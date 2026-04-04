/**
 * widgets.js — Добавляет виджеты поверх оригинального интерфейса:
 * - GigaChat ИИ-советник (кнопка + модалка)
 * - Голосовой ввод (кнопки 🎙️ у полей формы)
 * - Звуки (клик, шаг, успех, ошибка)
 * - Калькулятор бюджета (диаграмма на шаге 5)
 */

document.addEventListener('DOMContentLoaded', function() {

    // ══════════════════════════════════════
    // ЗВУКИ
    // ══════════════════════════════════════
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    var audioCtx;
    function getCtx() {
        if (!audioCtx) audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }
    function play(freq, dur, type, vol) {
        try {
            var ctx = getCtx();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + dur);
        } catch(e) {}
    }
    window.sound = {
        click:   function() { play(800, 0.06, 'sine', 0.06); },
        success: function() { play(523, 0.12, 'sine', 0.1); setTimeout(function() { play(784, 0.15, 'sine', 0.1); }, 100); },
        error:   function() { play(200, 0.25, 'sawtooth', 0.06); },
        step:    function() { play(600, 0.08, 'triangle', 0.05); }
    };

    // ══════════════════════════════════════
    // GIGACHAT — КНОПКА + МОДАЛКА
    // ══════════════════════════════════════
    var gcBtn = document.createElement('button');
    gcBtn.id = 'gcFloatBtn';
    gcBtn.title = 'ИИ-советник по дизайну';
    gcBtn.innerHTML = '🤖<span style="position:absolute;top:-2px;right:-2px;width:22px;height:22px;background:#22c55e;border-radius:50%;font-size:.65rem;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;box-shadow:0 2px 8px rgba(34,197,94,0.5);">AI</span>';
    gcBtn.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:1000;width:64px;height:64px;border-radius:50%;border:none;background:linear-gradient(135deg,#2563eb,#e74c5e);color:white;font-size:1.6rem;cursor:pointer;box-shadow:0 4px 24px rgba(37,99,235,0.5);transition:all .3s;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(gcBtn);

    var gcModal = document.createElement('div');
    gcModal.id = 'gcModal';
    gcModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);align-items:flex-end;justify-content:center;';
    gcModal.innerHTML = '<div style="background:var(--bg-secondary,rgba(255,255,255,0.95));border:1px solid var(--border-color,rgba(0,0,0,0.1));border-radius:24px 24px 0 0;width:100%;max-width:500px;max-height:80vh;display:flex;flex-direction:column;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border-color,rgba(0,0,0,0.1));">' +
        '<h3 style="margin:0;font-size:1.1rem;color:var(--text-main,#1a1a2e);">🤖 ИИ-советник</h3>' +
        '<button id="gcClose" style="background:none;border:none;color:var(--text-muted,#888);font-size:1.3rem;cursor:pointer;">&times;</button></div>' +
        '<div id="gcMsgs" style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:12px;">' +
        '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">Привет! Я ИИ-советник по дизайну интерьера. Спросите про стиль, бюджет, планировку, размеры помещений или материалы. 🏠</div></div>' +
        '<div style="display:flex;gap:8px;padding:16px 24px;border-top:1px solid var(--border-color,rgba(0,0,0,0.1));">' +
        '<input id="gcInput" type="text" placeholder="Спросите о дизайне..." style="flex:1;padding:12px 16px;border-radius:12px;background:var(--bg-primary,#faf8f5);border:1px solid var(--border-color,rgba(0,0,0,0.1));color:var(--text-main,#1a1a2e);font-size:.9rem;outline:none;">' +
        '<button id="gcSendBtn" style="padding:12px 20px;border-radius:12px;background:var(--accent,#2563eb);color:white;border:none;cursor:pointer;font-weight:600;">→</button></div></div>';
    document.body.appendChild(gcModal);

    gcBtn.addEventListener('click', function() { gcModal.style.display = 'flex'; });
    document.getElementById('gcClose').addEventListener('click', function() { gcModal.style.display = 'none'; });
    gcModal.addEventListener('click', function(e) { if (e.target === gcModal) gcModal.style.display = 'none'; });

    window.sendGC = function() {
        var inp = document.getElementById('gcInput');
        var btn = document.getElementById('gcSendBtn');
        var msgs = document.getElementById('gcMsgs');
        var q = inp.value.trim();
        if (!q) return;
        msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 4px 16px;background:var(--accent,#2563eb);color:white;align-self:flex-end;max-width:85%;font-size:.9rem;line-height:1.5;">' + esc(q) + '</div>';
        inp.value = '';
        btn.disabled = true;
        msgs.scrollTop = msgs.scrollHeight;
        fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
            .then(function(r) { return r.json(); })
            .then(function(d) { msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">' + esc(d.answer || 'Ошибка') + '</div>'; })
            .catch(function() { msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">⚠️ Ошибка соединения</div>'; })
            .then(function() { btn.disabled = false; msgs.scrollTop = msgs.scrollHeight; });
    };
    document.getElementById('gcInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') sendGC(); });

    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // ══════════════════════════════════════
    // ГОЛОСОВОЙ ВВОД — КНОПКИ У ПОЛЕЙ ФОРМЫ
    // ══════════════════════════════════════
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
        // Ждём появления формы (может быть на 6 шаге квиза)
        var observer = new MutationObserver(function() {
            var form = document.querySelector('.contact-form');
            if (form && !form.querySelector('.voice-btn')) addVoiceButtons(form);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Пробуем сразу
        var form = document.querySelector('.contact-form');
        if (form) addVoiceButtons(form);
    }

    function addVoiceButtons(form) {
        var groups = form.querySelectorAll('.form-group');
        var targets = [
            { id: 'inputName', label: 'Имя' },
            { id: 'inputPhone', label: 'Телефон' },
            { id: 'inputEmail', label: 'Email' },
            { id: 'inputComment', label: 'Комментарий' }
        ];
        groups.forEach(function(g, i) {
            if (i >= targets.length) return;
            var input = g.querySelector('input, textarea');
            if (!input || g.querySelector('.voice-btn')) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'voice-btn';
            btn.title = 'Голосовой ввод';
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:1px solid var(--border-color,rgba(0,0,0,0.1));background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-muted,#888);font-size:0.75rem;cursor:pointer;transition:all 0.2s;margin-left:6px;vertical-align:middle;';
            var label = g.querySelector('label');
            if (label) label.appendChild(btn);

            var rec = new SR();
            rec.lang = 'ru-RU';
            rec.continuous = false;
            rec.interimResults = false;
            rec.onstart = function() { btn.style.background = '#e74c5e'; btn.style.color = 'white'; btn.style.borderColor = '#e74c5e'; };
            rec.onresult = function(ev) {
                input.value = ev.results[0][0].transcript;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
            };
            rec.onerror = rec.onend = function() { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; };
            btn.addEventListener('click', function() { rec.listening ? rec.stop() : rec.start(); });
        });
    }

    // ══════════════════════════════════════
    // ЗВУКИ НА КНОПКИ
    // ══════════════════════════════════════
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-next, .btn-back, .option-card, .style-image-card')) {
            if (window.sound) window.sound.click();
        }
    });

    console.log('✅ Widgets loaded: GigaChat, Voice, Sounds');
});
