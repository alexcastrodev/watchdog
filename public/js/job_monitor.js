let tailInterval = null;
let lastLogSize = 0;
let filename = null;

function initJobMonitor(jobFilename) {
    filename = jobFilename;
}

function toggleAutoTail() {
    if (tailInterval) {
        stopTail();
    } else {
        startTail();
    }
}

function startTail() {
    const btn = document.getElementById('tailToggleBtn');
    const status = document.getElementById('monitoringStatus');
    const jobStatus = document.getElementById('jobStatus');
    
    btn.innerHTML = '<i class="bi bi-stop-circle me-1"></i>Stop Monitoring';
    btn.className = 'btn btn-outline-warning btn-sm me-2';
    status.innerHTML = '<span class="badge bg-success">Monitoring Active</span>';
    jobStatus.className = 'badge bg-warning text-dark fs-6';
    jobStatus.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Tailing';
    
    // Reset
    lastLogSize = 0;
    
    // Start polling
    tailInterval = setInterval(fetchLogContent, 2000);
    fetchLogContent();
}

function stopTail() {
    const btn = document.getElementById('tailToggleBtn');
    const status = document.getElementById('monitoringStatus');
    const jobStatus = document.getElementById('jobStatus');
    
    if (tailInterval) {
        clearInterval(tailInterval);
        tailInterval = null;
    }
    
    btn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Start Monitoring';
    btn.className = 'btn btn-outline-success btn-sm me-2';
    status.innerHTML = '<span class="badge bg-secondary">Stopped</span>';
    jobStatus.className = 'badge bg-success fs-6';
    jobStatus.textContent = 'Monitoring';
}

function fetchLogContent() {
    fetch(`/api/job/${filename}/tail`)
        .then(response => {
            if (!response.ok) {
                // Try to parse error response for better handling
                return response.json().then(errorData => {
                    if (response.status === 404 && errorData.status === 'completed') {
                        handleJobFinished(errorData.redirect_to);
                        return null;
                    }
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }).catch(parseError => {
                    // If can't parse JSON, handle as generic 404
                    if (response.status === 404) {
                        // If we have logged content, show concluded status
                        if (lastLogSize > 0) {
                            handleJobFinished();
                        } else {
                            // No previous log content, just show error
                            throw new Error(`HTTP ${response.status}`);
                        }
                        return null;
                    }
                    throw new Error(`HTTP ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data) return; // Skip if no data (job finished)
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Check if job status indicates completion
            if (data.status === 'done') {
                handleJobFinished();
                return;
            }
            
            // Update only if there are changes
            if (data.size > lastLogSize) {
                document.getElementById('logCode').textContent = data.content || 'No log content available';
                scrollToBottom();
                flashContent();
                lastLogSize = data.size;
            }
        })
        .catch(error => {
            console.error('Error fetching log:', error);
            if (!error.message.includes('Job has finished')) {
                document.getElementById('logCode').textContent = `Error: ${error.message}`;
            }
        });
}

function handleJobFinished(redirectUrl = null) {
    stopTail();
    
    const jobStatus = document.getElementById('jobStatus');
    const logCode = document.getElementById('logCode');
    const monitoringStatus = document.getElementById('monitoringStatus');
    
    jobStatus.className = 'badge bg-success fs-6';
    jobStatus.innerHTML = '<i class="bi bi-check-circle me-1"></i>Finished';
    
    monitoringStatus.innerHTML = '<span class="badge bg-info">Job Completed</span>';
    
    logCode.innerHTML = `
    <div class="text-center p-4">
        <i class="bi bi-check-circle-fill text-success display-4"></i>
        <h5 class="mt-3 mb-3 text-success">Job Execution Completed!</h5>
        <p class="text-light mb-4">The job has finished successfully. You can view the complete log file for detailed output.</p>
    </div>`;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function clearLog() {
    document.getElementById('logCode').textContent = '';
}

function scrollToBottom() {
    const element = document.getElementById('jobLogContent');
    element.scrollTop = element.scrollHeight;
}

function flashContent() {
    const element = document.getElementById('jobLogContent');
    element.style.backgroundColor = '#d1ecf1';
    setTimeout(() => {
        element.style.backgroundColor = '';
    }, 300);
}