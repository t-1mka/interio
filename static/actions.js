/*
 * actions.js — Тема + Доступность + Звуки
 * Работает на ВСЕХ страницах
 */

document.addEventListener('DOMContentLoaded', function () {

    // ══════════════════════════════════════
    // СМЕНА ТЕМЫ
    // ══════════════════════════════════════
    var btn = document.getElementById('themeToggle');
    var html = document.documentElement;

    // Восстановить сохранённую тему
    var saved = localStorage.getItem('interio_theme') || 'dark';
    html.setAttribute('data-theme', saved);

    // Обновить иконку
    function updateIcon() {
        var icon = btn ? btn.querySelector('i') : null;
        if (icon) {
            icon.className = html.getAttribute('data-theme') === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
    updateIcon();

    // По клику — переключить
    if (btn) {
        btn.addEventListener('click', function () {
            var current = html.getAttribute('data-theme');
            var next = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('interio_theme', next);
            updateIcon();
        });
    }

    // ══════════════════════════════════════
    // ДОСТУПНОСТЬ (слабовидящие)
    // ══════════════════════════════════════
    var a11yBtn = document.getElementById('a11yToggle');
    var a11yPanel = document.getElementById('a11yPanel');
    var a11yClose = document.getElementById('a11yClose');

    // Восстановить настройки
    function restoreA11y() {
        if (localStorage.getItem('interio_a11y_contrast') === 'true') {
            html.setAttribute('data-contrast', 'high');
            var cb = document.getElementById('highContrast');
            if (cb) cb.checked = true;
        }
        if (localStorage.getItem('interio_a11y_large-buttons') === 'true') {
            html.setAttribute('data-large-buttons', 'true');
            var cb = document.getElementById('largeButtons');
            if (cb) cb.checked = true;
        }
        if (localStorage.getItem('interio_a11y_large-text') === 'true') {
            html.setAttribute('data-large-text', 'true');
            var cb = document.getElementById('largeText');
            if (cb) cb.checked = true;
        }
    }
    restoreA11y();

    // Открыть/закрыть панель
    if (a11yBtn && a11yPanel) {
        a11yBtn.addEventListener('click', function () {
            a11yPanel.classList.toggle('show');
        });
    }
    if (a11yClose && a11yPanel) {
        a11yClose.addEventListener('click', function () {
            a11yPanel.classList.remove('show');
        });
    }

    // Закрыть при клике вне панели
    document.addEventListener('click', function (e) {
        if (a11yPanel && !a11yPanel.contains(e.target) && e.target !== a11yBtn) {
            a11yPanel.classList.remove('show');
        }
    });

    // Чекбокс: высокий контраст
    var hc = document.getElementById('highContrast');
    if (hc) {
        hc.addEventListener('change', function () {
            if (this.checked) {
                html.setAttribute('data-contrast', 'high');
                localStorage.setItem('interio_a11y_contrast', 'true');
            } else {
                html.removeAttribute('data-contrast');
                localStorage.removeItem('interio_a11y_contrast');
            }
        });
    }

    // Чекбокс: крупные кнопки
    var lb = document.getElementById('largeButtons');
    if (lb) {
        lb.addEventListener('change', function () {
            if (this.checked) {
                html.setAttribute('data-large-buttons', 'true');
                localStorage.setItem('interio_a11y_large-buttons', 'true');
            } else {
                html.removeAttribute('data-large-buttons');
                localStorage.removeItem('interio_a11y_large-buttons');
            }
        });
    }

    // Чекбокс: крупный текст
    var lt = document.getElementById('largeText');
    if (lt) {
        lt.addEventListener('change', function () {
            if (this.checked) {
                html.setAttribute('data-large-text', 'true');
                localStorage.setItem('interio_a11y_large-text', 'true');
            } else {
                html.removeAttribute('data-large-text');
                localStorage.removeItem('interio_a11y_large-text');
            }
        });
    }

    console.log('✅ Тема и доступность загружены');
});
