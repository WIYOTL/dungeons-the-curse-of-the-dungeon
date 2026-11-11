const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const notificationBanner = document.getElementById('notification-banner');
const notificationQueue = [];
let notificationInProgress = false;

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 1000;
const BASE_PLAYER_HP = 100;
const MAX_PLAYER_HP = 300;
const MAX_PLAYER_DEFENSE = 0.75;
const MAX_PLAYER_ATTACK_DAMAGE = 100;
const SAVE_VERSION = 12;
const SAVE_DEBOUNCE_MS = 400;
const BESTIARY_DEFINITIONS = {
    chaser: { label: 'Traqueur', icon: '👁', description: 'Poursuit le héros sans relâche.' },
    skirmisher: { label: 'Escarmoucheur', icon: '🗡', description: 'Se déplace en oblique pour contourner sa cible.' },
    brute: { label: 'Brute', icon: '🪨', description: 'Avance lentement et frappe avec force.' },
    sentinel: { label: 'Sentinelle', icon: '🛡', description: 'Temporise, puis lance périodiquement une charge rapide.' },
    boss: { label: 'Boss', icon: '👑', description: 'Gardien majeur doté de phases et d’attaques spéciales.' }
};
const VALID_SKIN_IDS = new Set([
    'cyan', 'crimson', 'shadow', 'astral', 'abyssal',
    'default', 'red', 'green', 'purple', 'gold', 'secret', 'ngplus-ascendant', 'seed-warden', 'endless-conqueror', 'endless-sentinel'
]);
const VALID_RELIC_IDS = new Set(['frost', 'ward', 'leech', 'fortune', 'shell']);
const DIFFICULTY_MODES = {
    adventure: { label: 'Adventure', multiplier: 1, description: 'Expérience équilibrée.' },
    difficult: { label: 'Difficult', multiplier: 1.25, description: 'Ennemis plus résistants et agressifs.' },
    nightmare: { label: 'Nightmare', multiplier: 1.6, description: 'Pour les builds maîtrisés.' },
    hell: { label: 'Hell', multiplier: 2.1, description: 'Aucune erreur ne sera pardonnée.' }
};
const BUILD_DEFINITIONS = {
    vanguard: { label: 'Vanguard', perks: ['+20% PV max', '+10% défense'], hp: 1.2, defense: .1, damage: .95, speed: .95, dashSpeed: 1 },
    duelist: { label: 'Duelist', perks: ['+18% dégâts', 'dash plus rapide'], hp: .95, defense: 0, damage: 1.18, speed: 1.08, dashSpeed: 1.2 },
    ranger: { label: 'Ranger', perks: ['+25% portée', '+8% vitesse'], hp: .95, defense: 0, damage: 1.05, speed: 1.08, dashSpeed: 1 }
};
const SPEED_RUN_LIMIT_SECONDS = 150;

let camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    lerp: 0.08
};

function generateWorldTheme(floorBase, floorGrid, floorDetail, wallFill, wallBorder) {
    return { floorBase, floorGrid, floorDetail, wallFill, wallBorder };
}

function buildEasyLevelsForWorld1() {
    let levels = [];
    let baseEnemies = [2, 3, 3, 4, 4, 5];
    let baseHp = [35, 45, 55, 65, 75, 85];
    let baseSpeed = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
    let baseDmg = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    for (let i = 0; i < 6; i++) {
        levels.push({
            id: `world-1-level-${i + 1}`,
            enemyCount: baseEnemies[i],
            enemySpeed: baseSpeed[i],
            enemyHp: baseHp[i],
            damageMult: baseDmg[i],
            goldDrop: 12 + i * 3,
            isBoss: false
        });
    }
    levels.push({
        id: 'world-1-boss',
        enemyCount: 1,
        enemySpeed: 0.75,
        enemyHp: 180,
        damageMult: 1.2,
        goldDrop: 60,
        isBoss: true,
        bossType: 0,
        bossName: "Gardien de l'Aube"
    });
    return levels;
}

function openNewGameConfirm() {
    showOverlay('newgame-confirm-screen');
}

function confirmNewGame() {
    resetGameData();
    updateSecondaryMissionMilestones();
    cameFromPause = false;
    gameState = 'WORLD_SELECT';
    buildWorldSelectUI();
    showWorldSelectMessage('Nouvelle partie créée !');
    showOverlay('world-select-screen');
}

function showWorldSelectMessage(text) {
    const message = document.getElementById('world-select-message');
    if (!message) return;
    clearTimeout(worldSelectMessageTimer);
    message.textContent = text;
    worldSelectMessageTimer = setTimeout(() => {
        message.textContent = '';
    }, 4000);
}


function buildLevelsForWorld(baseEnemyCount, baseSpeed, baseHp, baseDmg, baseGold, bossTypeVal, bossNameVal) {
    let levels = [];
    for (let i = 0; i < 6; i++) {
        let mult = 1 + i * 0.15;
        levels.push({
            id: `world-${bossTypeVal === 1 ? 2 : 3}-level-${i + 1}`,
            enemyCount: baseEnemyCount + Math.floor(i * 1.5),
            enemySpeed: baseSpeed + i * 0.08,
            enemyHp: Math.floor(baseHp * mult),
            damageMult: 0.8 + i * 0.1,
            goldDrop: baseGold + i * 5,
            isBoss: false
        });
    }
    levels.push({
        id: bossTypeVal === 1 ? 'world-2-boss' : 'world-3-boss',
        enemyCount: 1,
        enemySpeed: baseSpeed * 0.95,
        enemyHp: Math.floor(baseHp * 4.5),
        damageMult: 2.2,
        goldDrop: baseGold * 6,
        isBoss: true,
        bossType: bossTypeVal,
        bossName: bossNameVal
    });
    return levels;
}

function showVictoryScreen() {
    gameState = 'VICTORY';

    const bossRushVictory = bossRushState && bossRushState.completed;
    const victoryTitle = document.querySelector('#victory-screen .victory-title');
    const victorySubtitle = document.querySelector('#victory-screen .victory-subtitle');
    const retryButton = document.getElementById('victory-retry-btn');
    const newGamePlusButton = document.getElementById('victory-newgameplus-btn');
    const shareResultButton = document.getElementById('victory-share-result-btn');
    if (victoryTitle) victoryTitle.textContent = bossRushVictory ? 'BOSS-RUSH TERMINÉ !' : 'VICTOIRE !';
    if (victorySubtitle) {
        victorySubtitle.textContent = bossRushVictory
            ? 'Vous avez vaincu les trois boss à la suite et gagné 3 000 Or !'
            : `Vous avez vaincu tous les boss et la malédiction du donjon est levée ! New Game+ ${newGamePlusUnlocked ? 'est débloqué' : 'sera débloqué'}${newGamePlusLevel ? ` · cycle ${newGamePlusLevel}` : ''}.`;
    }
    if (retryButton) {
        retryButton.hidden = bossRushVictory;
        retryButton.style.display = bossRushVictory ? 'none' : '';
    }
    if (newGamePlusButton) {
        newGamePlusButton.hidden = !newGamePlusUnlocked;
        newGamePlusButton.style.display = newGamePlusUnlocked ? '' : 'none';
        newGamePlusButton.textContent = `COMMENCER NEW GAME+ ${newGamePlusLevel + 1} ▶`;
    }
    if (shareResultButton) shareResultButton.hidden = !dailyChallenge || !dailyChallenge.result;
    document.getElementById('victory-world').textContent =
        currentWorldIndex + 1;

    document.getElementById('victory-level').textContent =
        currentLevelIndex + 1;

    document.getElementById('victory-gold').textContent =
        Math.floor(player.gold);

    document.getElementById('victory-score').textContent =
        score;

    document.getElementById('victory-hp').textContent =
        `${Math.floor(player.hp)} / ${player.maxHp}`;

    showOverlay('victory-screen');
}

function startNewGamePlus() {
    if (!newGamePlusUnlocked || newGamePlusLevel >= Number.MAX_SAFE_INTEGER) {
        showNotification('New Game+ n’est pas disponible.');
        return false;
    }

    const previousLevel = newGamePlusLevel;
    newGamePlusLevel++;
    clearChallengeRuntimeState({ keepChallengeConfig: true });
    score = 0;
    player.hp = player.maxHp;

    if (!loadLevel(0, 0)) {
        newGamePlusLevel = previousLevel;
        showNotification('Impossible de démarrer New Game+ : le premier niveau ne peut pas être chargé.');
        return false;
    }

    newGamePlusRunActive = true;
    maxUnlockedWorld = 0;
    maxUnlockedLevel = 0;
    hasSavedProgress = true;
    phase3Stats.runs++;
    enterPlayingState();
    saveGame(true);
    renderPhase3();
    showNotification(`New Game+ ${newGamePlusLevel} lancé : ennemis plus résistants et plus puissants.`, 4500);
    return true;
}

function showCreditsScreen() {
    gameState = 'CREDITS';
    leavePlayingState();
    const shareResultButton = document.getElementById('credits-share-result-btn');
    if (shareResultButton) shareResultButton.hidden = !dailyChallenge || !dailyChallenge.result;
    showOverlay('credits-screen');
}

