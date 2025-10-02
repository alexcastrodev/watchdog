require 'yaml'
require 'fileutils'
require 'open3'
require_relative 'job'

module Orchestrator
  class Jobs
    def initialize(file)
      @job = Job.load(YAML.load_file(file))
      @file = file
      
      if @job.pid?
        @job.kill
        Jobs.new(@file)
      else
        process
      end
    end

    private

    def process
      dir = "#{ENV['PROJECTS_PATH']}/#{@job.name}"
      @job.path = "#{File.expand_path(File.dirname(__FILE__))}/logs/#{Time.now.strftime("%Y%m%d%H%M%S")}-#{@job.name}"
      @job.log = "#{@job.path}.log"
      @job.save

      debug("Start job #{@job.name} with path #{@job.path} and log #{@job.log}")

      if Dir.exist?(dir)
        cmd = "cd #{dir} && git pull && ./build.sh"
        spawn_process(cmd)
      else
        @job.status = Job::STATUS[:error]
        @job.save

        FileUtils.mv(@file, "#{@job.path}.yml")
        debug("Finished with error: Dir.exist?(dir) result is #{Dir.exist?(dir)} to file #{@file}")
      end
    end

    # ===================
    # Helpers
    # ===================
    def debug(content)
      File.write("tmp/development.log", "[#{Time.now.strftime("%Y-%m-%d %H:%M:%S")}] #{content}\n", mode: "a")
    end

    def spawn_process(cmd)
      Open3.popen2(cmd) do |stdin, stdout, status_thread|
        @job.pid = status_thread.pid
        @job.save
        
        stdout.each_line do |line|
          File.write(@job.log, line, mode: "a")
        end

        if status_thread.value.success?
          @job.status = Job::STATUS[:done]
        else
          @job.status = Job::STATUS[:done_with_error]
        end

        @job.pid = nil
        @job.save
        FileUtils.mv(@file, "#{@job.path}.yml")
      end

      @job.status = Job::STATUS[:running]
      @job.save
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
