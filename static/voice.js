/**
 * voice.js — Голосовой ввод (распознавание речи)
 * Добавляет кнопку 🎙️ ко всем текстовым полям
 */
(function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        console.warn('Speech Recognition not supported');
        return;
    }

    var listeningBtn = null;

    function addVoiceBtn(input) {
        if (input.dataset.voiceBtnAdded) return;
        input.dataset.voiceBtnAdded = 'true';

        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;width:100%;';

        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'voice-input-btn';
        btn.innerHTML = '🎙️';
        btn.title = 'Нажмите для голосового ввода';
        btn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:1.2rem;cursor:pointer;opacity:0.5;z-index:10;transition:all 0.2s;padding:4px;';
        btn.addEventListener('mouseenter', function() { btn.style.opacity = '1'; });
        btn.addEventListener('mouseleave', function() { btn.style.opacity = '0.5'; });

        wrap.appendChild(btn);

        var recognition = null;

        btn.addEventListener('click', function() {
            if (recognition && btn.dataset.listening === 'true') {
                recognition.stop();
                btn.dataset.listening = 'false';
                btn.style.opacity = '0.5';
                return;
            }

            recognition = new SR();
            recognition.lang = 'ru-RU';
            recognition.interimResults = false;
            recognition.continuous = false;

            recognition.onstart = function() {
                btn.dataset.listening = 'true';
                btn.style.opacity = '1';
                btn.innerHTML = '🔴';
            };

            recognition.onresult = function(event) {
                var transcript = event.results[0][0].transcript;
                input.value = (input.value ? input.value + ' ' : '') + transcript;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            };

            recognition.onerror = function() {
                btn.style.opacity = '0.5';
                btn.innerHTML = '🎙️';
                btn.dataset.listening = 'false';
            };

            recognition.onend = function() {
                btn.style.opacity = '0.5';
                btn.innerHTML = '🎙️';
                btn.dataset.listening = 'false';
            };

            recognition.start();
        });
    }

    function addAllVoiceBtns() {
        document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(addVoiceBtn);
    }

    // Initial
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addAllVoiceBtns);
    } else {
        addAllVoiceBtns();
    }

    // Dynamic content
    var observer = new MutationObserver(function() {
        addAllVoiceBtns();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
