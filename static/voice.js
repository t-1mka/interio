/**
 * voice.js — Голосовой ввод 🎙️
 * КРОМЕ полей регистрации/авторизации
 */
(function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    function isAuthField(input) {
        var el = input;
        while (el) {
            if (el.id === 'authModal' || el.id === 'phoneStep' ||
                el.id === 'passwordStep' || el.id === 'registerStep' ||
                el.classList.contains('auth-modal') || el.classList.contains('auth-step') ||
                el.id === 'phoneInput' || el.id === 'passwordInput' ||
                el.id === 'nicknameInput' || el.id === 'newPasswordInput' ||
                el.id === 'confirmPasswordInput') {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    function addVoiceBtn(input) {
        if (input.dataset._voiceAdded) return;
        // Пропускаем поля авторизации/регистрации
        if (isAuthField(input)) return;

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

    function addAll() {
        document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea')
            .forEach(addVoiceBtn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addAll);
    } else {
        addAll();
    }
    new MutationObserver(addAll).observe(document.body, { childList: true, subtree: true });
})();
