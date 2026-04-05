/**
 * voice.js — Голосовой ввод 🎙️
 * ТОЛЬКО для квиза и обычных форм. НЕ для авторизации/регистрации/админки.
 */
(function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Список ID и классов которые СКИПАЕМ (авторизация, регистрация, админка, трек)
    var SKIP_IDS = [
        'phoneInput', 'passwordInput', 'nicknameInput',
        'newPasswordInput', 'confirmPasswordInput',
        'adminCodeInput', 'trackCode', 'trackPhone',
        'inputPhone', 'inputName', 'inputComment'
    ];

    var SKIP_CLASSES = [
        'auth-modal', 'auth-step', 'admin-auth', 'admin-error',
        'password-input-wrapper', 'toggle-password-view'
    ];

    function isSkipField(input) {
        // По ID
        if (input.id && SKIP_IDS.indexOf(input.id) !== -1) return true;
        // По классу элемента
        var cls = input.className || '';
        for (var i = 0; i < SKIP_CLASSES.length; i++) {
            if (cls.indexOf(SKIP_CLASSES[i]) !== -1) return true;
        }
        // По родительским контейнерам
        var el = input;
        while (el) {
            if (el.id === 'authModal' || el.id === 'adminAuthModal' ||
                el.id === 'phoneStep' || el.id === 'passwordStep' || el.id === 'registerStep') return true;
            var ecl = el.className || '';
            for (var j = 0; j < SKIP_CLASSES.length; j++) {
                if (ecl.indexOf(SKIP_CLASSES[j]) !== -1) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    function addVoiceBtn(input) {
        if (input.dataset._voiceAdded) return;
        if (isSkipField(input)) return;

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
