(function (root, factory) {
    const utilities = factory();
    if (typeof module === 'object' && module.exports) module.exports = utilities;
    Object.assign(root, utilities);
})(globalThis, function () {
    const translate = text => (typeof globalThis.t === 'function' ? globalThis.t(text) : text);
    const DAILY_CHALLENGE_MODIFIERS = Object.freeze([
        ['armored', 'Ennemis blindés · +25% PV ennemis'],
        ['elite', 'Ennemis élites · +15% vitesse et dégâts'],
        ['swift', 'Donjon frénétique · +18% vitesse ennemie'],
        ['fury', 'Fureur du Néant · +20% dégâts ennemis'],
        ['scarce-healing', 'Soins réduits · potions restaurent 22 PV']
    ].map(([id, source]) => Object.freeze({
        id,
        source,
        get label() { return translate(source); }
    })));

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
        const h = translate('h');
        const min = translate('min');
        const s = translate('s');
        return `${hours} ${h} ${String(minutes).padStart(2, '0')} ${min} ${String(remainingSeconds).padStart(2, '0')} ${s}`;
    }

    return { DAILY_CHALLENGE_MODIFIERS, getDailyChallengeModifierIds, formatPlayTime };
});
