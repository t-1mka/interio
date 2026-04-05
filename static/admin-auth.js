class AdminAuth {
    constructor() {
        this.modal = document.getElementById('adminAuthModal');
        this.codeInput = document.getElementById('adminCodeInput');
        this.errorElement = document.getElementById('adminError');
        this.init();
    }

    init() {
        if (!this.modal || !this.codeInput) return;

        this.checkAdminAccess();

        this.codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    }

    async checkAdminAccess() {
        // Проверяем есть ли admin_session cookie
        if (document.cookie.includes('admin_session=')) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.clearError();
            if (this.codeInput) {
                this.codeInput.value = '';
                this.codeInput.focus();
            }
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.clearError();
        }
    }

    async login() {
        const code = this.codeInput?.value?.trim();
        if (!code) {
            this.showError('Введите код');
            return;
        }

        try {
            const response = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Ошибка входа');

            this.closeModal();
            window.location.reload();
        } catch (error) {
            this.showError(error.message);
        }
    }

    showError(message) {
        if (this.errorElement) {
            const s = this.errorElement.querySelector('span');
            if (s) s.textContent = message;
            this.errorElement.style.display = 'flex';
        }
    }

    clearError() {
        if (this.errorElement) {
            const s = this.errorElement.querySelector('span');
            if (s) s.textContent = '';
            this.errorElement.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminAuth = new AdminAuth();
});
