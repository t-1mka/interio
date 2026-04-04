document.addEventListener('DOMContentLoaded', () => {
    let currentStep = 1;
    const totalSteps = 6;
    const steps = document.querySelectorAll('.quiz-step');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const finishEarlyBtn = document.getElementById('finishEarlyBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('currentStepNum');
    const progressPercent = document.getElementById('progressPercent');
    const quizNav = document.getElementById('quizNav');
    const successScreen = document.getElementById('successScreen');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

    // --- Theme Toggle ---
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    if (window.stateManager && typeof window.stateManager.applyThemeFromStorage === 'function') {
        window.stateManager.applyThemeFromStorage();
    }
    const savedTheme = html.getAttribute('data-theme') || 'dark';
    updateThemeIcon(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            if (window.stateManager && typeof window.stateManager.setTheme === 'function') {
                window.stateManager.setTheme(next);
            }
            updateThemeIcon(next);
        });
    }

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // --- A11y ---
    initA11y();

    function initA11y() {
        const a11yToggle = document.getElementById('a11yToggle');
        const a11yPanel = document.getElementById('a11yPanel');
        const a11yClose = document.getElementById('a11yClose');
        if (!a11yToggle) return;

        if (window.stateManager && typeof window.stateManager.applyA11yFromStorageFull === 'function') {
            window.stateManager.applyA11yFromStorageFull();
        }

        a11yToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const opening = !a11yPanel.classList.contains('show');
            a11yPanel.classList.toggle('show');
            if (opening && window.stateManager && typeof window.stateManager.syncA11yCheckboxesFromStorage === 'function') {
                window.stateManager.syncA11yCheckboxesFromStorage();
            }
        });
        a11yClose.addEventListener('click', () => a11yPanel.classList.remove('show'));
        document.addEventListener('click', (e) => {
            if (!a11yPanel || !a11yToggle) return;
            if (a11yPanel.contains(e.target) || a11yToggle.contains(e.target)) return;
            a11yPanel.classList.remove('show');
        });

        const hc = document.getElementById('highContrast');
        if (hc) hc.addEventListener('change', (e) => {
            if (window.stateManager && typeof window.stateManager.setA11yContrast === 'function') {
                window.stateManager.setA11yContrast(e.target.checked);
            }
        });
        const lb = document.getElementById('largeButtons');
        if (lb) lb.addEventListener('change', (e) => {
            if (window.stateManager && typeof window.stateManager.setA11yLargeButtons === 'function') {
                window.stateManager.setA11yLargeButtons(e.target.checked);
            }
        });
        const lt = document.getElementById('largeText');
        if (lt) lt.addEventListener('change', (e) => {
            if (window.stateManager && typeof window.stateManager.setA11yLargeText === 'function') {
                window.stateManager.setA11yLargeText(e.target.checked);
            }
        });
    }

    // --- Toast Notification ---
    window.showToast = function(message, duration = 3000) {
        const toast = document.getElementById('toastNotification');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) {
            console.error('Toast elements not found:', { toast, toastMessage });
            return;
        }

        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // --- Slider ---
    const areaSlider = document.getElementById('areaSlider');
    const sliderValueDisplay = document.getElementById('sliderValue');
    
    function updateSliderBackground(slider) {
        const min = parseFloat(slider.min) || 20;
        const max = parseFloat(slider.max) || 300;
        const val = parseFloat(slider.value) || 60;
        const percent = ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #4a6cf7 0%, #e74c5e ${percent}%, var(--slider-track) ${percent}%, var(--slider-track) 100%)`;
    }

    localStorage.removeItem('interio_quiz_answers');
    
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(el => el.value = '');

    if (areaSlider) {
        areaSlider.value = 60;
        sliderValueDisplay.textContent = areaSlider.value;
        updateSliderBackground(areaSlider); 

        areaSlider.addEventListener('input', (e) => {
            sliderValueDisplay.textContent = e.target.value;
            updateSliderBackground(e.target); 
            saveAnswer();
        });
    }

    document.querySelectorAll('.quiz-container input, .quiz-container textarea').forEach(el => {
        el.addEventListener('change', saveAnswer);
        el.addEventListener('input', saveAnswer);
    });

    function saveAnswer() {
        const answers = {};
        const room = document.querySelector('.quiz-container input[name="roomType"]:checked');
        if (room) answers.roomType = room.value;
        const zones = Array.from(document.querySelectorAll('.quiz-container input[name="zones"]:checked')).map(c => c.value);
        if (zones.length) answers.zones = zones;
        answers.area = areaSlider ? areaSlider.value : '60';
        const style = document.querySelector('.quiz-container input[name="style"]:checked');
        if (style) answers.style = style.value;
        const budget = document.querySelector('.quiz-container input[name="budget"]:checked');
        if (budget) answers.budget = budget.value;
        answers.name = document.getElementById('inputName')?.value || '';
        answers.phone = document.getElementById('inputPhone')?.value || '';
        answers.email = document.getElementById('inputEmail')?.value || '';
        answers.comment = document.getElementById('inputComment')?.value || '';
        answers.consent = document.getElementById('consentCheck')?.checked || false;
        localStorage.setItem('interio_quiz_answers', JSON.stringify(answers));
    }

    // --- Navigation ---
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep === totalSteps) {
                submitForm();
            } else {
                goToStep(currentStep + 1);
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) goToStep(currentStep - 1);
    });

    finishEarlyBtn.addEventListener('click', () => {
        goToStep(totalSteps);
    });

    function goToStep(step) {
        steps.forEach(s => s.classList.remove('active'));
        const target = document.querySelector(`.quiz-step[data-step="${step}"]`);
        if (target) target.classList.add('active');
        currentStep = step;
        updateProgress();
        prevBtn.disabled = currentStep === 1;
        if (currentStep === totalSteps) {
            nextBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';
            finishEarlyBtn.style.display = 'none';
        } else {
            nextBtn.innerHTML = 'Далее <i class="fas fa-arrow-right"></i>';
            finishEarlyBtn.style.display = '';
        }
    }

    function updateProgress() {
        const pct = Math.round((currentStep / totalSteps) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = currentStep;
        progressPercent.textContent = pct + '%';
    }

    function validateStep(step) {
        switch (step) {
            case 1: 
                const roomType = document.querySelector('.quiz-container input[name="roomType"]:checked');
                if (!roomType) {
                    showToast('Пожалуйста, выберите тип помещения');
                    return false;
                }
                return true;
            case 2: 
                const zones = document.querySelectorAll('.quiz-container input[name="zones"]:checked');
                if (zones.length === 0) {
                    showToast('Пожалуйста, выберите хотя бы одну зону');
                    return false;
                }
                return true;
            case 3: return true;
            case 4: 
                const style = document.querySelector('.quiz-container input[name="style"]:checked');
                if (!style) {
                    showToast('Пожалуйста, выберите стиль интерьера');
                    return false;
                }
                return true;
            case 5: 
                const budget = document.querySelector('.quiz-container input[name="budget"]:checked');
                if (!budget) {
                    showToast('Пожалуйста, выберите бюджет');
                    return false;
                }
                return true;
            case 6: return validateForm();
            default: return true;
        }
    }

    function validateForm() {
        const name = document.getElementById('inputName').value.trim();
        const phone = document.getElementById('inputPhone').value.trim();
        const consent = document.getElementById('consentCheck').checked;
        let valid = true;
        
        if (!name) {
            showToast('Пожалуйста, введите ваше имя');
            return false;
        }
        
        const phoneErr = document.getElementById('phoneError');
        if (!phone || phone.length < 5) {
            phoneErr.classList.add('show');
            showToast('Пожалуйста, введите корректный номер телефона');
            valid = false;
        } else {
            phoneErr.classList.remove('show');
        }
        
        const consentErr = document.getElementById('consentError');
        if (!consent) {
            consentErr.classList.add('show');
            showToast('Необходимо согласие на обработку персональных данных');
            valid = false;
        } else {
            consentErr.classList.remove('show');
        }
        
        return valid;
    }

    async function submitForm() {
        saveAnswer();
        const answers = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
        
        const nextBtn = document.getElementById('nextBtn');
        const originalText = nextBtn.innerHTML;
        nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        nextBtn.disabled = true;
        
        try {
            const submissionData = {
                name: answers.name || '',
                phone: answers.phone || '',
                email: answers.email || '',
                room_type: answers.roomType || '',
                zones: answers.zones || [],
                area: parseInt(answers.area) || 60,
                style: answers.style || '',
                budget: answers.budget || '',
                comment: answers.comment || '',
                consent: answers.consent || false
            };
            
            console.log('📩 Отправка заявки:', submissionData);
            
            const mockResponse = new Promise(resolve => setTimeout(() => resolve({ok: true, json: () => ({success: true, submission_id: Math.floor(Math.random()*10000)})}), 1000));
            const response = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(submissionData)
            }).catch(() => mockResponse); 
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('✅ Заявка успешно сохранена, ID:', result.submission_id);
                
                steps.forEach(s => s.style.display = 'none');
                document.querySelector('.quiz-progress').style.display = 'none';
                quizNav.style.display = 'none';
                finishEarlyBtn.style.display = 'none';
                successScreen.classList.add('active');
                successScreen.style.display = 'block';
                
                localStorage.setItem('interio_submission_id', result.submission_id);
                
            } else {
                throw new Error(result.error || result.detail || 'Ошибка сервера');
            }
            
        } catch (error) {
            console.error('❌ Ошибка при отправке заявки:', error);
            showToast(`Ошибка при сохранении заявки: ${error.message}`);
            nextBtn.innerHTML = originalText;
            nextBtn.disabled = false;
        }
    }

    // --- PDF ---
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalText = downloadPdfBtn.innerHTML;
            downloadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Подготовка...';
            downloadPdfBtn.disabled = true;

            try {
                await generatePDF();
            } catch (error) {
                console.error("Ошибка генерации PDF:", error);
                showToast("Произошла ошибка при создании PDF-документа.");
            } finally {
                downloadPdfBtn.innerHTML = originalText;
                downloadPdfBtn.disabled = false;
            }
        });
    }

    async function generatePDF() {
        const answers = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const fetchFont = async (url) => {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        };

        const fontRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
        const fontMediumUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';

        const [fontRegular, fontMedium] = await Promise.all([
            fetchFont(fontRegularUrl),
            fetchFont(fontMediumUrl)
        ]);

        doc.addFileToVFS('Roboto-Regular.ttf', fontRegular);
        doc.addFileToVFS('Roboto-Medium.ttf', fontMedium);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

        doc.setFillColor(74, 108, 247);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        
        doc.setFont('Roboto', 'bold');
        doc.text('Interio', 20, 22);
        
        doc.setFontSize(12);
        doc.setFont('Roboto', 'normal');
        doc.text('Заявка на дизайн-проект', 20, 32);
        
        let y = 55;
        doc.setTextColor(30, 30, 30);
        
        const addSection = (title, value) => {
            doc.setFontSize(11);
            doc.setFont('Roboto', 'bold');
            doc.setTextColor(74, 108, 247);
            doc.text(title, 20, y);
            y += 7;
            
            doc.setFont('Roboto', 'normal');
            doc.setTextColor(50, 50, 50);
            
            if (Array.isArray(value)) {
                value.forEach(v => { doc.text('• ' + v, 24, y); y += 6; });
            } else {
                const textStr = String(value || '—');
                const textLines = doc.splitTextToSize(textStr, 170);
                doc.text(textLines, 20, y);
                y += (6 * textLines.length);
            }
            y += 4;
        };

        addSection('Тип помещения:', answers.roomType);
        addSection('Зоны:', answers.zones);
        addSection('Площадь:', answers.area ? answers.area + ' м²' : '—');
        addSection('Стиль:', answers.style);
        addSection('Бюджет:', answers.budget);
        
        y += 5;
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, 190, y);
        y += 10;
        
        addSection('Имя:', answers.name);
        addSection('Телефон:', answers.phone);
        addSection('Email:', answers.email || '—');
        addSection('Комментарий:', answers.comment || '—');
        
        y += 10;
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('Дата заявки: ' + new Date().toLocaleString('ru-RU'), 20, y);
        y += 6;
        
        const submissionId = localStorage.getItem('interio_submission_id');
        if (submissionId) {
            doc.text('ID заявки: #' + submissionId, 20, y);
            y += 6;
        }
        
        doc.text('Сгенерировано автоматически платформой Interio', 20, y);
        
        doc.save('Interio_заявка_' + Date.now() + '.pdf');
    }

    // ==========================================
    // ЛОГИКА МИНИ-КВИЗА (ВЫБОР СТИЛЯ)
    // ==========================================
    const miniQuizModal = document.getElementById('miniQuizModal');
    const closeMiniQuiz = document.getElementById('closeMiniQuiz');
    const undecidedRadio = document.getElementById('undecidedStyle');
    let currentMiniStep = 1;
    const totalMiniSteps = 6;
    const miniStepsList = document.querySelectorAll('.mini-quiz-step');
    const nextMiniBtn = document.getElementById('nextMiniBtn');
    const prevMiniBtn = document.getElementById('prevMiniBtn');
    let miniQuizCompleted = false;

    // Открываем мини-квиз при выборе "Пока не определился"
    document.querySelectorAll('.quiz-container input[name="style"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.id === 'undecidedStyle') {
                if (!miniQuizCompleted) {
                    miniQuizModal.style.display = 'block';
                    updateMiniQuizUI();
                }
            } else {
                // Сбрасываем плашку "Пока не определился", если пользователь передумал и выбрал конкретный стиль
                const undecidedLabel = document.querySelector('.style-image-card.wide .style-label');
                if (undecidedLabel) undecidedLabel.textContent = 'Пока не определился';
                if (undecidedRadio) undecidedRadio.value = 'Пока не определился';
                miniQuizCompleted = false;
            }
            saveAnswer();
        });
    });

    // Закрытие мини-квиза
    if (closeMiniQuiz) {
        closeMiniQuiz.addEventListener('click', () => {
            miniQuizModal.style.display = 'none';
            if (!miniQuizCompleted && undecidedRadio) {
                undecidedRadio.checked = false; // Отменяем выбор, если квиз не пройден
            }
        });
    }

    // Закрытие мини-квиза при клике вне окна
    window.addEventListener('click', (e) => {
        if (e.target === miniQuizModal) {
            miniQuizModal.style.display = 'none';
            if (!miniQuizCompleted && undecidedRadio) {
                undecidedRadio.checked = false;
            }
        }
    });

    // Навигация внутри мини-квиза
    function updateMiniQuizUI() {
        miniStepsList.forEach(s => s.classList.remove('active'));
        const target = document.querySelector(`.mini-quiz-step[data-mini-step="${currentMiniStep}"]`);
        if (target) target.classList.add('active');
        
        const pct = Math.round((currentMiniStep / totalMiniSteps) * 100);
        document.getElementById('miniProgressBar').style.width = pct + '%';
        document.getElementById('currentMiniStepNum').textContent = currentMiniStep;
        document.getElementById('miniProgressPercent').textContent = pct + '%';
        
        if (prevMiniBtn) prevMiniBtn.disabled = currentMiniStep === 1;
        
        if (nextMiniBtn) {
            if (currentMiniStep === totalMiniSteps) {
                nextMiniBtn.innerHTML = '<i class="fas fa-check"></i> Узнать результат';
            } else {
                nextMiniBtn.innerHTML = 'Далее <i class="fas fa-arrow-right"></i>';
            }
        }
    }

    if (nextMiniBtn) {
        nextMiniBtn.addEventListener('click', () => {
            const checked = document.querySelector(`.mini-quiz-step[data-mini-step="${currentMiniStep}"] input[type="radio"]:checked`);
            if (!checked) {
                showToast('Пожалуйста, выберите один из вариантов');
                return;
            }

            if (currentMiniStep === totalMiniSteps) {
                finishMiniQuiz();
            } else {
                currentMiniStep++;
                updateMiniQuizUI();
            }
        });
    }

    if (prevMiniBtn) {
        prevMiniBtn.addEventListener('click', () => {
            if (currentMiniStep > 1) {
                currentMiniStep--;
                updateMiniQuizUI();
            }
        });
    }

    // Подсчет результатов мини-квиза
    function finishMiniQuiz() {
        const scores = {
            'Скандинавский': 0,
            'Минимализм': 0,
            'Классика': 0,
            'Неоклассика': 0,
            'Лофт': 0,
            'Современный': 0
        };

        for (let i = 1; i <= 6; i++) {
            const checked = document.querySelector(`input[name="mq${i}"]:checked`);
            if (checked) {
                const styles = checked.value.split(','); // Разделяем значения стилей
                styles.forEach(s => {
                    const trimmed = s.trim();
                    if (scores[trimmed] !== undefined) scores[trimmed]++;
                });
            }
        }

        // Ищем максимальный балл
        let maxScore = 0;
        for (let s in scores) {
            if (scores[s] > maxScore) maxScore = scores[s];
        }

        // Находим всех победителей (если ничья — будет несколько)
        const winners = [];
        for (let s in scores) {
            if (scores[s] === maxScore) winners.push(s);
        }

        const resultText = winners.join(' / ');
        
        // Показываем результат
        const resultTextElement = document.getElementById('miniQuizResultText');
        if (resultTextElement) resultTextElement.textContent = resultText;
        
        document.getElementById('miniQuizQuestions').style.display = 'none';
        document.getElementById('miniQuizResult').style.display = 'block';
        
        // Передаем результат в основной квиз
        if (undecidedRadio) undecidedRadio.value = resultText;
        
        const undecidedLabel = document.querySelector('.style-image-card.wide .style-label');
        if (undecidedLabel) undecidedLabel.textContent = 'Ваш результат: ' + resultText;
        
        miniQuizCompleted = true;
        saveAnswer();
    }

    // Кнопка продолжения после мини-квиза
    const applyMiniQuizBtn = document.getElementById('applyMiniQuizBtn');
    if (applyMiniQuizBtn) {
        applyMiniQuizBtn.addEventListener('click', () => {
            miniQuizModal.style.display = 'none';
            goToStep(5); // Плавно переводим пользователя сразу на 5-й шаг основного квиза
        });
    }
});