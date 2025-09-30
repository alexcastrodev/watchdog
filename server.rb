require 'json'
require_relative 'job'
require_relative 'app'
require 'redis'

Thread.new do
  redis = Redis.new(host: "127.0.0.1", port: 9001)

  redis.subscribe('watchdog') do |on|
    on.message do |channel, msg|
      # msg => {"stack":"watchdog-webhook"}
      payload = JSON.parse(msg)
      jobs_dir = File.join(__dir__, 'jobs')
      Dir.mkdir(jobs_dir) unless Dir.exist?(jobs_dir)

      stack_name = payload['stack']
      file_path = File.join(jobs_dir, "#{stack_name}")

      @job = Job.new(name: stack_name).create_job
      
      executor_path = File.join(File.dirname(__FILE__), 'executor.rb')
      job_file_path = File.join(File.dirname(__FILE__), 'jobs', "#{payload["stack"]}.yml")
      spawn("ruby", executor_path, job_file_path)
    end
  end
end

App.run!