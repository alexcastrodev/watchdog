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
      killed: "killed",
      done_with_error: "done_with_error"
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

    def create_job
      if File.exist?(flowfile)
        job = Job.load(YAML.load_file(flowfile))
        job.kill
      end

      save
    end

    def kill
      begin
        Process.kill('TERM', pid.to_i) if executing?
      ensure
        self.pid = nil
        self.status = "killed"
        save
      end

      FileUtils.mv(flowfile, File.join(File.dirname(__FILE__), 'logs', "#{Time.now.strftime('%Y%m%d%H%M%S')}-#{name}.yml"))
    end

    def pid?
      !pid.nil? && !pid.to_s.empty?
    end

    def executing?
      return false unless pid && pid.to_i > 0

      begin
        Process.getpgid(pid.to_i)
        true
      rescue Errno::ESRCH
        false
      end
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