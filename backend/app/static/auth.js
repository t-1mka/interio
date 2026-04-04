// Auth Manager - управление авторизацией пользователей с SQLite backend
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentPhone = '';
        this.apiBaseUrl = 'http://localhost:5000/api/auth';
        this.init();
    }

    // Инициализация
    async init() {
        // Проверяем текущего пользователя при загрузке
        await this.checkCurrentUser();
        
        // Интеграция с StateManager
        if (window.stateManager) {
            console.log('Auth Manager интегрирован с StateManager');
            // Сохраняем информацию о сессии в StateManager
            this.updateStateManagerSession();
        }
        
        console.log('Auth Manager инициализирован');
    }

    // Проверка текущего пользователя
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

    // Открытие модального окна
    openModal() {
        document.getElementById('authModal').style.display = 'block';
        this.clearErrors();
        this.showPhoneStep();
    }

    // Закрытие модального окна
    closeModal() {
        document.getElementById('authModal').style.display = 'none';
        this.clearErrors();
        this.currentPhone = '';
    }

    // Очистка ошибок
    clearErrors() {
        document.getElementById('phoneError').textContent = '';
        document.getElementById('passwordError').textContent = '';
        document.getElementById('registerError').textContent = '';
    }

    // Показать шаг ввода телефона
    showPhoneStep() {
        document.getElementById('phoneStep').style.display = 'block';
        document.getElementById('passwordStep').style.display = 'none';
        document.getElementById('registerStep').style.display = 'none';
        document.getElementById('phoneInput').value = '';
        document.getElementById('phoneInput').focus();
    }

    // Показать шаг ввода пароля
    showPasswordStep() {
        document.getElementById('phoneStep').style.display = 'none';
        document.getElementById('passwordStep').style.display = 'block';
        document.getElementById('registerStep').style.display = 'none';
        document.getElementById('userPhone').textContent = `Телефон: ${this.currentPhone}`;
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }

    // Показать шаг регистрации
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

    // Возврат к шагу ввода телефона
    backToPhone() {
        this.showPhoneStep();
        this.clearErrors();
    }

    // Проверка номера телефона
    async checkPhone() {
        const phone = document.getElementById('phoneInput').value.trim();
        const phoneError = document.getElementById('phoneError');
        
        // Используем валидацию из StateManager
        if (!window.stateManager.validatePhone(phone)) {
            phoneError.textContent = 'Введите корректный российский номер телефона (например: +7 (999) 123-45-67)';
            return;
        }

        this.currentPhone = window.stateManager.normalizePhone(phone);
        
        // Сохраняем валидный телефон в StateManager
        window.stateManager.saveValidatedPhone(phone);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/check-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone: this.currentPhone })
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

// Форматирование телефона при вводе
formatPhone(input) {
    // Используем форматирование из StateManager
    if (window.stateManager) {
        window.stateManager.formatPhone(input);
    }
}

    // Валидация пароля
    validatePassword(password) {
        // Минимальная длина 8 символов
        if (password.length < 8) {
            return {
                isValid: false,
                error: 'Пароль должен содержать минимум 8 символов, один из которых - буква'
            };
        }
        
        // Обязательно должна быть хотя бы одна буква
        if (!/[a-zA-Z]/.test(password)) {
            return {
                isValid: false,
                error: 'Пароль должен содержать минимум 8 символов, один из которых - буква'
            };
        }
        
        return {
            isValid: true,
            error: null
        };
    }

    // Вход пользователя
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
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: this.currentPhone,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.currentUser = data.user;
                this.closeModal();
                this.updateLoginButton();
                this.showUserCabinet();
                
                // Обновляем StateManager сессию
                this.updateStateManagerSession();
                
                console.log('Пользователь вошел:', data.user);
            } else {
                passwordError.textContent = data.error || 'Ошибка входа';
            }
        } catch (error) {
            passwordError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка входа:', error);
        }
    }

    // Регистрация пользователя
    async register() {
        const nickname = document.getElementById('nicknameInput').value.trim();
        const password = document.getElementById('newPasswordInput').value;
        const confirmPassword = document.getElementById('confirmPasswordInput').value;
        const registerError = document.getElementById('registerError');
        
        // Валидация никнейма
        if (!nickname) {
            registerError.textContent = 'Введите никнейм';
            return;
        }
        
        // Валидация пароля
        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.isValid) {
            registerError.textContent = passwordValidation.error;
            return;
        }
        
        // Проверка совпадения паролей
        if (password !== confirmPassword) {
            registerError.textContent = 'Пароли не совпадают';
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: this.currentPhone,
                    nickname: nickname,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.currentUser = data.user;
                this.closeModal();
                this.updateLoginButton();
                this.showUserCabinet();
                
                // Обновляем StateManager сессию
                this.updateStateManagerSession();
                
                console.log('Пользователь зарегистрирован:', data.user);
            } else {
                registerError.textContent = data.error || 'Ошибка регистрации';
            }
        } catch (error) {
            registerError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка регистрации:', error);
        }
    }

    // Показать личный кабинет
    showUserCabinet() {
        // Показываем модальное окно
        document.getElementById('cabinetModal').style.display = 'block';
    }

    // Закрыть модальное окно личного кабинета
    closeCabinetModal() {
        document.getElementById('cabinetModal').style.display = 'none';
    }

    // Выход пользователя
    async logout() {
        try {
            await fetch(`${this.apiBaseUrl}/logout`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Ошибка выхода:', error);
        }
        
        this.currentUser = null;
        this.updateLoginButton();
        
        // Сбрасываем StateManager сессию
        this.resetStateManagerSession();
        
        // Закрываем модальное окно личного кабинета если открыто
        this.closeCabinetModal();
        
        console.log('Пользователь вышел');
    }

    // Обновление кнопки входа
    updateLoginButton() {
        const loginBtn = document.querySelector('.login-btn');
        if (this.currentUser) {
            loginBtn.textContent = this.currentUser.nickname;
            loginBtn.style.backgroundColor = '#17a2b8';
            loginBtn.onclick = () => this.showUserMenu();
        } else {
            loginBtn.textContent = 'Войти';
            loginBtn.style.backgroundColor = '#28a745';
            loginBtn.onclick = () => this.openModal();
        }
    }

    // Показать меню пользователя
    showUserMenu() {
        // Показываем модальное окно личного кабинета
        this.showUserCabinet();
    }

    // Получить текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

    // Обновление сессии в StateManager
    updateStateManagerSession() {
        if (window.stateManager && this.currentUser) {
            const sessionData = {
                user: this.currentUser,
                phone: this.currentPhone,
                authenticated: true,
                timestamp: new Date().toISOString()
            };
            
            // Сохраняем данные авторизации в текущем шаблоне
            const currentTemplate = window.stateManager.getCurrentTemplate();
            if (currentTemplate) {
                window.stateManager.saveTemplateState(currentTemplate, sessionData);
            }
            
            // Синхронизируем с сервером
            window.stateManager.syncSessionWithServer();
        }
    }

    // Сброс сессии через StateManager
    resetStateManagerSession() {
        if (window.stateManager) {
            // Создаем новую сессию
            window.stateManager.createSession();
            console.log('Сессия сброшена через StateManager');
        }
    }
}

// Инициализация Auth Manager после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