const worldsData = [
    {
        name: "Monde 1 : Le Sanctuaire de l'Aube",
        theme: generateWorldTheme('#131a22', '#1b2430', 'rgba(102,252,241,0.04)', '#212d3d', '#45a29e'),
        levels: buildEasyLevelsForWorld1()
    },
    {
        name: "Monde 2 : La Crypte d'Obsidienne",
        theme: generateWorldTheme('#100e16', '#1a1524', 'rgba(155,89,182,0.03)', '#221b30', '#9b59b6'),
        levels: buildLevelsForWorld(6, 1.1, 100, 1.0, 25, 1, "Seigneur d'Obsidienne")
    },
    {
        name: "Monde 3 : Le Trône du Néant",
        theme: generateWorldTheme('#0b0a14', '#141224', 'rgba(224,86,253,0.03)', '#1d1933', '#e056fd'),
        levels: buildLevelsForWorld(8, 1.45, 170, 1.4, 55, 2, "Avatar du Néant")
    }
];

let gameState = 'TITLE';
let hasSavedProgress = false;
let saveWritesAuthorized = false;
let maxUnlockedWorld = 0;
let maxUnlockedLevel = 0;

let currentWorldIndex = 0;
let currentLevelIndex = 0;
let score = 0;
let gameTime = 0;
let runTimerRemaining = null;
let portalNotificationShown = false;
let shiftWasDown = false;
let interactWasDown = false;
let parryWasDown = false;

let player = {
    x: 120,
    y: 120,
    radius: 15,
    speed: 3.8,
    hp: BASE_PLAYER_HP,
    maxHp: BASE_PLAYER_HP,
    gold: 0,
    skin: 'default',
    defense: 0,
    ownedSkins: ['default'],
    attackRange: 60,
    attackArc: Math.PI / 1.4,
    attackDamage: 22,
    attackCooldown: 0,
    isSwinging: false,
    swingTimer: 0,
    facing: { x: 1, y: 0 },
    dashCooldown: 0,
    isDashing: false,
    dashTimer: 0
    ,dashInvulnerability: 0,
    attackCharge: 0,
    parryTimer: 0,
    statusEffects: {},
    abilities: [],
    relics: [],
    _buildHpMultiplier: 1,
    _buildDefenseBonus: 0,
    _buildDamageMultiplier: 1,
    _buildSpeedMultiplier: 1,
    _buildDashSpeedMultiplier: 1,
    _shopHealthBonus: 0,
    _shopDefenseBonus: 0,
    _shopDamageBonus: 0,
    _shopSpeedBonus: 0
};

let enemies = [];
let items = [];
let particles = [];
let damageTexts = [];
let walls = [];
let floorTiles = [];
let exitDoor = null;
let levelElements = [];
let secretRewardsClaimed = [];
let bossTelegraphs = [];
let activeAudioNodes = new Set();
let cameFromPause = false;
let optionsReturnState = 'TITLE';
let shopReturnState = 'TITLE';
let missionsReturnState = 'TITLE';
let phase3ReturnState = 'TITLE';
let pendingBossReward = null;
let bossRewardShown = false;
let consecutiveMonsterKills = 0;
let killSkinsUsed = [];
let purchasedProducts = {};
let worldCompletionSkins = {};
let rareSkinsUnlocked = [];
let discoveredSecretRooms = [];
let completedLevels = [];
let defeatedBosses = [];
let optionalChallengeLevelProgress = {};
let currentLevelChallengeSnapshot = [];
let claimedBossRewards = [];
let completedLevelIds = [];
let defeatedBossIds = [];
let claimedBossRewardIds = [];
let claimedMissionRewards = [];
let saveWasMigrated = false;
let difficultyMode = 'adventure';
let selectedBuild = 'vanguard';
let challengeState = {};
let phase3Stats = { runs: 0, victories: 0, deaths: 0, damageDealt: 0, damageTaken: 0, bestScore: 0, dailyWins: 0, bossRushWins: 0, playSeconds: 0 };
let playTimeRemainder = 0;
let bestiary = {};
let activeChallenge = null;
let dailyChallenge = null;
let bossRushState = null;
let endlessModeState = {
    active: false,
    currentWave: 0,
    bestWave: 0,
    bestClearedWave: 0,
    lastRunWave: 0,
    bestScore: 0,
    claimedMilestones: []
};
let endlessRunEnded = false;
let newGamePlusLevel = 0;
let newGamePlusUnlocked = false;
let newGamePlusRunActive = false;
let levelGenerationRandom = null;

function getCurrentDailyChallengeModifiers() {
    if (!dailyChallenge || activeChallenge !== 'daily') return [];
    const validIds = new Set(DAILY_CHALLENGE_MODIFIERS.map(modifier => modifier.id));
    const stored = Array.isArray(dailyChallenge.modifiers)
        ? dailyChallenge.modifiers.filter(id => validIds.has(id))
        : [];
    if (stored.length === 2) return stored;
    if (Array.isArray(dailyChallenge.modifiers)
        && dailyChallenge.modifiers.includes('ennemis élites')
        && dailyChallenge.modifiers.includes('soins réduits')) {
        return ['armored', 'elite', 'scarce-healing'];
    }
    return getDailyChallengeModifierIds(dailyChallenge.seed);
}

function getDailyChallengeModifierLabels(ids = dailyChallenge?.modifiers) {
    const selectedIds = ids === dailyChallenge?.modifiers
        ? getCurrentDailyChallengeModifiers()
        : (Array.isArray(ids) ? ids : []);
    return selectedIds
        .map(id => DAILY_CHALLENGE_MODIFIERS.find(modifier => modifier.id === id)?.label)
        .filter(Boolean);
}

const secretRoomDefinitions = [
    { id: 'world-1-level-2', world: 0, level: 1, type: 'simple', x: 1180, y: 180, w: 150, h: 120 },
    { id: 'world-1-level-5', world: 0, level: 4, type: 'simple', x: 1180, y: 820, w: 150, h: 120 },
    { id: 'world-2-level-3', world: 1, level: 2, type: 'simple', x: 1160, y: 720, w: 150, h: 120 },
    { id: 'world-2-level-6', world: 1, level: 5, type: 'simple', x: 180, y: 820, w: 150, h: 120 },
    { id: 'world-3-level-1', world: 2, level: 0, type: 'rare', x: 1120, y: 150, w: 170, h: 130 },
    { id: 'world-3-level-4', world: 2, level: 3, type: 'rare', x: 1120, y: 850, w: 170, h: 130 },
    { id: 'world-3-level-7', world: 2, level: 6, type: 'ultimate', x: 180, y: 850, w: 190, h: 140 }
];
let runtimeError = null;
let worldSelectMessageTimer = null;
function createDefaultSettings() {
    return {
        masterVolume: 100,
        musicVolume: 80,
        sfxVolume: 100,
        showDamage: true,
        showParticles: true,
        showEnemyBars: true,
        showFps: false,
        highContrast: false,
        reducedMotion: false,
        largeText: false
    };
}

function normalizeSettings(source) {
    const defaults = createDefaultSettings();
    const values = source && typeof source === 'object' ? source : {};
    return {
        masterVolume: Number.isFinite(values.masterVolume)
            ? Math.max(0, Math.min(100, values.masterVolume)) : defaults.masterVolume,
        musicVolume: Number.isFinite(values.musicVolume)
            ? Math.max(0, Math.min(100, values.musicVolume)) : defaults.musicVolume,
        sfxVolume: Number.isFinite(values.sfxVolume)
            ? Math.max(0, Math.min(100, values.sfxVolume)) : defaults.sfxVolume,
        showDamage: typeof values.showDamage === 'boolean' ? values.showDamage : defaults.showDamage,
        showParticles: typeof values.showParticles === 'boolean' ? values.showParticles : defaults.showParticles,
        showEnemyBars: typeof values.showEnemyBars === 'boolean' ? values.showEnemyBars : defaults.showEnemyBars,
        showFps: typeof values.showFps === 'boolean' ? values.showFps : defaults.showFps,
        highContrast: typeof values.highContrast === 'boolean' ? values.highContrast : defaults.highContrast,
        reducedMotion: typeof values.reducedMotion === 'boolean' ? values.reducedMotion : defaults.reducedMotion,
        largeText: typeof values.largeText === 'boolean' ? values.largeText : defaults.largeText
    };
}

let settings = createDefaultSettings();
let audioContext = null;
let ambientOscillator = null;
let ambientGain = null;

function playUiTone(frequency = 660, duration = 0.08) {
    if (!settings || settings.masterVolume <= 0 || settings.sfxVolume <= 0) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const volume = (settings.masterVolume / 100) * (settings.sfxVolume / 100) * 0.08;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn('Audio indisponible :', error);
    }
}

function startAmbientMusic() {
    if (settings.musicVolume <= 0 || settings.masterVolume <= 0) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume();
        if (!ambientOscillator) {
            ambientOscillator = audioContext.createOscillator();
            ambientGain = audioContext.createGain();
            ambientOscillator.type = 'sine';
            ambientOscillator.frequency.value = 110;
            ambientGain.gain.value = 0;
            ambientOscillator.connect(ambientGain);
            ambientGain.connect(audioContext.destination);
            ambientOscillator.start();
        }
        ambientGain.gain.setTargetAtTime(
            (settings.masterVolume / 100) * (settings.musicVolume / 100) * 0.018,
            audioContext.currentTime,
            0.12
        );
    } catch (error) {
        console.warn('Musique indisponible :', error);
    }
}

