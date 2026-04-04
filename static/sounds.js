/* ═══ Interio Sound Effects ═══ */
(function() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx;
    function getCtx() {
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function play(freq, duration, type, volume) {
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume || 0.1, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start();
            osc.stop(c.currentTime + duration);
        } catch(e) {}
    }

    window.sound = {
        click:   () => play(800, 0.08, 'sine', 0.08),
        success: () => { play(523, 0.15, 'sine', 0.1); setTimeout(()=>play(659, 0.15, 'sine', 0.1), 100); setTimeout(()=>play(784, 0.2, 'sine', 0.1), 200); },
        error:   () => { play(200, 0.3, 'sawtooth', 0.08); },
        step:    () => play(600, 0.1, 'triangle', 0.06),
        hover:   () => play(1200, 0.04, 'sine', 0.03),
        submit:  () => { play(440, 0.1, 'sine', 0.1); setTimeout(()=>play(554, 0.1, 'sine', 0.1), 80); setTimeout(()=>play(659, 0.1, 'sine', 0.1), 160); setTimeout(()=>play(880, 0.2, 'sine', 0.1), 240); },
        notification: () => { play(880, 0.15, 'sine', 0.12); setTimeout(()=>play(1100, 0.2, 'sine', 0.12), 150); },
        toggle:  () => play(500, 0.06, 'sine', 0.05),
    };

    // Авто-звуки на кнопки
    document.addEventListener('click', e => {
        const btn = e.target.closest('button, .option-card, .style-image-card, a.btn-primary-hero, a.btn-outline');
        if (btn) {
            window.sound.click && window.sound.click();
        }
    }, true);

    console.log('🔊 Sound effects loaded');
})();
