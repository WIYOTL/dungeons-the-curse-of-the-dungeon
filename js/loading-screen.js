(() => {
    const loadingScreen = document.getElementById('app-loading-screen');
    const progressTrack = document.getElementById('loading-progress-track');
    const progressFill = document.getElementById('loading-progress-fill');
    const progressText = document.getElementById('loading-progress-text');
    const statusText = document.getElementById('loading-status-text');
    const gameTip = document.getElementById('loading-game-tip');
    const logo = loadingScreen?.querySelector('.loading-logo');
    const logoFallback = loadingScreen?.querySelector('.loading-logo-fallback');

    if (!loadingScreen || !progressTrack || !progressFill || !progressText || !statusText) return;

    const minimumDisplayDuration = 2400;
    const minimumStepInterval = 850;
    const startedAt = performance.now();
    const milestones = ['screen-painted', 'logo-ready', 'document-ready', 'engine-ready', 'first-frame'];
    const completedMilestones = new Set();
    let displayedMilestones = 0;
    let lastStepAt = startedAt;
    let stepScheduled = false;
    let completed = false;

    const gameTips = [
        'Astuce : utilisez ZQSD ou les flèches pour vous déplacer.',
        'Astuce : appuyez sur Espace pour attaquer.',
        'Astuce : utilisez Maj pour effectuer un dash.',
        'Astuce : appuyez sur P ou Échap pour mettre le jeu en pause.',
        'Astuce : explorez le donjon pour découvrir les portes vers la suite.'
    ];
    const mobileTips = [
        'Astuce (mobile) : utilisez le joystick tactile à gauche pour vous déplacer.',
        'Astuce (mobile) : touchez le bouton Attaque pour frapper les ennemis.',
        'Astuce (mobile) : le bouton Dash vous aide à esquiver les attaques.',
        'Astuce (mobile) : utilisez le bouton Parade pour bloquer une attaque au bon moment.',
        'Astuce (mobile) : touchez Pause pour interrompre la partie.',
        'Astuce (mobile) : approchez-vous des éléments et touchez Agir pour interagir.'
    ];
    const userAgent = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const hasTouch = navigator.maxTouchPoints > 0;
    const isIPad = /Mac/i.test(platform) && hasTouch;
    const isMobileAgent = /Android|iPhone|iPad|iPod/i.test(userAgent);
    const tips = hasTouch && (isMobileAgent || isIPad || navigator.userAgentData?.mobile === true)
        ? mobileTips
        : gameTips;
    const previousTipKey = 'dungeons.lastLoadingTip';
    let previousTip = null;
    try {
        previousTip = window.sessionStorage.getItem(previousTipKey);
    } catch (error) {
        console.warn('La mémorisation de l’astuce précédente est indisponible :', error);
    }

    const availableTips = tips.filter(tip => tip !== previousTip);
    const selectedTip = availableTips[Math.floor(Math.random() * availableTips.length)];
    if (gameTip) gameTip.textContent = selectedTip;
    try {
        window.sessionStorage.setItem(previousTipKey, selectedTip);
    } catch (error) {
        console.warn('Impossible de mémoriser l’astuce de chargement :', error);
    }

    const setProgress = value => {
        progressFill.style.width = `${value}%`;
        progressText.textContent = `${value} %`;
        statusText.textContent = 'Chargement...';
        progressTrack.setAttribute('aria-valuenow', String(value));
    };

    const finishStartup = () => {
        if (completed || displayedMilestones !== milestones.length) return;
        completed = true;
        const remainingDisplayTime = Math.max(0, minimumDisplayDuration - (performance.now() - startedAt));
        window.setTimeout(() => {
            loadingScreen.classList.add('is-leaving');
            loadingScreen.setAttribute('aria-hidden', 'true');
            const fadeDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720;
            window.setTimeout(() => loadingScreen.remove(), fadeDuration);
        }, remainingDisplayTime);
    };

    const advanceProgress = () => {
        if (stepScheduled || displayedMilestones >= milestones.length) return;
        const nextMilestone = milestones[displayedMilestones];
        if (!completedMilestones.has(nextMilestone)) return;

        stepScheduled = true;
        const wait = Math.max(0, minimumStepInterval - (performance.now() - lastStepAt));
        window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                stepScheduled = false;
                if (!completedMilestones.has(milestones[displayedMilestones])) return;
                displayedMilestones++;
                lastStepAt = performance.now();
                setProgress(displayedMilestones * 20);
                if (displayedMilestones === milestones.length) {
                    finishStartup();
                } else {
                    advanceProgress();
                }
            });
        }, wait);
    };

    const markReady = milestone => {
        completedMilestones.add(milestone);
        advanceProgress();
    };

    const showLogoFallback = () => {
        if (logo) logo.hidden = true;
        if (logoFallback) logoFallback.hidden = false;
    };

    if (logo) {
        const settleLogo = () => markReady('logo-ready');
        logo.addEventListener('load', settleLogo, { once: true });
        logo.addEventListener('error', () => {
            showLogoFallback();
            settleLogo();
        }, { once: true });
        if (logo.complete) {
            if (logo.naturalWidth === 0) showLogoFallback();
            settleLogo();
        }
    } else {
        markReady('logo-ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => markReady('document-ready'), { once: true });
    } else {
        markReady('document-ready');
    }

    window.addEventListener('dungeons:engine-ready', () => markReady('engine-ready'), { once: true });
    window.addEventListener('dungeons:first-frame', () => markReady('first-frame'), { once: true });
    window.requestAnimationFrame(() => markReady('screen-painted'));
    setProgress(0);
})();
