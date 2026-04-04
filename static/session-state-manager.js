/**
 * SessionStateManager - централизованное управление состоянием темы, адаптаций и авторизации
 * Работает в рамках одной сессии пользователя
 */
class SessionStateManager {
    constructor() {
        this.sessionKey = 'interio_session_state';
        this.state = {
            theme: 'dark',
            accessibility: {
                contrast: false,
                largeButtons: false,
                largeText: false
            },
            auth: {
                isAuthenticated: false,
                user: null,
                token: null
            },
            ui: {
                a11yPanelOpen: false,
                activeModal: null
            }
        };
        
        this.init();
    }

    /**
     * Инициализация менеджера состояний
     */
    init() {
        this.loadFromStorage();
        this.applyInitialState();
        this.setupEventListeners();
        console.log('SessionStateManager инициализирован');
    }

    /**
     * Загрузка состояния из хранилища
     */
    loadFromStorage() {
        try {
            const savedState = storageGet(this.sessionKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                this.state = { ...this.state, ...parsedState };
                console.log('Состояние загружено из хранилища:', this.state);
            }
        } catch (error) {
            console.warn('Ошибка загрузки состояния:', error);
        }
    }

    /**
     * Сохранение состояния в хранилище
     */
    saveToStorage() {
        try {
            storageSet(this.sessionKey, JSON.stringify(this.state));
            console.log('Состояние сохранено в хранилище');
        } catch (error) {
            console.warn('Ошибка сохранения состояния:', error);
        }
    }

    /**
     * Применение начального состояния к DOM
     */
    applyInitialState() {
        // Применяем тему
        this.applyTheme(this.state.theme);
        
        // Применяем настройки доступности
        this.applyAccessibility();
        
        // Применяем состояние авторизации
        this.applyAuthState();
    }

