document.addEventListener('DOMContentLoaded', () => {
    // --- Toast Notification ---
    window.showToast = function(message, duration = 3000) {
        const toast = document.getElementById('toastNotification');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) {
            console.error('Toast elements not found:', { toast, toastMessage });
            return;
        }

        console.log('Showing toast:', message);
        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

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
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    // --- A11y ---
    const a11yToggle = document.getElementById('a11yToggle');
    const a11yPanel = document.getElementById('a11yPanel');
    const a11yClose = document.getElementById('a11yClose');

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

    if (a11yToggle) {
        a11yToggle.addEventListener('click', () => a11yPanel.classList.toggle('show'));
    }
    if (a11yClose) {
        a11yClose.addEventListener('click', () => a11yPanel.classList.remove('show'));
    }

    const hcCb = document.getElementById('highContrast');
    if (hcCb) hcCb.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-contrast', e.target.checked ? 'high' : 'normal');
        localStorage.setItem('interio_a11y_contrast', e.target.checked ? 'true' : 'false');
    });

    const lbCb = document.getElementById('largeButtons');
    if (lbCb) lbCb.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-large-buttons', e.target.checked ? 'true' : 'false');
        localStorage.setItem('interio_a11y_buttons', e.target.checked ? 'true' : 'false');
    });

    const ltCb = document.getElementById('largeText');
    if (ltCb) ltCb.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-large-text', e.target.checked ? 'true' : 'false');
        localStorage.setItem('interio_a11y_text', e.target.checked ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        if (a11yPanel && !a11yPanel.contains(e.target) && e.target !== a11yToggle) {
            a11yPanel.classList.remove('show');
        }
    });
});
