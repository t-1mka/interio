/**
 * widgets.js — Все виджеты Interio
 * 1. GigaChat (круглая кнопка ❓)
 * 2. Голосовой ввод 🎙️
 * 3. Звуки кликов
 */

(function() {
    'use strict';

    // ══════════════════════════════════════
    // 1. ЗВУКИ
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
        click: function() { play(800, 0.06, 'sine', 0.06); },
        success: function() { play(523, 0.12, 'sine', 0.1); setTimeout(function() { play(784, 0.15, 'sine', 0.1); }, 100); },
        error: function() { play(200, 0.25, 'sawtooth', 0.06); },
        step: function() { play(600, 0.08, 'triangle', 0.05); }
    };
    document.addEventListener('click', function(e) {
        if (e.target.closest('button, .option-card, .style-image-card, .btn-next, .btn-back')) {
            if (window.sound) window.sound.click();
        }
    }, true);

    // ══════════════════════════════════════
    // 2. GIGACHAT — КРУГЛАЯ КНОПКА + МОДАЛКА
    // ══════════════════════════════════════
    if (!document.getElementById('gcFloatBtn')) {
        // Создаём кнопку
        var btn = document.createElement('button');
        btn.id = 'gcFloatBtn';
        btn.title = 'ИИ-советник';
        btn.innerHTML = '\u2753'; // ❓
        btn.setAttribute('style',
            'position:fixed !important;' +
            'bottom:28px !important;' +
            'right:28px !important;' +
            'z-index:1000 !important;' +
            'width:64px !important;' +
            'height:64px !important;' +
            'border-radius:50% !important;' +
            'border:none !important;' +
            'background:linear-gradient(135deg,#2563eb,#e74c5e) !important;' +
            'color:white !important;' +
            'font-size:1.8rem !important;' +
            'cursor:pointer !important;' +
            'box-shadow:0 4px 24px rgba(37,99,235,0.5) !important;' +
            'display:flex !important;' +
            'align-items:center !important;' +
            'justify-content:center !important;' +
            'transition:transform 0.2s ease !important;'
        );
        btn.addEventListener('mouseenter', function() { btn.style.transform = 'scale(1.1)'; });
        btn.addEventListener('mouseleave', function() { btn.style.transform = 'scale(1)'; });
        document.body.appendChild(btn);

        // Создаём модалку
        var modal = document.createElement('div');
        modal.id = 'gcModal';
        modal.setAttribute('style',
            'display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);' +
            'backdrop-filter:blur(8px);align-items:flex-end;justify-content:center;'
        );
        modal.innerHTML =
            '<div style="background:var(--bg-secondary,rgba(255,255,255,0.95));' +
            'border:1px solid var(--border-color,rgba(0,0,0,0.1));border-radius:24px 24px 0 0;' +
            'width:100%;max-width:500px;max-height:80vh;display:flex;flex-direction:column;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;' +
                'padding:20px 24px;border-bottom:1px solid var(--border-color,rgba(0,0,0,0.1));">' +
                    '<h3 style="margin:0;font-size:1.1rem;color:var(--text-main,#1a1a2e);">\u2753 \u0418\u0418-\u0441\u043e\u0432\u0435\u0442\u043d\u0438\u043a</h3>' +
                    '<button id="gcClose" style="background:none;border:none;color:var(--text-muted,#888);' +
                    'font-size:1.3rem;cursor:pointer;">&times;</button>' +
                '</div>' +
                '<div id="gcMsgs" style="flex:1;overflow-y:auto;padding:20px 24px;' +
                'display:flex;flex-direction:column;gap:12px;">' +
                    '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;' +
                    'background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);' +
                    'align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">' +
                    '\u041f\u0440\u0438\u0432\u0435\u0442! \u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043f\u0440\u043e \u0441\u0442\u0438\u043b\u044c, \u0431\u044e\u0434\u0436\u0435\u0442, ' +
                    '\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u043a\u0443, \u0440\u0430\u0437\u043c\u0435\u0440\u044b \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0439 \u0438\u043b\u0438 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b. \ud83c\udfe0' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:8px;padding:16px 24px;' +
                'border-top:1px solid var(--border-color,rgba(0,0,0,0.1));">' +
                    '<input id="gcInput" type="text" placeholder="\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u043e \u0434\u0438\u0437\u0430\u0439\u043d\u0435..." ' +
                    'style="flex:1;padding:12px 16px;border-radius:12px;background:var(--bg-primary,#faf8f5);' +
                    'border:1px solid var(--border-color,rgba(0,0,0,0.1));color:var(--text-main,#1a1a2e);' +
                    'font-size:.9rem;outline:none;">' +
                    '<button id="gcSendBtn" style="padding:12px 20px;border-radius:12px;' +
                    'background:var(--accent,#2563eb);color:white;border:none;cursor:pointer;font-weight:600;">\u2192</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        // Обработчики
        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
        });
        document.getElementById('gcClose').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    // Функция отправки (глобальная)
    window.sendGC = function() {
        var inp = document.getElementById('gcInput');
        var btn = document.getElementById('gcSendBtn');
        var msgs = document.getElementById('gcMsgs');
        var q = inp.value.trim();
        if (!q) return;

        msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 4px 16px;' +
            'background:var(--accent,#2563eb);color:white;align-self:flex-end;max-width:85%;' +
            'font-size:.9rem;line-height:1.5;">' + escHtml(q) + '</div>';
        inp.value = '';
        btn.disabled = true;
        btn.style.opacity = '0.5';
        msgs.scrollTop = msgs.scrollHeight;

        fetch('/api/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var ans = d.answer || '\u26a0\ufe0f \u041e\u0448\u0438\u0431\u043a\u0430';
            msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;' +
                'background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);' +
                'align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">' + escHtml(ans) + '</div>';
        })
        .catch(function() {
            msgs.innerHTML += '<div style="padding:12px 16px;border-radius:16px 16px 16px 4px;' +
                'background:var(--bg-card,rgba(0,0,0,0.03));color:var(--text-main,#1a1a2e);' +
                'align-self:flex-start;max-width:85%;font-size:.9rem;line-height:1.5;">' +
                '\u26a0\ufe0f \u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f</div>';
        })
        .then(function() {
            btn.disabled = false;
            btn.style.opacity = '1';
            msgs.scrollTop = msgs.scrollHeight;
        });
    };

    // Enter для отправки
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement.id === 'gcInput') {
            sendGC();
        }
    });

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ══════════════════════════════════════
    // 3. ГОЛОСОВОЙ ВВОД 🎙️
    // ══════════════════════════════════════
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
        function addVoiceBtn(input) {
            if (input.dataset._voiceAdded) return;
            input.dataset._voiceAdded = '1';

            var wrap = document.createElement('div');
            wrap.style.position = 'relative';
            wrap.style.display = 'inline-block';
            wrap.style.width = '100%';

            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);

            var vbtn = document.createElement('button');
            vbtn.type = 'button';
            vbtn.innerHTML = '\ud83c\udf99\ufe0f';
            vbtn.title = '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434';
            vbtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);' +
                'background:none;border:none;font-size:1.2rem;cursor:pointer;opacity:0.5;z-index:10;transition:all 0.2s;';
            vbtn.addEventListener('mouseenter', function() { vbtn.style.opacity = '1'; });
            vbtn.addEventListener('mouseleave', function() { vbtn.style.opacity = '0.5'; });
            wrap.appendChild(vbtn);

            var rec = null;
            vbtn.addEventListener('click', function() {
                if (rec && vbtn._listening) {
                    rec.stop();
                    vbtn._listening = false;
                    vbtn.style.opacity = '0.5';
                    return;
                }
                rec = new SR();
                rec.lang = 'ru-RU';
                rec.interimResults = false;
                rec.onstart = function() {
                    vbtn._listening = true;
                    vbtn.style.opacity = '1';
                    vbtn.innerHTML = '\ud83d\udd34';
                };
                rec.onresult = function(ev) {
                    var t = ev.results[0][0].transcript;
                    input.value = (input.value ? input.value + ' ' : '') + t;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                };
                rec.onerror = rec.onend = function() {
                    vbtn._listening = false;
                    vbtn.style.opacity = '0.5';
                    vbtn.innerHTML = '\ud83c\udf99\ufe0f';
                };
                rec.start();
            });
        }

        // Добавляем ко всем текстовым полям
        function addAll() {
            document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea')
                .forEach(addVoiceBtn);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addAll);
        } else {
            addAll();
        }
        // Наблюдатель за динамическим контентом
        new MutationObserver(addAll).observe(document.body, { childList: true, subtree: true });
    }

    console.log('\u2705 Widgets loaded: GigaChat (circle), Voice, Sounds');
})();
