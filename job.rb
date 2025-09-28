class Job
    attr_accessor :name, :status, :log, :pid, :path
  
    def initialize(name: '')
      @status = STATUS[:pending]
      @name = name
    end
  
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