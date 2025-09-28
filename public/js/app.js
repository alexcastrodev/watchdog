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
                  <div class="col-md-6">
                      <small class="text-muted">File Size:</small>
                      <div class="fw-bold">${data.size} bytes</div>
                  </div>
                  <div class="col-md-6">
                      <small class="text-muted">Last Modified:</small>
                      <div class="fw-bold">${data.last_modified}</div>
                  </div>
              </div>
          </div>
          
          <div class="mb-4">
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-list-ul"></i> Parsed Content
              </h6>
              <div class="bg-secondary bg-opacity-25 p-3 rounded">
                  ${formatYamlContent(data.content)}
              </div>
          </div>
          
          <div>
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-code"></i> Raw YAML
              </h6>
              <pre class="bg-dark text-light p-3 rounded" style="max-height: 300px; overflow-y: auto; font-size: 0.9rem;"><code>${escapeHtml(data.raw_content)}</code></pre>
          </div>
      `;
      
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

// Log file viewer function
async function viewLogFile(filename) {
  const modal = new bootstrap.Modal(document.getElementById('logModal'));
  const content = document.getElementById('logContent');
  const modalTitle = document.getElementById('logModalLabel');
  const downloadBtn = document.getElementById('downloadLogBtn');
  
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
                      <div class="fw-bold">${formatFileSize(data.size)}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Lines:</small>
                      <div class="fw-bold">${data.lines_count}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Last Modified:</small>
                      <div class="fw-bold">${data.last_modified}</div>
                  </div>
                  <div class="col-md-3">
                      <small class="text-muted">Status:</small>
                      <div class="fw-bold ${data.truncated ? 'text-warning' : 'text-success'}">
                          ${data.truncated ? 'Truncated (last 1000 lines)' : 'Complete'}
                      </div>
                  </div>
              </div>
          </div>
          
          <div>
              <h6 class="border-bottom pb-2 mb-3">
                  <i class="bi bi-terminal"></i> Log Content
              </h6>
              <pre class="bg-dark text-light p-3 rounded" style="max-height: 500px; overflow-y: auto; font-size: 0.85rem; white-space: pre-wrap; word-wrap: break-word;"><code>${escapeHtml(data.content)}</code></pre>
          </div>
      `;
      
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
      
  } catch (error) {
      content.innerHTML = `
          <div class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle"></i>
              Error loading log file: ${error.message}
          </div>
      `;
  }
}

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