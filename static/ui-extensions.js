/**
 * UI Extensions for Interio
 * Функции: 13 (цвета), 18 (голос), 21 (бюджет), 22 (предпросмотр)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ═══════════════════════════════════════
    // Функция 13: Кастомизация цветовой гаммы
    // ═══════════════════════════════════════
    const colorPickerToggle = document.getElementById('colorPickerToggle');
    const colorCustomizer = document.getElementById('colorCustomizer');
    const presetBtns = document.querySelectorAll('.preset-color-btn');
    const customColorPicker = document.getElementById('customColorPicker');
    
    // Загрузка сохраненного цвета
    const savedColor = localStorage.getItem('interio_accent_color') || '#4a6cf7';
    applyAccentColor(savedColor);
    if (customColorPicker) customColorPicker.value = savedColor;
    
    // Открытие/закрытие панели
    if (colorPickerToggle && colorCustomizer) {
        colorPickerToggle.addEventListener('click', () => {
            const isVisible = colorCustomizer.style.display !== 'none';
            colorCustomizer.style.display = isVisible ? 'none' : 'block';
        });
        
        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!colorCustomizer.contains(e.target) && e.target !== colorPickerToggle) {
                colorCustomizer.style.display = 'none';
            }
        });
    }
    
    // Пресеты
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyAccentColor(color);
            if (customColorPicker) customColorPicker.value = color;
            localStorage.setItem('interio_accent_color', color);
        });
    });
    
    // Кастомный цвет
    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            presetBtns.forEach(b => b.classList.remove('active'));
            applyAccentColor(color);
            localStorage.setItem('interio_accent_color', color);
        });
    }
    
    function applyAccentColor(color) {
        document.documentElement.style.setProperty('--accent', color);
        
        // Обновляем CSS переменные для градиентов
        document.documentElement.style.setProperty('--accent-light', color + '33');
        document.documentElement.style.setProperty('--accent-dark', shadeColor(color, -20));
    }
    
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);
        R = Math.min(255, Math.max(0, R + Math.round(R * percent / 100)));
        G = Math.min(255, Math.max(0, G + Math.round(G * percent / 100)));
        B = Math.min(255, Math.max(0, B + Math.round(B * percent / 100)));
        return `#${((R << 16) | (G << 8) | B).toString(16).padStart(6, '0')}`;
    }
    
    // ═══════════════════════════════════════
    // Функция 18: Голосовой ввод (Web Speech API)
    // ═══════════════════════════════════════
    window.initVoiceInput = function(inputId, buttonElement) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition не поддерживается');
            return null;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
            if (buttonElement) {
                buttonElement.classList.add('listening');
                buttonElement.innerHTML = '<i class="fas fa-circle fa-beat"></i>';
            }
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = transcript;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (buttonElement) {
                buttonElement.classList.remove('listening');
                buttonElement.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (buttonElement) {
                buttonElement.classList.remove('listening');
                buttonElement.innerHTML = '<i class="fas fa-microphone"></i>';
            }
            if (event.error === 'not-allowed') {
                showToast('Разрешите доступ к микрофону');
            }
        };
        
        recognition.onend = () => {
            if (buttonElement) {
                buttonElement.classList.remove('listening');
                buttonElement.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        };
        
        return recognition;
    };
    
    // ═══════════════════════════════════════
    // Функция 22: Предпросмотр ответов
    // ═══════════════════════════════════════
    const previewBtn = document.getElementById('previewAnswersBtn');
    const previewOverlay = document.getElementById('previewOverlay');
    const previewClose = document.getElementById('previewClose');
    const previewBack = document.getElementById('previewBack');
    const previewSubmit = document.getElementById('previewSubmit');
    const previewCards = document.getElementById('previewCards');
    
    if (previewBtn) {
        previewBtn.addEventListener('click', showPreview);
    }
    
    if (previewClose) {
        previewClose.addEventListener('click', hidePreview);
    }
    
    if (previewOverlay) {
        previewOverlay.addEventListener('click', (e) => {
            if (e.target === previewOverlay) hidePreview();
        });
    }
    
    if (previewBack) {
        previewBack.addEventListener('click', hidePreview);
    }
    
    if (previewSubmit) {
        previewSubmit.addEventListener('click', () => {
            hidePreview();
            // Находим кнопку "Отправить заявку" и кликаем
            const submitBtn = document.getElementById('nextBtn');
            if (submitBtn) submitBtn.click();
        });
    }
    
    function showPreview() {
        const answers = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
        
        const previewData = [
            { icon: '🏠', label: 'Тип помещения', value: answers.roomType || '—', step: 1 },
            { icon: '📍', label: 'Зоны', value: answers.zones?.join(', ') || '—', step: 2 },
            { icon: '📐', label: 'Площадь', value: answers.area ? answers.area + ' м²' : '—', step: 3 },
            { icon: '🎨', label: 'Стиль', value: answers.style || '—', step: 4 },
            { icon: '💰', label: 'Бюджет', value: answers.budget || '—', step: 5 },
            { icon: '👤', label: 'Имя', value: answers.name || '—', step: 6 },
            { icon: '📱', label: 'Телефон', value: answers.phone || '—', step: 6 },
            { icon: '📧', label: 'Email', value: answers.email || '—', step: 6 },
            { icon: '💬', label: 'Комментарий', value: answers.comment || '—', step: 6 }
        ];
        
        previewCards.innerHTML = previewData.map(item => `
            <div class="preview-card">
                <div class="preview-card-header">
                    <div class="preview-card-icon">${item.icon}</div>
                    <div>
                        <div class="preview-card-label">${item.label}</div>
                        <div class="preview-card-value">${item.value}</div>
                    </div>
                </div>
                <button class="preview-edit-btn" data-step="${item.step}">
                    <i class="fas fa-edit"></i> Изменить
                </button>
            </div>
        `).join('');
        
        // Обработчики кнопок "Изменить"
        previewCards.querySelectorAll('.preview-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.step);
                hidePreview();
                if (window.goToStep) {
                    window.goToStep(step);
                }
            });
        });
        
        previewOverlay.classList.add('show');
    }
    
    function hidePreview() {
        previewOverlay.classList.remove('show');
    }
    
    // Делаем goToStep доступным извне
    const originalGoToStep = window.goToStep;
    // Функция будет установлена из quiz.js
    
    console.log('✅ UI Extensions загружены');
});
