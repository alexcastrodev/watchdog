import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    static values = { 
        filename: String 
    }

    static targets = [
        "content", "title", "downloadBtn", "tailBtn", "stopTailBtn", 
        "fileSize", "lastModified", "status", "tailStatus"
    ]

    connect() {
        this.tailPollingInterval = null
        this.lastLogSize = 0
        this.lastLogModified = null
        this.modal = null
    }

    disconnect() {
        this.stopTail()
    }

    async view() {
        this.modal = new bootstrap.Modal(document.getElementById('logModal'))
        this.showLoadingState()
        this.modal.show()
        
        try {
            await this.loadContent()
            this.setupButtons()
        } catch (error) {
            this.showError(error.message)
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
        const response = await fetch(`/api/log/${this.filenameValue}`)
        if (!response.ok) throw new Error('Failed to load log file')
        
        const data = await response.json()
        this.updateContent(data)
        return data
    }

    updateContent(data) {
        this.titleTarget.innerHTML = `<i class="bi bi-file-earmark-text text-info me-2"></i>${data.name}.log`
        
        this.contentTarget.innerHTML = `
            <div class="mb-4">
                <div class="row g-3 mb-3">
                    <div class="col-md-4">
                        <small class="text-muted">File Size:</small>
                        <div class="fw-bold" data-log-target="fileSize">${window.formatFileSize(data.size)}</div>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Last Modified:</small>
                        <div class="fw-bold" data-log-target="lastModified">${data.last_modified}</div>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">Status:</small>
                        <div class="fw-bold" data-log-target="status">
                            <span class="badge bg-success">Static</span>
                        </div>
                    </div>
                </div>
            </div>

            <pre class="bg-dark text-light p-3 rounded" data-log-target="contentPre" style="max-height: 600px; overflow-y: auto; font-size: 0.85rem; white-space: pre-wrap; word-wrap: break-word;">
                <code data-log-target="contentCode">${window.escapeHtml(data.content)}</code>
            </pre>
        `

        this.setupDownloadButton(data)
    }

    setupButtons() {
        this.stopTailBtnTarget.style.display = 'none'
        this.tailStatusTarget.style.display = 'none'
    }

    setupDownloadButton(data) {
        this.downloadBtnTarget.onclick = () => {
            const blob = new Blob([data.content], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${data.name}.log`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    startTail() {
        if (this.tailPollingInterval) return

        // Update UI
        this.tailBtnTarget.style.display = 'none'
        this.stopTailBtnTarget.style.display = 'inline-block'
        this.tailStatusTarget.style.display = 'inline-block'
        
        const contentPre = document.querySelector('[data-log-target="contentPre"]')
        if (contentPre) contentPre.classList.add('tailing')

        // Reset tracking variables
        this.lastLogSize = 0
        this.lastLogModified = null

        // Start polling
        this.tailPollingInterval = setInterval(() => this.fetchLogContent(), 1000)
        this.fetchLogContent() // Initial load
    }

    async fetchLogContent() {
        try {
            const response = await fetch(`/api/log/${this.filenameValue}/tail`)
            
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
                const contentCode = document.querySelector('[data-log-target="contentCode"]')
                if (contentCode) {
                    contentCode.textContent = data.content || 'No log content available'
                    
                    // Auto-scroll to bottom
                    const contentPre = document.querySelector('[data-log-target="contentPre"]')
                    if (contentPre) {
                        contentPre.scrollTop = contentPre.scrollHeight
                    }
                    
                    this.flashNewContent()
                }
                
                this.updateLogStats(data.size, data.content)
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

        const contentPre = document.querySelector('[data-log-target="contentPre"]')
        if (contentPre) contentPre.classList.remove('tailing')

        // Reset status
        const statusElement = this.statusTarget?.querySelector('.badge')
        if (statusElement) {
            statusElement.className = 'badge bg-success'
            statusElement.textContent = 'Static'
        }

        // Reset tracking variables
        this.lastLogSize = 0
        this.lastLogModified = null
    }

    updateLogStats(size, newContent) {
        // Update file size
        if (this.hasFileSizeTarget) {
            this.fileSizeTarget.textContent = window.formatFileSize(size)
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

    flashNewContent() {
        const contentPre = document.querySelector('[data-log-target="contentPre"]')
        if (contentPre) {
            contentPre.style.backgroundColor = '#d1ecf1'
            setTimeout(() => {
                contentPre.style.backgroundColor = ''
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