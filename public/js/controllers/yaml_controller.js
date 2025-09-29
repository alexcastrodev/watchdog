import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    static values = { 
        filename: String, 
        source: String 
    }

    static targets = [
        "content", "title", "downloadBtn", "tailBtn", "stopTailBtn", 
        "fileSize", "lastModified", "status", "tailStatus"
    ]

    connect() {
        this.tailPollingInterval = null
        this.lastLogSize = 0
        this.lastLogModified = null
        this.tailElement = null
        this.modal = null
    }

    disconnect() {
        this.stopTail()
    }

    async view() {
        this.modal = new bootstrap.Modal(document.getElementById('yamlModal'))
        this.showLoadingState()
        this.modal.show()
        
        try {
            await this.loadContent()
            this.setupButtons()
        } catch (error) {
            this.showError(error.message)
        }
    }

    async viewWithTail() {
        await this.view()
        if (this.sourceValue === 'jobs') {
            setTimeout(() => this.startTail(), 500)
        }
    }

    showLoadingState() {
        this.contentTarget.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `
    }

    async loadContent() {
        const response = await fetch(`/api/yaml/${this.sourceValue}/${this.filenameValue}`)
        if (!response.ok) throw new Error('Failed to load file')
        
        const data = await response.json()
        this.updateContent(data)
        return data
    }

    updateContent(data) {
        const sourceLabel = this.sourceValue === 'jobs' ? 'Jobs' : 'Logs'
        this.titleTarget.innerHTML = `<i class="bi bi-file-earmark-code text-danger me-2"></i>${data.name}.yml <small class="text-muted">(${sourceLabel})</small>`
        
        this.contentTarget.innerHTML = `
            <div class="mb-4">
                <div class="row g-3 mb-3">
                    <div class="col-md-4">
                        <small class="text-muted">File Size:</small>
                        <div class="fw-bold" data-yaml-target="fileSize">${window.formatFileSize(data.size)}</div>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Last Modified:</small>
                        <div class="fw-bold" data-yaml-target="lastModified">${data.last_modified}</div>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Status:</small>
                        <div class="fw-bold" data-yaml-target="status">
                            <span class="badge bg-success">Static</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <h6 class="mb-3">Parsed Content</h6>
                    <div class="bg-light p-3 rounded mb-3" style="max-height: 400px; overflow-y: auto;">
                        ${window.formatYamlContent(data.parsed_content)}
                    </div>
                </div>
                <div class="col-md-6">
                    <h6 class="mb-3">Raw Content</h6>
                    <pre class="bg-dark text-light p-3 rounded" data-yaml-target="contentPre" style="max-height: 400px; overflow-y: auto; font-size: 0.85rem; position: relative;">
                        <code data-yaml-target="contentCode">${window.escapeHtml(data.raw_content)}</code>
                    </pre>
                </div>
            </div>

            <div id="jobLogSection" class="row mt-4" style="display: none;">
                <div class="col-12">
                    <h6 class="mb-3">Job Log Output</h6>
                    <pre class="bg-secondary text-light p-3 rounded" data-yaml-target="jobLogContent" style="max-height: 400px; overflow-y: auto; font-size: 0.85rem;">
                        <code data-yaml-target="jobLogCode"></code>
                    </pre>
                </div>
            </div>
        `

        this.setupDownloadButton(data)
    }

    setupButtons() {
        // Configure tail button visibility
        if (this.sourceValue === 'jobs') {
            this.tailBtnTarget.style.display = 'inline-block'
        } else {
            this.tailBtnTarget.style.display = 'none'
        }
        
        this.stopTailBtnTarget.style.display = 'none'
        this.tailStatusTarget.style.display = 'none'
    }

    setupDownloadButton(data) {
        this.downloadBtnTarget.onclick = () => {
            const blob = new Blob([data.raw_content], { type: 'text/yaml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${data.name}.yml`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    startTail() {
        if (this.tailPollingInterval || this.sourceValue !== 'jobs') return

        // Update UI
        this.tailBtnTarget.style.display = 'none'
        this.stopTailBtnTarget.style.display = 'inline-block'
        this.tailStatusTarget.style.display = 'inline-block'
        
        // Show job log section
        const jobLogSection = document.getElementById('jobLogSection')
        if (jobLogSection) jobLogSection.style.display = 'block'

        // Update tailElement reference to job log
        this.tailElement = document.querySelector('[data-yaml-target="jobLogCode"]')
        
        // Reset tracking variables
        this.lastLogSize = 0
        this.lastLogModified = null

        // Start polling
        this.tailPollingInterval = setInterval(() => this.fetchJobLogContent(), 1000)
        this.fetchJobLogContent() // Initial load
    }

    async fetchJobLogContent() {
        try {
            const response = await fetch(`/api/job/${this.filenameValue}/tail`)
            
            if (!response.ok) {
                this.showTailError(`HTTP ${response.status}: ${response.statusText}`)
                return
            }

            const data = await response.json()
            
            if (data.error) {
                this.showTailError(data.error)
                return
            }

            // Update content if there are changes
            if (data.size > this.lastLogSize || data.last_modified !== this.lastLogModified) {
                if (this.tailElement) {
                    this.tailElement.textContent = data.content || 'No log content available'
                    this.flashJobLogContent()
                }
                
                this.updateJobLogStats(data.size, data.job_name, data.log_file)
                this.lastLogSize = data.size
                this.lastLogModified = data.last_modified
            }

        } catch (error) {
            this.showTailError(`Network error: ${error.message}`)
        }
    }

    stopTail() {
        if (this.tailPollingInterval) {
            clearInterval(this.tailPollingInterval)
            this.tailPollingInterval = null
        }

        // Update UI
        this.tailBtnTarget.style.display = 'inline-block'
        this.stopTailBtnTarget.style.display = 'none'
        this.tailStatusTarget.style.display = 'none'

        // Hide job log section
        const jobLogSection = document.getElementById('jobLogSection')
        if (jobLogSection) jobLogSection.style.display = 'none'

        // Reset status
        const statusElement = this.statusTarget.querySelector('.badge')
        if (statusElement) {
            statusElement.className = 'badge bg-success'
            statusElement.textContent = 'Static'
        }

        // Reset tracking variables
        this.lastLogSize = 0
        this.lastLogModified = null
    }

    updateJobLogStats(size, jobName, logFile) {
        // Update file size
        if (this.hasFileSizeTarget) {
            this.fileSizeTarget.textContent = window.formatFileSize(size)
        }

        // Update last modified info
        if (this.hasLastModifiedTarget) {
            this.lastModifiedTarget.innerHTML = `
                <div>Job: ${window.escapeHtml(jobName)}</div>
                <div>Log: ${window.escapeHtml(logFile)}</div>
            `
        }

        // Update status
        if (this.hasStatusTarget) {
            const statusElement = this.statusTarget.querySelector('.badge')
            if (statusElement) {
                statusElement.className = 'badge bg-warning text-dark'
                statusElement.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i>Tailing'
            }
        }
    }

    flashJobLogContent() {
        const jobLogContent = document.getElementById('jobLogSection')
        if (jobLogContent) {
            jobLogContent.style.backgroundColor = '#fff3cd'
            setTimeout(() => {
                jobLogContent.style.backgroundColor = ''
            }, 300)
        }
    }

    showTailError(message) {
        this.tailStatusTarget.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>${message}</span>`
    }

    showError(message) {
        this.contentTarget.innerHTML = `<div class="alert alert-danger">Error: ${message}</div>`
    }

    // Event handlers for buttons
    handleTailClick() {
        this.startTail()
    }

    handleStopTailClick() {
        this.stopTail()
    }
}