function stopAmbientMusic() {
    if (!ambientGain || !audioContext) return;
    const oscillator = ambientOscillator;
    const gain = ambientGain;
    gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
    setTimeout(() => {
        try { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); } catch (error) { /* already stopped */ }
        if (ambientOscillator === oscillator) {
            ambientOscillator = null;
            ambientGain = null;
        }
    }, 420);
}

const audioCueProfiles = {
    hit: [220, 0.06, 'sawtooth'],
    critical: [520, 0.12, 'square'],
    dash: [150, 0.09, 'triangle'],
    parry: [760, 0.14, 'triangle'],
    trapWarning: [300, 0.12, 'square'],
    trap: [110, 0.18, 'sawtooth'],
    bossPhase: [90, 0.45, 'sawtooth'],
    bossAttack: [180, 0.22, 'square'],
    portal: [440, 0.3, 'sine'],
    secret: [880, 0.28, 'sine'],
    reward: [660, 0.34, 'triangle']
};

function playCue(name, multiplier = 1) {
    const profile = audioCueProfiles[name] || audioCueProfiles.hit;
    if (!settings || settings.masterVolume <= 0 || settings.sfxVolume <= 0) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;
        const duration = profile[1] * multiplier;
        oscillator.type = profile[2];
        oscillator.frequency.setValueAtTime(profile[0], now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, profile[0] * 0.55), now + duration);
        gain.gain.setValueAtTime((settings.masterVolume / 100) * (settings.sfxVolume / 100) * 0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        activeAudioNodes.add(oscillator);
        oscillator.onended = () => {
            activeAudioNodes.delete(oscillator);
            try { oscillator.disconnect(); gain.disconnect(); } catch (error) { /* already disconnected */ }
        };
        oscillator.start(now);
        oscillator.stop(now + duration);
    } catch (error) {
        console.warn('Audio cue indisponible :', error);
    }
}

function playWorldCue(worldIndex, boss = false) {
    const base = boss ? 120 : 260 + worldIndex * 70;
    playUiTone(base, boss ? 0.18 : 0.08);
    if (boss) playCue('bossPhase', 0.7);
}

function stopAllAudioNodes() {
    activeAudioNodes.forEach(node => {
        try { node.stop(); node.disconnect(); } catch (error) { /* node already ended */ }
    });
    activeAudioNodes.clear();
}

const GAME_COMPLETION_WEIGHTS = Object.freeze({
    levels: 40,
    missions: 40,
    secretRooms: 10,
    bestiary: 5,
    specialChallenges: 5
});
const OPTIONAL_CHALLENGE_IDS = Object.freeze(['no-potion', 'speed-run', 'glass-cannon']);
const SPECIAL_CHALLENGE_COUNT = 3 + OPTIONAL_CHALLENGE_IDS.length;
const ENDLESS_MASTERY_GOALS = Object.freeze([
    { wave: 5, gold: 500, label: 'Survivant · 5 vagues' },
    { wave: 10, gold: 1000, label: 'Aguerri · 10 vagues' },
    { wave: 20, gold: 2000, label: 'Vétéran · 20 vagues' },
    { wave: 35, gold: 3500, label: 'Champion · 35 vagues' },
    { wave: 50, gold: 5000, skin: 'endless-conqueror', label: 'Conquérant éternel · 50 vagues' }
]);

function createDefaultMissionProgress() {
    return secondaryMissionDefinitions.reduce((progress, mission) => {
        progress[mission.id] = { current: 0, target: mission.target, completed: false };
        return progress;
    }, {});
}

let secondaryMissionProgress = createDefaultMissionProgress();
let fpsFrames = 0;
let fpsTimestamp = 0;

function resetTransientPlayerState() {
    player.attackCooldown = 0;
    player.isSwinging = false;
    player.swingTimer = 0;
    player.dashCooldown = 0;
    player.isDashing = false;
    player.dashTimer = 0;
    player.dashInvulnerability = 0;
    player.attackCharge = 0;
    player.parryTimer = 0;
    player.facing.x = 1;
    player.facing.y = 0;
    shiftWasDown = false;
    interactWasDown = false;
    parryWasDown = false;
}

function clearInputState() {
    keys = {};
    shiftWasDown = false;
    interactWasDown = false;
    parryWasDown = false;
    if (typeof clearGamepadInput === 'function') clearGamepadInput();
    if (typeof clearMobileTouchInput === 'function') clearMobileTouchInput();
}

function resetCameraToPlayer() {
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - camera.width, player.x - camera.width / 2));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - camera.height, player.y - camera.height / 2));
}

function showOverlay(id) {
    const playerStatsBox = document.getElementById('player-stats-box');
    if (playerStatsBox) playerStatsBox.style.display = id === 'title-screen' ? 'flex' : 'none';
    document.querySelectorAll('.overlay-screen').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
    });

    if (!id) return;

    const screen = document.getElementById(id);
    if (!screen) {
        console.error("Overlay introuvable :", id);
        return;
    }

    screen.classList.remove('hidden');
    screen.style.display = 'flex';
    screen.style.visibility = 'visible';
    screen.style.opacity = '1';
    screen.style.pointerEvents = 'auto';
    screen.style.zIndex = '3000';
    if (id === 'title-screen') updateMenuStats();
    if (id === 'options-screen') syncOptionsControls();
    if (id === 'missions-screen') renderMissionsScreen();
    if (id === 'phase3-screen') renderPhase3();
}

function normalizeMissionProgress(source) {
    const normalized = createDefaultMissionProgress();
    if (!source || typeof source !== 'object') return normalized;
    secondaryMissionDefinitions.forEach(mission => {
        const saved = source[mission.id];
        if (!saved || typeof saved !== 'object') return;
        const current = Number.isFinite(saved.current)
            ? Math.max(0, Math.min(mission.target || 1, saved.current)) : 0;
        normalized[mission.id] = {
            current,
            target: mission.target || 1,
            completed: current >= (mission.target || 1)
        };
    });
    return normalized;
}

function normalizeMissionTracking(source) {
    const data = source && typeof source === 'object' ? source : {};
    const rawProducts = data.purchasedProducts && typeof data.purchasedProducts === 'object'
        ? data.purchasedProducts : {};
    const purchasedProducts = Object.keys(rawProducts).reduce((result, key) => {
        if (COLLECTIBLE_PRODUCT_IDS.includes(key)) {
            result[key] = rawProducts[key] === true;
        }
        return result;
    }, {});
    const rawWorldSkins = data.worldCompletionSkins && typeof data.worldCompletionSkins === 'object'
        ? data.worldCompletionSkins : {};
    const validLevelIds = worldsData.flatMap(world => world.levels.map(level => level.id));
    const validBossIds = worldsData.map((world, index) => `world-${index + 1}-boss`);
    const normalizeIds = (values, validValues) => Array.isArray(values)
        ? [...new Set(values.filter(value => typeof value === 'string' && validValues.includes(value)))]
        : [];
    const rawChallengeProgress = data.optionalChallengeLevelProgress
        && typeof data.optionalChallengeLevelProgress === 'object'
        && !Array.isArray(data.optionalChallengeLevelProgress)
        ? data.optionalChallengeLevelProgress : {};
    const optionalChallengeLevelProgress = OPTIONAL_CHALLENGE_IDS.reduce((result, id) => {
        result[id] = normalizeIds(rawChallengeProgress[id], validLevelIds);
        return result;
    }, {});
    const worldCompletionSkins = Object.keys(rawWorldSkins).reduce((result, key) => {
        if (/^[0-2]$/.test(key) && typeof rawWorldSkins[key] === 'string') {
            result[key] = rawWorldSkins[key];
        }
        return result;
    }, {});
    return {
        consecutiveMonsterKills: Number.isInteger(data.consecutiveMonsterKills)
            ? Math.max(0, data.consecutiveMonsterKills) : 0,
        killSkinsUsed: Array.isArray(data.killSkinsUsed) ? [...new Set(data.killSkinsUsed.filter(value => typeof value === 'string'))] : [],
        purchasedProducts,
        worldCompletionSkins,
        rareSkinsUnlocked: Array.isArray(data.rareSkinsUnlocked) ? [...new Set(data.rareSkinsUnlocked.filter(value => typeof value === 'string'))] : [],
        discoveredSecretRooms: Array.isArray(data.discoveredSecretRooms)
            ? [...new Set(data.discoveredSecretRooms.filter(value =>
                typeof value === 'string' &&
                secretRoomDefinitions.some(room => room.id === value)
            ))] : [],
        completedLevels: Array.isArray(data.completedLevels)
            ? [...new Set(data.completedLevels.filter(value => typeof value === 'string' && /^\d+-\d+$/.test(value)))] : [],
        defeatedBosses: Array.isArray(data.defeatedBosses)
            ? [...new Set(data.defeatedBosses.filter(value => Number.isInteger(value) && value >= 0 && value < worldsData.length))] : [],
        claimedBossRewards: Array.isArray(data.claimedBossRewards)
            ? [...new Set(data.claimedBossRewards.filter(value => Number.isInteger(value) && value >= 0 && value < worldsData.length))] : [],
        secretRewardsClaimed: Array.isArray(data.secretRewardsClaimed)
            ? [...new Set(data.secretRewardsClaimed.filter(value =>
                typeof value === 'string' && secretRoomDefinitions.some(room => room.id === value)
            ))] : [],
        completedLevelIds: normalizeIds(data.completedLevelIds, validLevelIds),
        optionalChallengeLevelProgress,
        defeatedBossIds: normalizeIds(data.defeatedBossIds, validBossIds),
        claimedBossRewardIds: normalizeIds(data.claimedBossRewardIds, validBossIds),
        claimedMissionRewards: Array.isArray(data.claimedMissionRewards)
            ? [...new Set(data.claimedMissionRewards.filter(value =>
                typeof value === 'string' &&
                secondaryMissionDefinitions.some(mission => mission.id === value)
            ))] : []
    };
}

