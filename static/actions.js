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
    
    console.log('Theme toggle found:', !!themeToggle);
    
    if (window.stateManager && typeof window.stateManager.applyThemeFromStorage === 'function') {
        window.stateManager.applyThemeFromStorage();
    }
    const savedTheme = html.getAttribute('data-theme') || 'dark';
    updateThemeIcon(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            console.log('Theme toggle clicked');
            const current = html.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            console.log('Changing theme from', current, 'to', next);
            if (window.stateManager && typeof window.stateManager.setTheme === 'function') {
                window.stateManager.setTheme(next);
                console.log('Theme set via stateManager');
            } else {
                console.warn('stateManager or setTheme method not available');
                console.log('stateManager exists:', !!window.stateManager);
                console.log('setTheme method exists:', window.stateManager && typeof window.stateManager.setTheme === 'function');
                console.log('Available methods:', window.stateManager ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.stateManager)).filter(name => typeof window.stateManager[name] === 'function') : 'none');
            }
            updateThemeIcon(next);
        });
    } else {
        console.warn('Theme toggle button not found, cannot add event listener');
    }

    function updateThemeIcon(theme) {
        if (!themeToggle) {
            console.warn('Theme toggle button not found');
            return;
        }
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        } else {
            console.warn('Theme toggle icon not found');
        }
    }

    // --- A11y ---
    const a11yToggle = document.getElementById('a11yToggle');
    const a11yPanel = document.getElementById('a11yPanel');
    const a11yClose = document.getElementById('a11yClose');
    
    console.log('A11y elements found:', { a11yToggle: !!a11yToggle, a11yPanel: !!a11yPanel, a11yClose: !!a11yClose });

    if (window.stateManager && typeof window.stateManager.applyA11yFromStorageFull === 'function') {
        window.stateManager.applyA11yFromStorageFull();
    }

    if (a11yToggle) {
        a11yToggle.addEventListener('click', (e) => {
            console.log('A11y toggle clicked');
            e.stopPropagation();
            const opening = !a11yPanel.classList.contains('show');
            console.log('A11y panel opening:', opening);
            a11yPanel.classList.toggle('show');
            if (opening && window.stateManager && typeof window.stateManager.syncA11yCheckboxesFromStorage === 'function') {
                window.stateManager.syncA11yCheckboxesFromStorage();
                console.log('A11y checkboxes synced');
            }
        });
    } else {
        console.warn('A11y toggle button not found, cannot add event listener');
    }
    if (a11yClose) {
        a11yClose.addEventListener('click', () => a11yPanel.classList.remove('show'));
    }

    const hcCb = document.getElementById('highContrast');
    if (hcCb) hcCb.addEventListener('change', (e) => {
        if (window.stateManager && typeof window.stateManager.setA11yContrast === 'function') {
            window.stateManager.setA11yContrast(e.target.checked);
        }
    });

    const lbCb = document.getElementById('largeButtons');
    if (lbCb) lbCb.addEventListener('change', (e) => {
        if (window.stateManager && typeof window.stateManager.setA11yLargeButtons === 'function') {
            window.stateManager.setA11yLargeButtons(e.target.checked);
        }
    });

    const ltCb = document.getElementById('largeText');
    if (ltCb) ltCb.addEventListener('change', (e) => {
        if (window.stateManager && typeof window.stateManager.setA11yLargeText === 'function') {
            window.stateManager.setA11yLargeText(e.target.checked);
        }
    });

    document.addEventListener('click', (e) => {
        if (!a11yPanel || !a11yToggle) return;
        if (a11yPanel.contains(e.target) || a11yToggle.contains(e.target)) return;
        a11yPanel.classList.remove('show');
    });
});
