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

    // --- Touch Gestures (Swipe Navigation for Main Page) ---
    function initTouchGestures() {
        if (typeof Hammer === 'undefined') {
            console.warn('Hammer.js not loaded, swipe gestures disabled');
            return;
        }

        const body = document.body;
        const hammer = new Hammer(body, {
            recognizers: [
                [Hammer.Swipe, { direction: Hammer.DIRECTION_VERTICAL }]
            ]
        });

        // Define sections in order
        const sections = [
            { id: 'hero', name: 'hero' },
            { id: 'about', name: 'about' },
            { id: 'contacts', name: 'contacts' }
        ];

        hammer.on('swipeup', () => {
            // Swipe up = go to next section
            const currentScroll = window.pageYOffset;
            const windowHeight = window.innerHeight;
            
            for (let i = 0; i < sections.length; i++) {
                const section = document.getElementById(sections[i].id);
                if (section) {
                    const sectionTop = section.offsetTop;
                    const sectionBottom = sectionTop + section.offsetHeight;
                    
                    // If current scroll is in this section and there's a next section
                    if (currentScroll >= sectionTop - 100 && currentScroll < sectionBottom - 100 && i < sections.length - 1) {
                        const nextSection = document.getElementById(sections[i + 1].id);
                        if (nextSection) {
                            nextSection.scrollIntoView({ behavior: 'smooth' });
                            break;
                        }
                    }
                }
            }
        });

        hammer.on('swipedown', () => {
            // Swipe down = go to previous section
            const currentScroll = window.pageYOffset;
            
            for (let i = sections.length - 1; i >= 0; i--) {
                const section = document.getElementById(sections[i].id);
                if (section) {
                    const sectionTop = section.offsetTop;
                    
                    // If current scroll is below this section and there's a previous section
                    if (currentScroll > sectionTop + 100 && i > 0) {
                        const prevSection = document.getElementById(sections[i - 1].id);
                        if (prevSection) {
                            prevSection.scrollIntoView({ behavior: 'smooth' });
                            break;
                        }
                    }
                }
            }
            
            // If at top, scroll to hero
            if (currentScroll < 100) {
                const heroSection = document.getElementById('hero');
                if (heroSection) {
                    heroSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }

    // Initialize touch gestures
    initTouchGestures();
});
