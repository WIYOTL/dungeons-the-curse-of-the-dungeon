(function (root, factory) {
    const utilities = factory();
    if (typeof module === 'object' && module.exports) module.exports = utilities;
    Object.assign(root, utilities);
})(globalThis, function () {
    const DAILY_CHALLENGE_MODIFIERS = Object.freeze([
        { id: 'armored', label: 'Ennemis blindés · +25% PV ennemis' },
        { id: 'elite', label: 'Ennemis élites · +15% vitesse et dégâts' },
        { id: 'swift', label: 'Donjon frénétique · +18% vitesse ennemie' },
        { id: 'fury', label: 'Fureur du Néant · +20% dégâts ennemis' },
        { id: 'scarce-healing', label: 'Soins réduits · potions restaurent 22 PV' }
    ]);

    function getDailyChallengeModifierIds(seed) {
        let state = seed >>> 0;
        const remaining = [...DAILY_CHALLENGE_MODIFIERS];
        const selected = [];
        while (selected.length < 2) {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            const index = Math.floor((state / 0x100000000) * remaining.length);
            selected.push(remaining.splice(index, 1)[0].id);
        }
        return selected;
    }

    function formatPlayTime(totalSeconds = 0) {
        const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return hours
            ? `${hours} h ${String(minutes).padStart(2, '0')} min`
            : `${minutes} min ${String(remainingSeconds).padStart(2, '0')} s`;
    }

    return { DAILY_CHALLENGE_MODIFIERS, getDailyChallengeModifierIds, formatPlayTime };
});
