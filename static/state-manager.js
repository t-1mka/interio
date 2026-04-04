class StateManager {
    constructor() {
        this.sessionId = null;
        this.templates = {};
        this.currentTemplateIndex = 0;
        this.templateIds = ['template1', 'template2', 'template3', 'template4', 'template5', 'template6'];
        this.init();
    }

    init() {
        this.createSession();
        this.setupSessionCleanup();
    }

    setupSessionCleanup() {
        window.addEventListener('beforeunload', () => {
            this.clearSession(true);
        });
    }

    createSession() {
        this.sessionId = this.generateSessionId();
        this.templates = {};
        this.currentTemplateIndex = 0;

        this.templateIds.forEach(id => {
            this.templates[id] = { visible: false, data: null, timestamp: null };
        });

        this.saveSession();
        console.log('Сессия создана:', this.sessionId);
        return this.sessionId;
    }

    nextTemplate() {
        if (!this.sessionId) { console.warn('Нет активной сессии'); return null; }
        if (this.currentTemplateIndex === this.templateIds.length - 1) { console.log('Достигнут последний шаблон'); return null; }
        this.hideCurrentTemplate();
        this.currentTemplateIndex = (this.currentTemplateIndex + 1) % this.templateIds.length;
        return this.showTemplate(this.templateIds[this.currentTemplateIndex]);
    }

    previousTemplate() {
        if (!this.sessionId) { console.warn('Нет активной сессии'); return null; }
        if (this.currentTemplateIndex === 0) { console.log('Достигнут первый шаблон'); return null; }
        this.hideCurrentTemplate();
        this.currentTemplateIndex = (this.currentTemplateIndex - 1 + this.templateIds.length) % this.templateIds.length;
        return this.showTemplate(this.templateIds[this.currentTemplateIndex]);
    }

    showTemplate(templateId) {
        if (!this.sessionId) { console.warn('Нет активной сессии'); return null; }
        this.hideAllTemplates();
        this.hideMainContent();

        const templateElement = document.getElementById(templateId);
        if (templateElement) {
            templateElement.classList.remove('template');
            if (this.templates[templateId]) {
                this.templates[templateId].visible = true;
                this.templates[templateId].timestamp = new Date().toISOString();
            }
            this.currentTemplateIndex = this.templateIds.indexOf(templateId);
            this.saveSession();
            return templateId;
        }
        return null;
    }

    hideCurrentTemplate() {
        const currentId = this.templateIds[this.currentTemplateIndex];
        if (currentId && this.templates[currentId]) {
            this.templates[currentId].visible = false;
            const element = document.getElementById(currentId);
            if (element) element.classList.add('template');
        }
    }

    hideAllTemplates() {
        this.templateIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.add('template');
            if (this.templates[id]) this.templates[id].visible = false;
        });
    }

    showMainContent() {
        const mainContent = document.querySelector('.rounded-rectangle:not(.template)');
        if (mainContent) mainContent.style.display = 'flex';
    }

    hideMainContent() {
        const mainContent = document.querySelector('.rounded-rectangle:not(.template)');
        if (mainContent) mainContent.style.display = 'none';
    }

    returnToMain() {
        this.hideAllTemplates();
        this.showMainContent();
        this.currentTemplateIndex = 0;
        this.saveSession();
    }

    saveTemplateState(templateId, data) {
        if (this.templates[templateId]) {
            this.templates[templateId].data = data;
            this.templates[templateId].timestamp = new Date().toISOString();
            this.saveSession();
        }
    }

    getTemplateState(templateId) {
        return this.templates[templateId] || null;
    }

    getCurrentTemplate() {
        return this.templateIds[this.currentTemplateIndex];
    }

    saveSession() {
        const sessionData = {
            sessionId: this.sessionId,
            templates: this.templates,
            currentTemplateIndex: this.currentTemplateIndex
        };
        localStorage.setItem('templateSession', JSON.stringify(sessionData));
    }

    clearSession(silent = false) {
        this.sessionId = null;
        this.templates = {};
        this.currentTemplateIndex = 0;
        localStorage.removeItem('templateSession');
        if (!silent) console.log('Сессия очищена');
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            currentTemplate: this.getCurrentTemplate(),
            templates: this.templates,
            currentTemplateIndex: this.currentTemplateIndex
        };
    }

    validatePhone(phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length === 11) return cleanPhone.startsWith('7') || cleanPhone.startsWith('8');
        return false;
    }

    formatPhone(input) {
        let value = input.value.replace(/[^\d]/g, '');
        let formattedValue = '';

        if (value.length > 0) {
            if (value.startsWith('8')) value = '7' + value.substring(1);
            else if (!value.startsWith('7')) value = '7' + value;

            if (value.length <= 1) formattedValue = '+' + value;
            else if (value.length <= 4) formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1);
            else if (value.length <= 7) formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4);
            else if (value.length <= 9) formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4, 7) + '-' + value.substring(7);
            else formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4, 7) + '-' + value.substring(7, 9) + '-' + value.substring(9, 11);
        }

        input.value = formattedValue;
    }

    normalizePhone(phone) {
        let cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length === 11 && cleanPhone.startsWith('8')) cleanPhone = '7' + cleanPhone.substring(1);
        if (cleanPhone.length === 10) cleanPhone = '7' + cleanPhone;
        return '+' + cleanPhone;
    }

    saveValidatedPhone(phone) {
        if (this.validatePhone(phone)) {
            const normalizedPhone = this.normalizePhone(phone);
            const currentTemplate = this.getCurrentTemplate();
            if (currentTemplate) {
                const templateState = this.getTemplateState(currentTemplate);
                if (templateState) {
                    templateState.data = templateState.data || {};
                    templateState.data.validatedPhone = normalizedPhone;
                    templateState.timestamp = new Date().toISOString();
                    this.saveSession();
                }
            }
            return normalizedPhone;
        }
        return null;
    }

    async syncSessionWithServer() {
        try {
            const response = await fetch('/api/session/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({session_id: this.sessionId})
            });
            const data = await response.json();
            if (data.success) console.log('Сессия синхронизирована');
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
        }
    }

    async getSessionFromServer() {
        try {
            const response = await fetch('/api/session/data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({session_id: this.sessionId})
            });
            const data = await response.json();
            if (data.success) return data.data;
        } catch (error) {
            console.error('Ошибка получения данных:', error);
        }
        return null;
    }
}

window.stateManager = new StateManager();
