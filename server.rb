require 'sinatra'
require 'json'

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

post '/api/webhook/build' do
    request.body.rewind
    payload = JSON.parse(request.body.read) rescue {}
    
    halt 422, {'Content-Type' => 'application/json'}, { error: 'missing stack' }.to_json if !payload['stack']

    jobs_dir = File.join(__dir__, 'jobs')
    Dir.mkdir(jobs_dir) unless Dir.exist?(jobs_dir)

    stack_name = payload['stack']
    file_path = File.join(jobs_dir, "#{stack_name}")

    File.write(file_path, Time.now.utc.to_s)

    status 201
    { message: "Job file created for stack #{stack_name}" }.to_json
end

require_relative 'scheduler'
