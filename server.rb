require 'sinatra'
require_relative 'routes/get_routes'

set :views, File.dirname(__FILE__) + '/views'
set :public_folder, File.dirname(__FILE__) + '/public'

helpers do
  def truncate_text(text, length = 50)
    return text if text.length <= length
    text[0, length] + '...'
  end
end

# Register GET routes from separate module
GetRoutes.register(self)

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
