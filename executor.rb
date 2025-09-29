require 'yaml'
require 'fileutils'
require_relative 'job'

module Orchestrator
  class Jobs
    def initialize(file)
      @job = Job.load(YAML.load_file(file))
      @file = file
      
      if @job.executing?
        @job.kill
        Jobs.new(@file)
      else
        process
      end
    end

    private

    def process
      dir = "#{ENV['PROJECTS_PATH']}/#{@job.name}"
      @job.path = "#{File.expand_path(File.dirname(__FILE__))}/logs/#{@job.name}-#{Time.now.strftime("%Y%m%d%H%M%S")}"
      @job.log = "#{@job.path}.log"
      @job.save

      if Dir.exist?(dir)
        cmd = "cd #{dir} && git pull && ./build.sh >> #{@job.path}.log"
  
        @pid = spawn_with_callback(cmd, lambda do |pid, success, output|
          @job.status = success ? Job::STATUS[:done] : Job::STATUS[:done_with_error]
          @job.pid = nil
          @job.save
  
          FileUtils.mv(@file, "#{@job.path}.yml")
        end)
  
        @job.status = Job::STATUS[:running]
        @job.pid = @pid
        @job.save
      else
        @job.status = Job::STATUS[:error]
        @job.save

        File.write(@job.path + ".log", "Directory #{dir} does not exist.\n", mode: "a")
        FileUtils.mv(@file, "#{@job.path}.yml")
      end
    end

    # ===================
    # Helpers
    # ===================
    def spawn_with_callback(cmd, callback)
      r, w = IO.pipe

      pid = Process.spawn(cmd, out: w, err: w)
      w.close

      Thread.new do
        output = r.read
        _, status = Process.wait2(pid)
        success = status.success?

        callback.call(pid, success, output) if callback
      ensure
        r.close
      end

      pid
    end
  end
end

# Check if is not required
if __FILE__ == $0
  file = ARGV[0]
  if file.nil? || !File.exist?(file)
    puts "Usage: ruby #{__FILE__} <job_file.yml>"
    exit 1
  end

  Orchestrator::Jobs.new(file)
end
