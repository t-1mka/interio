document.addEventListener('DOMContentLoaded', () => {
    // Тема и панель a11y обрабатывает только state-manager.js (initUI), без дублирования обработчиков.

    window.showToast = function(message, duration = 3000) {
        const toast = document.getElementById('toastNotification');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) {
            console.error('Toast elements not found:', { toast, toastMessage });
            return;
        }

        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    };
});
