// Auth Manager - управление авторизацией пользователей с SQLite backend
function interioApiErrorMessage(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.error) return data.error;
    const d = data.detail;
    if (d == null) return null;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
        return d.map((x) => (x && typeof x === 'object' && x.msg ? x.msg : String(x))).join(' ');
    }
    return String(d);
}

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
                phoneError.textContent = interioApiErrorMessage(data) || 'Ошибка проверки телефона';
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
                passwordError.textContent = interioApiErrorMessage(data) || 'Ошибка входа';
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
                // Проверяем конкретную ошибку 409 (конфликт)
                if (response.status === 409) {
                    if (data.detail && data.detail.includes('телефона')) {
                        registerError.textContent = 'Этот номер телефона уже зарегистрирован. Попробуйте войти.';
                    } else if (data.detail && data.detail.includes('никнейм')) {
                        registerError.textContent = 'Этот никнейм уже занят. Выберите другой.';
                    } else {
                        registerError.textContent = 'Пользователь с такими данными уже существует.';
                    }
                } else {
                    registerError.textContent = interioApiErrorMessage(data) || 'Ошибка регистрации';
                }
            }
        } catch (error) {
            registerError.textContent = 'Ошибка соединения с сервером';
            console.error('Ошибка регистрации:', error);
        }
    }

    // Открыть модальное окно личного кабинета
    openCabinetModal() {
        this.showUserCabinet();
    }

    // Показать личный кабинет
    async showUserCabinet() {
        const cabinetContainer = document.querySelector('.cabinet-container');
        if (cabinetContainer && this.currentUser) {
            cabinetContainer.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar-large">${this.currentUser.nickname.charAt(0).toUpperCase()}</div>
                    <h3>Личный кабинет</h3>
                    <p>Никнейм: <strong>${this.currentUser.nickname}</strong></p>
                    <p>Телефон: <strong>${this.currentUser.phone}</strong></p>
                    <div id="userSubmissions" class="submissions-list">
                        <div class="loading">Загрузка истории заявок...</div>
                    </div>
                    <button class="logout-btn" onclick="window.authManager.logout()">
                        <i class="fas fa-sign-out-alt"></i> Выйти
                    </button>
                </div>
            `;
            
            // Загружаем заявки пользователя
            await this.loadUserSubmissions();
        }
        // Показываем модальное окно
        document.getElementById('cabinetModal').style.display = 'block';
    }

    // Загрузить заявки пользователя
    async loadUserSubmissions() {
        try {
            const response = await fetch('/api/quiz/submissions');
            const data = await response.json();
            
            const submissionsContainer = document.getElementById('userSubmissions');
            if (!submissionsContainer) return;
            
            if (!response.ok) {
                submissionsContainer.innerHTML = '<p style="color: var(--error);">Ошибка загрузки заявок</p>';
                return;
            }
            
            const allSubmissions = data.submissions || [];
            // Фильтруем заявки текущего пользователя по телефону
            const userSubmissions = allSubmissions.filter(sub => sub.phone === this.currentUser.phone);
            
            if (userSubmissions.length === 0) {
                submissionsContainer.innerHTML = `
                    <div style="margin-top: 20px; padding: 20px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="margin-bottom: 10px; color: var(--text-primary);">История заявок</h4>
                        <p style="color: var(--text-secondary);">У вас пока нет заявок</p>
                    </div>
                `;
                return;
            }
            
            const submissionsHTML = userSubmissions.map(sub => {
                const createdDate = new Date(sub.created_at).toLocaleDateString('ru-RU');
                const status = sub.status || 'new';
                const statusClass = `status-${status}`;
                const statusText = this.getStatusText(status);
                
                return `
                    <div style="margin-top: 20px; padding: 20px; background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border);">
                        <h4 style="margin-bottom: 10px; color: var(--text-primary);">Заявка #${sub.id}</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.9rem;">
                            <div><strong>Тип:</strong> ${sub.room_type}</div>
                            <div><strong>Стиль:</strong> ${sub.style}</div>
                            <div><strong>Площадь:</strong> ${sub.area} м²</div>
                            <div><strong>Бюджет:</strong> ${sub.budget}</div>
                            <div><strong>Дата:</strong> ${createdDate}</div>
                            <div><strong>Статус:</strong> <span class="status-badge ${statusClass}" style="padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${statusText}</span></div>
                        </div>
                        ${sub.comment ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);"><strong>Комментарий:</strong> ${sub.comment}</div>` : ''}
                    </div>
                `;
            }).join('');
            
            submissionsContainer.innerHTML = `
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: var(--text-primary);">История заявок (${userSubmissions.length})</h4>
                    ${submissionsHTML}
                </div>
            `;
            
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error);
            const submissionsContainer = document.getElementById('userSubmissions');
            if (submissionsContainer) {
                submissionsContainer.innerHTML = '<p style="color: var(--error);">Ошибка загрузки заявок</p>';
            }
        }
    }

    // Получить текст статуса
    getStatusText(status) {
        const statusMap = {
            'new': 'Новая',
            'contacted': 'Связались',
            'in_progress': 'В работе',
            'completed': 'Завершена',
            'cancelled': 'Отмена'
        };
        return statusMap[status] || 'Новая';
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
