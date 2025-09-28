require 'listen'
require 'yaml'
require 'fileutils'

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
      unless Dir.exist?(dir)
        puts "Directory #{dir} does not exist. Skipping job."
        return
      end

      @job.path = "#{File.expand_path(File.dirname(__FILE__))}/logs/#{@job.name}-#{Time.now.strftime("%Y%m%d%H%M%S")}"
      cmd = "cd #{dir} && ./build.sh >> #{@job.path}.log"

      @pid = spawn_with_callback(cmd, lambda do |pid, success, output|
        @job.status = success ? Job::STATUS[:done] : Job::STATUS[:error]
        @job.log = "#{@job.path}.log"
        @job.pid = nil
        @job.save

        FileUtils.mv(@file, "#{@job.path}.yml")
      end)

      @job.status = Job::STATUS[:running]
      @job.pid = @pid
      @job.save
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

  class Listener
    @listener = Listen.to("./jobs") do |modified, added, removed|
      added.each do |file|
        Jobs.new(file)
      end
    end

    def self.start
      @listener.start
    end
  end

  class Job
    attr_accessor :name, :status, :log, :pid, :path

    STATUS = {
      pending: "pending",
      running: "running",
      done: "done",
      error: "error",
      killed: "killed"
    }

    def save
      File.write(flowfile, YAML.dump({
        name: name,
        status: status,
        log_file: log,
        pid: pid,
        path: path
      }))
    end

    def kill
      Process.kill('TERM', pid.to_i) if executing?
      self.pid = nil
      self.status = "killed"
      save
    end

    def executing?
      !pid.nil? && !pid.to_s.empty?
    end

    def self.load(data)
      job = new
      job.name = data[:name]
      job.status = data[:status]
      job.log = data[:log_file]
      job.pid = data[:pid]
      job.path = data[:path]
      job
    end

    private

    def flowfile
      "#{File.expand_path(File.dirname(__FILE__))}/jobs/#{name}.yml"
    end
  end
end

Orchestrator::Listener.start
