// Import Stimulus
import { Application } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"
import TabController from "./controllers/tab_controller.js"
import YamlController from "./controllers/yaml_controller.js"
import LogController from "./controllers/log_controller.js"

// Initialize Stimulus
window.Stimulus = Application.start()

// Register controllers
Stimulus.register("tab", TabController)
Stimulus.register("yaml", YamlController) 
Stimulus.register("log", LogController)

// Add loading animation to refresh button
document.querySelector('.refresh-btn')?.addEventListener('click', function() {
    this.classList.add('loading');
});

// Legacy function wrappers for existing template calls
window.viewYamlFile = function(source, filename) {
    const controller = document.querySelector('[data-controller*="yaml"]')
    if (controller) {
        const stimulusController = Stimulus.getControllerForElementAndIdentifier(controller, 'yaml')
        stimulusController.filenameValue = filename
        stimulusController.sourceValue = source
        stimulusController.view()
    }
}

window.viewYamlFileWithTail = function(source, filename) {
    const controller = document.querySelector('[data-controller*="yaml"]')
    if (controller) {
        const stimulusController = Stimulus.getControllerForElementAndIdentifier(controller, 'yaml')
        stimulusController.filenameValue = filename
        stimulusController.sourceValue = source
        stimulusController.viewWithTail()
    }
}

window.viewLogFile = function(filename) {
    const controller = document.querySelector('[data-controller*="log"]')
    if (controller) {
        const stimulusController = Stimulus.getControllerForElementAndIdentifier(controller, 'log')
        stimulusController.filenameValue = filename
        stimulusController.view()
    }
}

// Helper functions (mantemos globais para reutilização)
window.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

window.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.formatYamlContent = function(content) {
    if (!content || typeof content !== 'object') {
        return '<div class="text-muted">No content available</div>';
    }
    
    let html = '';
    for (const [key, value] of Object.entries(content)) {
        html += `
            <div class="row py-2 border-bottom">
                <div class="col-4">
                    <span class="property-key fw-bold">${window.escapeHtml(key)}:</span>
                </div>
                <div class="col-8">
                    <span class="property-value path-text" style="word-break: break-all; font-size: 0.9rem;">
                        ${window.formatValue(value)}
                    </span>
                </div>
            </div>
        `;
    }
    return html;
}

window.formatValue = function(value) {
    if (value === null) return '<em class="text-muted">null</em>';
    if (typeof value === 'boolean') return `<code class="text-info">${value}</code>`;
    if (typeof value === 'number') return `<code class="text-warning">${value}</code>`;
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `<code class="text-success">[Array with ${value.length} items]</code>`;
        }
        return `<code class="text-primary">{Object with ${Object.keys(value).length} keys}</code>`;
    }
    return `<code class="text-light">${window.escapeHtml(String(value))}</code>`;
}

// Clean up when modals are closed
document.getElementById('logModal')?.addEventListener('hidden.bs.modal', function() {
    const controller = document.querySelector('[data-controller*="log"]')
    if (controller) {
        const stimulusController = Stimulus.getControllerForElementAndIdentifier(controller, 'log')
        if (stimulusController) stimulusController.stopTail()
    }
});

document.getElementById('yamlModal')?.addEventListener('hidden.bs.modal', function() {
    const controller = document.querySelector('[data-controller*="yaml"]')
    if (controller) {
        const stimulusController = Stimulus.getControllerForElementAndIdentifier(controller, 'yaml')
        if (stimulusController) stimulusController.stopTail()
    }
});

// Error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});