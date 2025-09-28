require 'yaml'

module DataHelpers
  # Build stacks data from logs directory
  def build_stacks_data
    logs_dir = File.join(settings.root, 'logs')
    entries = build_log_entries(logs_dir)
    
    entries.group_by { |e| e[:name].split('-').first }
           .transform_values { |items| items.sort_by { |item| item[:timestamp] }.reverse }
           .map { |stack, items| { stack => items } }
  end

  # Process log entries from YAML files
  def build_log_entries(logs_dir)
    Dir.glob(File.join(logs_dir, '*.yml')).map do |yml_file|
      name = File.basename(yml_file, '.yml')
      log_file = File.join(logs_dir, "#{name}.log")
      properties = File.exist?(yml_file) ? YAML.load_file(yml_file) : {}
      
      # Extract timestamp from filename for sorting (format: stack-YYYYMMDDHHMMSS)
      timestamp_match = name.match(/-(\d{14})$/)
      timestamp = timestamp_match ? timestamp_match[1] : '0'
      
      {
        name: name,
        status: properties[:status],
        properties: properties,
        log: File.exist?(log_file) ? log_file : nil,
        yml_file: yml_file,
        timestamp: timestamp
      }
    end.sort_by { |entry| entry[:timestamp] }.reverse # Most recent first
  end

  # Fetch job files from jobs directory
  def fetch_job_files
    jobs_dir = File.join(settings.root, 'jobs')
    Dir.mkdir(jobs_dir) unless Dir.exist?(jobs_dir)
    
    Dir.glob(File.join(jobs_dir, '*.yml')).map do |yml_file|
      build_file_info(yml_file)
    end.sort_by { |f| f[:last_modified] }.reverse
  end

  # Fetch YAML files from logs directory
  def fetch_logs_yaml_files
    logs_dir = File.join(settings.root, 'logs')
    
    Dir.glob(File.join(logs_dir, '*.yml')).map do |yml_file|
      file_info = build_file_info(yml_file)
      
      # Extract timestamp from filename for sorting (format: stack-YYYYMMDDHHMMSS)
      name = File.basename(yml_file, '.yml')
      timestamp_match = name.match(/-(\d{14})$/)
      file_info[:timestamp] = timestamp_match ? timestamp_match[1] : '0'
      
      file_info
    end.sort_by { |f| f[:timestamp] }.reverse # Most recent first
  end

  # Build file information hash
  def build_file_info(yml_file)
    name = File.basename(yml_file, '.yml')
    content = File.exist?(yml_file) ? YAML.load_file(yml_file) : {}
    
    {
      name: name,
      file_path: yml_file,
      content: content,
      last_modified: File.mtime(yml_file),
      size: File.size(yml_file)
    }
  end

  # Get YAML file details for API
  def get_yaml_file_details(source, filename)
    # Determine source directory
    source_dir = case source
                 when 'jobs'
                   File.join(settings.root, 'jobs')
                 when 'logs'
                   File.join(settings.root, 'logs')
                 else
                   halt 400, { error: 'Invalid source' }.to_json
                 end

    yml_file = File.join(source_dir, "#{filename}.yml")
    halt 404, { error: 'File not found' }.to_json unless File.exist?(yml_file)

    begin
      content = YAML.load_file(yml_file)
      raw_content = File.read(yml_file)

      {
        name: filename,
        content: content,
        raw_content: raw_content,
        last_modified: File.mtime(yml_file).strftime('%Y-%m-%d %H:%M:%S'),
        size: File.size(yml_file),
        file_path: yml_file
      }.to_json
    rescue => e
      halt 500, { error: "Error reading file: #{e.message}" }.to_json
    end
  end

  # Get log file content for API
  def get_log_file_content(filename)
    logs_dir = File.join(settings.root, 'logs')
    log_file = File.join(logs_dir, "#{filename}.log")

    halt 404, { error: 'Log file not found' }.to_json unless File.exist?(log_file)

    begin
      # Read log file with size limit for performance
      content = File.read(log_file)
      lines = content.lines
      
      # If file is too large, show last 1000 lines
      if lines.length > 1000
        content = lines.last(1000).join
        truncated = true
      else
        truncated = false
      end

      {
        name: filename,
        content: content,
        last_modified: File.mtime(log_file).strftime('%Y-%m-%d %H:%M:%S'),
        size: File.size(log_file),
        lines_count: lines.length,
        truncated: truncated,
        file_path: log_file
      }.to_json
    rescue => e
      halt 500, { error: "Error reading log file: #{e.message}" }.to_json
    end
  end
end