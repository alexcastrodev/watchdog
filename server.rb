require 'sinatra'
require 'json'
require_relative 'job'

set :views, File.dirname(__FILE__) + '/views'
set :public_folder, File.dirname(__FILE__) + '/public'

helpers do
  def truncate_text(text, length = 50)
    return text if text.length <= length
    text[0, length] + '...'
  end
end

require_relative 'helpers/data_helpers'
include DataHelpers

# body:
## stack: remapi, feed
get '/' do
    @stacks = build_stacks_data
    @job_files = fetch_job_files
    @logs_yaml_files = fetch_logs_yaml_files
    erb :index
end

# API endpoint to get YAML file details
get '/api/yaml/:source/:filename' do
    content_type :json
    get_yaml_file_details(params[:source], params[:filename])
end

# API endpoint to get job file content
get '/api/job/:filename' do
    content_type :json
    get_job_file_content(params[:filename])
end

# API endpoint to get log file content
get '/api/log/:filename' do
    content_type :json
    get_log_file_content(params[:filename])
end

# Server-Sent Events endpoint for tail -f functionality for job logs
get '/api/log/:filename/tail' do
    content_type 'text/event-stream'
    cache_control :no_cache
    headers 'Connection' => 'keep-alive',
            'Access-Control-Allow-Origin' => '*'
    
    filename = params[:filename]
    logs_dir = File.join(settings.root, 'logs')
    log_file = File.join(logs_dir, "#{filename}.log")
    
    halt 404, "data: {\"error\": \"Log file not found\"}\n\n" unless File.exist?(log_file)
    
    stream :keep_open do |out|
      begin
        # Get initial file size and position
        initial_size = File.size(log_file)
        position = [initial_size - 5000, 0].max # Start from last 5KB or beginning
        
        File.open(log_file, 'r') do |file|
          file.seek(position)
          initial_content = file.read
          data = {
            type: 'initial',
            content: initial_content,
            size: File.size(log_file),
            position: file.pos
          }
          position = file.pos
          out << "data: #{data.to_json}\n\n"
          
          # Keep checking for new content
          loop do
            sleep 0.5 # Check every 500ms
            
            unless File.exist?(log_file)
              error_data = { error: "Log file no longer exists" }
              out << "data: #{error_data.to_json}\n\n"
              break
            end
            
            current_size = File.size(log_file)
            if current_size > position
              file.seek(position)
              new_content = file.read
              if new_content && !new_content.empty?
                position = file.pos
                update_data = {
                  type: 'update',
                  content: new_content,
                  size: current_size,
                  position: position
                }
                out << "data: #{update_data.to_json}\n\n"
              end
            end
          end
        end
      rescue => e
        error_data = { error: "Error reading log file: #{e.message}" }
        out << "data: #{error_data.to_json}\n\n"
      end
    end
end

# Server-Sent Events endpoint for tail -f functionality for job files
get '/api/job/:filename/tail' do
    content_type 'text/event-stream'
    cache_control :no_cache
    headers 'Connection' => 'keep-alive',
            'Access-Control-Allow-Origin' => '*'
    
    filename = params[:filename]
    jobs_dir = File.join(settings.root, 'jobs')
    job_file = File.join(jobs_dir, "#{filename}.yml")
    
    halt 404, "data: {\"error\": \"Job file not found\"}\n\n" unless File.exist?(job_file)
    
    stream :keep_open do |out|
      begin
        # Get initial file stats and content
        initial_size = File.size(job_file)
        initial_mtime = File.mtime(job_file)
        
        initial_content = File.read(job_file)
        data = {
          type: 'initial',
          content: initial_content,
          size: initial_size,
          last_modified: initial_mtime.strftime('%Y-%m-%d %H:%M:%S')
        }
        out << "data: #{data.to_json}\n\n"
        
        last_mtime = initial_mtime
        
        # Keep checking for file changes
        loop do
          sleep 0.5 # Check every 500ms
          
          unless File.exist?(job_file)
            error_data = { error: "Job file no longer exists" }
            out << "data: #{error_data.to_json}\n\n"
            break
          end
          
          current_mtime = File.mtime(job_file)
          current_size = File.size(job_file)
          
          # Check if file was modified
          if current_mtime > last_mtime
            new_content = File.read(job_file)
            last_mtime = current_mtime
            
            update_data = {
              type: 'update',
              content: new_content,
              size: current_size,
              last_modified: current_mtime.strftime('%Y-%m-%d %H:%M:%S')
            }
            out << "data: #{update_data.to_json}\n\n"
          end
        end
      rescue => e
        error_data = { error: "Error reading job file: #{e.message}" }
        out << "data: #{error_data.to_json}\n\n"
      end
    end
end

post '/api/webhook/build' do
    request.body.rewind
    payload = JSON.parse(request.body.read) rescue {}
    
    halt 422, {'Content-Type' => 'application/json'}, { error: 'missing stack' }.to_json if !payload['stack']

    jobs_dir = File.join(__dir__, 'jobs')
    Dir.mkdir(jobs_dir) unless Dir.exist?(jobs_dir)

    stack_name = payload['stack']
    file_path = File.join(jobs_dir, "#{stack_name}")

    @job = Job.new(name: stack_name)
    @job.save

    status 201
    { message: "Job file created for stack #{stack_name}" }.to_json
end

require_relative 'scheduler'