function migrateLegacyMissionTracking(save) {
    const tracking = save && save.missionTracking && typeof save.missionTracking === 'object'
        ? save.missionTracking : {};
    const saveVersion = Number.isInteger(save && save.saveVersion) ? save.saveVersion : 1;
    const missions = secondaryMissionProgress;
    let migrated = false;

    if (!Array.isArray(save && save.missionTracking && save.missionTracking.completedLevels)) {
        const completedCount = Math.max(0, Math.min(21,
            missions['dungeon-master'] && Number.isFinite(missions['dungeon-master'].current)
                ? Math.floor(missions['dungeon-master'].current) : 0));
        const legacyLevelKeys = [];
        worldsData.forEach((world, worldIndex) => {
            world.levels.forEach((level, levelIndex) => {
                if (legacyLevelKeys.length < completedCount) {
                    legacyLevelKeys.push(`${worldIndex}-${levelIndex}`);
                }
            });
        });
        completedLevels = legacyLevelKeys;
        migrated = completedCount > 0;
    }

    if (!Array.isArray(tracking.defeatedBosses)) {
        const legacyBosses = [];
        if (missions['sanctuary-of-dawn'] && missions['sanctuary-of-dawn'].completed) legacyBosses.push(0);
        if ((missions['obsidian-crypt'] && missions['obsidian-crypt'].completed)
            || (saveVersion <= 10 && missions['world-master'] && missions['world-master'].completed)
            || (Array.isArray(player.ownedSkins) && player.ownedSkins.includes('purple'))) legacyBosses.push(1);
        if ((missions['void-throne'] && missions['void-throne'].completed)
            || (Array.isArray(player.ownedSkins) && player.ownedSkins.includes('gold'))) legacyBosses.push(2);
        defeatedBosses = legacyBosses;
        migrated = migrated || legacyBosses.length > 0;
    }

    if (!Array.isArray(tracking.claimedBossRewards)) {
        claimedBossRewards = [...defeatedBosses];
        migrated = migrated || claimedBossRewards.length > 0;
    }

    const levelIdsFromIndexes = completedLevels.map(key => {
        const [worldIndex, levelIndex] = key.split('-').map(Number);
        return worldsData[worldIndex] && worldsData[worldIndex].levels[levelIndex]
            ? worldsData[worldIndex].levels[levelIndex].id
            : null;
    }).filter(Boolean);
    if (!Array.isArray(tracking.completedLevelIds)) {
        completedLevelIds = [...new Set(levelIdsFromIndexes)];
        migrated = migrated || completedLevelIds.length > 0;
    }
    if (!Array.isArray(tracking.defeatedBossIds)) {
        defeatedBossIds = [...new Set(defeatedBosses.map(index => `world-${index + 1}-boss`))];
        migrated = migrated || defeatedBossIds.length > 0;
    }
    if (!Array.isArray(tracking.claimedBossRewardIds)) {
        claimedBossRewardIds = [...new Set(claimedBossRewards.map(index => `world-${index + 1}-boss`))];
        migrated = migrated || claimedBossRewardIds.length > 0;
    }

    return migrated;
}

let missionFilter = 'all';

function setMissionFilter(filter) {
    missionFilter = ['all', 'active', 'completed'].includes(filter) ? filter : 'all';
    document.querySelectorAll('[data-mission-filter]').forEach(button => {
        button.classList.toggle('active', button.dataset.missionFilter === missionFilter);
    });
    renderMissionsScreen();
}

function renderMissionsScreen() {
    const container = document.getElementById('missions-container');
    if (!container) return;
    const completed = secondaryMissionDefinitions.filter(mission =>
        secondaryMissionProgress[mission.id] &&
        secondaryMissionProgress[mission.id].completed
    ).length;
    const total = secondaryMissionDefinitions.length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const progressBar = document.getElementById('missions-global-progress');
    const percentLabel = document.getElementById('missions-global-percent');
    const countLabel = document.getElementById('missions-completed-count');
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (percentLabel) percentLabel.textContent = `${percent}%`;
    if (countLabel) countLabel.textContent = `${completed} / ${total} missions terminées`;
    const active = total - completed;
    const completedTotal = document.getElementById('missions-completed-total');
    const activeTotal = document.getElementById('missions-active-total');
    const remainingTotal = document.getElementById('missions-remaining-total');
    if (completedTotal) completedTotal.textContent = completed;
    if (activeTotal) activeTotal.textContent = active;
    if (remainingTotal) remainingTotal.textContent = Math.max(0, total - completed);

    const sections = [];
    secondaryMissionDefinitions.forEach(mission => {
        if (!sections.includes(mission.section)) sections.push(mission.section);
    });
    container.innerHTML = sections.map(section => {
        const missions = secondaryMissionDefinitions.filter(mission => {
            if (mission.section !== section) return false;
            const isCompleted = Boolean(secondaryMissionProgress[mission.id] && secondaryMissionProgress[mission.id].completed);
            return missionFilter === 'all'
                || (missionFilter === 'completed' && isCompleted)
                || (missionFilter === 'active' && !isCompleted);
        });
        if (!missions.length) return '';
        return `<section class="missions-section">
            <h3>${section}</h3>
            ${missions.map(mission => {
                const state = secondaryMissionProgress[mission.id] || {
                    current: 0,
                    target: mission.target,
                    completed: false
                };
                const target = Math.max(1, mission.target);
                const current = Math.min(target, Math.max(0, state.current));
                const missionPercent = Math.round((current / target) * 100);
                const unit = mission.unit || 'objectifs';
                const reward = SECONDARY_MISSION_REWARDS[mission.id];
                return `<article class="mission-card${state.completed ? ' completed' : ''}">
                    <div class="mission-name">${mission.name}</div>
                    <div class="mission-status">${state.completed ? '✓ TERMINÉE' : `${current} / ${target} ${unit}`}</div>
                    <div class="mission-description">${mission.description}</div>
                    <div class="mission-progress-track"><div class="mission-progress-fill" style="width:${missionPercent}%"></div></div>
                    <div class="mission-reward">${reward ? `Récompense : ${reward.label}` : 'Récompense à découvrir'}</div>
                </article>`;
            }).join('')}
        </section>`;
    }).join('');
    const visibleCount = secondaryMissionDefinitions.filter(mission => {
        const isCompleted = Boolean(secondaryMissionProgress[mission.id] && secondaryMissionProgress[mission.id].completed);
        return missionFilter === 'all'
            || (missionFilter === 'completed' && isCompleted)
            || (missionFilter === 'active' && !isCompleted);
    }).length;
    if (!visibleCount) {
        container.innerHTML = '<div class="mission-empty">Aucune mission ne correspond à ce filtre.</div>';
    }
    const filterCount = document.getElementById('missions-filter-count');
    if (filterCount) filterCount.textContent = `${visibleCount} mission${visibleCount > 1 ? 's' : ''} affichée${visibleCount > 1 ? 's' : ''}`;
}

function getMissionDefinition(id) {
    return secondaryMissionDefinitions.find(mission => mission.id === id);
}

function saveMissionState() {
    saveGame();
    renderMissionsScreen();
}

function completeMission(mission, state) {
    if (state.completed) return false;
    if (mission.id === 'all-colors'
        && !(killSkinsUsed.includes('red') && killSkinsUsed.includes('gold')
            && killSkinsUsed.some(skin => !['red', 'gold'].includes(skin)))) return false;
    if (mission.id === 'rainbow-worlds'
        && !(Object.values(worldCompletionSkins).includes('red')
            && Object.values(worldCompletionSkins).includes('gold')
            && new Set(Object.values(worldCompletionSkins)).size >= 3)) return false;
    state.current = mission.target;
    state.completed = true;
    const reward = SECONDARY_MISSION_REWARDS[mission.id];
    grantMissionReward(mission.id);
    const duration = mission.id === 'adventure-starts' ? 6000 : 4500;
    showNotification(
        `🏆 Mission secondaire terminée ! ${mission.name}${reward ? ` · ${reward.label}` : ''}`,
        duration
    );
    updateMenuStats();
    return true;
}

function grantMissionReward(missionId) {
    const reward = SECONDARY_MISSION_REWARDS[missionId];
    if (!reward || !Number.isFinite(reward.gold) || reward.gold < 0) return false;
    const alreadyClaimed = claimedMissionRewards.includes(missionId);
    let changed = false;
    if (!alreadyClaimed && reward.gold > 0) {
        player.gold += reward.gold;
        changed = true;
    }
    if (reward.skin) {
        if (!player.ownedSkins.includes(reward.skin)) {
            player.ownedSkins.push(reward.skin);
            changed = true;
        }
        if (reward.countsAsRareSkin !== false && !rareSkinsUnlocked.includes(reward.skin)) {
            rareSkinsUnlocked.push(reward.skin);
            changed = true;
        }
    }
    if (!alreadyClaimed && (reward.gold > 0 || reward.skin)) {
        claimedMissionRewards.push(missionId);
        changed = true;
    }
    if (reward.skin && changed) updateCollectionMissions();
    return changed;
}

