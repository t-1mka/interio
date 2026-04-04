// Auth Manager - управление авторизацией пользователей с SQLite backend
if (typeof AuthManager === 'undefined') {
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentPhone = '';
        this.apiBaseUrl = '/api/auth';
        this.fetchOptions = { credentials: 'include' };
        
        // Try to load auth snapshot if stateManager is available
        if (window.stateManager && typeof window.stateManager.loadAuthSnapshot === 'function') {
            this.currentUser = window.stateManager.loadAuthSnapshot();
            if (this.currentUser) {
                this.updateLoginButton();
            }
        }
        
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
            const response = await fetch(`${this.apiBaseUrl}/current-user`, this.fetchOptions);
            const data = await response.json();
            
            if (response.ok && data.success && data.user) {
                this.currentUser = data.user;
                if (window.stateManager && typeof window.stateManager.saveAuthSnapshot === 'function') {
                    window.stateManager.saveAuthSnapshot(data.user);
                }
                this.updateLoginButton();
            } else {
                this.currentUser = null;
                if (window.stateManager && typeof window.stateManager.clearAuthSnapshot === 'function') {
                    window.stateManager.clearAuthSnapshot();
                }
                this.updateLoginButton();
            }
        } catch (error) {
            console.log('Проверка сессии: сервер недоступен, оставляем локальный снимок профиля при наличии');
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
        if (!window.stateManager || typeof window.stateManager.validatePhone !== 'function' || !window.stateManager.validatePhone(phone)) {
            phoneError.textContent = 'Введите корректный российский номер телефона (например: +7 (999) 123-45-67)';
            return;
        }

        this.currentPhone = window.stateManager.normalizePhone(phone);
        
        // Сохраняем валидный телефон в StateManager
        if (typeof window.stateManager.saveValidatedPhone === 'function') {
            window.stateManager.saveValidatedPhone(phone);
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/check-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
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
    if (window.stateManager && typeof window.stateManager.formatPhone === 'function') {
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
                credentials: 'include',
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
                credentials: 'include',
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
        const cabinetContainer = document.querySelector('.cabinet-container');
        if (cabinetContainer && this.currentUser) {
            cabinetContainer.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar-large">${this.currentUser.nickname.charAt(0).toUpperCase()}</div>
                    <h3>Личный кабинет</h3>
                    <p>Никнейм: <strong>${this.currentUser.nickname}</strong></p>
                    <p>Телефон: <strong>${this.currentUser.phone}</strong></p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 16px;">
                        Вы вошли в систему. Здесь будет отображаться история ваших заявок и настройки.
                    </p>
                    <button class="logout-btn" onclick="window.authManager.logout()">
                        <i class="fas fa-sign-out-alt"></i> Выйти
                    </button>
                </div>
            `;
        }
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
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Ошибка выхода:', error);
        }
        
        this.currentUser = null;
        if (window.stateManager && typeof window.stateManager.clearAuthSnapshot === 'function') {
            window.stateManager.clearAuthSnapshot();
        }
        this.updateLoginButton();
        
        // Сбрасываем StateManager сессию
        this.resetStateManagerSession();
        
        // Закрываем модальное окно личного кабинета если открыто
        this.closeCabinetModal();
        
        console.log('Пользователь вышел');
    }

    // Обновление кнопки входа
    updateLoginButton() {
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userNickname = document.getElementById('userNicknameDisplay');
        
        if (this.currentUser) {
            // Показываем профиль пользователя
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) {
                userProfile.style.display = 'flex';
                // Устанавливаем аватар (первая буква никнейма)
                if (userAvatar) {
                    userAvatar.textContent = this.currentUser.nickname.charAt(0).toUpperCase();
                }
                // Устанавливаем никнейм
                if (userNickname) {
                    userNickname.textContent = this.currentUser.nickname;
                }
            }
        } else {
            // Показываем кнопку входа
            if (loginBtn) {
                loginBtn.style.display = 'flex';
                loginBtn.onclick = () => this.openModal();
            }
            if (userProfile) {
                userProfile.style.display = 'none';
            }
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
        if (window.stateManager && this.currentUser && typeof window.stateManager.saveAuthSnapshot === 'function') {
            window.stateManager.saveAuthSnapshot(this.currentUser);
            const sessionData = {
                user: this.currentUser,
                phone: this.currentPhone,
                authenticated: true,
                timestamp: new Date().toISOString()
            };
            
            // Сохраняем данные авторизации в текущем шаблоне
            if (typeof window.stateManager.getCurrentTemplate === 'function' && typeof window.stateManager.saveTemplateState === 'function') {
                const currentTemplate = window.stateManager.getCurrentTemplate();
                if (currentTemplate) {
                    window.stateManager.saveTemplateState(currentTemplate, sessionData);
                }
            }
            
            // Синхронизируем с сервером
            if (typeof window.stateManager.syncSessionWithServer === 'function') {
                window.stateManager.syncSessionWithServer();
            }
        }
    }

    // Сброс сессии через StateManager
    resetStateManagerSession() {
        if (window.stateManager && typeof window.stateManager.createSession === 'function') {
            // Создаем новую сессию
            window.stateManager.createSession();
            console.log('Сессия сброшена через StateManager');
        }
    }
}

// Инициализация Auth Manager после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    if (!window.authManager) {
        window.authManager = new AuthManager();
    }
});
}
