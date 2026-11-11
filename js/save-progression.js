function readSaveData(key = "dungeonsSave") {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn("Sauvegarde indisponible dans cet environnement :", error);
        return null;
    }
}

function writeSaveData(saveData, key = "dungeonsSave") {
    try {
        localStorage.setItem(key, JSON.stringify(saveData));
        return true;
    } catch (error) {
        console.warn("Impossible d'enregistrer la sauvegarde :", error);
        return false;
    }
}

function preserveSaveRecoveryCopy(data, reason) {
    const baseKey = 'dungeonsSaveRecovery';
    try {
        let key = baseKey;
        let suffix = 1;
        while (localStorage.getItem(key) !== null) {
            if (localStorage.getItem(key) === data) {
                console.error(`Sauvegarde conservée sous forme de copie de récupération (${key}) : ${reason}`);
                return key;
            }
            key = `${baseKey}-${suffix++}`;
        }
        localStorage.setItem(key, data);
        if (localStorage.getItem(key) !== data) {
            throw new Error('La copie de récupération n’a pas pu être vérifiée.');
        }
        console.error(`Copie de récupération créée (${key}) : ${reason}`);
        return key;
    } catch (error) {
        console.error('Impossible de créer une copie locale de récupération :', error);
        return null;
    }
}

function normalizePhase3Data(save) {
        const validDifficulty = Object.keys(DIFFICULTY_MODES);
        difficultyMode = validDifficulty.includes(save && save.difficultyMode) ? save.difficultyMode : 'adventure';
        selectedBuild = BUILD_DEFINITIONS[save && save.selectedBuild] ? save.selectedBuild : 'vanguard';
    const rawChallengeState = save && save.challengeState && typeof save.challengeState === 'object' ? save.challengeState : {};
    challengeState = OPTIONAL_CHALLENGE_IDS.reduce((result, id) => {
        const value = rawChallengeState[id];
        result[id] = typeof value === 'boolean' ? value : false;
            return result;
    }, {});
    const rawStats = save && save.phase3Stats && typeof save.phase3Stats === 'object' ? save.phase3Stats : {};
    phase3Stats = Object.keys(phase3Stats).reduce((result, key) => {
        result[key] = Number.isFinite(rawStats[key]) ? Math.max(0, rawStats[key]) : result[key];
        return result;
    }, { ...phase3Stats });
        const rawBestiary = save && save.bestiary && typeof save.bestiary === 'object' && !Array.isArray(save.bestiary)
            ? save.bestiary : {};
        bestiary = Object.keys(BESTIARY_DEFINITIONS).reduce((result, type) => {
            const count = rawBestiary[type];
            result[type] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
            return result;
        }, {});
    }

    function getDifficultyMultiplier() {
        return (DIFFICULTY_MODES[difficultyMode] || DIFFICULTY_MODES.adventure).multiplier;
    }

    function createSeededRandom(seed) {
        let state = seed >>> 0;
        return () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 0x100000000;
        };
    }

    function getLevelRandom() {
        return levelGenerationRandom ? levelGenerationRandom() : Math.random();
    }

    function applyBuildStats() {
        const build = BUILD_DEFINITIONS[selectedBuild] || BUILD_DEFINITIONS.vanguard;
        const previousMaxHp = player.maxHp;
        const healthRatio = previousMaxHp > 0 ? Math.max(0, Math.min(1, player.hp / previousMaxHp)) : 1;
        const baseMaxHp = (player.maxHp - (player._shopHealthBonus || 0)) / (player._buildHpMultiplier || 1);
        player.maxHp = Math.min(MAX_PLAYER_HP,
            Math.max(1, Math.round(baseMaxHp * build.hp + (player._shopHealthBonus || 0))));
        player.hp = Math.min(player.maxHp, Math.round(player.maxHp * healthRatio));
        const baseDefense = player.defense - (player._buildDefenseBonus || 0) - (player._shopDefenseBonus || 0);
        player.defense = Math.max(0, Math.min(MAX_PLAYER_DEFENSE, baseDefense + build.defense + (player._shopDefenseBonus || 0)));
        const baseAttackDamage = (player.attackDamage - (player._shopDamageBonus || 0)) / (player._buildDamageMultiplier || 1);
        player.attackDamage = Math.max(1, Math.min(MAX_PLAYER_ATTACK_DAMAGE,
            baseAttackDamage * build.damage + (player._shopDamageBonus || 0)));
        const baseSpeed = (player.speed - (player._shopSpeedBonus || 0)) / (player._buildSpeedMultiplier || 1);
        player.speed = Math.max(.1, baseSpeed * build.speed + (player._shopSpeedBonus || 0));
        player.attackRange = 60 * (selectedBuild === 'ranger' ? 1.25 : 1);
        player._buildHpMultiplier = build.hp;
        player._buildDefenseBonus = build.defense;
        player._buildDamageMultiplier = build.damage;
        player._buildSpeedMultiplier = build.speed;
        player._buildDashSpeedMultiplier = build.dashSpeed;
    }

    function setDifficulty(value) {
        if (!DIFFICULTY_MODES[value]) return;
        difficultyMode = value;
        const description = document.getElementById('difficulty-description');
        if (description) description.textContent = `${DIFFICULTY_MODES[value].description} Multiplicateur ×${DIFFICULTY_MODES[value].multiplier}.`;
        saveGame(true);
    }

    function setBuild(value) {
        if (!BUILD_DEFINITIONS[value]) return;
        selectedBuild = value;
        applyBuildStats();
        updateMenuStats();
        renderPhase3();
        saveGame(true);
    }

    function getIncomingDamage(baseDamage) {
        const relicMultiplier = player.relics.includes('shell') ? 0.9 : 1;
        const afterDefense = baseDamage * (1 - Math.min(MAX_PLAYER_DEFENSE, player.defense)) * relicMultiplier;
        const glassCannonMultiplier = challengeState['glass-cannon'] ? 1.35 : 1;
        return Math.max(1, Math.floor(afterDefense * glassCannonMultiplier));
    }

    function receiveDamage(baseDamage) {
        const damage = getIncomingDamage(baseDamage);
        player.hp -= damage;
        phase3Stats.damageTaken += damage;
        return damage;
    }

    function dailySeed(date = new Date().toISOString().slice(0, 10)) {
        let hash = 2166136261;
        for (let i = 0; i < date.length; i++) hash = Math.imul(hash ^ date.charCodeAt(i), 16777619);
        return Math.abs(hash >>> 0);
    }

    function formatChallengeCode(date, seed) {
        return `DNG1-${date.replace(/-/g, '')}-${(seed >>> 0).toString(16).padStart(8, '0')}`;
    }

    function parseChallengeCode(value) {
        const input = String(value || '').trim();
        let code = input;
        try {
            if (/^https?:\/\//i.test(input)) {
                code = new URL(input).searchParams.get('challenge') || '';
            }
        } catch (error) {
            return null;
        }
        const match = /^DNG1-(\d{4})(\d{2})(\d{2})-([0-9a-f]{8})$/i.exec(code);
        if (!match) return null;
        const date = `${match[1]}-${match[2]}-${match[3]}`;
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
        return { date, seed: Number.parseInt(match[4], 16) >>> 0 };
    }

    function challengeShareUrl(code) {
        if (window.location.protocol === 'file:') return code;
        const url = new URL(window.location.href);
        url.searchParams.set('challenge', code);
        return url.toString();
    }

    async function copyShareText(text, successMessage) {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
            } else {
                const field = document.createElement('textarea');
                field.value = text;
                field.setAttribute('readonly', '');
                field.style.position = 'fixed';
                field.style.opacity = '0';
                document.body.appendChild(field);
                let copied = false;
                try {
                    field.select();
                    copied = document.execCommand('copy');
                } finally {
                    field.remove();
                }
                if (!copied) throw new Error('Le navigateur a refusé la copie dans le presse-papiers.');
            }
            showNotification(successMessage, 4500);
            return true;
        } catch (error) {
            console.error('Impossible de copier le partage du défi :', error);
            const manualCopy = window.prompt('La copie automatique a échoué. Copiez le texte ci-dessous :', text);
            showNotification(manualCopy === null
                ? 'Partage annulé. Le résultat reste disponible à l’écran.'
                : 'Texte de partage prêt à être copié.', 5000);
            return false;
        }
    }

    async function copyDailyChallengeCode() {
        const date = dailyChallenge ? dailyChallenge.date : new Date().toISOString().slice(0, 10);
        const seed = dailyChallenge ? dailyChallenge.seed : dailySeed(date);
        const code = formatChallengeCode(date, seed);
        const input = document.getElementById('challenge-code-input');
        if (input) input.value = code;
        const url = challengeShareUrl(code);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Défi quotidien Dungeons',
                    text: `Jouez le même défi seedé : ${code}`,
                    url
                });
                return true;
            } catch (error) {
                if (error && error.name === 'AbortError') return false;
                console.error('Le partage natif du défi a échoué :', error);
            }
        }
        return copyShareText(url, 'Lien du défi copié. Partagez-le pour jouer la même seed.');
    }

    function formatChallengeDuration(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
    }

    function getDailyChallengeResultText() {
        if (!dailyChallenge || !dailyChallenge.result) return '';
        const result = dailyChallenge.result;
        const code = formatChallengeCode(dailyChallenge.date, dailyChallenge.seed);
        const resultLabel = result.outcome === 'victory' ? 'Victoire' : 'Défaite';
        return [
            `Dungeons: The Curse of the Dungeon — défi ${dailyChallenge.date}`,
            `${resultLabel} · Score ${result.score} · Durée ${formatChallengeDuration(result.durationSeconds)}`,
            `Build ${result.build} · Difficulté ${result.difficulty}`,
            `Modificateurs : ${getDailyChallengeModifierLabels().join(' · ')}`,
            `Seed ${dailyChallenge.seed}`,
            `Rejouer : ${challengeShareUrl(code)}`
        ].join('\n');
    }

    async function shareDailyChallengeResult() {
        const text = getDailyChallengeResultText();
        if (!text) {
            showNotification('Aucun résultat de défi quotidien à partager.');
            return false;
        }
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Résultat du défi quotidien', text });
                return true;
            } catch (error) {
                if (error && error.name === 'AbortError') return false;
                console.error('Le partage natif a échoué :', error);
            }
        }
        return copyShareText(text, 'Résultat copié. Vous pouvez maintenant le partager.');
    }

    function finishDailyChallenge(outcome) {
        if (activeChallenge !== 'daily' || !dailyChallenge) return;
        const start = Date.parse(dailyChallenge.startedAt);
        dailyChallenge.result = {
            outcome,
            score: Math.max(0, Math.floor(score)),
            durationSeconds: Number.isFinite(start) ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : 0,
            build: selectedBuild,
            difficulty: difficultyMode
        };
        saveGame(true);
    }

    function startDailyChallenge(seedOverride = null, dateOverride = null) {
        clearChallengeRuntimeState({ keepChallengeConfig: true });
        newGamePlusRunActive = false;
        const date = dateOverride || new Date().toISOString().slice(0, 10);
        const seed = seedOverride === null ? dailySeed(date) : seedOverride;
        const code = typeof date === 'string' ? formatChallengeCode(date, seed) : '';
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !parseChallengeCode(code)) {
            showNotification('Code de défi invalide. Vérifiez la date et la seed.');
            return false;
        }
        dailyChallenge = {
            date,
            seed,
            code,
            startedAt: new Date().toISOString(),
            modifiers: getDailyChallengeModifierIds(seed),
            started: true
        };
        levelGenerationRandom = null;
        bossRushState = null;
        activeChallenge = 'daily';
        const previousHp = player.hp;
        const previousScore = score;
        score = 0;
        player.hp = player.maxHp;
        if (!loadLevel(0, 0)) {
            activeChallenge = null;
            dailyChallenge = null;
            player.hp = previousHp;
            score = previousScore;
            renderPhase3();
            showNotification('Impossible de démarrer le défi quotidien.');
            return false;
        }
        phase3Stats.runs++;
        enterPlayingState();
        saveGame(true);
        showNotification(`☀ Défi quotidien ${dailyChallenge.date} — seed ${dailyChallenge.seed}`, 5000);
        renderPhase3();
        return true;
    }

    function startChallengeFromCode() {
        const input = document.getElementById('challenge-code-input');
        const parsed = parseChallengeCode(input && input.value);
        if (!parsed) {
            showNotification('Code ou lien invalide. Format attendu : DNG1-AAAAMMJJ-XXXXXXXX.');
            return false;
        }
        return startDailyChallenge(parsed.seed, parsed.date);
    }

    function startDailyChallengeFromUrl() {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('challenge');
        if (!code) return false;
        const input = document.getElementById('challenge-code-input');
        if (input) input.value = code;
        const parsed = parseChallengeCode(code);
        if (!parsed) {
            showNotification('Le lien contient un code de défi invalide.');
            return false;
        }
        if (!startDailyChallenge(parsed.seed, parsed.date)) return false;
        url.searchParams.delete('challenge');
        window.history.replaceState(null, '', url.toString());
        return true;
    }

    function renderEndlessMode() {
        const startButton = document.getElementById('endless-start-btn');
        const records = document.getElementById('endless-records');
        const goals = document.getElementById('endless-mastery-goals');
        if (startButton) startButton.hidden = !newGamePlusUnlocked;
        if (records) {
            const bestWave = Math.max(endlessModeState.bestWave, endlessModeState.currentWave);
            records.textContent = `Meilleure vague atteinte : ${bestWave} · Meilleure série nettoyée : ${endlessModeState.bestClearedWave} · Meilleur score : ${endlessModeState.bestScore}`;
        }
        if (goals) {
            goals.innerHTML = ENDLESS_MASTERY_GOALS.map(goal => {
                const completed = endlessModeState.claimedMilestones.includes(goal.wave);
                const progress = Math.min(endlessModeState.bestClearedWave, goal.wave);
                const reward = goal.skin ? `${goal.gold} Or + skin exclusif` : `${goal.gold} Or`;
                return `<div class="endless-mastery-goal${completed ? ' completed' : ''}"><strong>${completed ? '✓ ' : ''}${goal.label}</strong><span>${completed ? 'Récompense obtenue' : `${progress} / ${goal.wave} vagues nettoyées · ${reward}`}</span></div>`;
            }).join('');
        }
    }

    function startEndlessMode() {
        if (!newGamePlusUnlocked) {
            showNotification('Le mode sans fin se débloque après avoir terminé la campagne.');
            return false;
        }
        clearChallengeRuntimeState({ keepChallengeConfig: false });
        newGamePlusRunActive = false;
        endlessModeState.active = true;
        endlessModeState.currentWave = 1;
        endlessModeState.bestWave = Math.max(endlessModeState.bestWave, 1);
        endlessModeState.lastRunWave = 0;
        endlessRunEnded = false;
        activeChallenge = 'endless';
        const previousHp = player.hp;
        const previousScore = score;
        score = 0;
        player.hp = player.maxHp;
        if (!loadLevel(0, 0)) {
            endlessModeState.active = false;
            endlessModeState.currentWave = 0;
            endlessRunEnded = false;
            activeChallenge = null;
            player.hp = previousHp;
            score = previousScore;
            renderPhase3();
            showNotification('Impossible de démarrer le mode sans fin.');
            return false;
        }
        phase3Stats.runs++;
        enterPlayingState();
        saveGame(true);
        renderPhase3();
        showNotification('Mode sans fin lancé : chaque vague sera plus difficile.');
        return true;
    }

    function advanceEndlessWave() {
        if (activeChallenge !== 'endless' || !endlessModeState.active) {
            reportRuntimeError(new Error('État du mode sans fin invalide au changement de vague'), 'Mode sans fin');
            return false;
        }

        const clearedWave = endlessModeState.currentWave;
        endlessModeState.bestClearedWave = Math.max(endlessModeState.bestClearedWave, clearedWave);
        endlessModeState.lastRunWave = clearedWave;
        endlessModeState.bestScore = Math.max(endlessModeState.bestScore, Math.floor(score));
        if (clearedWave >= 10) {
            updateMissionProgress('endless-ten-waves', 1, 'set');
            updateSecondaryMissionMilestones();
        }
        ENDLESS_MASTERY_GOALS.forEach(goal => {
            if (clearedWave < goal.wave || endlessModeState.claimedMilestones.includes(goal.wave)) return;
            endlessModeState.claimedMilestones.push(goal.wave);
            player.gold += goal.gold;
            if (goal.skin && !player.ownedSkins.includes(goal.skin)) {
                player.ownedSkins.push(goal.skin);
            }
            showNotification(`🏆 Maîtrise du sans-fin : ${goal.label} · +${goal.gold} Or${goal.skin ? ' · Skin Conquérant éternel débloqué' : ''}`, 5000);
        });
        if (ENDLESS_MASTERY_GOALS.some(goal => goal.wave === clearedWave && goal.skin)) {
            updateCollectionMissions();
        }
        updateGameCompletionDisplay();

        const levelOrder = worldsData.flatMap((world, worldIndex) =>
            world.levels.map((level, levelIndex) => ({ worldIndex, levelIndex }))
        );
        const currentIndex = levelOrder.findIndex(level =>
            level.worldIndex === currentWorldIndex && level.levelIndex === currentLevelIndex
        );
        if (currentIndex < 0 || !levelOrder.length) {
            reportRuntimeError(new Error('Niveau courant absent de la rotation sans fin'), 'Mode sans fin');
            return false;
        }
        const nextLevel = levelOrder[(currentIndex + 1) % levelOrder.length];
        endlessModeState.currentWave = clearedWave + 1;
        endlessModeState.bestWave = Math.max(endlessModeState.bestWave, endlessModeState.currentWave);
        if (!loadLevel(nextLevel.worldIndex, nextLevel.levelIndex)) {
            endlessModeState.active = false;
            endlessModeState.currentWave = 0;
            activeChallenge = null;
            endlessRunEnded = false;
            saveGame(true);
            leavePlayingState();
            gameState = 'TITLE';
            showOverlay('title-screen');
            showNotification('Le mode sans fin a été arrêté car la vague suivante n’a pas pu être chargée.');
            return false;
        }
        saveGame(true);
        renderEndlessMode();
        showNotification(`Vague ${clearedWave} terminée · Vague ${endlessModeState.currentWave} : ${endlessModeDifficultyLabel()}`, 4000);
        return true;
    }

    function endlessModeDifficultyLabel() {
        const wave = Math.max(1, endlessModeState.currentWave);
        const hpMultiplier = 1 + Math.min(7, (wave - 1) * 0.06);
        const damageMultiplier = 1 + Math.min(3, (wave - 1) * 0.025);
        const extraEnemies = Math.min(8, Math.floor((wave - 1) / 5));
        return `ennemis ×${hpMultiplier.toFixed(1)} PV / ×${damageMultiplier.toFixed(1)} dégâts, +${extraEnemies} ennemis max`;
    }

    function startBossRush() {
        clearChallengeRuntimeState({ keepChallengeConfig: true });
        newGamePlusRunActive = false;
        const bossOrder = worldsData.map((world, worldIndex) => ({
            worldIndex,
            levelIndex: world.levels.findIndex(level => level.isBoss)
        }));
        if (bossOrder.some(boss => boss.levelIndex < 0)) {
            showNotification('Impossible de démarrer le Boss-Rush : un boss est introuvable.');
            return false;
        }
        dailyChallenge = null;
        bossRushState = { active: true, bossesDefeated: [], bossOrder, bonusGold: 3000 };
        activeChallenge = 'boss-rush';
        const previousHp = player.hp;
        const previousScore = score;
        score = 0;
        player.hp = player.maxHp;
        const firstBoss = bossOrder[0];
        if (!loadLevel(firstBoss.worldIndex, firstBoss.levelIndex)) {
            activeChallenge = null;
            bossRushState = null;
            player.hp = previousHp;
            score = previousScore;
            renderPhase3();
            showNotification('Impossible de démarrer le Boss-Rush.');
            return false;
        }
        phase3Stats.runs++;
        enterPlayingState();
        saveGame(true);
        showNotification('👑 Boss-Rush lancé : vainquez les trois boss à la suite !', 5000);
        renderPhase3();
        return true;
    }

    function toggleOptionalChallenge(id, enabled) {
        if (!['no-potion', 'speed-run', 'glass-cannon'].includes(id)) return;
        challengeState[id] = Boolean(enabled);
        if (!enabled && gameState === 'PLAYING' && currentLevelChallengeSnapshot.includes(id)) {
            currentLevelChallengeSnapshot = currentLevelChallengeSnapshot.filter(challengeId => challengeId !== id);
        }
        if (id === 'speed-run') {
            runTimerRemaining = enabled ? SPEED_RUN_LIMIT_SECONDS : null;
            updateRunTimerDisplay();
        }
        saveGame(true);
    }

    function updateRunTimerDisplay() {
        const timerGroup = document.getElementById('run-timer-group');
        const timerDisplay = document.getElementById('run-timer-display');
        const timerActive = challengeState['speed-run'] && runTimerRemaining !== null;
        if (timerGroup) timerGroup.hidden = !timerActive;
        if (timerDisplay && timerActive) {
            const totalSeconds = Math.max(0, Math.ceil(runTimerRemaining));
            timerDisplay.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
        }
    }

    function openPhase3() {
        phase3ReturnState = gameState === 'PAUSED' ? 'PAUSED' : 'TITLE';
        missionsReturnState = gameState;
        if (gameState === 'PLAYING') leavePlayingState();
        gameState = 'PHASE3';
        showOverlay('phase3-screen');
    }
    function closePhase3() {
        const restoreState = phase3ReturnState === 'PAUSED' ? 'PAUSED' : 'TITLE';
        gameState = restoreState;
        if (restoreState === 'PAUSED') { updatePauseStats(); showOverlay('pause-screen'); } else showOverlay('title-screen');
    }
    function renderPhase3() {
        const difficulty = document.getElementById('difficulty-select');
        const build = document.getElementById('build-select');
        if (difficulty) difficulty.value = difficultyMode;
        if (build) build.value = selectedBuild;
        const desc = document.getElementById('difficulty-description');
        if (desc) desc.textContent = `${DIFFICULTY_MODES[difficultyMode].description} Multiplicateur ×${getDifficultyMultiplier()}.`;
        const phase3Runs = document.getElementById('phase3-runs');
        const phase3Victories = document.getElementById('phase3-victories');
        const phase3Score = document.getElementById('phase3-score');
        const phase3Kills = document.getElementById('phase3-kills');
        const phase3NewGamePlus = document.getElementById('phase3-ngplus');
        const phase3PlayTime = document.getElementById('phase3-play-time');
        const newGamePlusButton = document.getElementById('phase3-newgameplus-btn');
        const newGamePlusDescription = document.getElementById('newgameplus-description');
        renderEndlessMode();
        if (phase3Runs) phase3Runs.textContent = phase3Stats.runs;
        if (phase3Victories) phase3Victories.textContent = phase3Stats.victories;
        if (phase3Score) phase3Score.textContent = Math.floor(phase3Stats.bestScore);
        if (phase3NewGamePlus) phase3NewGamePlus.textContent = newGamePlusLevel;
        if (phase3PlayTime) phase3PlayTime.textContent = formatPlayTime();
        if (newGamePlusButton) {
            newGamePlusButton.hidden = !newGamePlusUnlocked;
            newGamePlusButton.style.display = newGamePlusUnlocked ? '' : 'none';
            newGamePlusButton.textContent = `COMMENCER NEW GAME+ ${newGamePlusLevel + 1} ▶`;
        }
        if (newGamePlusDescription) {
            newGamePlusDescription.textContent = newGamePlusUnlocked
                ? `Cycle actuel : ${newGamePlusLevel}. Vos améliorations sont conservées ; les ennemis gagnent 15% de PV et 8% de dégâts par cycle.`
                : 'Terminez la campagne pour débloquer New Game+ et conserver vos améliorations.';
        }
        const bestiaryTypes = Object.keys(BESTIARY_DEFINITIONS);
        const bestiaryTotal = bestiaryTypes.reduce((total, type) => total + (bestiary[type] || 0), 0);
        if (phase3Kills) phase3Kills.textContent = bestiaryTotal;
        const perks = document.getElementById('build-perks');
        if (perks) perks.innerHTML = (BUILD_DEFINITIONS[selectedBuild].perks || []).map(perk => `<span class="phase3-pill">${perk}</span>`).join('');
        const challenges = document.getElementById('challenge-list');
        if (challenges) challenges.innerHTML = [['no-potion','Sans potion'],['speed-run','Speed-run (−30 s : 2 min 30 par niveau)'],['glass-cannon','Canon de verre (+35% dégâts reçus)']].map(([id,label]) => `<label><span>${label}</span><input type="checkbox" ${challengeState[id] ? 'checked' : ''} onchange="toggleOptionalChallenge('${id}',this.checked)"></label>`).join('');
        const bestiaryList = document.getElementById('bestiary-list');
        if (bestiaryList) {
            const discovered = bestiaryTypes.filter(type => (bestiary[type] || 0) > 0).length;
            const totalCount = document.getElementById('bestiary-total');
            const discoveryCount = document.getElementById('bestiary-discovery');
            if (totalCount) totalCount.textContent = `${bestiaryTotal} élimination${bestiaryTotal === 1 ? '' : 's'}`;
            if (discoveryCount) discoveryCount.textContent = `${discovered} / ${bestiaryTypes.length} espèces rencontrées`;
            bestiaryList.replaceChildren(...bestiaryTypes.map(type => {
                const definition = BESTIARY_DEFINITIONS[type];
                const count = bestiary[type] || 0;
                const entry = document.createElement('article');
                entry.className = `bestiary-entry${count ? ' is-discovered' : ' is-unknown'}`;

                const icon = document.createElement('span');
                icon.className = 'bestiary-entry-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = definition.icon;

                const details = document.createElement('div');
                details.className = 'bestiary-entry-details';
                const name = document.createElement('strong');
                name.textContent = definition.label;
                const description = document.createElement('small');
                description.textContent = definition.description;
                details.append(name, description);

                const countLabel = document.createElement('span');
                countLabel.className = 'bestiary-entry-count';
                countLabel.textContent = count ? `${count} vaincu${count === 1 ? '' : 's'}` : 'Non rencontré';

                entry.append(icon, details, countLabel);
                return entry;
            }));
        }
        const stats = document.getElementById('advanced-stats');
        if (stats) stats.innerHTML = `<table class="phase3-table"><tr><td>Parties / victoires</td><td>${phase3Stats.runs} / ${phase3Stats.victories}</td></tr><tr><td>Temps total joué</td><td>${formatPlayTime()}</td></tr><tr><td>Meilleur score</td><td>${Math.floor(phase3Stats.bestScore)}</td></tr><tr><td>Dégâts infligés / reçus</td><td>${Math.floor(phase3Stats.damageDealt)} / ${Math.floor(phase3Stats.damageTaken)}</td></tr><tr><td>Défi quotidien / Boss-Rush</td><td>${phase3Stats.dailyWins} / ${phase3Stats.bossRushWins}</td></tr></table>`;
        const status = document.getElementById('challenge-status');
        if (status) {
            status.textContent = activeChallenge === 'daily' && dailyChallenge
                ? `Défi seed ${dailyChallenge.seed} du ${dailyChallenge.date} · ${getDailyChallengeModifierLabels().join(' · ')}`
                : activeChallenge === 'endless' && endlessModeState.active
                    ? `Mode sans fin · Vague ${endlessModeState.currentWave} · ${endlessModeDifficultyLabel()}`
                : activeChallenge === 'boss-rush' && bossRushState
                    ? `Boss-Rush : ${bossRushState.bossesDefeated.length} / ${bossRushState.bossOrder.length} boss vaincus`
                    : dailyChallenge && dailyChallenge.result
                        ? `Dernier défi ${dailyChallenge.date} · ${dailyChallenge.result.outcome === 'victory' ? 'victoire' : 'défaite'} · score ${dailyChallenge.result.score}`
                        : 'Aucun mode spécial actif.';
        }
        renderPhase4();
    }
    function getPhase4Audit() {
        const progressionMissions = secondaryMissionDefinitions.filter(mission => mission.section.includes('Progression'));
        const completedMissions = secondaryMissionDefinitions.filter(mission => secondaryMissionProgress[mission.id] && secondaryMissionProgress[mission.id].completed).length;
        const missionIds = secondaryMissionDefinitions.map(mission => mission.id);
        const missionGoalKeys = secondaryMissionDefinitions.map(mission =>
            `${mission.description}|${mission.target}|${mission.unit}`
        );
        const rewardIds = Object.keys(SECONDARY_MISSION_REWARDS);
        const rewardSkins = secondaryMissionDefinitions
            .map(mission => SECONDARY_MISSION_REWARDS[mission.id]?.skin)
            .filter(Boolean);
        const missionCatalogComplete = missionIds.length === 30
            && new Set(missionIds).size === missionIds.length
            && new Set(secondaryMissionDefinitions.map(mission => mission.name)).size === missionIds.length
            && new Set(missionGoalKeys).size === missionIds.length;
        const rewardsComplete = rewardIds.length === missionIds.length
            && rewardIds.every(id => missionIds.includes(id))
            && secondaryMissionDefinitions.every(mission => {
                const reward = SECONDARY_MISSION_REWARDS[mission.id];
                return reward && Number.isFinite(Number(reward.gold))
                    && (mission.id === 'adventure-starts' ? Number(reward.gold) === 0 : Number(reward.gold) > 0)
                    && typeof reward.label === 'string' && reward.label.length > 0
                    && (!reward.skin || (VALID_SKIN_IDS.has(reward.skin)
                        && typeof reward.skinLabel === 'string' && reward.skinLabel.length > 0));
            })
            && new Set(rewardSkins).size === rewardSkins.length
            && rewardSkins.every(skin => VALID_SKIN_IDS.has(skin));
        const save = buildSaveData();
        const saveValid = save.saveVersion === SAVE_VERSION && Array.isArray(save.ownedSkins) && save.ownedSkins.includes('default') && save.missionTracking && Array.isArray(save.missionTracking.claimedMissionRewards);
        const renderedProductIds = Array.from(document.querySelectorAll('[data-product-id]'))
            .map(button => button.dataset.productId);
        const expectedProductIds = new Set(COLLECTIBLE_PRODUCT_IDS);
        const renderedProductIdSet = new Set(renderedProductIds);
        const catalogComplete = expectedProductIds.size === COLLECTIBLE_PRODUCT_IDS.length
            && renderedProductIds.length === expectedProductIds.size
            && renderedProductIdSet.size === renderedProductIds.length
            && [...expectedProductIds].every(id => renderedProductIdSet.has(id));
        return {
            progressionMissions,
            completedMissions,
            totalMissions: secondaryMissionDefinitions.length,
            missionCatalogComplete,
            rewardsComplete,
            saveValid,
            catalogComplete,
            expectedProductCount: expectedProductIds.size,
            renderedProductCount: renderedProductIds.length
        };
    }

    function renderPhase4() {
        const summary = document.getElementById('phase4-mission-summary');
        const auditContainer = document.getElementById('phase4-save-audit');
        if (!summary || !auditContainer) return;
        const audit = getPhase4Audit();
        const progressionDone = audit.progressionMissions.filter(mission => secondaryMissionProgress[mission.id] && secondaryMissionProgress[mission.id].completed).length;
        const progressionPercent = audit.progressionMissions.length ? Math.round((progressionDone / audit.progressionMissions.length) * 100) : 0;
        summary.innerHTML = `<div class="phase4-summary"><div class="phase4-kpi"><strong>${progressionDone}/${audit.progressionMissions.length}</strong><span>Objectifs de progression</span></div><div class="phase4-kpi"><strong>${audit.completedMissions}/${audit.totalMissions}</strong><span>Missions terminées</span></div><div class="phase4-kpi"><strong>${progressionPercent}%</strong><span>Progression des mondes</span></div></div><div class="phase4-mission-list">${audit.progressionMissions.map(mission => { const state = secondaryMissionProgress[mission.id] || { current: 0, target: mission.target }; const done = Boolean(state.completed); return `<div class="phase4-mission"><span>${done ? '✓' : '○'} ${mission.name}<small> · ${state.current}/${mission.target} ${mission.unit}</small></span><strong class="${done ? 'phase4-status-ok' : 'phase4-status-warn'}">${done ? 'TERMINÉE' : 'EN COURS'}</strong></div>`; }).join('')}</div>`;
        auditContainer.innerHTML = `<div class="phase4-audit-list"><div class="phase4-audit"><span>Catalogue des missions</span><strong class="${audit.missionCatalogComplete ? 'phase4-status-ok' : 'phase4-status-warn'}">${audit.missionCatalogComplete ? `${audit.totalMissions} missions uniques` : 'À VÉRIFIER'}</strong></div><div class="phase4-audit"><span>Récompenses des missions</span><strong class="${audit.rewardsComplete ? 'phase4-status-ok' : 'phase4-status-warn'}">${audit.rewardsComplete ? 'VALIDES' : 'À VÉRIFIER'}</strong></div><div class="phase4-audit"><span>Catalogue boutique</span><strong class="${audit.catalogComplete ? 'phase4-status-ok' : 'phase4-status-warn'}">${audit.renderedProductCount}/${audit.expectedProductCount} produits ${audit.catalogComplete ? '· VALIDE' : '· À VÉRIFIER'}</strong></div><div class="phase4-audit"><span>Sauvegarde locale</span><strong class="${audit.saveValid ? 'phase4-status-ok' : 'phase4-status-warn'}">${audit.saveValid ? 'COHÉRENTE' : 'À VÉRIFIER'}</strong></div></div>`;
    }

    function runPhase4Audit(notify = false) {
        const audit = getPhase4Audit();
        renderPhase4();
        const valid = audit.missionCatalogComplete && audit.rewardsComplete && audit.saveValid && audit.catalogComplete;
        if (notify) showNotification(valid ? '✓ Phase 4 : sauvegarde et progression vérifiées.' : '⚠ Phase 4 : une vérification nécessite votre attention.', 4200);
        return valid;
    }

    function saveToSlot() {
        const slot = document.getElementById('save-slot-select').value;
        const key = `dungeonsSaveSlot${slot}`;
        const save = buildSaveData();
        if (!writeSaveData(save, key) || readSaveData(key) !== JSON.stringify(save)) {
            showNotification(`Échec de l’enregistrement du slot ${Number(slot) + 1}. Vérifiez que le stockage est disponible.`);
            return false;
        }
        showNotification(`Slot ${Number(slot) + 1} enregistré.`);
        return true;
    }
    function loadFromSlot() {
        const slot = document.getElementById('save-slot-select').value;
        const data = readSaveData(`dungeonsSaveSlot${slot}`);
        if (!data) {
            showNotification('Slot vide.');
            return false;
        }

        let save;
        try {
            save = JSON.parse(data);
        } catch (error) {
            showNotification('Slot invalide : le JSON est corrompu.');
            return false;
        }
        if (!validateImportedSave(save)) {
            showNotification('Slot invalide : format ou version non pris en charge.');
            return false;
        }

        const previousSave = readSaveData();
        let saveReplaced = false;
        try {
            localStorage.setItem('dungeonsSave', data);
            saveReplaced = true;
            const loaded = loadGameSave();
            if (save.hasSavedProgress === true && !loaded) {
                throw new Error('La sauvegarde n’a pas pu être chargée.');
            }
            updateMenuStats();
            renderOwnedSkins();
            updateShopCards();
            renderPhase3();
            showNotification(`Slot ${Number(slot) + 1} chargé.`);
            return true;
        } catch (error) {
            if (saveReplaced) {
                let restoreError = null;
                try {
                    if (previousSave === null) localStorage.removeItem('dungeonsSave');
                    else localStorage.setItem('dungeonsSave', previousSave);
                    loadGameSave();
                    renderPhase3();
                } catch (error) {
                    restoreError = error;
                }
                try {
                    if (previousSave === null) localStorage.removeItem('dungeonsSave');
                    else localStorage.setItem('dungeonsSave', previousSave);
                } catch (error) {
                    restoreError = error;
                }
                if (restoreError) {
                    console.error('Impossible de restaurer la sauvegarde principale après échec du chargement du slot :', restoreError);
                    showNotification('Erreur de chargement : la sauvegarde principale n’a pas pu être restaurée.');
                    return false;
                }
            }
            showNotification('Impossible de charger ce slot. La sauvegarde principale a été conservée.');
            return false;
        }
    }
    function exportSaveJson() { const blob = new Blob([JSON.stringify(buildSaveData(), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `dungeons-save-v${SAVE_VERSION}.json`; link.click(); URL.revokeObjectURL(link.href); }
    function validateImportedSave(save) {
        if (!save || typeof save !== 'object' || Array.isArray(save)) return false;
        const version = save.saveVersion === undefined ? 1 : save.saveVersion;
        if (!Number.isInteger(version) || version < 1 || version > SAVE_VERSION) return false;
        const maxSafeValue = Number.MAX_SAFE_INTEGER;
        const maxFrameMovement = Math.hypot(WORLD_WIDTH, WORLD_HEIGHT);
        const hasValidNumericValues = root => {
            const pending = [root];
            while (pending.length) {
                const value = pending.pop();
                if (typeof value === 'number') {
                    if (!Number.isFinite(value) || value < 0 || value > maxSafeValue) return false;
                } else if (value && typeof value === 'object') {
                    Object.values(value).forEach(nested => pending.push(nested));
                }
            }
            return true;
        };
        if (!hasValidNumericValues(save)) return false;
        const isInRange = (value, min, max = maxSafeValue) =>
            typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
        const optionalInRange = (object, key, min, max = maxSafeValue) =>
            object[key] === undefined || isInRange(object[key], min, max);
        if (!Number.isSafeInteger(save.gold) || save.gold < 0) return false;
        if (!Array.isArray(save.ownedSkins) || save.ownedSkins.some(skin => typeof skin !== 'string')) return false;
        if (save.relics !== undefined
            && (!Array.isArray(save.relics) || save.relics.some(relic => !VALID_RELIC_IDS.has(relic)))) return false;
        if (save.hasSavedProgress !== undefined && typeof save.hasSavedProgress !== 'boolean') return false;
        if (!optionalInRange(save, 'newGamePlusLevel', 0)
            || (save.newGamePlusLevel !== undefined && !Number.isSafeInteger(save.newGamePlusLevel))
            || (save.newGamePlusUnlocked !== undefined && typeof save.newGamePlusUnlocked !== 'boolean')
            || (save.newGamePlusRunActive !== undefined && typeof save.newGamePlusRunActive !== 'boolean')) return false;

        if (!optionalInRange(save, 'defense', 0, 0.95)
            || !optionalInRange(save, 'attackDamage', 1)
            || !optionalInRange(save, 'maxHp', 1)
            || !optionalInRange(save, 'hp', 0)
            || !optionalInRange(save, 'speed', 0.1, maxFrameMovement)
            || !optionalInRange(save, 'score', 0)) return false;
        const maxHp = save.maxHp === undefined ? 120 : save.maxHp;
        const hp = save.hp === undefined ? maxHp : save.hp;
        if (hp > maxHp) return false;

        const build = BUILD_DEFINITIONS[save.selectedBuild] || BUILD_DEFINITIONS.vanguard;
        const buildModifiers = save.buildModifiers;
        if (buildModifiers !== undefined) {
            if (!buildModifiers || typeof buildModifiers !== 'object' || Array.isArray(buildModifiers)
                || !optionalInRange(buildModifiers, 'hp', 0.95, 1.2)
                || !optionalInRange(buildModifiers, 'defense', 0, 0.1)
                || !optionalInRange(buildModifiers, 'damage', 0.95, 1.18)
                || !optionalInRange(buildModifiers, 'speed', 0.95, 1.08)
                || !optionalInRange(buildModifiers, 'dashSpeed', 1, 1.2)) return false;
        }
        const shopUpgrades = save.shopUpgrades;
        if (shopUpgrades !== undefined) {
            if (!shopUpgrades || typeof shopUpgrades !== 'object' || Array.isArray(shopUpgrades)
                || !optionalInRange(shopUpgrades, 'health', 0)
                || !optionalInRange(shopUpgrades, 'defense', 0, 0.95)
                || !optionalInRange(shopUpgrades, 'damage', 0)
                || !optionalInRange(shopUpgrades, 'speed', 0, maxFrameMovement)) return false;
            if ((shopUpgrades.health !== undefined && !Number.isSafeInteger(shopUpgrades.health))
                || (shopUpgrades.damage !== undefined && !Number.isSafeInteger(shopUpgrades.damage))
                || (shopUpgrades.health !== undefined && shopUpgrades.health > maxHp)
                || (save.attackDamage !== undefined && shopUpgrades.damage > save.attackDamage)
                || (save.speed !== undefined && shopUpgrades.speed > save.speed)) return false;
        }
        if (save.speed !== undefined) {
            const previousBuildSpeed = buildModifiers
                ? (buildModifiers.speed === undefined ? 1 : buildModifiers.speed)
                : build.speed;
            const shopSpeed = shopUpgrades && shopUpgrades.speed !== undefined
                ? shopUpgrades.speed : 0;
            const speedAfterBuildSelection = Math.max(
                0.1,
                ((save.speed - shopSpeed) / previousBuildSpeed) * build.speed + shopSpeed
            );
            if (!Number.isFinite(speedAfterBuildSelection) || speedAfterBuildSelection > maxFrameMovement) return false;
        }

        if ((save.maxHp !== undefined && !Number.isSafeInteger(save.maxHp))
            || (save.hp !== undefined && !Number.isSafeInteger(save.hp))
            || (save.score !== undefined && !Number.isSafeInteger(save.score))) return false;

        const worldIndex = save.currentWorldIndex === undefined ? 0 : save.currentWorldIndex;
        const levelIndex = save.currentLevelIndex === undefined ? 0 : save.currentLevelIndex;
        const unlockedWorld = save.maxUnlockedWorld === undefined ? 0 : save.maxUnlockedWorld;
        const unlockedLevel = save.maxUnlockedLevel === undefined ? 0 : save.maxUnlockedLevel;
        if (!Number.isInteger(worldIndex) || worldIndex < 0 || worldIndex >= worldsData.length
            || !Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= worldsData[worldIndex].levels.length
            || !Number.isInteger(unlockedWorld) || unlockedWorld < 0 || unlockedWorld >= worldsData.length
            || !Number.isInteger(unlockedLevel) || unlockedLevel < 0
            || unlockedLevel >= worldsData[unlockedWorld].levels.length) return false;

        if (save.settings !== undefined) {
            if (!save.settings || typeof save.settings !== 'object' || Array.isArray(save.settings)
                || !optionalInRange(save.settings, 'masterVolume', 0, 100)
                || !optionalInRange(save.settings, 'musicVolume', 0, 100)
                || !optionalInRange(save.settings, 'sfxVolume', 0, 100)) return false;
        }
        if (save.secondaryMissionProgress !== undefined) {
            if (!save.secondaryMissionProgress || typeof save.secondaryMissionProgress !== 'object'
                || Array.isArray(save.secondaryMissionProgress)) return false;
            for (const mission of secondaryMissionDefinitions) {
                const progress = save.secondaryMissionProgress[mission.id];
                if (progress === undefined) continue;
                if (!progress || typeof progress !== 'object' || Array.isArray(progress)
                    || !optionalInRange(progress, 'current', 0, mission.target)
                    || (progress.current !== undefined && !Number.isSafeInteger(progress.current))
                    || (progress.target !== undefined
                        && (!Number.isSafeInteger(progress.target)
                            || (progress.target !== mission.target
                                && !(mission.id === 'collector' && progress.target > 0 && progress.target < mission.target)
                        && !(mission.id === 'side-missions-finished'
                            && ((version <= 6 && progress.target === 27)
                                || (version === 7 && progress.target === 28)
                                || (version >= 8 && version < SAVE_VERSION && progress.target === 29))))))
                    || (progress.completed !== undefined && typeof progress.completed !== 'boolean')) return false;
            }
        }
        if (save.missionTracking !== undefined) {
            if (!save.missionTracking || typeof save.missionTracking !== 'object' || Array.isArray(save.missionTracking)
                || !optionalInRange(save.missionTracking, 'consecutiveMonsterKills', 0)
                || (save.missionTracking.consecutiveMonsterKills !== undefined
                    && !Number.isSafeInteger(save.missionTracking.consecutiveMonsterKills))) return false;
            for (const key of ['defeatedBosses', 'claimedBossRewards']) {
                const values = save.missionTracking[key];
                if (values !== undefined && (!Array.isArray(values) || values.some(index =>
                    !Number.isInteger(index) || index < 0 || index >= worldsData.length
                ))) return false;
            }
            const challengeProgress = save.missionTracking.optionalChallengeLevelProgress;
            if (challengeProgress !== undefined) {
                const validLevelIds = new Set(worldsData.flatMap(world => world.levels.map(level => level.id)));
                if (!challengeProgress || typeof challengeProgress !== 'object' || Array.isArray(challengeProgress)
                    || Object.keys(challengeProgress).some(id => !OPTIONAL_CHALLENGE_IDS.includes(id))
                    || OPTIONAL_CHALLENGE_IDS.some(id => {
                        const values = challengeProgress[id];
                        return values !== undefined && (!Array.isArray(values)
                            || new Set(values).size !== values.length
                            || values.some(levelId => typeof levelId !== 'string' || !validLevelIds.has(levelId)));
                    })) return false;
            }
        }
        if (save.phase3Stats !== undefined) {
            const integerStats = ['runs', 'victories', 'deaths', 'bestScore', 'dailyWins', 'bossRushWins', 'playSeconds'];
            const decimalStats = ['damageDealt', 'damageTaken'];
            if (!save.phase3Stats || typeof save.phase3Stats !== 'object' || Array.isArray(save.phase3Stats)
                || [...integerStats, ...decimalStats].some(key =>
                    !optionalInRange(save.phase3Stats, key, 0)
                )
                || integerStats.some(key => save.phase3Stats[key] !== undefined
                    && !Number.isSafeInteger(save.phase3Stats[key]))) return false;
        }
        if (save.bestiary !== undefined) {
            if (!save.bestiary || typeof save.bestiary !== 'object' || Array.isArray(save.bestiary)
                || Object.keys(BESTIARY_DEFINITIONS).some(key =>
                    save.bestiary[key] !== undefined
                    && (!Number.isSafeInteger(save.bestiary[key]) || save.bestiary[key] < 0)
                )) return false;
        }
        if (save.dailyChallenge !== undefined && save.dailyChallenge !== null) {
            if (typeof save.dailyChallenge !== 'object' || Array.isArray(save.dailyChallenge)
                || (save.dailyChallenge.seed !== undefined
                    && (!Number.isInteger(save.dailyChallenge.seed) || save.dailyChallenge.seed < 0 || save.dailyChallenge.seed > 0xffffffff))
                || (save.dailyChallenge.date !== undefined
                    && (typeof save.dailyChallenge.date !== 'string'
                        || !parseChallengeCode(formatChallengeCode(save.dailyChallenge.date, save.dailyChallenge.seed || 0))))
                || (save.dailyChallenge.startedAt !== undefined
                    && (typeof save.dailyChallenge.startedAt !== 'string' || !Number.isFinite(Date.parse(save.dailyChallenge.startedAt))))) return false;
            if (save.dailyChallenge.result !== undefined) {
                const result = save.dailyChallenge.result;
                if (!result || typeof result !== 'object' || Array.isArray(result)
                    || !['victory', 'defeat'].includes(result.outcome)
                    || !Number.isSafeInteger(result.score) || result.score < 0
                    || !Number.isSafeInteger(result.durationSeconds) || result.durationSeconds < 0
                    || !BUILD_DEFINITIONS[result.build]
                    || !DIFFICULTY_MODES[result.difficulty]) return false;
            }
        }
        if (save.bossRushState !== undefined && save.bossRushState !== null) {
            const rush = save.bossRushState;
            if (typeof rush !== 'object' || Array.isArray(rush)
                || !optionalInRange(rush, 'bonusGold', 0, 3000)
                || (rush.bonusGold !== undefined && rush.bonusGold !== 3000)) return false;
            if (rush.bossesDefeated !== undefined
                && (!Array.isArray(rush.bossesDefeated)
                    || rush.bossesDefeated.some(index =>
                        !Number.isInteger(index) || index < 0 || index >= worldsData.length
                    ))) return false;
            if (rush.bossOrder !== undefined
                && (!Array.isArray(rush.bossOrder)
                    || rush.bossOrder.some(boss =>
                        !boss || typeof boss !== 'object' || Array.isArray(boss)
                        || !Number.isInteger(boss.worldIndex) || boss.worldIndex < 0
                        || boss.worldIndex >= worldsData.length
                        || !Number.isInteger(boss.levelIndex) || boss.levelIndex < 0
                        || !worldsData[boss.worldIndex].levels[boss.levelIndex]?.isBoss
                    ))) return false;
        }
        if (save.activeChallenge !== undefined
            && save.activeChallenge !== null
            && !['daily', 'boss-rush', 'endless'].includes(save.activeChallenge)) return false;
        if (save.endlessModeState !== undefined) {
            const endless = save.endlessModeState;
            const goalWaves = new Set(ENDLESS_MASTERY_GOALS.map(goal => goal.wave));
            if (!endless || typeof endless !== 'object' || Array.isArray(endless)
                || typeof endless.active !== 'boolean'
                || !Number.isSafeInteger(endless.currentWave) || endless.currentWave < 0
                || !Number.isSafeInteger(endless.bestWave) || endless.bestWave < 0
                || !Number.isSafeInteger(endless.bestClearedWave) || endless.bestClearedWave < 0
                || !Number.isSafeInteger(endless.lastRunWave) || endless.lastRunWave < 0
                || !Number.isSafeInteger(endless.bestScore) || endless.bestScore < 0
                || !Array.isArray(endless.claimedMilestones)
                || endless.claimedMilestones.some(wave => !goalWaves.has(wave))
                || new Set(endless.claimedMilestones).size !== endless.claimedMilestones.length
                || endless.bestClearedWave > endless.bestWave
                || (endless.active && endless.currentWave < 1)
                || (!endless.active && endless.currentWave !== 0)) return false;
            if (endless.active && save.activeChallenge !== 'endless') return false;
        } else if (save.activeChallenge === 'endless') {
            return false;
        }
        return true;
    }

    function importSaveJson() {
        const input = document.getElementById('save-import-input');
        if (!input) return;
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                let saveWritten = false;
                const previousSave = readSaveData();
                try {
                    const parsed = JSON.parse(reader.result);
                    if (!validateImportedSave(parsed)) throw new Error('invalid save');
                    parsed.hasSavedProgress = true;
                    if (!writeSaveData(parsed)) throw new Error('storage unavailable');
                    saveWritten = true;
                    if (!loadGameSave()) throw new Error('save could not be loaded');
                    if (!saveGame(true)) throw new Error('storage unavailable');
                    renderOwnedSkins();
                    renderPhase3();
                    showNotification('Sauvegarde importée.');
                } catch (error) {
                    if (saveWritten) {
                        let restoreError = null;
                        try {
                            if (previousSave === null) localStorage.removeItem('dungeonsSave');
                            else localStorage.setItem('dungeonsSave', previousSave);
                            loadGameSave();
                            renderOwnedSkins();
                            renderPhase3();
                        } catch (error) {
                            restoreError = error;
                        }
                        try {
                            if (previousSave === null) localStorage.removeItem('dungeonsSave');
                            else localStorage.setItem('dungeonsSave', previousSave);
                        } catch (error) {
                            restoreError = error;
                        }
                        if (restoreError) {
                            console.error('Impossible de restaurer la sauvegarde précédente après échec d’import :', restoreError);
                        }
                    }
                    showNotification('JSON de sauvegarde invalide ou impossible à enregistrer.');
                } finally {
                    input.value = '';
                }
            };
            reader.onerror = () => {
                input.value = '';
                showNotification('Impossible de lire le fichier de sauvegarde.');
            };
            reader.readAsText(file);
        };
        input.click();
    }

function saveSettings() {
    settings = normalizeSettings(settings);
    return writeSaveData(settings, "dungeonsSettings");
}

function loadSettings() {
    const data = readSaveData("dungeonsSettings");
    if (!data) return false;
    try {
        settings = normalizeSettings(JSON.parse(data));
        return true;
    } catch (error) {
        console.warn("Réglages invalides, restauration des valeurs par défaut.", error);
        settings = createDefaultSettings();
        try { localStorage.removeItem("dungeonsSettings"); } catch (removeError) {
            console.warn("Impossible de supprimer les réglages invalides :", removeError);
        }
        return false;
    }
}

let saveTimer = null;
let savePending = false;

function buildSaveData() {
    const saveData = {
        saveVersion: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        gold: player.gold,

        skin: player.skin,
        ownedSkins: player.ownedSkins,

        defense: player.defense,

        attackDamage: player.attackDamage,

        maxHp: player.maxHp,
        hp: player.hp,

        speed: player.speed,
        buildModifiers: {
            hp: player._buildHpMultiplier || 1,
            defense: player._buildDefenseBonus || 0,
            damage: player._buildDamageMultiplier || 1,
            speed: player._buildSpeedMultiplier || 1,
            dashSpeed: player._buildDashSpeedMultiplier || 1
        },
        shopUpgrades: {
            health: player._shopHealthBonus || 0,
            defense: player._shopDefenseBonus || 0,
            damage: player._shopDamageBonus || 0,
            speed: player._shopSpeedBonus || 0
        },
        abilities: player.abilities,
        relics: player.relics,
        newGamePlusLevel,
        newGamePlusUnlocked,
        newGamePlusRunActive,

        maxUnlockedWorld,
        maxUnlockedLevel,
        hasSavedProgress,
        currentWorldIndex,
        currentLevelIndex,
        settings: normalizeSettings(settings),
        secondaryMissionProgress: normalizeMissionProgress(secondaryMissionProgress),
        missionTracking: {
            consecutiveMonsterKills,
            killSkinsUsed,
            purchasedProducts,
            worldCompletionSkins,
            rareSkinsUnlocked,
            discoveredSecretRooms,
            secretRewardsClaimed,
            completedLevels,
            completedLevelIds,
            optionalChallengeLevelProgress,
            defeatedBosses,
            defeatedBossIds,
            claimedBossRewards,
                claimedBossRewardIds,
                claimedMissionRewards
        },
        score,
        difficultyMode,
        selectedBuild,
        challengeState,
        phase3Stats,
        bestiary,
        activeChallenge,
        dailyChallenge,
        bossRushState,
        endlessModeState
    };
    return saveData;
}

function saveGameNow() {
    if (!saveWritesAuthorized) return false;
    const result = writeSaveData(buildSaveData());
    if (result) {
        savePending = false;
        lastAutoSave = performance.now();
    }
    return result;
}

function saveGame(force = false) {
    if (!saveWritesAuthorized) return false;
    if (force) {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        return saveGameNow();
    }
    savePending = true;
    if (!saveTimer) {
        saveTimer = setTimeout(() => {
            saveTimer = null;
            if (savePending) saveGameNow();
        }, SAVE_DEBOUNCE_MS);
    }
    return true;
}

function authorizeFreshRunSave() {
    if (saveWritesAuthorized) return true;
    try {
        if (localStorage.getItem('dungeonsSave') === null) {
            saveWritesAuthorized = true;
            return true;
        }
    } catch (error) {
        console.warn('Impossible de vérifier le stockage avant le démarrage de la partie :', error);
    }
    return false;
}

function migrateSaveData(save) {
    const version = Number.isInteger(save.saveVersion) ? save.saveVersion : 1;
    if (version > SAVE_VERSION) {
        console.warn(`Sauvegarde plus récente détectée (v${version}), chargement prudent.`);
        return false;
    }
    return version < SAVE_VERSION;
}

function loadGameSave() {
    saveWritesAuthorized = false;
    loadSettings();
    const data = readSaveData();
    if (data === null) {
        applyBuildStats();
        return false;
    }

    let save;
    try {
        save = JSON.parse(data);
    } catch (error) {
        const recoveryKey = preserveSaveRecoveryCopy(data, 'JSON invalide');
        showNotification(recoveryKey
            ? `Sauvegarde illisible. Copie conservée sous ${recoveryKey} ; aucun écrasement effectué.`
            : 'Sauvegarde illisible. Écriture bloquée, mais la copie locale de récupération a échoué.');
        console.error("Sauvegarde invalide, conservation de la sauvegarde d'origine.", error);
        return false;
    }
    if (!save || typeof save !== 'object' || Array.isArray(save)) {
        const recoveryKey = preserveSaveRecoveryCopy(data, 'format de sauvegarde inattendu');
        showNotification(recoveryKey
            ? `Sauvegarde invalide. Copie conservée sous ${recoveryKey} ; aucun écrasement effectué.`
            : 'Sauvegarde invalide. Écriture bloquée, mais la copie locale de récupération a échoué.');
        console.error("Sauvegarde invalide : format JSON inattendu. Sauvegarde d'origine conservée.");
        return false;
    }
    if (Number.isInteger(save.saveVersion) && save.saveVersion > SAVE_VERSION) {
        const recoveryKey = preserveSaveRecoveryCopy(data, `version ${save.saveVersion} plus récente que ${SAVE_VERSION}`);
        showNotification(recoveryKey
            ? `Sauvegarde v${save.saveVersion} non prise en charge. Copie conservée sous ${recoveryKey} ; mise à jour requise.`
            : `Sauvegarde v${save.saveVersion} non prise en charge. Écriture bloquée ; copie de récupération impossible.`);
        console.warn(`Sauvegarde plus récente détectée (v${save.saveVersion}) : chargement et écriture bloqués.`);
        return false;
    }
    if (!validateImportedSave(save)) {
        const recoveryKey = preserveSaveRecoveryCopy(data, 'validation de sauvegarde échouée');
        showNotification(recoveryKey
            ? `Sauvegarde invalide. Copie conservée sous ${recoveryKey} ; aucun écrasement effectué.`
            : 'Sauvegarde invalide. Écriture bloquée, mais la copie locale de récupération a échoué.');
        console.error('Sauvegarde invalide : validation échouée. Sauvegarde d’origine conservée.');
        return false;
    }
    normalizePhase3Data(save);
    newGamePlusLevel = Number.isSafeInteger(save.newGamePlusLevel) ? Math.max(0, save.newGamePlusLevel) : 0;
    newGamePlusRunActive = save.newGamePlusRunActive === true && newGamePlusLevel > 0;
    const savedCompletedLevels = save.missionTracking && save.missionTracking.completedLevelIds;
    const savedDefeatedBosses = save.missionTracking && save.missionTracking.defeatedBossIds;
    const hasCompletedCampaign = Array.isArray(savedCompletedLevels)
        && worldsData.every(world => world.levels.every(level => savedCompletedLevels.includes(level.id)))
        && Array.isArray(savedDefeatedBosses)
        && worldsData.every((world, index) => savedDefeatedBosses.includes(`world-${index + 1}-boss`));
    newGamePlusUnlocked = save.newGamePlusUnlocked === true || newGamePlusLevel > 0 || hasCompletedCampaign;
    activeChallenge = typeof save.activeChallenge === 'string' ? save.activeChallenge : null;
    dailyChallenge = save.dailyChallenge && typeof save.dailyChallenge === 'object' ? save.dailyChallenge : null;
    bossRushState = save.bossRushState && typeof save.bossRushState === 'object' ? save.bossRushState : null;
    const savedEndlessState = save.endlessModeState;
    endlessModeState = savedEndlessState && typeof savedEndlessState === 'object' && !Array.isArray(savedEndlessState)
        ? {
            active: savedEndlessState.active === true,
            currentWave: Number.isSafeInteger(savedEndlessState.currentWave) ? Math.max(0, savedEndlessState.currentWave) : 0,
            bestWave: Number.isSafeInteger(savedEndlessState.bestWave) ? Math.max(0, savedEndlessState.bestWave) : 0,
            bestClearedWave: Number.isSafeInteger(savedEndlessState.bestClearedWave) ? Math.max(0, savedEndlessState.bestClearedWave) : 0,
            lastRunWave: Number.isSafeInteger(savedEndlessState.lastRunWave) ? Math.max(0, savedEndlessState.lastRunWave) : 0,
            bestScore: Number.isSafeInteger(savedEndlessState.bestScore) ? Math.max(0, savedEndlessState.bestScore) : 0,
            claimedMilestones: Array.isArray(savedEndlessState.claimedMilestones)
                ? [...new Set(savedEndlessState.claimedMilestones.filter(wave =>
                    ENDLESS_MASTERY_GOALS.some(goal => goal.wave === wave)
                ))]
                : []
        }
        : {
            active: false,
            currentWave: 0,
            bestWave: 0,
            bestClearedWave: 0,
            lastRunWave: 0,
            bestScore: 0,
            claimedMilestones: []
        };
    endlessRunEnded = false;
    if (activeChallenge === 'daily' && (!dailyChallenge || dailyChallenge.started !== true)) {
        activeChallenge = null;
        dailyChallenge = null;
    }
    if (activeChallenge === 'boss-rush' && (
        !bossRushState ||
        !Array.isArray(bossRushState.bossOrder) ||
        !Array.isArray(bossRushState.bossesDefeated)
    )) {
        activeChallenge = null;
        bossRushState = null;
    }
    if (activeChallenge === 'endless' && (!endlessModeState.active || endlessModeState.currentWave < 1)) {
        activeChallenge = null;
        endlessModeState.active = false;
        endlessModeState.currentWave = 0;
    }
    if (activeChallenge !== 'endless' && endlessModeState.active) {
        endlessModeState.active = false;
        endlessModeState.currentWave = 0;
    }

    const saveNeedsMigration = migrateSaveData(save);
    hasSavedProgress = save.hasSavedProgress === true;
    secondaryMissionProgress = normalizeMissionProgress(save.secondaryMissionProgress);
    const missionTracking = normalizeMissionTracking(save.missionTracking);
    consecutiveMonsterKills = missionTracking.consecutiveMonsterKills;
    killSkinsUsed = missionTracking.killSkinsUsed;
    purchasedProducts = missionTracking.purchasedProducts;
    worldCompletionSkins = missionTracking.worldCompletionSkins;
    rareSkinsUnlocked = missionTracking.rareSkinsUnlocked;
    discoveredSecretRooms = missionTracking.discoveredSecretRooms;
    secretRewardsClaimed = missionTracking.secretRewardsClaimed;
    if (!Array.isArray(save.missionTracking && save.missionTracking.secretRewardsClaimed)) {
        // Avant v4, la découverte accordait immédiatement la récompense.
        secretRewardsClaimed = [...discoveredSecretRooms];
    }
    completedLevels = missionTracking.completedLevels;
    completedLevelIds = missionTracking.completedLevelIds;
    optionalChallengeLevelProgress = missionTracking.optionalChallengeLevelProgress;
    defeatedBosses = missionTracking.defeatedBosses;
    defeatedBossIds = missionTracking.defeatedBossIds;
    claimedBossRewards = missionTracking.claimedBossRewards;
    claimedBossRewardIds = missionTracking.claimedBossRewardIds;
    claimedMissionRewards = missionTracking.claimedMissionRewards;
    const secretMission = secondaryMissionProgress['world-secrets'];
    if (secretMission) {
        secretMission.current = Math.min(secretRoomDefinitions.length, discoveredSecretRooms.length);
        secretMission.completed = secretMission.current >= secretMission.target;
    }
    const levelMission = secondaryMissionProgress['dungeon-master'];
    if (levelMission) {
        levelMission.current = Math.min(levelMission.target, completedLevels.length);
        levelMission.completed = levelMission.current >= levelMission.target;
    }
    const bossMission = secondaryMissionProgress['finished'];
    if (bossMission) {
        bossMission.current = Math.min(bossMission.target, defeatedBosses.length);
        bossMission.completed = bossMission.current >= bossMission.target;
    }
    if (Array.isArray(save.ownedSkins) && save.ownedSkins.includes('secret')) {
        const playerSecretMission = secondaryMissionProgress['player-secrets'];
        if (playerSecretMission) {
            playerSecretMission.current = playerSecretMission.target;
            playerSecretMission.completed = true;
        }
    }
    if (!hasSavedProgress) {
        player.defense = Number.isFinite(save.defense) ? Math.max(0, Math.min(MAX_PLAYER_DEFENSE, save.defense)) : 0;
        player.attackDamage = Number.isFinite(save.attackDamage)
            ? Math.max(1, Math.min(MAX_PLAYER_ATTACK_DAMAGE, save.attackDamage)) : 22;
        player.maxHp = Number.isFinite(save.maxHp)
            ? Math.min(MAX_PLAYER_HP, Math.max(1, save.maxHp)) : BASE_PLAYER_HP;
        player.hp = Number.isFinite(save.hp) ? Math.max(0, Math.min(player.maxHp, save.hp)) : player.maxHp;
        player.speed = Number.isFinite(save.speed) ? Math.max(0.1, save.speed) : 3.8;
        const shopUpgrades = save.shopUpgrades && typeof save.shopUpgrades === 'object' ? save.shopUpgrades : {};
        player._shopHealthBonus = Number.isFinite(shopUpgrades.health)
            ? Math.min(MAX_PLAYER_HP, Math.max(0, shopUpgrades.health)) : 0;
        player._shopDefenseBonus = Number.isFinite(shopUpgrades.defense)
            ? Math.max(0, Math.min(MAX_PLAYER_DEFENSE, shopUpgrades.defense)) : 0;
        player._shopDamageBonus = Number.isFinite(shopUpgrades.damage)
            ? Math.max(0, Math.min(MAX_PLAYER_ATTACK_DAMAGE, shopUpgrades.damage)) : 0;
        player._shopSpeedBonus = Number.isFinite(shopUpgrades.speed) ? Math.max(0, shopUpgrades.speed) : 0;
        const modifiers = save.buildModifiers && typeof save.buildModifiers === 'object' ? save.buildModifiers : {};
        player._buildHpMultiplier = Number.isFinite(modifiers.hp) && modifiers.hp > 0 ? modifiers.hp : 1;
        player._buildDefenseBonus = Number.isFinite(modifiers.defense) ? modifiers.defense : 0;
        player._buildDamageMultiplier = Number.isFinite(modifiers.damage) && modifiers.damage > 0 ? modifiers.damage : 1;
        player._buildSpeedMultiplier = Number.isFinite(modifiers.speed) && modifiers.speed > 0 ? modifiers.speed : 1;
        player._buildDashSpeedMultiplier = Number.isFinite(modifiers.dashSpeed) && modifiers.dashSpeed > 0 ? modifiers.dashSpeed : 1;
        applyBuildStats();
        saveWritesAuthorized = true;
        return false;
    }

    player.gold = Number.isFinite(save.gold) ? Math.max(0, save.gold) : 0;
    let migratedMissionRewards = false;
    player.skin = typeof save.skin === 'string' ? save.skin : "default";
    player.ownedSkins = Array.isArray(save.ownedSkins)
        ? [...new Set(save.ownedSkins.filter(skin => typeof skin === 'string' && VALID_SKIN_IDS.has(skin)))]
        : [];
    if (!player.ownedSkins.length) player.ownedSkins = ["default"];
    if (!player.ownedSkins.includes('default')) player.ownedSkins.unshift('default');
    if (!player.ownedSkins.includes(player.skin)) player.skin = 'default';
    secondaryMissionDefinitions.forEach(mission => {
        const state = secondaryMissionProgress[mission.id];
        if (state && state.completed && grantMissionReward(mission.id)) migratedMissionRewards = true;
    });
    saveWasMigrated = saveNeedsMigration || migrateLegacyMissionTracking(save);
    if (!completedLevelIds.length) {
        completedLevelIds = completedLevels.map(key => {
            const [worldIndex, levelIndex] = key.split('-').map(Number);
            return worldsData[worldIndex] && worldsData[worldIndex].levels[levelIndex]
                ? worldsData[worldIndex].levels[levelIndex].id
                : null;
        }).filter(Boolean);
    }
    if (!defeatedBossIds.length) defeatedBossIds = defeatedBosses.map(index => `world-${index + 1}-boss`);
    if (!claimedBossRewardIds.length) claimedBossRewardIds = claimedBossRewards.map(index => `world-${index + 1}-boss`);
    const migratedLevelMission = secondaryMissionProgress['dungeon-master'];
    if (migratedLevelMission) {
        migratedLevelMission.current = Math.min(migratedLevelMission.target, completedLevels.length);
        migratedLevelMission.completed = migratedLevelMission.current >= migratedLevelMission.target;
    }
    const migratedBossMission = secondaryMissionProgress['finished'];
    if (migratedBossMission) {
        migratedBossMission.current = Math.min(migratedBossMission.target, defeatedBosses.length);
        migratedBossMission.completed = migratedBossMission.current >= migratedBossMission.target;
    }
    player.defense = Number.isFinite(save.defense) ? Math.max(0, Math.min(MAX_PLAYER_DEFENSE, save.defense)) : 0;
    player.attackDamage = Number.isFinite(save.attackDamage)
        ? Math.max(1, Math.min(MAX_PLAYER_ATTACK_DAMAGE, save.attackDamage)) : 22;
    player.maxHp = Number.isFinite(save.maxHp)
        ? Math.min(MAX_PLAYER_HP, Math.max(1, save.maxHp)) : BASE_PLAYER_HP;
    player.hp = Number.isFinite(save.hp) ? Math.max(0, Math.min(player.maxHp, save.hp)) : player.maxHp;
    player.speed = Number.isFinite(save.speed) ? Math.max(0.1, save.speed) : 3.8;
    const shopUpgrades = save.shopUpgrades && typeof save.shopUpgrades === 'object' ? save.shopUpgrades : {};
    player._shopHealthBonus = Number.isFinite(shopUpgrades.health)
        ? Math.min(MAX_PLAYER_HP, Math.max(0, shopUpgrades.health)) : 0;
    player._shopDefenseBonus = Number.isFinite(shopUpgrades.defense)
        ? Math.max(0, Math.min(MAX_PLAYER_DEFENSE, shopUpgrades.defense)) : 0;
    player._shopDamageBonus = Number.isFinite(shopUpgrades.damage)
        ? Math.max(0, Math.min(MAX_PLAYER_ATTACK_DAMAGE, shopUpgrades.damage)) : 0;
    player._shopSpeedBonus = Number.isFinite(shopUpgrades.speed) ? Math.max(0, shopUpgrades.speed) : 0;
    const hasBuildModifiers = save.buildModifiers && typeof save.buildModifiers === 'object';
    const buildModifiers = hasBuildModifiers ? save.buildModifiers : BUILD_DEFINITIONS[selectedBuild];
    player._buildHpMultiplier = Number.isFinite(buildModifiers.hp) && buildModifiers.hp > 0 ? buildModifiers.hp : BUILD_DEFINITIONS[selectedBuild].hp;
    player._buildDefenseBonus = Number.isFinite(buildModifiers.defense) ? buildModifiers.defense : BUILD_DEFINITIONS[selectedBuild].defense;
    player._buildDamageMultiplier = Number.isFinite(buildModifiers.damage) && buildModifiers.damage > 0 ? buildModifiers.damage : BUILD_DEFINITIONS[selectedBuild].damage;
    player._buildSpeedMultiplier = Number.isFinite(buildModifiers.speed) && buildModifiers.speed > 0 ? buildModifiers.speed : BUILD_DEFINITIONS[selectedBuild].speed;
    player._buildDashSpeedMultiplier = Number.isFinite(buildModifiers.dashSpeed) && buildModifiers.dashSpeed > 0 ? buildModifiers.dashSpeed : BUILD_DEFINITIONS[selectedBuild].dashSpeed;
    player.abilities = Array.isArray(save.abilities) ? [...new Set(save.abilities.filter(value => ['precision', 'ember'].includes(value)))] : [];
    player.relics = Array.isArray(save.relics)
        ? [...new Set(save.relics.filter(value => VALID_RELIC_IDS.has(value)))]
        : [];
    if (hasBuildModifiers) {
        applyBuildStats();
    } else {
        player.attackRange = 60 * (selectedBuild === 'ranger' ? 1.25 : 1);
    }
    maxUnlockedWorld = Number.isInteger(save.maxUnlockedWorld) ? Math.max(0, Math.min(worldsData.length - 1, save.maxUnlockedWorld)) : 0;
    const unlockedWorldLevels = worldsData[maxUnlockedWorld].levels.length;
    maxUnlockedLevel = Number.isInteger(save.maxUnlockedLevel)
        ? Math.max(0, Math.min(unlockedWorldLevels - 1, save.maxUnlockedLevel))
        : 0;
    currentWorldIndex = Number.isInteger(save.currentWorldIndex)
        ? Math.max(0, Math.min(worldsData.length - 1, save.currentWorldIndex))
        : 0;
    currentLevelIndex = Number.isInteger(save.currentLevelIndex)
        ? Math.max(0, Math.min(worldsData[currentWorldIndex].levels.length - 1, save.currentLevelIndex))
        : 0;
    score = Number.isFinite(save.score) ? Math.max(0, save.score) : 0;
    if (save.settings && typeof save.settings === 'object'
        && !readSaveData("dungeonsSettings")) {
        settings = normalizeSettings(save.settings);
        saveSettings();
    }
    const playButton = document.getElementById('btn-continue');
    if (playButton) playButton.disabled = false;
    saveWritesAuthorized = true;
    if (saveWasMigrated || migratedMissionRewards) saveGame(true);
    return hasSavedProgress;
}

function buyHealthUpgrade() {
    const healthGain = Math.min(20, MAX_PLAYER_HP - player.maxHp);
    if (healthGain <= 0) {
        showNotification('Vos PV sont déjà au maximum (300 PV).');
        return;
    }
    if (player.gold < 50) {
        showNotification("Or insuffisant !");
        return;
    }

    player.gold -= 50;
    player._shopHealthBonus = Math.min(MAX_PLAYER_HP,
        (player._shopHealthBonus || 0) + healthGain);
    player.maxHp = Math.min(MAX_PLAYER_HP, player.maxHp + healthGain);
    player.hp = player.maxHp;
    applyBuildStats();
    player.hp = player.maxHp;

    updateShopGold();
    updateMenuStats();

    markPurchasedProduct('health-upgrade');
    updateMissionByEvent('purchase');
    updateMissionByEvent('upgrade');
    saveGame(true);

    showNotification("PV augmentés !");
}

function buyDamageUpgrade() {
    buyAttackUpgrade();
}

function buySpeedUpgrade() {
    if (player.gold < 60) {
        showNotification("Or insuffisant !");
        return;
    }

    player.gold -= 60;
    player._shopSpeedBonus = (player._shopSpeedBonus || 0) + 0.3;
    player.speed += 0.3;
    applyBuildStats();

    updateShopGold();
    updateMenuStats();
    
    markPurchasedProduct('speed-upgrade');
    updateMissionByEvent('purchase');
    updateMissionByEvent('upgrade');
    saveGame(true);
    
    showNotification("Vitesse augmentée !");
}

function buyAttackUpgrade() {
    const damageGain = Math.min(5, MAX_PLAYER_ATTACK_DAMAGE - player.attackDamage);
    if (damageGain <= 0) {
        showNotification('Attaque maximale atteinte (100 dégâts).');
        return;
    }

    if (player.gold < 100) {
        showNotification("Or insuffisant !");
        return;
    }

    player.gold -= 100;
    player._shopDamageBonus = Math.min(MAX_PLAYER_ATTACK_DAMAGE,
        (player._shopDamageBonus || 0) + damageGain);
    player.attackDamage = Math.min(MAX_PLAYER_ATTACK_DAMAGE, player.attackDamage + damageGain);
    applyBuildStats();

    updateShopGold();
    updateMenuStats();

    markPurchasedProduct('attack-upgrade');
    updateMissionByEvent('purchase');
    updateMissionByEvent('upgrade');
    saveGame(true);
    
    showNotification("Attaque augmentée !");
}

function buyDefenseUpgrade() {
    const defenseGain = Math.min(0.05, Math.max(0, MAX_PLAYER_DEFENSE - player.defense));
    if (defenseGain <= 1e-9) {
        showNotification("Défense maximale atteinte.");
        return;
    }

    if (player.gold < 150) {
        showNotification("Or insuffisant !");
        return;
    }

    player.gold -= 150;
    player._shopDefenseBonus = (player._shopDefenseBonus || 0) + defenseGain;
    player.defense += defenseGain;
    applyBuildStats();

    updateShopGold();
    updateMenuStats();

    markPurchasedProduct('defense-upgrade');
    updateMissionByEvent('purchase');
    updateMissionByEvent('upgrade');
    saveGame(true);
    
    showNotification("Défense augmentée !");
}

function buySkin(name, price) {

    if (player.ownedSkins.includes(name)) {
        if (player.skin === name) {
            showNotification("Ce skin est déjà équipé.");
            return;
        }
        player.skin = name;
        saveGame(true);
        updateMenuStats();
        updateShopCards();
        showNotification("Skin équipé !");
        return;
    }

    if (player.gold < price) {
        showNotification("Or insuffisant !");
        return;
    }

    player.gold -= price;

    player.ownedSkins.push(name);
    player.skin = name;

    updateShopGold();

    markPurchasedProduct(`skin-${name}`);
    updateMissionByEvent('purchase');
    updateCollectionMissions();
    updateShopCards();
    saveGame(true);

    showNotification("Nouveau skin débloqué !");
}

function buyShopPower(productId, price, collection, powerId, message) {
    if (!['abilities', 'relics'].includes(collection)) return;
    if (purchasedProducts[productId] || player[collection].includes(powerId)) {
        showNotification("Cet artefact est deja acquis !");
        return;
    }
    if (player.gold < price) {
        showNotification("Or insuffisant !");
        return;
    }
    player.gold -= price;
    player[collection].push(powerId);
    markPurchasedProduct(productId);
    updateMissionByEvent('purchase');
    updateCollectionMissions();
    updateShopGold();
    updateMenuStats();
    saveGame(true);
    showNotification(message);
}

function deleteSave() {
    resetGameData();
}

function closeOptions() {
    if (optionsReturnState === 'PAUSED') {
        gameState = 'PAUSED';
        showOverlay('pause-screen');
    } else {
        gameState = 'TITLE';
        showOverlay('title-screen');
    }
}

function resumeGame() {
    enterPlayingState();
}

function returnToTitle() {
    clearChallengeRuntimeState({ keepChallengeConfig: true });
    pendingBossReward = null;
    bossRewardShown = false;
    runTimerRemaining = null;
    currentLevelChallengeSnapshot = [];
    saveGame(true);
    renderPhase3();
    gameState = 'TITLE';
    leavePlayingState();
    showOverlay('title-screen');
}

function updatePauseStats() {
    const wName = worldsData[currentWorldIndex].name.split(':')[0].trim();
    document.getElementById('pause-world-info').innerText = `${wName} | Nv ${currentLevelIndex + 1}`;
    document.getElementById('pause-gold-info').innerText = `${player.gold} 🪙`;
    document.getElementById('pause-score-info').innerText = score;
}

let keys = {};
