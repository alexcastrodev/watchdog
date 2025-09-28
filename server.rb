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

# API endpoint to get log file content
get '/api/log/:filename' do
    content_type :json
    get_log_file_content(params[:filename])
end

# Server-Sent Events endpoint for tail -f functionality
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