    /**
     * Установка обработчиков событий
     */
    setupEventListeners() {
        // Отслеживание изменений темы в системе
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                if (!this.state.theme) { // Если пользователь не выбрал тему явно
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        // Отслеживание видимости страницы для синхронизации
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.syncWithOtherTabs();
            }
        });

        // Очистка состояния при закрытии вкладки
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Управление темой
     */
    setTheme(theme) {
        const oldTheme = this.state.theme;
        this.state.theme = theme;
        this.applyTheme(theme);
        this.saveToStorage();
        this.notifyThemeChange(oldTheme, theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
    }

    updateThemeIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }

    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }

    /**
     * Применение настроек доступности с синхронизацией UI элементов
     */
    applyAccessibility() {
        const root = document.documentElement;
        const { contrast, largeButtons, largeText } = this.state.accessibility;
        
        // Применяем атрибуты к DOM
        root.setAttribute('data-contrast', contrast ? 'high' : 'normal');
        root.setAttribute('data-large-buttons', largeButtons ? 'true' : 'false');
        root.setAttribute('data-large-text', largeText ? 'true' : 'false');
        
        // Синхронизируем все UI элементы
        this.syncAllA11yElements();
    }

    /**
     * Полная синхронизация всех элементов доступности
     */
    syncAllA11yElements() {
        const { contrast, largeButtons, largeText } = this.state.accessibility;
        
        // Синхронизация чекбоксов
        this.syncCheckboxes('highContrast', contrast);
        this.syncCheckboxes('largeButtons', largeButtons);
        this.syncCheckboxes('largeText', largeText);
        
        // Синхронизация кнопок
        this.syncA11yButtons();
        
        // Синхронизация панели
        this.syncA11yPanel();
        
        console.log('Синхронизированы элементы доступности:', this.state.accessibility);
    }

    /**
     * Синхронизация конкретного чекбокса
     */
    syncCheckboxes(checkboxId, checked) {
        const checkboxes = document.querySelectorAll(`#${checkboxId}, [name="${checkboxId}"], input[type="checkbox"][data-setting="${checkboxId}"]`);
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked !== checked) {
                checkbox.checked = checked;
                // Триггерим событие change для обновления зависимых элементов
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    /**
     * Синхронизация кнопок доступности
     */
    syncA11yButtons() {
        const { contrast, largeButtons, largeText } = this.state.accessibility;
        
        // Обновляем состояние кнопок
        this.updateA11yButton('contrast', contrast);
        this.updateA11yButton('largeButtons', largeButtons);
        this.updateA11yButton('largeText', largeText);
    }

    /**
     * Обновление конкретной кнопки доступности
     */
    updateA11yButton(type, active) {
        const buttonSelectors = [
            `[data-a11y="${type}"]`,
            `.a11y-btn-${type}`,
            `button[onclick*="${type}"]`
        ];
        
        buttonSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(button => {
                if (active) {
                    button.classList.add('active');
                    button.setAttribute('aria-pressed', 'true');
                } else {
                    button.classList.remove('active');
                    button.setAttribute('aria-pressed', 'false');
                }
            });
        });
    }

    /**
     * Синхронизация панели доступности
     */
    syncA11yPanel() {
        const a11yPanel = document.getElementById('a11yPanel');
        const a11yToggle = document.getElementById('a11yToggle');
        
        if (a11yPanel && a11yToggle) {
            const isOpen = this.state.ui.a11yPanelOpen;
            
            // Обновляем классы
            if (isOpen) {
                a11yPanel.classList.add('show');
                a11yToggle.classList.add('active');
                a11yToggle.setAttribute('aria-expanded', 'true');
            } else {
                a11yPanel.classList.remove('show');
                a11yToggle.classList.remove('active');
                a11yToggle.setAttribute('aria-expanded', 'false');
            }
        }
    }

    /**
     * Управление доступностью с улучшенной синхронизацией
     */
    setAccessibility(setting, value) {
        if (this.state.accessibility.hasOwnProperty(setting)) {
            const oldValue = this.state.accessibility[setting];
            this.state.accessibility[setting] = value;
            
            // Применяем и синхронизируем
            this.applyAccessibility();
            this.saveToStorage();
            
            // Уведомляем только если значение действительно изменилось
            if (oldValue !== value) {
                this.notifyAccessibilityChange(setting, value);
            }
        }
    }

    toggleA11yPanel() {
        this.state.ui.a11yPanelOpen = !this.state.ui.a11yPanelOpen;
        this.syncA11yPanel();
        this.saveToStorage();
    }

    closeA11yPanel() {
        if (this.state.ui.a11yPanelOpen) {
            this.state.ui.a11yPanelOpen = false;
            this.syncA11yPanel();
            this.saveToStorage();
        }
    }

    applyA11yPanelState() {
        const a11yPanel = document.getElementById('a11yPanel');
        if (a11yPanel) {
            if (this.state.ui.a11yPanelOpen) {
                a11yPanel.classList.add('show');
                this.syncA11yCheckboxes();
            } else {
                a11yPanel.classList.remove('show');
            }
        }
    }

    closeA11yPanel() {
        this.state.ui.a11yPanelOpen = false;
        this.applyA11yPanelState();
        this.saveToStorage();
    }

    /**
     * Управление авторизацией
     */
    setAuthState(isAuthenticated, user = null, token = null) {
        this.state.auth.isAuthenticated = isAuthenticated;
        this.state.auth.user = user;
        this.state.auth.token = token;
        
        this.applyAuthState();
        this.saveToStorage();
        this.notifyAuthChange(isAuthenticated, user);
    }

    applyAuthState() {
        const { isAuthenticated, user } = this.state.auth;
        
        // Обновляем UI элементы авторизации
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userNickname = document.getElementById('userNicknameDisplay');
        
        if (isAuthenticated && user) {
            // Показываем профиль пользователя
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            if (userAvatar) userAvatar.textContent = user.nickname.charAt(0).toUpperCase();
            if (userNickname) userNickname.textContent = user.nickname;
        } else {
            // Показываем кнопку входа
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userProfile) userProfile.style.display = 'none';
        }
    }

    logout() {
        this.setAuthState(false, null, null);
        console.log('Пользователь вышел из системы');
    }

    /**
     * Управление модальными окнами
     */
    setActiveModal(modalId) {
        this.state.ui.activeModal = modalId;
        this.saveToStorage();
    }

    clearActiveModal() {
        this.state.ui.activeModal = null;
        this.saveToStorage();
    }

    /**
     * Получение текущего состояния
     */
    getState() {
        return { ...this.state };
    }

    getTheme() {
        return this.state.theme;
    }

    getAccessibility() {
        return { ...this.state.accessibility };
    }

    getAuthState() {
        return { ...this.state.auth };
    }

    isAuthenticated() {
        return this.state.auth.isAuthenticated;
    }

    getCurrentUser() {
        return this.state.auth.user;
    }

    /**
     * Синхронизация между вкладками
     */
    syncWithOtherTabs() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.sessionKey && e.newValue) {
                try {
                    const newState = JSON.parse(e.newValue);
                    this.state = { ...this.state, ...newState };
                    this.applyInitialState();
                    console.log('Состояние синхронизировано из другой вкладки');
                } catch (error) {
                    console.warn('Ошибка синхронизации состояния:', error);
                }
            }
        });
    }

    /**
     * Уведомления об изменениях
     */
    notifyThemeChange(oldTheme, newTheme) {
        const event = new CustomEvent('themeChanged', {
            detail: { oldTheme, newTheme }
        });
        document.dispatchEvent(event);
    }

    notifyAccessibilityChange(setting, value) {
        const event = new CustomEvent('accessibilityChanged', {
            detail: { setting, value }
        });
        document.dispatchEvent(event);
    }

    notifyAuthChange(isAuthenticated, user) {
        const event = new CustomEvent('authChanged', {
            detail: { isAuthenticated, user }
        });
        document.dispatchEvent(event);
    }

    /**
     * Сброс состояния
     */
    reset() {
        this.state = {
            theme: 'dark',
            accessibility: {
                contrast: false,
                largeButtons: false,
                largeText: false
            },
            auth: {
                isAuthenticated: false,
                user: null,
                token: null
            },
            ui: {
                a11yPanelOpen: false,
                activeModal: null
            }
        };
        
        this.applyInitialState();
        this.saveToStorage();
        console.log('Состояние сброшено');
    }

    /**
     * Очистка при закрытии
     */
    cleanup() {
        // Сохраняем финальное состояние
        this.saveToStorage();
        
        // Очищаем временные данные
        this.state.ui.activeModal = null;
    }

    /**
     * Экспорт состояния для отладки
     */
    exportState() {
        return {
            timestamp: new Date().toISOString(),
            state: this.state,
            storage: storageGet(this.sessionKey)
        };
    }

    /**
     * Импорт состояния
     */
    importState(stateData) {
        try {
            this.state = { ...this.state, ...stateData };
            this.applyInitialState();
            this.saveToStorage();
            console.log('Состояние импортировано');
            return true;
        } catch (error) {
            console.error('Ошибка импорта состояния:', error);
            return false;
        }
    }
}

// Создаем глобальный экземпляр
window.sessionStateManager = new SessionStateManager();

// Удобные глобальные функции для обратной совместимости
window.setTheme = (theme) => window.sessionStateManager.setTheme(theme);
window.toggleTheme = () => window.sessionStateManager.toggleTheme();
window.setA11yContrast = (value) => window.sessionStateManager.setAccessibility('contrast', value);
window.setA11yLargeButtons = (value) => window.sessionStateManager.setAccessibility('largeButtons', value);
window.setA11yLargeText = (value) => window.sessionStateManager.setAccessibility('largeText', value);
window.toggleA11yPanel = () => window.sessionStateManager.toggleA11yPanel();
window.closeA11yPanel = () => window.sessionStateManager.closeA11yPanel();

// Уведомления о готовности
document.addEventListener('DOMContentLoaded', () => {
    console.log('SessionStateManager готов к использованию');
});
