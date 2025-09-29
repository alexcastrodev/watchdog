// Tab persistence
document.addEventListener('DOMContentLoaded', function() {
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
        const tabTrigger = document.querySelector(`[data-bs-target="#${activeTab}"]`);
        if (tabTrigger) {
            new bootstrap.Tab(tabTrigger).show();
        }
    }
});

// Save active tab
document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function(tabTrigger) {
    tabTrigger.addEventListener('shown.bs.tab', function(event) {
        const targetId = event.target.getAttribute('data-bs-target').substring(1);
        localStorage.setItem('activeTab', targetId);
    });
});

// Add loading animation to refresh button
document.querySelector('.refresh-btn').addEventListener('click', function() {
    this.classList.add('loading');
});

// YAML file viewer function
async function viewYamlFile(source, filename) {
  const modal = new bootstrap.Modal(document.getElementById('yamlModal'));
  const content = document.getElementById('yamlContent');
  const modalTitle = document.getElementById('yamlModalLabel');
  const downloadBtn = document.getElementById('downloadYamlBtn');
  const tailBtn = document.getElementById('tailYamlBtn');
  const stopTailBtn = document.getElementById('stopTailYamlBtn');
  
  // Store current filename and source for tail functionality
  currentTailYamlFilename = filename;
  currentTailYamlSource = source;
  
  // Show loading state
  content.innerHTML = `
      <div class="text-center p-4">
          <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
          </div>
      </div>
  `;
  
  modal.show();
  
  try {
      const response = await fetch(`/api/yaml/${source}/${filename}`);
      if (!response.ok) throw new Error('Failed to load file');
      
      const data = await response.json();
      
      // Update modal title
      const sourceLabel = source === 'jobs' ? 'Jobs' : 'Logs';
      modalTitle.innerHTML = `<i class="bi bi-file-earmark-code text-danger me-2"></i>${data.name}.yml <small class="text-muted">(${sourceLabel})</small>`;
      
      // Create content HTML
      content.innerHTML = `
          <div class="mb-4">
              <div class="row g-3 mb-3">
                  <div class="col-md-4">
                      <small class="text-muted">File Size:</small>
                      <div class="fw-bold" id="yamlFileSize">${data.size} bytes</div>
                  </div>
                  <div class="col-md-4">
                      <small class="text-muted">Last Modified:</small>
                      <div class="fw-bold" id="yamlLastModified">${data.last_modified}</div>
                  </div>
                  <div class="col-md-4">
                      <small class="text-muted">Status:</small>
                      <div class="fw-bold text-light" id="yamlStatus">Static View</div>
                  </div>
              </div>
          </div>
          
          <div class="mb-4" id="jobLogSection" style="display: none;">
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-terminal"></i> Job Log Content
                  <span id="tailYamlStatus" class="badge bg-secondary ms-2" style="display: none;">
                      <i class="bi bi-circle-fill text-success blink"></i> Live Tail
                  </span>
              </h6>
              <pre class="bg-dark text-light p-3 rounded" id="jobLogContent" style="max-height: 400px; overflow-y: auto; font-size: 0.85rem; white-space: pre-wrap; word-wrap: break-word;"><code id="jobLogCode"></code></pre>
          </div>
          
          <div class="mb-4">
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-list-ul"></i> Parsed Content
              </h6>
              <div class="bg-secondary bg-opacity-25 p-3 rounded" id="yamlParsedContent">
                  ${formatYamlContent(data.content)}
              </div>
          </div>
          
          <div>
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-code"></i> Raw YAML
              </h6>
              <pre class="bg-dark text-light p-3 rounded" id="yamlContentPre" style="max-height: 300px; overflow-y: auto; font-size: 0.9rem;"><code id="yamlContentCode">${escapeHtml(data.raw_content)}</code></pre>
          </div>
      `;
      
      // Store reference to yaml element for tail (will be updated if job log tail is used)
      tailYamlElement = document.getElementById('yamlContentCode');
      
      // Show tail button only for jobs (not logs)
      if (source === 'jobs') {
          tailBtn.style.display = 'inline-block';
          stopTailBtn.style.display = 'none';
          
          // Set up tail button
          tailBtn.onclick = () => startTailYaml();
          stopTailBtn.onclick = () => stopTailYaml();
      } else {
          tailBtn.style.display = 'none';
          stopTailBtn.style.display = 'none';
      }
      
      // Set up download button
      downloadBtn.onclick = () => {
          const blob = new Blob([data.raw_content], { type: 'text/yaml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${data.name}.yml`;
          a.click();
          URL.revokeObjectURL(url);
      };
      
  } catch (error) {
      content.innerHTML = `
          <div class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle"></i>
              Error loading file: ${error.message}
          </div>
      `;
  }
}

// YAML file viewer with tail started automatically
async function viewYamlFileWithTail(source, filename) {
  await viewYamlFile(source, filename);
  // Start tail after a short delay to ensure modal is fully loaded
  if (source === 'jobs') {
    setTimeout(() => {
      startTailYaml();
    }, 500);
  }
}

// Global variables for tail functionality
let tailPollingInterval = null;
let currentTailFilename = null;
let tailLogElement = null;

// Global variables for YAML tail functionality
let tailYamlPollingInterval = null;
let currentTailYamlFilename = null;
let currentTailYamlSource = null;
let tailYamlElement = null;
let lastLogSize = 0;
let lastLogModified = null;

// Log file viewer function
async function viewLogFile(filename) {
  const modal = new bootstrap.Modal(document.getElementById('logModal'));
  const content = document.getElementById('logContent');
  const modalTitle = document.getElementById('logModalLabel');
  const downloadBtn = document.getElementById('downloadLogBtn');
  const tailBtn = document.getElementById('tailLogBtn');
  const stopTailBtn = document.getElementById('stopTailBtn');
  
  // Store current filename for tail functionality
  currentTailFilename = filename;
  
  // Show loading state
  content.innerHTML = `
      <div class="text-center p-4">
          <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
          </div>
      </div>
  `;
  
  modal.show();
  
  try {
      const response = await fetch(`/api/log/${filename}`);
      if (!response.ok) throw new Error('Failed to load log file');
      
      const data = await response.json();
      
      // Update modal title
      modalTitle.innerHTML = `<i class="bi bi-file-earmark-text text-danger me-2"></i>${data.name}.log`;
      
      // Create content HTML
      content.innerHTML = `
          <div class="mb-4">
              <div class="row g-3 mb-3">
                  <div class="col-md-3">
                      <small class="text-muted">File Size:</small>
                      <div class="fw-bold" id="logFileSize">${formatFileSize(data.size)}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Lines:</small>
                      <div class="fw-bold" id="logLinesCount">${data.lines_count}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Last Modified:</small>
                      <div class="fw-bold" id="logLastModified">${data.last_modified}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Status:</small>
                      <div class="fw-bold ${data.truncated ? 'text-warning' : 'text-success'}" id="logStatus">
                          ${data.truncated ? 'Truncated (last 1000 lines)' : 'Complete'}
                      </div>
                  </div>
              </div>
          </div>
          
          <div>
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-terminal"></i> Log Content 
                  <span id="tailStatus" class="badge bg-secondary ms-2" style="display: none;">
                      <i class="bi bi-circle-fill text-success blink"></i> Live Tail
                  </span>
              </h6>
              <pre class="bg-dark text-light p-3 rounded" id="logContentPre" style="max-height: 500px; overflow-y: auto; font-size: 0.85rem; white-space: pre-wrap; word-wrap: break-word;"><code id="logContentCode">${escapeHtml(data.content)}</code></pre>
          </div>
      `;
      
      // Store reference to log element
      tailLogElement = document.getElementById('logContentCode');
      
      // Show tail button
      tailBtn.style.display = 'inline-block';
      stopTailBtn.style.display = 'none';
      
      // Set up download button
      downloadBtn.onclick = () => {
          const blob = new Blob([data.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${data.name}.log`;
          a.click();
          URL.revokeObjectURL(url);
      };
      
      // Set up tail button
      tailBtn.onclick = () => startTailLog();
      stopTailBtn.onclick = () => stopTailLog();
      
  } catch (error) {
      content.innerHTML = `
          <div class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle"></i>
              Error loading log file: ${error.message}
          </div>
      `;
  }
}

// Start tail -f functionality with polling
function startTailLog() {
  if (!currentTailFilename || tailPollingInterval) return;
  
  const tailBtn = document.getElementById('tailLogBtn');
  const stopTailBtn = document.getElementById('stopTailBtn');
  const tailStatus = document.getElementById('tailStatus');
  const logContentPre = document.getElementById('logContentPre');
  
  // Update UI
  tailBtn.style.display = 'none';
  stopTailBtn.style.display = 'inline-block';
  tailStatus.style.display = 'inline-block';
  logContentPre.classList.add('tailing');
  
  // Reset tracking variables
  lastLogSize = 0;
  lastLogModified = null;
  
  // Function to fetch log content
  const fetchLogContent = async () => {
    try {
      const response = await fetch(`/api/log/${currentTailFilename}/tail`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error('Tail error:', data.error);
        showTailError(data.error);
        stopTailLog();
        return;
      }
      
      // Check if content has changed
      if (data.size !== lastLogSize || data.last_modified !== lastLogModified) {
        tailLogElement.textContent = data.content;
        updateLogStats(data.size, data.content);
        
        // Auto-scroll to bottom
        logContentPre.scrollTop = logContentPre.scrollHeight;
        
        // Flash effect for new content (only if not first load)
        if (lastLogSize > 0) {
          flashNewContent();
        }
        
        lastLogSize = data.size;
        lastLogModified = data.last_modified;
      }
      
    } catch (error) {
      console.error('Error fetching log content:', error);
      showTailError(`Error fetching content: ${error.message}`);
    }
  };
  
  // Initial load
  fetchLogContent();
  
  // Set up polling
  tailPollingInterval = setInterval(fetchLogContent, 1000); // Poll every 1 second
}

// Show error message in tail status
function showTailError(message) {
  const tailStatus = document.getElementById('tailStatus');
  if (tailStatus) {
    tailStatus.innerHTML = `<i class="bi bi-exclamation-triangle text-warning"></i> ${message}`;
    tailStatus.className = 'badge bg-warning ms-2';
  }
}

// Flash effect for new content
function flashNewContent() {
  const logContentPre = document.getElementById('logContentPre');
  if (logContentPre) {
    logContentPre.style.borderLeftColor = '#28a745';
    setTimeout(() => {
      logContentPre.style.borderLeftColor = '';
    }, 200);
  }
}

// Stop tail -f functionality
function stopTailLog() {
  if (tailPollingInterval) {
    clearInterval(tailPollingInterval);
    tailPollingInterval = null;
  }
  
  const tailBtn = document.getElementById('tailLogBtn');
  const stopTailBtn = document.getElementById('stopTailBtn');
  const tailStatus = document.getElementById('tailStatus');
  const logContentPre = document.getElementById('logContentPre');
  
  // Update UI
  tailBtn.style.display = 'inline-block';
  stopTailBtn.style.display = 'none';
  tailStatus.style.display = 'none';
  
  if (logContentPre) {
    logContentPre.classList.remove('tailing');
  }
  
  // Reset status to static
  const statusElement = document.getElementById('logStatus');
  if (statusElement) {
    statusElement.innerHTML = 'Static View';
    statusElement.className = 'fw-bold text-light';
  }
  
  // Reset tracking variables
  lastLogSize = 0;
  lastLogModified = null;
}

// Update log statistics during tail
function updateLogStats(size, newContent) {
  const fileSizeElement = document.getElementById('logFileSize');
  const statusElement = document.getElementById('logStatus');
  
  if (fileSizeElement) {
    fileSizeElement.textContent = formatFileSize(size);
  }
  
  if (statusElement) {
    statusElement.innerHTML = '<i class="bi bi-circle-fill text-success blink"></i> Live Updating';
    statusElement.className = 'fw-bold text-success';
  }
}

// Start tail -f functionality for YAML files with polling
function startTailYaml() {
  if (!currentTailYamlFilename || !currentTailYamlSource || tailYamlPollingInterval) return;
  
  const tailBtn = document.getElementById('tailYamlBtn');
  const stopTailBtn = document.getElementById('stopTailYamlBtn');
  const tailStatus = document.getElementById('tailYamlStatus');
  const yamlContentPre = document.getElementById('yamlContentPre');
  
  // Update UI
  tailBtn.style.display = 'none';
  stopTailBtn.style.display = 'inline-block';
  tailStatus.style.display = 'inline-block';
  yamlContentPre.classList.add('tailing');
  
  // Only jobs support tail for now
  if (currentTailYamlSource !== 'jobs') {
    showTailYamlError('Tail functionality is only available for job files');
    stopTailYaml();
    return;
  }
  
  // Reset tracking variables
  lastLogSize = 0;
  lastLogModified = null;
  
  // Function to fetch job log content
  const fetchJobLogContent = async () => {
    try {
      const response = await fetch(`/api/job/${currentTailYamlFilename}/tail`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error('Job tail error:', data.error);
        showTailYamlError(data.error);
        stopTailYaml();
        return;
      }
      
      // Check if content has changed
      if (data.size !== lastLogSize || data.last_modified !== lastLogModified) {
        // Clear existing content and show job log content (first time only)
        if (lastLogSize === 0) {
          clearYamlContentForLogTail();
        }
        
        tailYamlElement.textContent = data.content;
        updateJobLogStats(data.size, data.job_name, data.log_file);
        
        // Auto-scroll to bottom of job log section
        const jobLogContent = document.getElementById('jobLogContent');
        if (jobLogContent) {
          jobLogContent.scrollTop = jobLogContent.scrollHeight;
        }
        
        // Flash effect for changes (only if not first load)
        if (lastLogSize > 0) {
          flashJobLogContent();
        }
        
        lastLogSize = data.size;
        lastLogModified = data.last_modified;
      }
      
    } catch (error) {
      console.error('Error fetching job log content:', error);
      showTailYamlError(`Error fetching content: ${error.message}`);
    }
  };
  
  // Initial load
  fetchJobLogContent();
  
  // Set up polling
  tailYamlPollingInterval = setInterval(fetchJobLogContent, 1000); // Poll every 1 second
}

// Stop tail -f functionality for YAML files
function stopTailYaml() {
  if (tailYamlPollingInterval) {
    clearInterval(tailYamlPollingInterval);
    tailYamlPollingInterval = null;
  }
  
  const tailBtn = document.getElementById('tailYamlBtn');
  const stopTailBtn = document.getElementById('stopTailYamlBtn');
  const tailStatus = document.getElementById('tailYamlStatus');
  const yamlContentPre = document.getElementById('yamlContentPre');
  const jobLogSection = document.getElementById('jobLogSection');
  
  // Update UI
  tailBtn.style.display = 'inline-block';
  stopTailBtn.style.display = 'none';
  tailStatus.style.display = 'none';
  
  // Hide job log section when stopping tail
  if (jobLogSection) {
    jobLogSection.style.display = 'none';
  }
  
  if (yamlContentPre) {
    yamlContentPre.classList.remove('tailing');
  }
  
  // Restore original tailYamlElement reference
  tailYamlElement = document.getElementById('yamlContentCode');
  
  // Reset status to static
  const statusElement = document.getElementById('yamlStatus');
  if (statusElement) {
    statusElement.innerHTML = 'Static View';
    statusElement.className = 'fw-bold text-light';
  }
  
  // Reset tracking variables
  lastLogSize = 0;
  lastLogModified = null;
}

// Update YAML statistics during tail
function updateYamlStats(size, lastModified) {
  const fileSizeElement = document.getElementById('yamlFileSize');
  const lastModifiedElement = document.getElementById('yamlLastModified');
  const statusElement = document.getElementById('yamlStatus');
  
  if (fileSizeElement) {
    fileSizeElement.textContent = `${size} bytes`;
  }
  
  if (lastModifiedElement) {
    lastModifiedElement.textContent = lastModified;
  }
  
  if (statusElement) {
    statusElement.innerHTML = '<i class="bi bi-circle-fill text-success blink"></i> Live Updating';
    statusElement.className = 'fw-bold text-success';
  }
}

// Update parsed content during YAML tail
function updateYamlParsedContent(parsedContent) {
  try {
    const parsedContentDiv = document.getElementById('yamlParsedContent');
    if (parsedContentDiv) {
      if (parsedContent && typeof parsedContent === 'object' && !parsedContent.error) {
        parsedContentDiv.innerHTML = formatYamlContent(parsedContent);
      } else if (parsedContent && parsedContent.error) {
        parsedContentDiv.innerHTML = `
          <div class="alert alert-warning" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            ${parsedContent.error}
          </div>
        `;
      } else {
        parsedContentDiv.innerHTML = `
          <div class="text-info">
            <i class="bi bi-info-circle me-2"></i>
            Content updated at ${new Date().toLocaleTimeString()}
            <br>
            <small class="text-muted">No valid YAML content to display</small>
          </div>
        `;
      }
    }
  } catch (e) {
    console.error('Error updating parsed content:', e);
    const parsedContentDiv = document.getElementById('yamlParsedContent');
    if (parsedContentDiv) {
      parsedContentDiv.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error displaying content: ${e.message}
        </div>
      `;
    }
  }
}

// Clear YAML content area and prepare for log tail display
function clearYamlContentForLogTail() {
  const jobLogSection = document.getElementById('jobLogSection');
  const jobLogCode = document.getElementById('jobLogCode');
  
  if (jobLogSection) {
    jobLogSection.style.display = 'block';
  }
  
  if (jobLogCode) {
    jobLogCode.textContent = '';
  }
  
  // Update the reference to point to job log element
  tailYamlElement = jobLogCode;
}

// Update statistics for job log tail
function updateJobLogStats(size, jobName, logFile) {
  const fileSizeElement = document.getElementById('yamlFileSize');
  const lastModifiedElement = document.getElementById('yamlLastModified');
  const statusElement = document.getElementById('yamlStatus');
  
  if (fileSizeElement) {
    fileSizeElement.textContent = formatFileSize(size);
  }
  
  if (lastModifiedElement) {
    lastModifiedElement.innerHTML = `
      <div>Job: <strong>${jobName}</strong></div>
      <div class="text-muted" style="font-size: 0.8rem;">${logFile}</div>
    `;
  }
  
  if (statusElement) {
    statusElement.innerHTML = '<i class="bi bi-circle-fill text-success blink"></i> Live Log Tail';
    statusElement.className = 'fw-bold text-success';
  }
}

// Show error message in YAML tail status
function showTailYamlError(message) {
  const tailStatus = document.getElementById('tailYamlStatus');
  if (tailStatus) {
    tailStatus.innerHTML = `<i class="bi bi-exclamation-triangle text-warning"></i> ${message}`;
    tailStatus.className = 'badge bg-warning ms-2';
  }
}

// Flash effect for YAML content changes
function flashYamlContent() {
  const yamlContentPre = document.getElementById('yamlContentPre');
  if (yamlContentPre) {
    yamlContentPre.style.borderLeftColor = '#28a745';
    setTimeout(() => {
      yamlContentPre.style.borderLeftColor = '';
    }, 200);
  }
}

// Flash effect for job log content changes
function flashJobLogContent() {
  const jobLogContent = document.getElementById('jobLogContent');
  if (jobLogContent) {
    jobLogContent.style.borderLeftColor = '#28a745';
    setTimeout(() => {
      jobLogContent.style.borderLeftColor = '';
    }, 200);
  }
}

// Clean up when modals are closed
document.getElementById('logModal').addEventListener('hidden.bs.modal', function() {
  stopTailLog();
  currentTailFilename = null;
  tailLogElement = null;
});

document.getElementById('yamlModal').addEventListener('hidden.bs.modal', function() {
  stopTailYaml();
  currentTailYamlFilename = null;
  currentTailYamlSource = null;
  tailYamlElement = null;
});

// Helper functions
function formatYamlContent(content) {
  if (!content || typeof content !== 'object') {
      return '<div class="text-muted">No content available</div>';
  }
  
  let html = '';
  for (const [key, value] of Object.entries(content)) {
      html += `
          <div class="row py-2 border-bottom">
              <div class="col-4">
                  <span class="property-key fw-bold">${escapeHtml(key)}:</span>
              </div>
              <div class="col-8">
                  <span class="property-value path-text" style="word-break: break-all; font-size: 0.9rem;">
                      ${formatValue(value)}
                  </span>
              </div>
          </div>
      `;
  }
  return html;
}

function formatValue(value) {
  if (value === null) return '<em class="text-muted">null</em>';
  if (typeof value === 'boolean') return `<code class="text-info">${value}</code>`;
  if (typeof value === 'number') return `<code class="text-warning">${value}</code>`;
  if (typeof value === 'object') {
      if (Array.isArray(value)) {
          return `<code class="text-success">[Array with ${value.length} items]</code>`;
      }
      return `<code class="text-primary">{Object with ${Object.keys(value).length} keys}</code>`;
  }
  return `<code>${escapeHtml(String(value))}</code>`;
}

function formatValue(value) {
    if (value === null) return '<em class="text-muted">null</em>';
    if (typeof value === 'boolean') return `<code class="text-info">${value}</code>`;
    if (typeof value === 'number') return `<code class="text-warning">${value}</code>`;
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `<code class="text-success">[Array with ${value.length} items]</code>`;
        }
        return `<code class="text-primary">{Object with ${Object.keys(value).length} keys}</code>`;
    }
    return `<code class="text-light">${escapeHtml(String(value))}</code>`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}// Error handling
window.addEventListener('error', function(e) {
    console.error('Resource loading error:', e);
});