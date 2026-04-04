class StateManager {
    constructor() {
        this.sessionId = null;
        this.templates = {};
        this.currentTemplateIndex = 0;
        this.templateIds = ['template1', 'template2', 'template3', 'template4', 'template5', 'template6'];
        this.init();
    }

    // Инициализация state-менеджера
    init() {
        // Автоматически создаем сессию при загрузке страницы
        this.createSession();
        
        // Устанавливаем обработчики для удаления сессии при уходе
        this.setupSessionCleanup();
    }

    // Настройка очистки сессии при уходе со страницы
    setupSessionCleanup() {
        // Удаление сессии только при закрытии вкладки/окна
        window.addEventListener('beforeunload', () => {
            this.clearSession(true);
        });
    }

    // Создание новой сессии
    createSession() {
        this.sessionId = this.generateSessionId();
        this.templates = {};
        this.currentTemplateIndex = 0;
        
        // Инициализируем состояния для всех шаблонов
        this.templateIds.forEach(id => {
            this.templates[id] = {
                visible: false,
                data: null,
                timestamp: null
            };
        });

        this.saveSession();
        console.log('Сессия создана:', this.sessionId);
        return this.sessionId;
    }

    // Переключение на следующий шаблон
    nextTemplate() {
        if (!this.sessionId) {
            console.warn('Нет активной сессии');
            return null;
        }

        // Проверка: если текущий шаблон последний, не переключаемся
        if (this.currentTemplateIndex === this.templateIds.length - 1) {
            console.log('Достигнут последний шаблон, переключение невозможно');
            return null;
        }

        // Скрываем текущий шаблон
        this.hideCurrentTemplate();

        // Переключаем индекс
        this.currentTemplateIndex = (this.currentTemplateIndex + 1) % this.templateIds.length;
        
        // Показываем новый шаблон
        return this.showTemplate(this.templateIds[this.currentTemplateIndex]);
    }

    // Переключение на предыдущий шаблон
    previousTemplate() {
        if (!this.sessionId) {
            console.warn('Нет активной сессии');
            return null;
        }

        // Проверка: если текущий шаблон первый, не переключаемся
        if (this.currentTemplateIndex === 0) {
            console.log('Достигнут первый шаблон, переключение невозможно');
            return null;
        }

        // Скрываем текущий шаблон
        this.hideCurrentTemplate();

        // Переключаем индекс
        this.currentTemplateIndex = (this.currentTemplateIndex - 1 + this.templateIds.length) % this.templateIds.length;
        
        // Показываем новый шаблон
        return this.showTemplate(this.templateIds[this.currentTemplateIndex]);
    }

    // Показать конкретный шаблон
    showTemplate(templateId) {
        if (!this.sessionId) {
            console.warn('Нет активной сессии');
            return null;
        }

        // Скрываем все шаблоны и основной контент
        this.hideAllTemplates();
        this.hideMainContent();

        // Находим элемент шаблона
        const templateElement = document.getElementById(templateId);
        if (templateElement) {
            // Убираем класс template для показа
            templateElement.classList.remove('template');
            
            // Обновляем состояние
            if (this.templates[templateId]) {
                this.templates[templateId].visible = true;
                this.templates[templateId].timestamp = new Date().toISOString();
            }
            
            // Обновляем текущий индекс
            this.currentTemplateIndex = this.templateIds.indexOf(templateId);
            
            this.saveSession();
            console.log('Показан шаблон:', templateId);
            return templateId;
        }
        
        return null;
    }

    // Скрыть текущий шаблон
    hideCurrentTemplate() {
        const currentId = this.templateIds[this.currentTemplateIndex];
        if (currentId && this.templates[currentId]) {
            this.templates[currentId].visible = false;
            const element = document.getElementById(currentId);
            if (element) {
                element.classList.add('template');
            }
        }
    }

    // Скрыть все шаблоны
    hideAllTemplates() {
        this.templateIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('template');
            }
            if (this.templates[id]) {
                this.templates[id].visible = false;
            }
        });
    }

    // Показать основной контент
    showMainContent() {
        const mainContent = document.querySelector('.rounded-rectangle:not(.template)');
        if (mainContent) {
            mainContent.style.display = 'flex';
        }
    }

    // Скрыть основной контент
    hideMainContent() {
        const mainContent = document.querySelector('.rounded-rectangle:not(.template)');
        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    // Вернуться к основному контенту
    returnToMain() {
        this.hideAllTemplates();
        this.showMainContent();
        this.currentTemplateIndex = 0;
        this.saveSession();
        console.log('Возврат к основному контенту');
    }

    // Сохранить состояние шаблона
    saveTemplateState(templateId, data) {
        if (this.templates[templateId]) {
            this.templates[templateId].data = data;
            this.templates[templateId].timestamp = new Date().toISOString();
            this.saveSession();
        }
    }

    // Получить состояние шаблона
    getTemplateState(templateId) {
        return this.templates[templateId] || null;
    }

    // Получить текущий шаблон
    getCurrentTemplate() {
        return this.templateIds[this.currentTemplateIndex];
    }

    // Сохранить сессию в localStorage
    saveSession() {
        const sessionData = {
            sessionId: this.sessionId,
            templates: this.templates,
            currentTemplateIndex: this.currentTemplateIndex
        };
        localStorage.setItem('templateSession', JSON.stringify(sessionData));
    }

    // Удалить сессию
    clearSession(silent = false) {
        this.sessionId = null;
        this.templates = {};
        this.currentTemplateIndex = 0;
        localStorage.removeItem('templateSession');
        if (!silent) {
            console.log('Сессия очищена');
        }
    }

    // Генератор ID для сессии
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Получить информацию о сессии
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            currentTemplate: this.getCurrentTemplate(),
            templates: this.templates,
            currentTemplateIndex: this.currentTemplateIndex
        };
    }

    // Валидация номера телефона
    validatePhone(phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        
        if (cleanPhone.length === 11) {
            return cleanPhone.startsWith('7') || cleanPhone.startsWith('8');
        }
        
        return false;
    }

    // Форматирование телефона при вводе
    formatPhone(input) {
        let value = input.value.replace(/[^\d]/g, '');
        let formattedValue = '';
        
        if (value.length > 0) {
            if (value.startsWith('8')) {
                value = '7' + value.substring(1);
            } else if (!value.startsWith('7')) {
                value = '7' + value;
            }
            
            if (value.length <= 1) {
                formattedValue = '+' + value;
            } else if (value.length <= 4) {
                formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1);
            } else if (value.length <= 7) {
                formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4);
            } else if (value.length <= 9) {
                formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4, 7) + '-' + value.substring(7);
            } else {
                formattedValue = '+' + value.substring(0, 1) + ' (' + value.substring(1, 4) + ') ' + value.substring(4, 7) + '-' + value.substring(7, 9) + '-' + value.substring(9, 11);
            }
        }
        
        input.value = formattedValue;
    }

    // Нормализация телефона
    normalizePhone(phone) {
        let cleanPhone = phone.replace(/[^\d]/g, '');
        
        if (cleanPhone.length === 11 && cleanPhone.startsWith('8')) {
            cleanPhone = '7' + cleanPhone.substring(1);
        }
        
        if (cleanPhone.length === 10) {
            cleanPhone = '7' + cleanPhone;
        }
        
        return '+' + cleanPhone;
    }

    // Сохранение валидного номера телефона в сессии
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

    // Синхронизация сессии с сервером
    async syncSessionWithServer() {
        try {
            const response = await fetch('/api/session/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('Сессия синхронизирована с сервером');
            }
        } catch (error) {
            console.error('Ошибка синхронизации сессии:', error);
        }
    }

    // Получение данных сессии с сервера
    async getSessionFromServer() {
        try {
            const response = await fetch('/api/session/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });
            
            const data = await response.json();
            if (data.success) {
                console.log('Данные сессии получены с сервера');
                return data.data;
            }
        } catch (error) {
            console.error('Ошибка получения данных сессии:', error);
        }
        return null;
    }
}

// Singleton pattern for StateManager
if (!window.stateManager) {
    window.stateManager = new StateManager();
} else {
    console.log('StateManager instance already exists, reusing existing instance');
}

// window.stateManager.createSession() - создать сессию
// window.stateManager.showTemplate('template1') - показать шаблон 1
// window.stateManager.nextTemplate() - следующий шаблон
// window.stateManager.previousTemplate() - предыдущий шаблон
// window.stateManager.returnToMain() - вернуться к основному контенту
// window.stateManager.getSessionInfo() - информация о сессии
// window.stateManager.validatePhone(phone) - валидация телефона
// window.stateManager.formatPhone(input) - форматирование телефона при вводе
// window.stateManager.normalizePhone(phone) - нормализация телефона
// window.stateManager.saveValidatedPhone(phone) - сохранение валидного телефона в сессию
// window.stateManager.syncSessionWithServer() - синхронизация сессии с сервером
// window.stateManager.getSessionFromServer() - получение данных сессии с сервера
