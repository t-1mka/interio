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
    const savedTheme = localStorage.getItem('interio_theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('interio_theme', next);
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

        ['a11y_contrast', 'a11y_buttons', 'a11y_text'].forEach(key => {
            const val = localStorage.getItem('interio_' + key);
            if (val === 'true') {
                document.documentElement.setAttribute('data-' + key.replace('a11y_', ''), 'true');
                const cb = document.getElementById(
                    key === 'a11y_contrast' ? 'highContrast' :
                    key === 'a11y_buttons' ? 'largeButtons' : 'largeText'
                );
                if (cb) cb.checked = true;
            }
        });

        a11yToggle.addEventListener('click', () => a11yPanel.classList.toggle('show'));
        a11yClose.addEventListener('click', () => a11yPanel.classList.remove('show'));
        document.addEventListener('click', (e) => {
            if (a11yPanel && !a11yPanel.contains(e.target) && e.target !== a11yToggle) {
                a11yPanel.classList.remove('show');
            }
        });

        const hc = document.getElementById('highContrast');
        if (hc) hc.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-contrast', e.target.checked ? 'high' : 'normal');
            localStorage.setItem('interio_a11y_contrast', e.target.checked ? 'true' : 'false');
        });
        const lb = document.getElementById('largeButtons');
        if (lb) lb.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-large-buttons', e.target.checked ? 'true' : 'false');
            localStorage.setItem('interio_a11y_buttons', e.target.checked ? 'true' : 'false');
        });
        const lt = document.getElementById('largeText');
        if (lt) lt.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-large-text', e.target.checked ? 'true' : 'false');
            localStorage.setItem('interio_a11y_text', e.target.checked ? 'true' : 'false');
        });
    }

    // --- Slider ---
    const areaSlider = document.getElementById('areaSlider');
    const sliderValueDisplay = document.getElementById('sliderValue');
    
    // Функция для обновления заливки ползунка слева
    function updateSliderBackground(slider) {
        const min = parseFloat(slider.min) || 20;
        const max = parseFloat(slider.max) || 300;
        const val = parseFloat(slider.value) || 60;
        const percent = ((val - min) / (max - min)) * 100;
        
        // Красим левую часть градиентом, а правую оставляем прозрачной (фоновой)
        slider.style.background = `linear-gradient(to right, #4a6cf7 0%, #e74c5e ${percent}%, var(--slider-track) ${percent}%, var(--slider-track) 100%)`;
    }

    // --- Очистка данных при загрузке страницы ---
    localStorage.removeItem('interio_quiz_answers');
    
    // Сбрасываем состояние полей, чтобы браузер не подтягивал их из кэша (при нажатии F5)
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(el => el.value = '');

    if (areaSlider) {
        // Устанавливаем базовое значение в 60 при каждой загрузке
        areaSlider.value = 60;
        
        sliderValueDisplay.textContent = areaSlider.value;
        updateSliderBackground(areaSlider); // Вызываем отрисовку градиента при загрузке

        areaSlider.addEventListener('input', (e) => {
            sliderValueDisplay.textContent = e.target.value;
            updateSliderBackground(e.target); // Обновляем градиент при сдвиге
            saveAnswer();
        });
    }

    // --- Save on every input ---
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('change', saveAnswer);
        el.addEventListener('input', saveAnswer);
    });

    function saveAnswer() {
        const answers = {};
        const room = document.querySelector('input[name="roomType"]:checked');
        if (room) answers.roomType = room.value;
        const zones = Array.from(document.querySelectorAll('input[name="zones"]:checked')).map(c => c.value);
        if (zones.length) answers.zones = zones;
        answers.area = areaSlider ? areaSlider.value : '60';
        const style = document.querySelector('input[name="style"]:checked');
        if (style) answers.style = style.value;
        const budget = document.querySelector('input[name="budget"]:checked');
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
            case 1: return !!document.querySelector('input[name="roomType"]:checked');
            case 2: return document.querySelectorAll('input[name="zones"]:checked').length > 0;
            case 3: return true;
            case 4: return !!document.querySelector('input[name="style"]:checked');
            case 5: return !!document.querySelector('input[name="budget"]:checked');
            case 6: return validateForm();
            default: return true;
        }
    }

    function validateForm() {
        const phone = document.getElementById('inputPhone').value.trim();
        const consent = document.getElementById('consentCheck').checked;
        let valid = true;
        const phoneErr = document.getElementById('phoneError');
        if (!phone || phone.length < 5) {
            phoneErr.classList.add('show');
            valid = false;
        } else {
            phoneErr.classList.remove('show');
        }
        const consentErr = document.getElementById('consentError');
        if (!consent) {
            consentErr.classList.add('show');
            valid = false;
        } else {
            consentErr.classList.remove('show');
        }
        return valid;
    }

    async function submitForm() {
        saveAnswer();
        const answers = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
        
        // Показываем индикатор загрузки
        const nextBtn = document.getElementById('nextBtn');
        const originalText = nextBtn.innerHTML;
        nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        nextBtn.disabled = true;
        
        try {
            // Подготовка данных для отправки
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
            
            // Отправка на сервер (Interio backend API)
            const response = await fetch('/api/interio/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submissionData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('✅ Заявка успешно сохранена, ID:', result.submission_id);
                
                // Показываем экран успеха
                steps.forEach(s => s.style.display = 'none');
                document.querySelector('.quiz-progress').style.display = 'none';
                quizNav.style.display = 'none';
                finishEarlyBtn.style.display = 'none';
                successScreen.classList.add('active');
                successScreen.style.display = 'block';
                
                // Сохраняем ID заявки в localStorage для PDF
                localStorage.setItem('interio_submission_id', result.submission_id);
                
            } else {
                throw new Error(result.error || result.detail || 'Ошибка сервера');
            }
            
        } catch (error) {
            console.error('❌ Ошибка при отправке заявки:', error);
            
            // Показываем ошибку пользователю
            alert(`Ошибка при сохранении заявки: ${error.message}\n\nПожалуйста, попробуйте еще раз или свяжитесь с нами напрямую.`);
            
            // Возвращаем кнопку в исходное состояние
            nextBtn.innerHTML = originalText;
            nextBtn.disabled = false;
            
            // Прокручиваем к форме чтобы пользователь мог исправить ошибки
            document.querySelector('.quiz-step[data-step="6"]').scrollIntoView({ behavior: 'smooth' });
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
                alert("Произошла ошибка при создании PDF-документа.");
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

        // Вспомогательная функция для загрузки шрифтов из CDN
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

        // Загружаем шрифты Roboto, поддерживающие кириллицу
        const fontRegularUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
        const fontMediumUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';

        const [fontRegular, fontMedium] = await Promise.all([
            fetchFont(fontRegularUrl),
            fetchFont(fontMediumUrl)
        ]);

        // Подключаем шрифты к jsPDF
        doc.addFileToVFS('Roboto-Regular.ttf', fontRegular);
        doc.addFileToVFS('Roboto-Medium.ttf', fontMedium);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

        doc.setFillColor(74, 108, 247);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        
        // Теперь используем наш шрифт Roboto
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
                // Разбиваем длинные тексты (например, комментарии), чтобы они не выходили за рамки PDF
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
        
        // Добавляем ID заявки если есть
        const submissionId = localStorage.getItem('interio_submission_id');
        if (submissionId) {
            doc.text('ID заявки: #' + submissionId, 20, y);
            y += 6;
        }
        
        doc.text('Сгенерировано автоматически платформой Interio', 20, y);
        
        doc.save('Interio_заявка_' + Date.now() + '.pdf');
    }
});
