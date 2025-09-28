require 'sinatra'

# body:
## stack: remapi, feed
get '/' do
    send_file File.join('index.html')
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