function updateMissionProgress(id, amount = 1, mode = 'increment') {
    const mission = getMissionDefinition(id);
    if (!mission) return false;
    const state = secondaryMissionProgress[id] || {
        current: 0,
        target: mission.target,
        completed: false
    };
    if (state.completed) return false;
    const previous = state.current;
    state.current = mode === 'set'
        ? Math.max(0, Math.min(mission.target, amount))
        : Math.max(0, Math.min(mission.target, state.current + amount));
    state.target = mission.target;
    if (state.current >= mission.target) completeMission(mission, state);
    secondaryMissionProgress[id] = state;
    const changed = state.current !== previous || state.completed;
    if (changed) {
        saveMissionState();
        updateGameCompletionDisplay();
    }
    return changed;
}

function updateMissionByEvent(eventName, amount = 1) {
    const eventMap = {
        firstPlay: ['adventure-starts'],
        save: ['protect-your-save'],
        worldTwoUnlocked: ['world-master'],
        enemyDefeated: ['at-the-attack', 'monsters-five', 'monsters-twenty', 'monsters-fifty', 'monsters-one-fifty', 'monsters-three-hundred'],
        goldCollected: [],
        purchase: ['time-to-buy', 'in-mass'],
        restart: ['here-we-go-again'],
        upgrade: ['more-strength'],
        levelCompleted: [],
        bossDefeated: ['finished'],
        worldCompleted: ['sanctuary-of-dawn', 'obsidian-crypt', 'void-throne'],
        skinOwned: ['different-skins', 'collector', 'rainbow-worlds'],
        rareSkin: ['rarer-and-rarer'],
        worldSecret: ['world-secrets'],
        playerSecret: ['player-secrets']
    };
    const ids = eventMap[eventName] || [];
    let changed = false;
    ids.forEach(id => {
        changed = updateMissionProgress(id, amount) || changed;
    });
    updateSecondaryMissionMilestones();
    return changed;
}

function recordSecondaryMissionEvent(eventName, amount = 1) {
    return updateMissionByEvent(eventName, amount);
}

function getLevelProgressKey(worldIndex = currentWorldIndex, levelIndex = currentLevelIndex) {
    return `${worldIndex}-${levelIndex}`;
}

function recordCompletedLevel(worldIndex, levelIndex) {
    const key = getLevelProgressKey(worldIndex, levelIndex);
    const level = worldsData[worldIndex] && worldsData[worldIndex].levels[levelIndex];
    if (!level) return false;
    let changed = false;
    if (activeChallenge === null && currentLevelChallengeSnapshot.length) {
        OPTIONAL_CHALLENGE_IDS.forEach(challengeId => {
            if (!currentLevelChallengeSnapshot.includes(challengeId)) return;
            const completedIds = optionalChallengeLevelProgress[challengeId] || [];
            if (!completedIds.includes(level.id)) {
                completedIds.push(level.id);
                optionalChallengeLevelProgress[challengeId] = completedIds;
                changed = true;
            }
        });
    }
    if (!completedLevels.includes(key)) {
        completedLevels.push(key);
        if (level.id && !completedLevelIds.includes(level.id)) completedLevelIds.push(level.id);
        updateMissionProgress('dungeon-master', completedLevels.length, 'set');
        changed = true;
    }
    if (changed) updateGameCompletionDisplay();
    return changed;
}

function recordDefeatedBoss(worldIndex) {
    if (!Number.isInteger(worldIndex) || defeatedBosses.includes(worldIndex)) return false;
    defeatedBosses.push(worldIndex);
    const bossId = `world-${worldIndex + 1}-boss`;
    if (!defeatedBossIds.includes(bossId)) defeatedBossIds.push(bossId);
    updateMissionProgress('finished', defeatedBosses.length, 'set');
    return true;
}

function updateCollectionMissions() {
    const skins = Math.max(0, player.ownedSkins.length - 1);
    updateMissionProgress('different-skins', skins, 'set');
    const purchasedCount = COLLECTIBLE_PRODUCT_IDS.filter(id => purchasedProducts[id] === true).length;
    updateMissionProgress('collector', purchasedCount, 'set');
    updateMissionProgress('rainbow-worlds', Object.keys(worldCompletionSkins).length, 'set');
    updateMissionProgress('rarer-and-rarer', rareSkinsUnlocked.length, 'set');
}

function getCurrentSecretRoom() {
    return secretRoomDefinitions.find(room =>
        room.world === currentWorldIndex &&
        room.level === currentLevelIndex &&
        !discoveredSecretRooms.includes(room.id)
    );
}

function getSecretRoomForLevel(worldIndex = currentWorldIndex, levelIndex = currentLevelIndex) {
    return secretRoomDefinitions.find(room =>
        room.world === worldIndex && room.level === levelIndex
    );
}

function getSecretRoomEntrancePoint(room) {
    if (!room) return null;
    return {
        x: room.x,
        y: room.y - room.h / 2 - player.radius - 6
    };
}

function addSecretRoomWalls(room) {
    if (!room) return;
    const left = room.x - room.w / 2;
    const top = room.y - room.h / 2;
    const right = left + room.w;
    const bottom = top + room.h;
    const wallThickness = 12;
    const entranceWidth = 58;
    const entranceLeft = room.x - entranceWidth / 2;
    const entranceRight = room.x + entranceWidth / 2;

    // L'ouverture est placée sur le mur supérieur et reste assez large pour le joueur.
    walls.push({ x: left, y: top, w: entranceLeft - left, h: wallThickness });
    walls.push({ x: entranceRight, y: top, w: right - entranceRight, h: wallThickness });
    walls.push({ x: left, y: top, w: wallThickness, h: room.h });
    walls.push({ x: right - wallThickness, y: top, w: wallThickness, h: room.h });
    walls.push({ x: left, y: bottom - wallThickness, w: room.w, h: wallThickness });
}

function discoverSecretRoom(room) {
    if (!room || discoveredSecretRooms.includes(room.id)) return;
    discoveredSecretRooms.push(room.id);
    updateMissionProgress('world-secrets', discoveredSecretRooms.length, 'set');
    updateGameCompletionDisplay();
    playCue('secret');
    showNotification('🔎 Entrée secrète trouvée ! Appuyez sur E près du coffre ou de l’autel.', 4500);
    saveGame(true);
}

function claimSecretRoomReward(room) {
    if (!room || !discoveredSecretRooms.includes(room.id) || secretRewardsClaimed.includes(room.id)) return;
    secretRewardsClaimed.push(room.id);
    let rewardText = '';
    if (room.type === 'simple') {
        player.gold += 250;
        rewardText = '🪙 +250 Or';
    } else if (room.type === 'rare') {
        player.gold += 500;
        const healthGain = Math.min(20, MAX_PLAYER_HP - player.maxHp);
        player.maxHp = Math.min(MAX_PLAYER_HP, player.maxHp + healthGain);
        player.hp = Math.min(player.maxHp, player.hp + healthGain);
        rewardText = healthGain
            ? `🪙 +500 Or · ❤️ Bonus de vie +${healthGain}`
            : '🪙 +500 Or · ❤️ PV déjà au maximum';
    } else {
        player.gold += 1000;
        if (!player.ownedSkins.includes('secret')) player.ownedSkins.push('secret');
        if (!rareSkinsUnlocked.includes('secret')) rareSkinsUnlocked.push('secret');
        updateMissionProgress('player-secrets', 1, 'set');
        rewardText = '🪙 +1000 Or · 🎨 Skin Secret débloqué';
    }
    updateMissionProgress('world-secrets', discoveredSecretRooms.length, 'set');
    updateCollectionMissions();
    playCue('reward');
    saveGame(true);
    showNotification(`🔎 Récompense secrète ! ${rewardText}`, 5000);
}

function updateSecretRoomDiscovery() {
    const room = getSecretRoomForLevel();
    if (room && Math.hypot(player.x - room.x, player.y - room.y) < Math.max(room.w, room.h) * 0.45
        && !discoveredSecretRooms.includes(room.id)) {
        discoverSecretRoom(room);
    }
    if (room && isInputPressed('e') && !interactWasDown
        && discoveredSecretRooms.includes(room.id)
        && Math.hypot(player.x - room.x, player.y - room.y) < 82) {
        claimSecretRoomReward(room);
    }
}

function drawSecretRoom(room) {
    const discovered = discoveredSecretRooms.includes(room.id);
    const nearby = Math.hypot(player.x - room.x, player.y - room.y) < 220;
    const colors = room.type === 'ultimate'
        ? { main: '#ffd700', glow: 'rgba(255, 215, 0, 0.28)' }
        : room.type === 'rare'
            ? { main: '#bb66ff', glow: 'rgba(187, 102, 255, 0.24)' }
            : { main: '#66fcf1', glow: 'rgba(102, 252, 241, 0.20)' };
    const left = room.x - room.w / 2;
    const top = room.y - room.h / 2;

    ctx.save();
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = discovered ? 18 : nearby ? 10 : 2;
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = discovered || nearby ? 1 : 0.18;
    ctx.fillRect(left, top, room.w, room.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.82)';
    ctx.fillRect(left + 8, top + 8, room.w - 16, room.h - 16);
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, room.w, room.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 8, top + 8, room.w - 16, room.h - 16);

    const entranceW = 46;
    const entranceH = 12;
    ctx.fillStyle = colors.main;
    ctx.fillRect(room.x - entranceW / 2, top - 2, entranceW, entranceH);
    if (discovered || nearby) {
        ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.main;
    ctx.shadowBlur = 8;
    ctx.fillText(discovered ? 'SALLE SECRÈTE ✓' : 'SALLE SECRÈTE', room.x, top - 14);
    }

    ctx.beginPath();
    ctx.arc(room.x, room.y, 13 + Math.sin(gameTime * 3) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (discovered) {
        ctx.fillStyle = secretRewardsClaimed.includes(room.id) ? '#53606b' : colors.main;
        ctx.fillRect(room.x - 22, room.y - 14, 44, 28);
        ctx.fillStyle = '#111820';
        ctx.fillRect(room.x - 18, room.y - 9, 36, 7);
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(secretRewardsClaimed.includes(room.id) ? 'OUVERT' : 'E', room.x, room.y + 4);
    }
    ctx.restore();
}

