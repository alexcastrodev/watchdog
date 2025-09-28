require 'sinatra'

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
        log: File.exist?(log_file) ? log_file : nil
      }
    end

    stacks = entries.group_by { |e| e[:name].split('-').first }
                   .map { |stack, items| { stack => items } }

    @stacks = stacks
    erb :index
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

