require 'sinatra'

set :views, File.dirname(__FILE__) + '/views'

# body:
## stack: remapi, feed
get '/' do
    require 'yaml'
    logs_dir = File.join(__dir__, 'logs')
    entries = Dir.glob(File.join(logs_dir, '*.yml')).map do |yml_file|
        name = File.basename(yml_file, '.yml')
        stack = name.split('-').first
        log_file = File.join(logs_dir, "#{name}.log")
        properties = File.exist?(yml_file) ? YAML.load_file(yml_file) : {}
        {
            name: name,
            properties: properties,
            log: File.exist?(log_file) ? log_file : nil,
            yml_file: yml_file
        }
    end

    stacks = entries.group_by { |e| e[:name].split('-').first }
                                 .map { |stack, items| { stack => items } }

    # Get all YAML files for Jobs tab
    yaml_files = Dir.glob(File.join(logs_dir, '*.yml')).map do |yml_file|
        name = File.basename(yml_file, '.yml')
        content = File.exist?(yml_file) ? YAML.load_file(yml_file) : {}
        {
            name: name,
            file_path: yml_file,
            content: content,
            last_modified: File.mtime(yml_file),
            size: File.size(yml_file)
        }
    end.sort_by { |f| f[:last_modified] }.reverse

    @stacks = stacks
    @yaml_files = yaml_files
    erb :index
end

# API endpoint to get YAML file details
get '/api/yaml/:filename' do
    require 'yaml'
    content_type :json

    logs_dir = File.join(__dir__, 'logs')
    yml_file = File.join(logs_dir, "#{params[:filename]}.yml")

    halt 404, { error: 'File not found' }.to_json unless File.exist?(yml_file)

    begin
        content = YAML.load_file(yml_file)
        raw_content = File.read(yml_file)

        {
            name: params[:filename],
            content: content,
            raw_content: raw_content,
            last_modified: File.mtime(yml_file).strftime('%Y-%m-%d %H:%M:%S'),
            size: File.size(yml_file),
            file_path: yml_file
        }.to_json
    rescue => e
        halt 500, { error: "Error reading file: #{e.message}" }.to_json
    end
end

post '/webhook/build' do
    halt 422, {'Content-Type' => 'application/json'}, { error: 'missing stack' }.to_json if !params['stack']

    jobs_dir = File.join(__dir__, 'jobs')
    Dir.mkdir(jobs_dir) unless Dir.exist?(jobs_dir)

    stack_name = params['stack']
    file_path = File.join(jobs_dir, "#{stack_name}")

    File.write(file_path, Time.now.utc.to_s)

    status 201
    { message: "Job file created for stack #{stack_name}" }.to_json
end

require_relative 'scheduler'