function markPurchasedProduct(productId) {
    if (!COLLECTIBLE_PRODUCT_IDS.includes(productId)) return;
    purchasedProducts[productId] = true;
    updateCollectionMissions();
}

function recordMonsterDefeat() {
    consecutiveMonsterKills += 1;
    updateMissionProgress('double-feast', consecutiveMonsterKills, 'set');
    if (!killSkinsUsed.includes(player.skin)) killSkinsUsed.push(player.skin);
    updateMissionProgress('all-colors', killSkinsUsed.length, 'set');
    updateMissionByEvent('enemyDefeated');
}

function updateSecondaryMissionMilestones() {
    const sideMission = getMissionDefinition('side-missions-finished');
    const otherCompleted = secondaryMissionDefinitions.filter(mission =>
        mission.id !== 'side-missions-finished' &&
        secondaryMissionProgress[mission.id] &&
        secondaryMissionProgress[mission.id].completed
    ).length;
    if (sideMission && otherCompleted >= secondaryMissionDefinitions.length - 1) {
        updateMissionProgress('side-missions-finished', sideMission.target, 'set');
    } else {
        updateMissionProgress('side-missions-finished', otherCompleted, 'set');
    }
}

function openMissions() {
    missionsReturnState = gameState === 'PAUSED' ? 'PAUSED' : 'TITLE';
    gameState = 'MISSIONS';
    leavePlayingState();
    showOverlay('missions-screen');
}

function closeMissions() {
    if (missionsReturnState === 'PAUSED') {
        gameState = 'PAUSED';
        showOverlay('pause-screen');
    } else {
        gameState = 'TITLE';
        showOverlay('title-screen');
    }
}

function clearChallengeRuntimeState({ keepChallengeConfig = true } = {}) {
    activeChallenge = null;
    dailyChallenge = null;
    bossRushState = null;
    if (endlessModeState) {
        endlessModeState.active = false;
        endlessModeState.currentWave = 0;
    }
    endlessRunEnded = false;
    pendingBossReward = null;
    currentLevelChallengeSnapshot = [];
    runTimerRemaining = null;
    updateRunTimerDisplay();
    if (!keepChallengeConfig) {
        challengeState = {
            'no-potion': false,
            'speed-run': false,
            'glass-cannon': false
        };
    }
}

const bossRewardDefinitions = {
    0: {
        bossName: 'Gardien du Sanctuaire',
        gold: 500,
        skin: null,
        missions: [
            { id: 'sanctuary-of-dawn', name: "Le Sanctuaire de l'Aube", description: 'Terminez le Monde 1 en entier.' }
        ]
    },
    1: {
        bossName: 'Seigneur de la Crypte d’Obsidienne',
        gold: 1000,
        skin: 'purple',
        skinLabel: '🎨 Skin rare débloqué',
        missions: [
            { id: 'obsidian-crypt', name: 'La Crypte d’Obsidienne', description: 'Terminez le Monde 2 en entier.' }
        ]
    },
    2: {
        bossName: 'Roi du Néant',
        gold: 2000,
        skin: 'gold',
        skinLabel: '🎨 Skin légendaire débloqué',
        missions: [
            { id: 'void-throne', name: 'Le Trône du Néant', description: 'Terminez le Monde 3 en entier.' },
            { id: 'dungeon-master', name: 'Le Maître des Donjons', description: 'Terminez les 21 donjons et vainquez les 3 boss finaux.' }
        ]
    }
};

function grantBossRewards(worldIndex) {
    const reward = bossRewardDefinitions[worldIndex];
    const bossId = `world-${worldIndex + 1}-boss`;
    if (!reward || claimedBossRewards.includes(worldIndex) || claimedBossRewardIds.includes(bossId)) return null;
    const missionsCompleted = [];
    claimedBossRewards.push(worldIndex);
    if (!claimedBossRewardIds.includes(bossId)) claimedBossRewardIds.push(bossId);
    player.gold += reward.gold;
    if (reward.skin && !player.ownedSkins.includes(reward.skin)) {
        player.ownedSkins.push(reward.skin);
    }
    if (reward.skin && !rareSkinsUnlocked.includes(reward.skin)) {
        rareSkinsUnlocked.push(reward.skin);
    }
    reward.missions.forEach(mission => {
        const state = secondaryMissionProgress[mission.id];
        if (state && !state.completed) {
            updateMissionProgress(mission.id, mission.id === 'dungeon-master' ? 21 : mission.target, 'set');
            if (secondaryMissionProgress[mission.id].completed) missionsCompleted.push(mission);
        }
    });
    if (worldIndex === 2) {
        updateMissionProgress('dungeon-master', 21, 'set');
    }
    updateCollectionMissions();
    updateSecondaryMissionMilestones();
    saveGame(true);
    return { ...reward, worldIndex, missionsCompleted };
}

function showBossRewardScreen(reward) {
    pendingBossReward = reward;
    const boss = document.getElementById('boss-reward-boss');
    const items = document.getElementById('boss-reward-items');
    const missions = document.getElementById('boss-reward-missions');
    if (boss) boss.textContent = reward.bossName;
    if (items) {
        items.innerHTML = `<div class="boss-reward-item">🪙 +${reward.gold} Or</div>` +
            (reward.skin ? `<div class="boss-reward-item">${reward.skinLabel}</div>` : '');
    }
    if (missions) {
        missions.innerHTML = reward.missionsCompleted.length
            ? reward.missionsCompleted.map(mission =>
                `<div class="boss-mission-item">🏆 ${mission.name}<small>${mission.description}</small></div>`
            ).join('')
            : '<div class="boss-mission-item">Aucune nouvelle mission terminée.</div>';
    }
    gameState = 'BOSS_REWARD';
    leavePlayingState();
    showOverlay('boss-reward-screen');
}

function continueAfterBossReward() {
    const reward = pendingBossReward;
    pendingBossReward = null;
    if (!reward) {
        returnToTitle();
        return;
    }
    if (activeChallenge === 'daily') {
        enterPlayingState();
        return;
    }
    if (reward.worldIndex === 2) {
        showCreditsScreen();
        return;
    }
    const nextWorld = reward.worldIndex + 1;
    if (loadLevel(nextWorld, 0)) {
        enterPlayingState();
    } else {
        returnToTitle();
    }
}

function hideAllOverlays() {
    document.querySelectorAll('.overlay-screen').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-1';
    });
}

function resetGameData() {
    playTimeRemainder = 0;
    try {
        localStorage.removeItem("dungeonsSave");
    } catch (error) {
        console.warn("Impossible de réinitialiser le stockage :", error);
    }
    hasSavedProgress = false;
    saveWritesAuthorized = true;
    const playButton = document.getElementById('btn-continue');
    if (playButton) playButton.disabled = false;

    optionsReturnState = 'TITLE';
    shopReturnState = 'TITLE';
    missionsReturnState = 'TITLE';
    phase3ReturnState = 'TITLE';
    pendingBossReward = null;

    player.gold = 0;

    player.skin = "default";
    player.ownedSkins = ["default"];

    player.defense = 0;

    player.attackDamage = 22;

    player.maxHp = BASE_PLAYER_HP;
    player.hp = BASE_PLAYER_HP;

    player.speed = 3.8;
    player.attackRange = 60;
    player.abilities = [];
    player.relics = [];
    player._buildHpMultiplier = 1;
    player._buildDefenseBonus = 0;
    player._buildDamageMultiplier = 1;
    player._buildSpeedMultiplier = 1;
    player._buildDashSpeedMultiplier = 1;
    player._shopHealthBonus = 0;
    player._shopDefenseBonus = 0;
    player._shopDamageBonus = 0;
    player._shopSpeedBonus = 0;

    score = 0;

    maxUnlockedWorld = 0;
    maxUnlockedLevel = 0;
    currentWorldIndex = 0;
    currentLevelIndex = 0;
    secondaryMissionProgress = createDefaultMissionProgress();
    consecutiveMonsterKills = 0;
    killSkinsUsed = [];
    purchasedProducts = {};
    worldCompletionSkins = {};
    rareSkinsUnlocked = [];
    discoveredSecretRooms = [];
    secretRewardsClaimed = [];
    completedLevels = [];
    completedLevelIds = [];
    optionalChallengeLevelProgress = {};
    currentLevelChallengeSnapshot = [];
    defeatedBosses = [];
    claimedBossRewards = [];
    claimedMissionRewards = [];
    defeatedBossIds = [];
    claimedBossRewardIds = [];
    difficultyMode = 'adventure';
    selectedBuild = 'vanguard';
    challengeState = {
        'no-potion': false,
        'speed-run': false,
        'glass-cannon': false
    };
    phase3Stats = { runs: 0, victories: 0, deaths: 0, damageDealt: 0, damageTaken: 0, bestScore: 0, dailyWins: 0, bossRushWins: 0, playSeconds: 0 };
    bestiary = {};
    activeChallenge = null;
    dailyChallenge = null;
    bossRushState = null;
    endlessModeState = {
        active: false,
        currentWave: 0,
        bestWave: 0,
        bestClearedWave: 0,
        lastRunWave: 0,
        bestScore: 0,
        claimedMilestones: []
    };
    endlessRunEnded = false;
    newGamePlusLevel = 0;
    newGamePlusUnlocked = false;
    newGamePlusRunActive = false;
    bossRewardShown = false;
    runTimerRemaining = null;
    clearChallengeRuntimeState({ keepChallengeConfig: true });
    resetTransientPlayerState();
    applyBuildStats();
    clearInputState();
    updateFpsVisibility();
    updateRunTimerDisplay();
    renderPhase3();
    updateMenuStats();
    if (typeof loadLevel === 'function') loadLevel(0, 0);
    saveGame(true);
}

