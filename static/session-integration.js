/**
 * Интеграция SessionStateManager с существующими компонентами
 * Обеспечивает плавный переход и совместимость
 */

document.addEventListener('DOMContentLoaded', () => {
    // Ждем загрузки SessionStateManager
    if (!window.sessionStateManager) {
        console.error('SessionStateManager не найден');
        return;
    }

    console.log('Начинаю интеграцию SessionStateManager...');

    // Интеграция с темой
    function integrateTheme() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            // Удаляем существующие обработчики если есть
            const newThemeToggle = themeToggle.cloneNode(true);
            themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
            
            // Добавляем новый обработчик
            newThemeToggle.addEventListener('click', () => {
                window.sessionStateManager.toggleTheme();
            });
        }
    }

    // Интеграция с доступностью - улучшенная синхронизация
    function integrateAccessibility() {
        const a11yToggle = document.getElementById('a11yToggle');
        const a11yClose = document.getElementById('a11yClose');
        
        if (a11yToggle) {
            // Удаляем существующие обработчики
            const newA11yToggle = a11yToggle.cloneNode(true);
            a11yToggle.parentNode.replaceChild(newA11yToggle, a11yToggle);
            
            newA11yToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                window.sessionStateManager.toggleA11yPanel();
            });
        }
        
        if (a11yClose) {
            a11yClose.addEventListener('click', (e) => {
                e.stopPropagation();
                window.sessionStateManager.closeA11yPanel();
            });
        }

        // Универсальные обработчики для всех чекбоксов доступности
        setupUniversalCheckboxHandlers();
        
        // Обработчики для кнопок доступности
        setupUniversalButtonHandlers();
    }

    /**
     * Универсальная настройка обработчиков для чекбоксов
     */
    function setupUniversalCheckboxHandlers() {
        const a11ySettings = [
            { id: 'highContrast', setting: 'contrast' },
            { id: 'largeButtons', setting: 'largeButtons' },
            { id: 'largeText', setting: 'largeText' }
        ];

        a11ySettings.forEach(({ id, setting }) => {
            // Находим все связанные чекбоксы
            const checkboxes = document.querySelectorAll(`#${id}, [name="${id}"], input[type="checkbox"][data-setting="${setting}"]`);
            
            checkboxes.forEach(checkbox => {
                // Удаляем старые обработчики
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                
                // Добавляем новый обработчик
                newCheckbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    window.sessionStateManager.setAccessibility(setting, e.target.checked);
                });
                
                // Устанавливаем начальное состояние
                const currentState = window.sessionStateManager.getAccessibility();
                newCheckbox.checked = currentState[setting];
            });
        });
    }

    /**
     * Универсальная настройка обработчиков для кнопок
     */
    function setupUniversalButtonHandlers() {
        const a11yButtons = [
            { setting: 'contrast', selectors: ['[data-a11y="contrast"]', '.a11y-contrast-btn', 'button[onclick*="Contrast"]'] },
            { setting: 'largeButtons', selectors: ['[data-a11y="largeButtons"]', '.a11y-large-buttons-btn', 'button[onclick*="largeButtons"]'] },
            { setting: 'largeText', selectors: ['[data-a11y="largeText"]', '.a11y-large-text-btn', 'button[onclick*="largeText"]'] }
        ];

        a11yButtons.forEach(({ setting, selectors }) => {
            selectors.forEach(selector => {
                const buttons = document.querySelectorAll(selector);
                
                buttons.forEach(button => {
                    // Удаляем старые обработчики
                    const newButton = button.cloneNode(true);
                    button.parentNode.replaceChild(newButton, button);
                    
                    // Добавляем новый обработчик
                    newButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentState = window.sessionStateManager.getAccessibility();
                        const newValue = !currentState[setting];
                        window.sessionStateManager.setAccessibility(setting, newValue);
                    });
                    
                    // Устанавливаем начальное состояние
                    const currentState = window.sessionStateManager.getAccessibility();
                    if (currentState[setting]) {
                        newButton.classList.add('active');
                        newButton.setAttribute('aria-pressed', 'true');
                    } else {
                        newButton.classList.remove('active');
                        newButton.setAttribute('aria-pressed', 'false');
                    }
                });
            });
        });
    }

    // Интеграция с авторизацией
    function integrateAuth() {
        // Слушаем события изменения авторизации
        document.addEventListener('authChanged', (e) => {
            const { isAuthenticated, user } = e.detail;
            console.log('Событие авторизации:', { isAuthenticated, user });
            
            // Обновляем существующий AuthManager если есть
            if (window.authManager) {
                window.authManager.currentUser = user;
                window.authManager.updateLoginButton();
            }
        });
    }

    // Интеграция с StateManager для обратной совместимости
    function integrateStateManager() {
        if (window.stateManager) {
            // Обновляем StateManager при изменениях
            document.addEventListener('themeChanged', (e) => {
                const { newTheme } = e.detail;
                if (window.stateManager.setTheme) {
                    window.stateManager.setTheme(newTheme);
                }
            });

            document.addEventListener('accessibilityChanged', (e) => {
                const { setting, value } = e.detail;
                switch (setting) {
                    case 'contrast':
                        if (window.stateManager.setA11yContrast) {
                            window.stateManager.setA11yContrast(value);
                        }
                        break;
                    case 'largeButtons':
                        if (window.stateManager.setA11yLargeButtons) {
                            window.stateManager.setA11yLargeButtons(value);
                        }
                        break;
                    case 'largeText':
                        if (window.stateManager.setA11yLargeText) {
                            window.stateManager.setA11yLargeText(value);
                        }
                        break;
                }
            });
        }
    }

    // Закрытие модальных окон при клике вне их - улучшенная версия
    function setupModalCloseHandlers() {
        document.addEventListener('click', (e) => {
            const a11yPanel = document.getElementById('a11yPanel');
            const a11yToggle = document.getElementById('a11yToggle');
            
            if (a11yPanel && a11yToggle) {
                const clickInsidePanel = a11yPanel.contains(e.target);
                const clickOnToggle = a11yToggle.contains(e.target);
                
                // Закрываем панель только если клик вне панели и не на кнопке-триггере
                if (!clickInsidePanel && !clickOnToggle) {
                    window.sessionStateManager.closeA11yPanel();
                }
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const a11yPanel = document.getElementById('a11yPanel');
                if (a11yPanel && a11yPanel.classList.contains('show')) {
                    window.sessionStateManager.closeA11yPanel();
                }
            }
        });
    }

    // Обработчики изменений в других вкладках
    function setupTabSync() {
        // Синхронизация темы
        document.addEventListener('themeChanged', (e) => {
            const { newTheme } = e.detail;
            console.log('Тема изменена на:', newTheme);
        });

        // Синхронизация доступности
        document.addEventListener('accessibilityChanged', (e) => {
            const { setting, value } = e.detail;
            console.log(`Настройка доступности изменена: ${setting} = ${value}`);
        });
    }

    // Инициализация всех интеграций
    function initializeIntegrations() {
        integrateTheme();
        integrateAccessibility();
        integrateAuth();
        integrateStateManager();
        setupModalCloseHandlers();
        setupTabSync();
        
        console.log('Все интеграции SessionStateManager завершены');
    }

    // Запускаем интеграцию с небольшой задержкой для уверенности в загрузке DOM
    setTimeout(initializeIntegrations, 100);
});

// Экспорт функций для использования в других скриптах
window.SessionIntegration = {
    // Получение текущего состояния
    getCurrentState: () => window.sessionStateManager.getState(),
    
    // Быстрые операции
    quickThemeToggle: () => window.sessionStateManager.toggleTheme(),
    quickA11yToggle: () => window.sessionStateManager.toggleA11yPanel(),
    
    // Проверки состояния
    isDarkTheme: () => window.sessionStateManager.getTheme() === 'dark',
    isAuthenticated: () => window.sessionStateManager.isAuthenticated(),
    
    // Отладка
    exportDebugInfo: () => window.sessionStateManager.exportState(),
    resetAll: () => window.sessionStateManager.reset()
};
