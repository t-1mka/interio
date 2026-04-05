class AdminAuth {
    constructor() {
        this.modal = document.getElementById('adminAuthModal');
        this.codeInput = document.getElementById('adminCodeInput');
        this.errorElement = document.getElementById('adminError');
        this.passwordVisible = false;
        this.init();
    }

    init() {
        if (!this.modal || !this.codeInput) {
            // На странице админки - сразу проверяем доступ
            this.checkAdminAccess();
            return;
        }
        
        // Обработчик Enter в поле ввода кода
        this.codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
    }

    togglePassword() {
        const input = this.codeInput;
        const button = document.querySelector('.admin-toggle-password i');

        if (!input || !button) return;

        this.passwordVisible = !this.passwordVisible;

        if (this.passwordVisible) {
            input.type = 'text';
            button.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            button.className = 'fas fa-eye';
        }
    }

    async checkAdminAccess() {
        try {
            const response = await fetch('/api/auth/current-user');
            const data = await response.json();

            if (data.success && data.user && data.user.role === 'admin') {
                if (this.modal) {
                    this.closeModal();
                }
            } else {
                // Если нет доступа и мы на странице админки - редирект
                if (!this.modal && window.location.pathname === '/admin') {
                    window.location.href = '/';
                }
            }
        } catch (error) {
            console.error('Ошибка проверки админ доступа:', error);
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'block';
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка входа');
            }

            // Успешный вход
            this.closeModal();
            
            // Перезагружаем страницу для обновления доступа
            window.location.reload();

        } catch (error) {
            this.showError(error.message);
        }
    }

    showError(message) {
        if (this.errorElement) {
            const errorSpan = this.errorElement.querySelector('span');
            if (errorSpan) {
                errorSpan.textContent = message;
            }
            this.errorElement.style.display = 'flex';
        }
    }

    clearError() {
        if (this.errorElement) {
            const errorSpan = this.errorElement.querySelector('span');
            if (errorSpan) {
                errorSpan.textContent = '';
            }
            this.errorElement.style.display = 'none';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.adminAuth = new AdminAuth();
});