function syncOptionsControls() {
    const ranges = [
        ['master-volume', 'masterVolume'],
        ['music-volume', 'musicVolume'],
        ['sfx-volume', 'sfxVolume']
    ];
    ranges.forEach(([id, key]) => {
        const input = document.getElementById(id);
        const value = document.getElementById(`${id}-value`);
        if (input) input.value = settings[key];
        if (value) value.textContent = `${settings[key]}%`;
    });
    const checks = [
        ['show-damage', 'showDamage'],
        ['show-particles', 'showParticles'],
        ['show-enemy-bars', 'showEnemyBars'],
        ['show-fps', 'showFps'],
        ['high-contrast', 'highContrast'],
        ['reduced-motion', 'reducedMotion'],
        ['large-text', 'largeText']
    ];
    checks.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (input) input.checked = settings[key];
    });
    updateFpsVisibility();
    applyAccessibilitySettings();
}

function updateAudioSetting(key, value) {
    if (!['masterVolume', 'musicVolume', 'sfxVolume'].includes(key)) return;
    settings[key] = Math.max(0, Math.min(100, Number(value) || 0));
    if (key === 'musicVolume' || key === 'masterVolume') {
        if (settings[key] === 0) stopAmbientMusic();
        else if (gameState === 'PLAYING') startAmbientMusic();
    }
    syncOptionsControls();
    saveSettings();
}

function updateDisplaySetting(key, value) {
    if (!['showDamage', 'showParticles', 'showEnemyBars', 'showFps', 'highContrast', 'reducedMotion', 'largeText'].includes(key)) return;
    settings[key] = Boolean(value);
    updateFpsVisibility();
    applyAccessibilitySettings();
    saveSettings();
}

function applyAccessibilitySettings() {
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('large-text', settings.largeText);
}

function updateFpsVisibility() {
    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) fpsCounter.classList.toggle('visible', settings.showFps);
}

function saveFromOptions() {
    if (saveSettings() && saveGame(true)) {
        updateMissionByEvent('save');
        saveGame(true);
        showNotification('Sauvegarde effectuée !');
    } else {
        showNotification('Impossible de sauvegarder.');
    }
}

function confirmResetSave() {
    if (!window.confirm('Réinitialiser la sauvegarde et toutes les améliorations ?')) return;
    resetGameData();
    syncOptionsControls();
    showNotification('Sauvegarde réinitialisée.');
}

function showNextNotification() {
    if (notificationInProgress || !notificationQueue.length) return;
    const { text, duration } = notificationQueue.shift();
    notificationInProgress = true;
    notificationBanner.innerText = text;
    notificationBanner.classList.add('show');
    playUiTone(text.includes('Mission') || text.includes('découverte') ? 880 : 660);
    notificationBanner._timeout = setTimeout(() => {
        notificationBanner.classList.remove('show');
        notificationInProgress = false;
        showNextNotification();
    }, duration);
}

function showNotification(text, duration = 4500) {
    const maxVisibleDuration = 4600;
    const requestedDuration = Number.isFinite(duration) ? duration : 4500;
    notificationQueue.push({
        text,
        duration: Math.max(0, Math.min(maxVisibleDuration, requestedDuration))
    });
    showNextNotification();
}

function spawnDamageText(x, y, value, color) {
    if (!settings.showDamage) return;
    damageTexts.push({ x, y, value: Math.floor(value), color, alpha: 1, life: 36 });
}

function isLevelUnlocked(wIdx, lIdx) {
    if (wIdx < maxUnlockedWorld) return true;
    if (wIdx === maxUnlockedWorld && lIdx <= maxUnlockedLevel) return true;
    return false;
}

function buildWorldSelectUI() {
    const container = document.getElementById('world-select-container');
    container.innerHTML = '';
    worldsData.forEach((w, wIdx) => {
        let block = document.createElement('div');
        block.className = 'world-block';
        let title = document.createElement('div');
        title.className = 'world-block-title';
        title.innerText = w.name;
        block.appendChild(title);

        let grid = document.createElement('div');
        grid.className = 'level-grid';

        w.levels.forEach((l, lIdx) => {
            let btn = document.createElement('button');
            let unlocked = isLevelUnlocked(wIdx, lIdx);
            btn.className = 'btn-level' + (l.isBoss ? ' boss-btn' : '');
            btn.disabled = !unlocked;
            btn.innerHTML = l.isBoss ? `BOSS 👑` : `Niv ${lIdx+1}`;
            btn.title = unlocked ? `Jouer Monde ${wIdx+1}, Niveau ${lIdx+1}` : 'Verrouillé (Terminez les niveaux précédents)';
            btn.onclick = () => {
                startSelectedLevel(wIdx, lIdx);
            };
            grid.appendChild(btn);
        });
        block.appendChild(grid);
        container.appendChild(block);
    });
}

function openWorldSelect() {
    cameFromPause = false;
    gameState = 'WORLD_SELECT';
    buildWorldSelectUI();
    showWorldSelectMessage('');
    showOverlay('world-select-screen');
}


function openWorldSelectFromPause() {
    cameFromPause = true;
    gameState = 'WORLD_SELECT';
    buildWorldSelectUI();
    showWorldSelectMessage('');
    showOverlay('world-select-screen');
}

function backFromWorldSelect() {
    clearTimeout(worldSelectMessageTimer);
    const message = document.getElementById('world-select-message');
    if (message) message.textContent = '';
    if (cameFromPause) {
        showOverlay('pause-screen');
        gameState = 'PAUSED';
    } else {
        showOverlay('title-screen');
        gameState = 'TITLE';
    }
}

function enterPlayingState() {
    authorizeFreshRunSave();
    runtimeError = null;
    gameState = 'PLAYING';
    startAmbientMusic();
    document.body.classList.add('game-playing');
    hideAllOverlays();
    canvas.style.visibility = 'visible';
    canvas.style.opacity = '1';
    const wrapper = document.querySelector('.canvas-wrapper');
    if (wrapper) {
        wrapper.style.visibility = 'visible';
        wrapper.style.opacity = '1';
        wrapper.style.zIndex = '4000';
    }
}

function leavePlayingState() {
    if (saveWritesAuthorized && !saveGame(true)) {
        console.error('La progression active n’a pas pu être sauvegardée.');
    }
    stopAmbientMusic();
    document.body.classList.remove('game-playing');
    const wrapper = document.querySelector('.canvas-wrapper');
    if (wrapper) {
        wrapper.style.zIndex = '';
        wrapper.style.visibility = '';
        wrapper.style.opacity = '';
    }
    canvas.style.visibility = '';
    canvas.style.opacity = '';
}

function syncOverlayVisibility() {
    const isPlaying = gameState === 'PLAYING';
    document.body.classList.toggle('game-playing', isPlaying);
    if (isPlaying) hideAllOverlays();
}


function startSelectedLevel(wIdx, lIdx) {
    if (!worldsData[wIdx] || !worldsData[wIdx].levels[lIdx]) {
        reportRuntimeError(new Error(`Niveau invalide (${wIdx}-${lIdx})`), 'Chargement');
        return;
    }
    const playButton = document.getElementById('btn-continue');
    currentWorldIndex = wIdx;
    currentLevelIndex = lIdx;
    if (!loadLevel(wIdx, lIdx)) {
        showWorldSelectMessage('Impossible de charger ce niveau. Réessayez.');
        return;
    }
    updateMissionByEvent('firstPlay');
    if (wIdx === 0 && lIdx === 0 && !activeChallenge) phase3Stats.runs++;
    hasSavedProgress = true;
    if (playButton) playButton.disabled = false;
    enterPlayingState();
    saveGame();
}

function openOptions() {
    optionsReturnState = gameState === 'PAUSED' ? 'PAUSED' : 'TITLE';
    gameState = 'OPTIONS';
    leavePlayingState();
    showOverlay('options-screen');
}

function openShop() {

    shopReturnState = gameState === 'GAMEOVER'
        ? 'GAMEOVER'
        : (gameState === 'PAUSED' ? 'PAUSED' : 'TITLE');
    gameState = 'SHOP';

    const goldDisplay =
        document.getElementById('shop-gold-display');

    if (goldDisplay) {
        goldDisplay.textContent =
            Math.floor(player.gold);
    }

    updateShopCards();
    showOverlay('shop-screen');
}

