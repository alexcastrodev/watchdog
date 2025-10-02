require 'json'
require_relative 'job'
require_relative 'app'
require 'redis'
require 'concurrent-ruby'

redis_task = Concurrent::Promise.execute do
  redis = Redis.new(host: "127.0.0.1", port: 9001)

  redis.subscribe('watchdog') do |on|
    on.message do |channel, msg|
      File.write("tmp/redis.log", "[#{Time.now.strftime("%Y-%m-%d %H:%M:%S")}] #{msg}\n", mode: "a")
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

job_checker = Concurrent::TimerTask.new(execution_interval: 30) do
  jobs_dir = File.join(__dir__, 'jobs')
  
  if Dir.exist?(jobs_dir)
    jobs = Dir.entries(jobs_dir).select { |f| f.end_with?('.yml') }
    puts "Found #{jobs.size} job(s)."

    jobs.each do |job_file|
      loaded_job = YAML.load_file(File.join(jobs_dir, job_file))
      job = Job.load(loaded_job)
      # This will kill jobs that are not executing but have a PID
      # Maybe caused by a crash or unexpected shutdown
      puts "Checking job: #{job.name}, PID: #{job.pid}, executing: #{job.executing?}"
      job.kill if !job.executing?
    end
  else
    puts "No jobs directory found."
  end
end

# Job
job_checker.execute

App.run!