// Simplified JavaScript without Stimulus framework
// Handles basic functionality for tabs and refresh button

// Tab persistence
document.addEventListener('DOMContentLoaded', function() {
    // Load active tab from localStorage
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
        const tabTrigger = document.querySelector(`[data-bs-target="#${activeTab}"]`);
        if (tabTrigger) {
            new bootstrap.Tab(tabTrigger).show();
        }
    }

    // Setup tab listeners for persistence
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tabTrigger => {
        tabTrigger.addEventListener('shown.bs.tab', (event) => {
            const targetId = event.target.getAttribute('data-bs-target').substring(1);
            localStorage.setItem('activeTab', targetId);
        });
    });

    // Add loading animation to refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            this.classList.add('loading');
            // Remove loading class after a delay (page will reload anyway)
            setTimeout(() => {
                this.classList.remove('loading');
            }, 1000);
        });
    }
});

// Simple helper functions (kept minimal)
window.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Error handler
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});