function updateShopGold() {

    const goldDisplay =
        document.getElementById('shop-gold-display');

    if (goldDisplay) {
        goldDisplay.textContent =
            Math.floor(player.gold);
    }
    updateShopCards();
}

function closeShop() {
    if (shopReturnState === 'GAMEOVER') {
        gameState = 'GAMEOVER';
        showOverlay('gameover-screen');
    } else if (shopReturnState === 'PAUSED') {
        gameState = 'PAUSED';
        updatePauseStats();
        showOverlay('pause-screen');
    } else {
        gameState = 'TITLE';
        showOverlay('title-screen');
    }
    saveGame();
}

function openSkins() {

    renderOwnedSkins();

    gameState = 'SKINS';

    showOverlay('skins-screen');
}

function closeSkins() {

    gameState = 'TITLE';

    showOverlay('title-screen');
}

function updateMenuStats() {

    document.getElementById("menu-hp").textContent =
        formatPlayerHealth();

    document.getElementById("menu-attack").textContent =
        `${Math.floor(player.attackDamage)}${player.attackDamage >= MAX_PLAYER_ATTACK_DAMAGE ? ' · MAX' : ''}`;

    document.getElementById("menu-defense").textContent =
        `${Math.round(player.defense * 100)}%${player.defense >= MAX_PLAYER_DEFENSE - 1e-9 ? ' · MAX' : ''}`;

    document.getElementById("menu-speed").textContent =
        player.speed.toFixed(1);

    document.getElementById("menu-gold").textContent =
        Math.floor(player.gold);

    updateGameCompletionDisplay();
}

function formatPlayerHealth(hp = player.hp, healthLimit = player.maxHp) {
    const currentHp = Math.floor(hp);
    const maxHp = Math.floor(healthLimit);
    return `${currentHp} / ${maxHp}${maxHp >= MAX_PLAYER_HP ? ' · MAX' : ''}`;
}

function getGameCompletionPercent() {
    const levelIds = new Set(worldsData.flatMap(world => world.levels.map(level => level.id)));
    const totalLevels = levelIds.size;
    const completedLevelCount = new Set(completedLevelIds.filter(id => levelIds.has(id))).size;

    const countedMissions = secondaryMissionDefinitions;
    const completedMissionCount = countedMissions.filter(mission =>
        secondaryMissionProgress[mission.id] && secondaryMissionProgress[mission.id].completed
    ).length;

    const validSecretIds = new Set(secretRoomDefinitions.map(room => room.id));
    const discoveredSecretCount = new Set(discoveredSecretRooms.filter(id => validSecretIds.has(id))).size;
    const discoveredBestiaryCount = Object.keys(BESTIARY_DEFINITIONS).filter(type =>
        Number.isSafeInteger(bestiary[type]) && bestiary[type] > 0
    ).length;
    const completedOptionalChallenges = OPTIONAL_CHALLENGE_IDS.filter(challengeId => {
        const completedIds = new Set(optionalChallengeLevelProgress[challengeId] || []);
        return levelIds.size > 0 && [...levelIds].every(id => completedIds.has(id));
    }).length;
    const completedSpecialChallenges = Number(phase3Stats.dailyWins > 0)
        + Number(phase3Stats.bossRushWins > 0)
        + Number(endlessModeState.bestClearedWave >= 50)
        + completedOptionalChallenges;

    const weightedPercent =
        (totalLevels ? completedLevelCount / totalLevels * GAME_COMPLETION_WEIGHTS.levels : 0)
        + (countedMissions.length ? completedMissionCount / countedMissions.length * GAME_COMPLETION_WEIGHTS.missions : 0)
        + (validSecretIds.size ? discoveredSecretCount / validSecretIds.size * GAME_COMPLETION_WEIGHTS.secretRooms : 0)
        + (Object.keys(BESTIARY_DEFINITIONS).length
            ? discoveredBestiaryCount / Object.keys(BESTIARY_DEFINITIONS).length * GAME_COMPLETION_WEIGHTS.bestiary : 0)
        + (completedSpecialChallenges / SPECIAL_CHALLENGE_COUNT * GAME_COMPLETION_WEIGHTS.specialChallenges);

    return Math.min(100, Math.round(weightedPercent * 10) / 10);
}

function updateGameCompletionDisplay() {
    const percent = getGameCompletionPercent();
    const label = document.getElementById('game-completion-percent');
    const track = document.getElementById('game-completion-track');
    const fill = document.getElementById('game-completion-fill');
    const formattedPercent = Number.isInteger(percent)
        ? String(percent)
        : percent.toFixed(1).replace('.', ',');

    if (label) label.textContent = `${formattedPercent}%`;
    if (track) track.setAttribute('aria-valuenow', String(percent));
    if (fill) fill.style.width = `${percent}%`;
}

function renderOwnedSkins() {

    const container =
        document.getElementById('skins-container');

    container.innerHTML = '';

    const skinDetails = {
        cyan: ['Prisme cyan', '#00d9ff', 'Une lumiere cristalline'],
        crimson: ['Seigneur cramoisi', '#dc143c', 'La fureur du champion'],
        shadow: ['Marcheur des ombres', '#6c7086', 'Le silence du Neant'],
        astral: ['Prisme astral', '#a78bfa', 'Éclat rare aux reflets cosmiques'],
        abyssal: ['Spectre abyssal', '#8b7cff', 'Présence rare venue des profondeurs'],
        'ngplus-ascendant': ['Ascendant du Néant', '#ffd166', 'Récompense exclusive pour avoir terminé une campagne New Game+'],
        'seed-warden': ['Gardien du Destin', '#63e6be', 'Récompense exclusive pour avoir terminé un défi à seed fixe'],
        'endless-conqueror': ['Conquérant éternel', '#ff922b', 'Récompense de maîtrise après 50 vagues nettoyées en mode sans fin'],
        'endless-sentinel': ['Sentinelle éternelle', '#a855f7', 'Récompense exclusive pour avoir nettoyé 10 vagues dans une même série sans fin'],
        secret: ['Skin secret', '#d946ef', 'Un éclat mystique et rare'],
        default: ['Explorateur', '#66fcf1', 'Skin de départ'],
        red: ['Flamme rouge', '#ff4d4d', 'Une présence agressive'],
        green: ['Gardien vert', '#2ecc71', 'Une énergie naturelle'],
        purple: ['Arcaniste violet', '#c77dff', 'Une aura mystérieuse'],
        gold: ['Champion doré', '#ffd700', 'La récompense ultime']
    };
    player.ownedSkins.forEach(skin => {
        const detail = skinDetails[skin] || [skin, '#66fcf1', 'Skin débloqué'];
        const card = document.createElement('article');
        card.className = `skin-card${player.skin === skin ? ' equipped' : ''}`;
        const preview = document.createElement('div');
        preview.className = 'skin-preview';
        preview.style.setProperty('--skin-color', detail[1]);
        preview.setAttribute('aria-label', detail[0]);
        const content = document.createElement('div');
        content.className = 'skin-card-content';
        const name = document.createElement('strong');
        name.textContent = detail[0];
        const description = document.createElement('small');
        description.textContent = detail[2];
        content.append(name, description);
        const button = document.createElement('button');
        button.className = 'btn-ui';
        button.textContent = player.skin === skin ? 'ÉQUIPÉ ✓' : 'ÉQUIPER';
        button.disabled = player.skin === skin;
        button.onclick = () => {
            player.skin = skin;
            saveGame(true);
            updateMenuStats();
            renderOwnedSkins();
            showNotification(`${detail[0]} équipé !`);
        };
        card.append(preview, content, button);
        container.appendChild(card);
    });
    const equipped = document.getElementById('equipped-skin-name');
    const count = document.getElementById('owned-skins-count');
    if (equipped) equipped.textContent = (skinDetails[player.skin] || [player.skin])[0].toUpperCase();
    if (count) count.textContent = player.ownedSkins.length;
}

function updateShopCards() {
    document.querySelectorAll('#shop-screen .shop-item-card').forEach(card => {
        const button = card.querySelector('button');
        if (!button) return;
        const productId = button.dataset.productId;
        const price = Number(button.dataset.price || 0);
        const repeatable = button.dataset.repeatable === 'true';
        const skinId = productId && productId.startsWith('skin-') ? productId.slice(5) : null;
        const owned = skinId
            ? player.ownedSkins.includes(skinId)
            : Boolean(productId && purchasedProducts[productId]);
        const maxed = (productId === 'health-upgrade' && player.maxHp >= MAX_PLAYER_HP)
            || (productId === 'defense-upgrade' && player.defense >= MAX_PLAYER_DEFENSE - 1e-9)
            || (productId === 'attack-upgrade' && player.attackDamage >= MAX_PLAYER_ATTACK_DAMAGE);
        if (skinId && owned) {
            const equipped = player.skin === skinId;
            button.disabled = equipped;
            button.textContent = equipped ? 'ÉQUIPÉ ✓' : 'ÉQUIPER';
        } else if (maxed) {
            button.disabled = true;
            button.textContent = 'MAX';
        } else {
            button.disabled = (owned && !repeatable) || (!owned && player.gold < price);
            button.textContent = owned && !repeatable ? 'ACQUIS ✓' : 'ACHETER';
        }
    });
    const goldDisplay = document.getElementById('shop-gold-display');
    if (goldDisplay) goldDisplay.textContent = Math.floor(player.gold);
}
