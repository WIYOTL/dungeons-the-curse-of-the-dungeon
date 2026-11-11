if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(new URL('./service-worker.js', document.baseURI), { scope: './' })
            .catch(error => console.error('Installation hors ligne indisponible :', error));
    });
}
