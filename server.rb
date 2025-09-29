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

# Páginas dedicadas para visualização
get '/yaml/:source/:filename' do
    @source = params[:source]
    @filename = params[:filename]
    
    begin
        @file_data = JSON.parse(get_yaml_file_details(params[:source], params[:filename]))
        erb :yaml_view
    rescue => e
        halt 404, erb(:not_found, locals: { error: "YAML file not found: #{e.message}" })
    end
end

get '/log/:filename' do
    @filename = params[:filename]
    
    begin
        @file_data = JSON.parse(get_log_file_content(params[:filename]))
        erb :log_view
    rescue => e
        halt 404, erb(:not_found, locals: { error: "Log file not found: #{e.message}" })
    end
end

get '/job/:filename' do
    @filename = params[:filename]
    
    begin
        @file_data = JSON.parse(get_job_file_content(params[:filename]))
        erb :job_view
    rescue => e
        halt 404, erb(:not_found, locals: { error: "Job file not found: #{e.message}" })
    end
end

# Rota para visualização rápida apenas de jobs ativos
get '/jobs' do
    @job_files = fetch_job_files
    erb :jobs_only
end

# Rota para visualização rápida apenas de logs
get '/logs' do
    @stacks = build_stacks_data
    erb :logs_only
end

# API endpoints simplificados (mantidos para funcionalidades específicas)
get '/api/yaml/:source/:filename' do
    content_type :json
    get_yaml_file_details(params[:source], params[:filename])
end

get '/api/job/:filename' do
    content_type :json
    get_job_file_content(params[:filename])
end

get '/api/log/:filename' do
    content_type :json
    get_log_file_content(params[:filename])
end

# Polling endpoint for log file content
get '/api/log/:filename/tail' do
    content_type :json
    
    filename = params[:filename]
    logs_dir = File.join(settings.root, 'logs')
    log_file = File.join(logs_dir, "#{filename}.log")
    
    halt 404, { error: "Log file not found" }.to_json unless File.exist?(log_file)
    
    begin
      content = File.read(log_file)
      
      {
        content: content,
        size: File.size(log_file),
        last_modified: File.mtime(log_file).strftime('%Y-%m-%d %H:%M:%S'),
        lines_count: content.lines.length
      }.to_json
    rescue => e
      halt 500, { error: "Error reading log file: #{e.message}" }.to_json
    end
end

# Polling endpoint for job log file content
get '/api/job/:filename/tail' do
    content_type :json
    
    filename = params[:filename]
    jobs_dir = File.join(settings.root, 'jobs')
    job_file = File.join(jobs_dir, "#{filename}.yml")
    
    halt 404, { error: "Job file not found" }.to_json unless File.exist?(job_file)
    
    # Parse job file to get log file path
    begin
      job_data = YAML.load_file(job_file)
      log_file_path = job_data[:log_file] || job_data['log_file']
      
      halt 404, { error: "No log file specified in job" }.to_json unless log_file_path
      
      # Handle both absolute and relative paths
      if File.absolute_path?(log_file_path)
        log_file = log_file_path
      else
        log_file = File.join(settings.root, 'logs', log_file_path)
      end
      
      halt 404, { error: "Log file not found: #{log_file}" }.to_json unless File.exist?(log_file)
      
    rescue => e
      halt 500, { error: "Error reading job file: #{e.message}" }.to_json
    end
    
    begin
      content = File.read(log_file)
      
      {
        content: content,
        size: File.size(log_file),
        last_modified: File.mtime(log_file).strftime('%Y-%m-%d %H:%M:%S'),
        lines_count: content.lines.length,
        job_name: filename,
        log_file: log_file
      }.to_json
    rescue => e
      halt 500, { error: "Error reading log file: #{e.message}" }.to_json
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

    @job = Job.new(name: stack_name).create_job

    status 201
    { message: "Job file created for stack #{stack_name}" }.to_json
end

require_relative 'scheduler'
