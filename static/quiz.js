/*
 * quiz.js — Вся логика квиза
 * - 6 шагов с навигацией
 * - Автосохранение в localStorage
 * - Загрузка фото (drag & drop)
 * - Голосовой ввод полей
 * - Случайный ответ
 * - Калькулятор бюджета (Chart.js)
 * - Предпросмотр ответов
 * - Мини-квиз выбора стиля
 * - PDF-бриф
 * - Отправка заявки на сервер
 */

document.addEventListener('DOMContentLoaded', () => {

    // ══════════════════════════════════════
    // ПЕРЕМЕННЫЕ
    // ══════════════════════════════════════
    let currentStep = 1;
    const totalSteps = 6;
    const steps = document.querySelectorAll('.quiz-step');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const progressBar = document.getElementById('progressBar');
    const stepNum = document.getElementById('currentStepNum');
    const stepPct = document.getElementById('progressPercent');
    const areaSlider = document.getElementById('areaSlider');
    const sliderVal = document.getElementById('sliderValue');
    const successScreen = document.getElementById('successScreen');
    const pdfBtn = document.getElementById('downloadPdfBtn');

    // ══════════════════════════════════════
    // ПОЛОСОТКА ПРОГРЕССА
    // ══════════════════════════════════════
    function updateProgress() {
        const pct = Math.round((currentStep / totalSteps) * 100);
        progressBar.style.width = pct + '%';
        stepNum.textContent = currentStep;
        stepPct.textContent = pct + '%';
    }

    // ══════════════════════════════════════
    // ПЕРЕХОД НА ШАГ
    // ══════════════════════════════════════
    function goToStep(step) {
        steps.forEach(s => s.classList.remove('active'));
        const target = document.querySelector(`.quiz-step[data-step="${step}"]`);
        if (target) target.classList.add('active');
        currentStep = step;
        updateProgress();
        prevBtn.disabled = currentStep === 1;
        if (currentStep === totalSteps) {
            nextBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
        } else {
            nextBtn.innerHTML = 'Далее <i class="fas fa-arrow-right"></i>';
        }
        if (window.sound) window.sound.step();
        saveAnswer();
    }

    // ══════════════════════════════════════
    // СЛАЙДЕР ПЛОЩАДИ
    // ══════════════════════════════════════
    function updateSliderBg(slider) {
        const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.background = `linear-gradient(to right, #2563eb 0%, #e74c5e ${pct}%, var(--slider-track) ${pct}%, var(--slider-track) 100%)`;
    }

    if (areaSlider) {
        areaSlider.value = 60;
        sliderVal.textContent = '60';
        updateSliderBg(areaSlider);
        areaSlider.addEventListener('input', (e) => {
            sliderVal.textContent = e.target.value;
            updateSliderBg(e.target);
            saveAnswer();
        });
    }

    // ══════════════════════════════════════
    // СОХРАНЕНИЕ ОТВЕТОВ
    // ══════════════════════════════════════
    function saveAnswer() {
        const a = {};
        const room = document.querySelector('input[name="roomType"]:checked');
        if (room) a.roomType = room.value;
        a.zones = Array.from(document.querySelectorAll('input[name="zones"]:checked')).map(c => c.value);
        a.area = areaSlider ? areaSlider.value : 60;
        const style = document.querySelector('input[name="style"]:checked');
        if (style) a.style = style.value;
        const budget = document.querySelector('input[name="budget"]:checked');
        if (budget) a.budget = budget.value;
        a.name = document.getElementById('inputName')?.value || '';
        a.phone = document.getElementById('inputPhone')?.value || '';
        a.email = document.getElementById('inputEmail')?.value || '';
        a.comment = document.getElementById('inputComment')?.value || '';
        a.consent = document.getElementById('consentCheck')?.checked || false;
        a.photos = uploadedPhotos ? uploadedPhotos.filter(p => p.uploaded).map(p => p.url) : [];
        localStorage.setItem('interio_quiz_answers', JSON.stringify(a));
    }

    // ══════════════════════════════════════
    // ВАЛИДАЦИЯ ШАГА
    // ══════════════════════════════════════
    function validateStep(step) {
        switch (step) {
            case 1:
                if (!document.querySelector('input[name="roomType"]:checked')) {
                    showToast('Выберите тип помещения'); return false;
                } return true;
            case 2:
                if (!document.querySelector('input[name="zones"]:checked')) {
                    showToast('Выберите хотя бы одну зону'); return false;
                } return true;
            case 3: return true;
            case 4:
                if (!document.querySelector('input[name="style"]:checked')) {
                    showToast('Выберите стиль'); return false;
                } return true;
            case 5:
                if (!document.querySelector('input[name="budget"]:checked')) {
                    showToast('Выберите бюджет'); return false;
                } return true;
            case 6: return validateForm();
            default: return true;
        }
    }

    function validateForm() {
        const name = document.getElementById('inputName').value.trim();
        const phone = document.getElementById('inputPhone').value.trim();
        const consent = document.getElementById('consentCheck').checked;
        if (!name) { showToast('Введите имя'); return false; }
        if (!phone || phone.length < 5) {
            document.getElementById('phoneError').classList.add('show');
            showToast('Введите телефон'); return false;
        }
        document.getElementById('phoneError').classList.remove('show');
        if (!consent) {
            document.getElementById('consentError').classList.add('show');
            showToast('Дайте согласие'); return false;
        }
        document.getElementById('consentError').classList.remove('show');
        return true;
    }

    // ══════════════════════════════════════
    // ТОСТ (уведомление)
    // ══════════════════════════════════════
    window.showToast = function(msg, dur = 3000) {
        const t = document.getElementById('toastNotification');
        const m = document.getElementById('toastMessage');
        if (!t || !m) return;
        m.textContent = msg;
        t.classList.add('show');
        if (window.sound && msg.includes('Ошибка')) window.sound.error();
        else if (window.sound) window.sound.click();
        setTimeout(() => t.classList.remove('show'), dur);
    };

    // ══════════════════════════════════════
    // ВСЁ ПОМЕЩЕНИЕ — отмечает все зоны
    // ══════════════════════════════════════
    const allZone = document.querySelector('input[name="zones"][value="Всё помещение"]');
    if (allZone) {
        allZone.addEventListener('change', (e) => {
            document.querySelectorAll('input[name="zones"]:not([value="Всё помещение"])').forEach(cb => {
                cb.checked = e.target.checked;
            });
            saveAnswer();
        });
    }

    // ══════════════════════════════════════
    // СЛУЧАЙНЫЙ ОТВЕТ
    // ══════════════════════════════════════
    const randomBtn = document.getElementById('randomAnswerBtn');
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            let opts;
            switch (currentStep) {
                case 1:
                    opts = document.querySelectorAll('input[name="roomType"]');
                    if (opts.length) opts[Math.floor(Math.random() * opts.length)].checked = true;
                    break;
                case 2:
                    opts = document.querySelectorAll('input[name="zones"]');
                    const n = Math.floor(Math.random() * 3) + 2;
                    const s = Array.from(opts).sort(() => Math.random() - 0.5);
                    opts.forEach(c => c.checked = false);
                    s.slice(0, n).forEach(c => c.checked = true);
                    break;
                case 3:
                    if (areaSlider) {
                        areaSlider.value = Math.floor(Math.random() * 57) * 5 + 20;
                        areaSlider.dispatchEvent(new Event('input'));
                    }
                    break;
                case 4:
                    opts = document.querySelectorAll('input[name="style"]');
                    if (opts.length) opts[Math.floor(Math.random() * opts.length)].checked = true;
                    break;
                case 5:
                    opts = document.querySelectorAll('input[name="budget"]');
                    if (opts.length) opts[Math.floor(Math.random() * opts.length)].checked = true;
                    break;
                case 6:
                    showToast('Заполните форму вручную'); return;
            }
            saveAnswer();
            randomBtn.style.transform = 'scale(0.9) rotate(180deg)';
            setTimeout(() => randomBtn.style.transform = '', 300);
            showToast('✅ Случайный ответ!');
        });
    }

    // ══════════════════════════════════════
    // КАЛЬКУЛЯТОР БЮДЖЕТА (Chart.js)
    // ══════════════════════════════════════
    let budgetChart = null;

    function parseBudget(s) {
        if (!s || s === 'Пока не знаю') return 500000;
        const m = s.match(/(\d[\d\s]*)/);
        return m ? parseInt(m[1].replace(/\s/g, '')) || 500000 : 500000;
    }

    function updateBudgetChart(budgetStr) {
        const el = document.getElementById('budgetCalc');
        if (!el) return;
        const total = parseBudget(budgetStr);
        el.classList.add('show');

        const items = [
            { label: 'Дизайн-концепция', pct: 40, color: '#2563eb' },
            { label: 'Чертежи', pct: 25, color: '#e74c5e' },
            { label: '3D-визуализация', pct: 20, color: '#f39c12' },
            { label: 'Выезд дизайнера', pct: 15, color: '#22c55e' }
        ];
        const data = items.map(i => ({ ...i, amt: Math.round(total * i.pct / 100) }));

        const ctx = document.getElementById('budgetChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (budgetChart) {
            budgetChart.data.datasets[0].data = data.map(d => d.amt);
            budgetChart.update();
        } else {
            budgetChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: data.map(d => d.label),
                    datasets: [{ data: data.map(d => d.amt), backgroundColor: data.map(d => d.color), borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '60%'
                }
            });
        }

        document.getElementById('budgetBreakdown').innerHTML = data.map(d =>
            `<div class="budget-item" style="border-left-color:${d.color}">
                <div class="budget-item-label">${d.label} (${d.pct}%)</div>
                <div class="budget-item-value">${d.amt.toLocaleString('ru-RU')} ₽</div>
            </div>`
        ).join('');
    }

    document.querySelectorAll('input[name="budget"]').forEach(r => {
        r.addEventListener('change', e => updateBudgetChart(e.target.value));
    });

    // ══════════════════════════════════════
    // ЗАГРУЗКА ФОТО
    // ══════════════════════════════════════
    window.uploadedPhotos = [];

    const dropZone = document.getElementById('photoDropZone');
    const photoInput = document.getElementById('photoFileInput');
    const photoGrid = document.getElementById('photoGrid');

    if (dropZone && photoInput && photoGrid) {
        dropZone.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', e => handleFiles(e.target.files));
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

        function handleFiles(files) {
            const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
            if (uploadedPhotos.length + valid.length > 5) { showToast('Максимум 5 фото'); return; }
            valid.forEach(file => {
                if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} > 5MB`); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    uploadedPhotos.push({ file, dataUrl: ev.target.result });
                    renderPhotos();
                    uploadPhoto(file);
                };
                reader.readAsDataURL(file);
            });
        }

        function renderPhotos() {
            photoGrid.innerHTML = uploadedPhotos.map((p, i) =>
                `<div class="photo-item">
                    <img src="${p.dataUrl}">
                    <button class="photo-remove" data-idx="${i}"><i class="fas fa-times"></i></button>
                    ${!p.uploaded ? '<div class="photo-spinner"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
                </div>`
            ).join('');
            photoGrid.querySelectorAll('.photo-remove').forEach(b =>
                b.addEventListener('click', e => { e.stopPropagation(); uploadedPhotos.splice(parseInt(b.dataset.idx), 1); renderPhotos(); })
            );
        }

        async function uploadPhoto(file) {
            const fd = new FormData();
            fd.append('file', file);
            try {
                const r = await fetch('/api/upload-photo', { method: 'POST', body: fd });
                const d = await r.json();
                if (d.success) {
                    const p = uploadedPhotos.find(p => p.file === file);
                    if (p) { p.url = d.url; p.uploaded = true; renderPhotos(); }
                }
            } catch (e) { console.warn('Upload error:', e); }
        }
    }

    // ══════════════════════════════════════
    // ГОЛОСОВОЙ ВВОД
    // ══════════════════════════════════════
    function addVoiceButtons() {
        const form = document.querySelector('.contact-form');
        if (!form) return;
        if (form.querySelector('.voice-btn')) return; // уже есть

        const targets = [
            { id: 'inputName', label: 'Имя' },
            { id: 'inputPhone', label: 'Телефон' },
            { id: 'inputEmail', label: 'Email' },
            { id: 'inputComment', label: 'Комментарий' }
        ];

        targets.forEach(t => {
            const input = document.getElementById(t.id);
            if (!input) return;
            const label = input.closest('.form-group')?.querySelector('label');
            if (!label || label.querySelector('.voice-btn')) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'voice-btn';
            btn.title = 'Голосовой ввод';
            btn.innerHTML = '<i class="fas fa-microphone"></i>';

            // Проверяем поддержку
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SR) {
                const rec = new SR();
                rec.lang = 'ru-RU';
                rec.continuous = false;
                rec.interimResults = false;
                rec.onstart = () => { btn.classList.add('listening'); btn.innerHTML = '<i class="fas fa-circle"></i>'; };
                rec.onresult = ev => {
                    input.value = ev.results[0][0].transcript;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    btn.classList.remove('listening');
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                };
                rec.onerror = rec.onend = () => {
                    btn.classList.remove('listening');
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                };
                btn.addEventListener('click', () => {
                    btn.classList.contains('listening') ? rec.stop() : rec.start();
                });
            } else {
                btn.style.display = 'none'; // не поддерживается
            }

            label.appendChild(btn);
        });
    }

    // Добавляем при загрузке и при возврате на шаг 6
    addVoiceButtons();
    const origGoToStep = goToStep;

    // ══════════════════════════════════════
    // ПРЕДПРОСМОТР ОТВЕТОВ
    // ══════════════════════════════════════
    const previewBtn = document.getElementById('previewAnswersBtn');
    const previewOverlay = document.getElementById('previewOverlay');

    if (previewBtn && previewOverlay) {
        previewBtn.addEventListener('click', () => {
            const a = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
            const items = [
                { icon: '🏠', label: 'Помещение', val: a.roomType || '—', step: 1 },
                { icon: '📍', label: 'Зоны', val: (a.zones || []).join(', ') || '—', step: 2 },
                { icon: '📐', label: 'Площадь', val: a.area ? a.area + ' м²' : '—', step: 3 },
                { icon: '🎨', label: 'Стиль', val: a.style || '—', step: 4 },
                { icon: '💰', label: 'Бюджет', val: a.budget || '—', step: 5 },
                { icon: '👤', label: 'Имя', val: a.name || '—', step: 6 },
                { icon: '📱', label: 'Телефон', val: a.phone || '—', step: 6 },
            ];

            const cards = document.getElementById('previewCards');
            if (cards) {
                cards.innerHTML = items.map(it =>
                    `<div class="preview-card">
                        <div class="preview-card-info">
                            <div class="preview-card-icon">${it.icon}</div>
                            <div><div class="preview-card-label">${it.label}</div><div class="preview-card-value">${it.val}</div></div>
                        </div>
                        <button class="preview-edit-btn" data-step="${it.step}"><i class="fas fa-edit"></i></button>
                    </div>`
                ).join('');

                cards.querySelectorAll('.preview-edit-btn').forEach(b =>
                    b.addEventListener('click', () => {
                        previewOverlay.classList.remove('show');
                        goToStep(parseInt(b.dataset.step));
                    })
                );
            }
            previewOverlay.classList.add('show');
        });
    }

    const previewClose = document.getElementById('previewClose');
    const previewBack = document.getElementById('previewBack');
    if (previewClose) previewClose.addEventListener('click', () => previewOverlay.classList.remove('show'));
    if (previewBack) previewBack.addEventListener('click', () => previewOverlay.classList.remove('show'));

    const previewSubmit = document.getElementById('previewSubmit');
    if (previewSubmit) {
        previewSubmit.addEventListener('click', () => {
            previewOverlay.classList.remove('show');
            nextBtn.click();
        });
    }

    // ══════════════════════════════════════
    // ОТПРАВКА ЗАЯВКИ
    // ══════════════════════════════════════
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep === totalSteps) submitForm();
            else goToStep(currentStep + 1);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) goToStep(currentStep - 1);
    });

    finishBtn.addEventListener('click', () => goToStep(totalSteps));

    async function submitForm() {
        saveAnswer();
        const a = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');

        const origText = nextBtn.innerHTML;
        nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        nextBtn.disabled = true;

        try {
            const r = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: a.name || '', phone: a.phone || '', email: a.email || '',
                    room_type: a.roomType || '', zones: a.zones || [],
                    area: parseInt(a.area) || 60, style: a.style || '',
                    budget: a.budget || '', comment: a.comment || '',
                    consent: a.consent || false, photo_urls: a.photos || []
                })
            });

            // Проверяем что ответ — JSON
            const type = r.headers.get('content-type') || '';
            if (!type.includes('application/json')) {
                throw new Error('Сервер вернул ошибку. Попробуйте ещё раз.');
            }

            const d = await r.json();

            if (r.ok && d.success) {
                if (window.sound) window.sound.success();
                steps.forEach(s => s.style.display = 'none');
                document.querySelector('.quiz-progress').style.display = 'none';
                document.getElementById('quizNav').style.display = 'none';
                finishBtn.style.display = 'none';
                successScreen.classList.add('active');
                successScreen.style.display = 'block';
                localStorage.setItem('interio_submission_id', d.submission_id);
            } else {
                throw new Error(d.detail || d.message || 'Ошибка сервера');
            }
        } catch (e) {
            console.error('Submit error:', e);
            showToast('Ошибка: ' + e.message);
            nextBtn.innerHTML = origText;
            nextBtn.disabled = false;
        }
    }

    // ══════════════════════════════════════
    // PDF-БРИФ
    // ══════════════════════════════════════
    if (pdfBtn) {
        pdfBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const a = JSON.parse(localStorage.getItem('interio_quiz_answers') || '{}');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Загружаем шрифт с кириллицей
            const fetchFont = async (url) => {
                const buf = await (await fetch(url)).arrayBuffer();
                let binary = '';
                new Uint8Array(buf).forEach(b => binary += String.fromCharCode(b));
                return window.btoa(binary);
            };

            const [reg, bold] = await Promise.all([
                fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf'),
                fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf')
            ]);

            doc.addFileToVFS('Roboto-Regular.ttf', reg);
            doc.addFileToVFS('Roboto-Medium.ttf', bold);
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

            doc.setFillColor(37, 99, 235);
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

            const sec = (title, val) => {
                doc.setFontSize(11);
                doc.setFont('Roboto', 'bold');
                doc.setTextColor(37, 99, 235);
                doc.text(title, 20, y); y += 7;
                doc.setFont('Roboto', 'normal');
                doc.setTextColor(50, 50, 50);
                if (Array.isArray(val)) val.forEach(v => { doc.text('• ' + v, 24, y); y += 6; });
                else { const lines = doc.splitTextToSize(String(val || '—'), 170); doc.text(lines, 20, y); y += 6 * lines.length; }
                y += 4;
            };

            sec('Помещение:', a.roomType);
            sec('Зоны:', a.zones);
            sec('Площадь:', a.area ? a.area + ' м²' : '—');
            sec('Стиль:', a.style);
            sec('Бюджет:', a.budget);
            y += 5; doc.line(20, y, 190, y); y += 10;
            sec('Имя:', a.name);
            sec('Телефон:', a.phone);
            sec('Email:', a.email || '—');
            sec('Комментарий:', a.comment || '—');

            doc.save('Interio_' + Date.now() + '.pdf');
        });
    }

    // ══════════════════════════════════════
    // МИНИ-КВИЗ (выбор стиля)
    // ══════════════════════════════════════
    const miniModal = document.getElementById('miniQuizModal');
    const miniClose = document.getElementById('closeMiniQuiz');
    const miniNext = document.getElementById('nextMiniBtn');
    const miniPrev = document.getElementById('prevMiniBtn');
    const miniApply = document.getElementById('applyMiniQuizBtn');
    let miniStep = 1;
    let miniDone = false;

    // Открытие при выборе "Пока не определился"
    document.querySelectorAll('input[name="style"]').forEach(r => {
        r.addEventListener('change', (e) => {
            if (e.target.id === 'undecidedStyle' && !miniDone && miniModal) {
                miniModal.style.display = 'block';
                updateMiniUI();
            }
        });
    });

    function updateMiniUI() {
        document.querySelectorAll('.mini-quiz-step').forEach(s => s.classList.remove('active'));
        const t = document.querySelector(`.mini-quiz-step[data-mini-step="${miniStep}"]`);
        if (t) t.classList.add('active');
        const pct = Math.round((miniStep / 6) * 100);
        const bar = document.getElementById('miniProgressBar');
        if (bar) bar.style.width = pct + '%';
        const num = document.getElementById('currentMiniStepNum');
        if (num) num.textContent = miniStep;
        const pctEl = document.getElementById('miniProgressPercent');
        if (pctEl) pctEl.textContent = pct + '%';
        if (miniPrev) miniPrev.disabled = miniStep === 1;
        if (miniNext) miniNext.innerHTML = miniStep === 6 ? '<i class="fas fa-check"></i> Результат' : 'Далее <i class="fas fa-arrow-right"></i>';
    }

    if (miniNext) {
        miniNext.addEventListener('click', () => {
            if (!document.querySelector(`.mini-quiz-step[data-mini-step="${miniStep}"] input:checked`)) {
                showToast('Выберите вариант'); return;
            }
            if (miniStep === 6) finishMiniQuiz();
            else { miniStep++; updateMiniUI(); }
        });
    }

    if (miniPrev) {
        miniPrev.addEventListener('click', () => { if (miniStep > 1) { miniStep--; updateMiniUI(); } });
    }

    function finishMiniQuiz() {
        const scores = { 'Скандинавский': 0, 'Минимализм': 0, 'Классика': 0, 'Неоклассика': 0, 'Лофт': 0, 'Современный': 0 };
        for (let i = 1; i <= 6; i++) {
            const checked = document.querySelector(`input[name="mq${i}"]:checked`);
            if (checked) checked.value.split(',').forEach(s => { s = s.trim(); if (scores[s] !== undefined) scores[s]++; });
        }
        const max = Math.max(...Object.values(scores));
        const winners = Object.keys(scores).filter(s => scores[s] === max);
        const result = winners.join(' / ');

        document.getElementById('miniQuizQuestions').style.display = 'none';
        document.getElementById('miniQuizResult').style.display = 'block';
        const resultEl = document.getElementById('miniQuizResultText');
        if (resultEl) resultEl.textContent = result;

        const undRadio = document.getElementById('undecidedStyle');
        if (undRadio) undRadio.value = result;
        const undLabel = document.querySelector('.style-image-card.wide .style-label');
        if (undLabel) undLabel.textContent = 'Результат: ' + result;
        miniDone = true;
        saveAnswer();
    }

    if (miniClose) miniClose.addEventListener('click', () => { miniModal.style.display = 'none'; });
    if (miniApply) miniApply.addEventListener('click', () => { miniModal.style.display = 'none'; goToStep(5); });

    // ══════════════════════════════════════
    // ОЧИСТКА ПРИ ЗАГРУЗКЕ
    // ══════════════════════════════════════
    localStorage.removeItem('interio_quiz_answers');
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(el => el.value = '');

    // ══════════════════════════════════════
    // СЛУШАЕМ ВСЕ ИЗМЕНЕНИЯ
    // ══════════════════════════════════════
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('change', saveAnswer);
        el.addEventListener('input', saveAnswer);
    });

    updateProgress();
    console.log('✅ Квиз загружен');
});
