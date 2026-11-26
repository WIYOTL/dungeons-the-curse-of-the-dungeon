if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(new URL('./service-worker.js', document.baseURI), {
            scope: './',
            // Le script du service worker ne doit jamais sortir du cache HTTP Safari :
            // un SW périmé sert sinon du JS périmé (compteur de leviers à 0/10 sur iPhone).
            updateViaCache: 'none'
        }).then(registration => {
            // Vérifie immédiatement s'il existe un service worker plus récent côté serveur.
            if (registration.update) registration.update().catch(() => {});
        }).catch(error => console.error(window.t('Installation hors ligne indisponible :'), error));

        // Quand un nouveau service worker prend le contrôle d'une page qui était sous
        // l'ancien, on recharge une seule fois pour exécuter le JS à jour — sans action
        // de l'utilisateur (le garde-fou évite toute boucle de rechargement).
        let reloadedForNewSw = false;
        try { reloadedForNewSw = sessionStorage.getItem('dungeonsSwReloaded') === '1'; } catch (e) { /* stockage indisponible */ }
        const hadController = Boolean(navigator.serviceWorker.controller);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hadController || reloadedForNewSw) return;
            reloadedForNewSw = true;
            try { sessionStorage.setItem('dungeonsSwReloaded', '1'); } catch (e) { /* stockage indisponible */ }
            location.reload();
        });
    });
}
