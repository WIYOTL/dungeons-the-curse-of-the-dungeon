(function () {
    const steps = [
        ['Explorez', 'Utilisez ZQSD ou les flèches pour vous déplacer. Sur mobile, déplacez le joystick tactile. Cherchez les portes et les salles secrètes.'],
        ['Combattez', 'ESPACE attaque, SHIFT effectue un dash, F déclenche une parade et E interagit avec les leviers. Les boutons tactiles offrent les mêmes actions.'],
        ['Progressez', 'Ramassez l’or, utilisez les potions et améliorez votre héros dans la boutique. La progression se sauvegarde localement automatiquement.'],
        ['Complétez le jeu', 'Terminez les 21 niveaux, les missions, les secrets, le bestiaire et les défis pour viser les 100 %. Les défis seedés se partagent depuis Progression & Défis.']
    ];
    let currentStep = 0;
    let previousFocus = null;
    const dialog = document.getElementById('tutorial-dialog');

    function renderStep() {
        document.getElementById('tutorial-step-label').textContent = `ÉTAPE ${currentStep + 1} / ${steps.length}`;
        document.getElementById('tutorial-title').textContent = steps[currentStep][0];
        document.getElementById('tutorial-copy').textContent = steps[currentStep][1];
        const next = document.getElementById('tutorial-next');
        next.textContent = currentStep === steps.length - 1 ? 'TERMINER' : 'SUIVANT';
    }

    function closeTutorial() {
        dialog.hidden = true;
        try {
            localStorage.setItem('dungeonsTutorialSeen', 'true');
        } catch (error) {
            console.warn('Le tutoriel ne peut pas mémoriser sa fermeture :', error);
        }
        previousFocus?.focus();
    }

    window.openTutorial = () => {
        currentStep = 0;
        previousFocus = document.activeElement;
        renderStep();
        dialog.hidden = false;
        document.getElementById('tutorial-next').focus();
    };

    document.getElementById('tutorial-next').addEventListener('click', () => {
        if (currentStep === steps.length - 1) {
            closeTutorial();
            return;
        }
        currentStep++;
        renderStep();
        document.getElementById('tutorial-next').focus();
    });
    document.getElementById('tutorial-skip').addEventListener('click', closeTutorial);
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeTutorial();
        if (event.key === 'Tab') {
            const buttons = [...dialog.querySelectorAll('button')];
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    let hasSeenTutorial = false;
    try {
        hasSeenTutorial = localStorage.getItem('dungeonsTutorialSeen') === 'true';
    } catch (error) {
        console.warn('Le statut du tutoriel ne peut pas être lu :', error);
    }
    if (!hasSeenTutorial) window.setTimeout(window.openTutorial, window.__dungeonsEngineReady ? 500 : 1500);
})();
