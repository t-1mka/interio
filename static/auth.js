// Auth Manager - управление авторизацией пользователей с SQLite backend
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentPhone = '';
        this.apiBaseUrl = '/api/auth';
        this.init();
    }

    async init() {
        await this.checkCurrentUser();
        console.log('Auth Manager инициализирован');
    }

    async checkCurrentUser() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/current-user`);
            const data = await response.json();
            if (data.success && data.user) {
                this.currentUser = data.user;
                this.updateLoginButton();
            }
        } catch (error) {
            console.log('Пользователь не авторизован');
        }
    }

    openModal() {
        document.getElementById('authModal').style.display = 'block';
        this.clearErrors();
        this.showPhoneStep();
    }

    closeModal() {
        document.getElementById('authModal').style.display = 'none';
        this.clearErrors();
        this.currentPhone = '';
    }

    clearErrors() {
        document.getElementById('phoneError').textContent = '';
        document.getElementById('passwordError').textContent = '';
        document.getElementById('registerError').textContent = '';
    }

    showPhoneStep() {
        document.getElementById('phoneStep').style.display = 'block';
        document.getElementById('passwordStep').style.display = 'none';
        document.getElementById('registerStep').style.display = 'none';
        document.getElementById('phoneInput').value = '';
        document.getElementById('phoneInput').focus();
    }

    showPasswordStep() {
        document.getElementById('phoneStep').style.display = 'none';
        document.getElementById('passwordStep').style.display = 'block';
        document.getElementById('registerStep').style.display = 'none';
        document.getElementById('userPhone').textContent = `Телефон: ${this.currentPhone}`;
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }

    showRegisterStep() {
        document.getElementById('phoneStep').style.display = 'none';
        document.getElementById('passwordStep').style.display = 'none';
        document.getElementById('registerStep').style.display = 'block';
        document.getElementById('newUserPhone').textContent = `Телефон: ${this.currentPhone}`;
        document.getElementById('nicknameInput').value = '';
        document.getElementById('newPasswordInput').value = '';
        document.getElementById('confirmPasswordInput').value = '';
        document.getElementById('nicknameInput').focus();
    }

    backToPhone() {
        this.showPhoneStep();
        this.clearErrors();
    }

    async checkPhone() {
        const phone = document.getElementById('phoneInput').value.trim();
        const phoneError = document.getElementById('phoneError');

        if (!this.validatePhone(phone)) {
            phoneError.textContent = 'Введите корректный российский номер телефона';
            return;
        }

        this.currentPhone = this.normalizePhone(phone);

        try {
            const response = await fetch(`${this.apiBaseUrl}/check-phone`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({phone: this.currentPhone})
            });

            const data = await response.json();

            if (response.ok) {
                if (data.exists) {
                    this.showPasswordStep();
                } else {
                    this.showRegisterStep();
                }
            } else {
                phoneError.textContent = data.error || 'Ошибка проверки телефона';
            }
        } catch (error) {
            phoneError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка проверки телефона:', error);
        }
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

    validatePassword(password) {
        if (password.length < 8) return {isValid: false, error: 'Пароль должен содержать минимум 8 символов, один из которых - буква'};
        if (!/[a-zA-Z]/.test(password)) return {isValid: false, error: 'Пароль должен содержать минимум 8 символов, один из которых - буква'};
        return {isValid: true, error: null};
    }

    async login() {
        const password = document.getElementById('passwordInput').value;
        const passwordError = document.getElementById('passwordError');

        if (!password) {
            passwordError.textContent = 'Введите пароль';
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({phone: this.currentPhone, password})
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.currentUser = data.user;
                this.closeModal();
                this.updateLoginButton();
                console.log('Пользователь вошел:', data.user);
            } else {
                passwordError.textContent = data.error || 'Ошибка входа';
            }
        } catch (error) {
            passwordError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка входа:', error);
        }
    }

    async register() {
        const nickname = document.getElementById('nicknameInput').value.trim();
        const password = document.getElementById('newPasswordInput').value;
        const confirmPassword = document.getElementById('confirmPasswordInput').value;
        const registerError = document.getElementById('registerError');

        if (!nickname) {
            registerError.textContent = 'Введите никнейм';
            return;
        }

        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.isValid) {
            registerError.textContent = passwordValidation.error;
            return;
        }

        if (password !== confirmPassword) {
            registerError.textContent = 'Пароли не совпадают';
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({phone: this.currentPhone, nickname, password})
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.currentUser = data.user;
                this.closeModal();
                this.updateLoginButton();
                console.log('Пользователь зарегистрирован:', data.user);
            } else {
                registerError.textContent = data.error || 'Ошибка регистрации';
            }
        } catch (error) {
            registerError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка регистрации:', error);
        }
    }

    showUserCabinet() {
        document.getElementById('cabinetModal').style.display = 'block';
    }

    closeCabinetModal() {
        document.getElementById('cabinetModal').style.display = 'none';
    }

    async logout() {
        try {
            await fetch(`${this.apiBaseUrl}/logout`, {method: 'POST'});
        } catch (error) {
            console.error('Ошибка выхода:', error);
        }

        this.currentUser = null;
        this.updateLoginButton();
        this.closeCabinetModal();
        console.log('Пользователь вышел');
    }

    updateLoginButton() {
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userNickname = document.getElementById('userNicknameDisplay');

        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) {
                userProfile.style.display = 'flex';
                if (userAvatar) userAvatar.textContent = this.currentUser.nickname.charAt(0).toUpperCase();
                if (userNickname) userNickname.textContent = this.currentUser.nickname;
            }
        } else {
            if (loginBtn) {
                loginBtn.style.display = 'flex';
                loginBtn.onclick = () => this.openModal();
            }
            if (userProfile) userProfile.style.display = 'none';
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    validatePhone(phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length === 11) return cleanPhone.startsWith('7') || cleanPhone.startsWith('8');
        return false;
    }

    normalizePhone(phone) {
        let cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone.length === 11 && cleanPhone.startsWith('8')) cleanPhone = '7' + cleanPhone.substring(1);
        if (cleanPhone.length === 10) cleanPhone = '7' + cleanPhone;
        return '+' + cleanPhone;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
