import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    connect() {
        this.loadActiveTab()
        this.setupTabListeners()
    }

    loadActiveTab() {
        const activeTab = localStorage.getItem('activeTab');
        if (activeTab) {
            const tabTrigger = document.querySelector(`[data-bs-target="#${activeTab}"]`);
            if (tabTrigger) {
                new bootstrap.Tab(tabTrigger).show();
            }
        }
    }

    setupTabListeners() {
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tabTrigger => {
            tabTrigger.addEventListener('shown.bs.tab', (event) => {
                const targetId = event.target.getAttribute('data-bs-target').substring(1);
                localStorage.setItem('activeTab', targetId);
            });
        });
    }

    switchTab(event) {
        const targetId = event.currentTarget.getAttribute('data-bs-target').substring(1);
        localStorage.setItem('activeTab', targetId);
    }
}