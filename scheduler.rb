require 'listen'

listener = Listen.to("./jobs") do |modified, added, removed|
  added.each do |file|
    executor_path = File.join(File.dirname(__FILE__), 'executor.rb')
    spawn("ruby", executor_path, file)
  end
end

listener.start