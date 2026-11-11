const touchControlKeys = Object.create(null);
const touchControlPointers = new Map();
let gamepadInputState = Object.create(null);
let activeGamepadIndex = null;
let touchParryQueued = false;

function isInputPressed(key) {
    return Boolean(keys[key] || gamepadInputState[key] || touchControlKeys[key] || (key === 'f' && touchParryQueued));
}

function clearGamepadInput() {
    gamepadInputState = Object.create(null);
    activeGamepadIndex = null;
}

function isMoveUpPressed() {
    return isInputPressed('z') || isInputPressed('w') || isInputPressed('arrowup');
}
function isMoveDownPressed() {
    return isInputPressed('s') || isInputPressed('arrowdown');
}
function isMoveLeftPressed() {
    return isInputPressed('q') || isInputPressed('a') || isInputPressed('arrowleft');
}
function isMoveRightPressed() {
    return isInputPressed('d') || isInputPressed('arrowright');
}

function setTouchPointerKey(key, pointerId, pressed) {
    let pointers = touchControlPointers.get(key);
    if (!pointers) {
        pointers = new Set();
        touchControlPointers.set(key, pointers);
    }

    if (pressed) pointers.add(pointerId);
    else pointers.delete(pointerId);

    touchControlKeys[key] = pointers.size > 0;
    if (!pointers.size) touchControlPointers.delete(key);
}

function clearMobileTouchInput() {
    touchControlPointers.clear();
    Object.keys(touchControlKeys).forEach(key => delete touchControlKeys[key]);
    touchParryQueued = false;
    const joystick = document.querySelector('.touch-joystick');
    if (joystick) {
        joystick.style.setProperty('--stick-x', '0px');
        joystick.style.setProperty('--stick-y', '0px');
    }
}

function enableMobileTouchControls() {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const hasTouch = navigator.maxTouchPoints > 0;
    const isIPad = /Mac/i.test(platform) && hasTouch;
    const isMobileAgent = /Android|iPhone|iPad|iPod/i.test(userAgent);
    if (hasTouch && (isMobileAgent || isIPad || navigator.userAgentData?.mobile === true)) {
        document.body.classList.add('mobile-touch-enabled');
    }
}

enableMobileTouchControls();

const MOBILE_GAME_ZOOM = 1.2;
let mobileCanvasScale = 1;

function resizeMobileGameCanvas() {
    const isMobileGame = document.body.classList.contains('game-playing')
        && document.body.classList.contains('mobile-touch-enabled');
    const wrapper = document.querySelector('.canvas-wrapper');
    const bounds = wrapper?.getBoundingClientRect();
    if (isMobileGame && bounds?.width > 0 && bounds?.height > 0) {
        const width = Math.round(bounds.width);
        const height = Math.round(bounds.height);
        const scale = Math.max(width / 800, height / 600) * MOBILE_GAME_ZOOM;
        const cameraWidth = width / scale;
        const cameraHeight = height / scale;
        if (
            canvas.width !== width
            || canvas.height !== height
            || mobileCanvasScale !== scale
            || camera.width !== cameraWidth
            || camera.height !== cameraHeight
        ) {
            canvas.width = width;
            canvas.height = height;
            mobileCanvasScale = scale;
            camera.width = cameraWidth;
            camera.height = cameraHeight;
            camera.x = Math.max(0, Math.min(WORLD_WIDTH - cameraWidth, player.x - cameraWidth / 2));
            camera.y = Math.max(0, Math.min(WORLD_HEIGHT - cameraHeight, player.y - cameraHeight / 2));
        }
        return;
    }

    if (canvas.width !== 800 || canvas.height !== 600 || mobileCanvasScale !== 1) {
        canvas.width = 800;
        canvas.height = 600;
        mobileCanvasScale = 1;
        camera.width = canvas.width;
        camera.height = canvas.height;
        camera.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - camera.width / 2));
        camera.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, player.y - camera.height / 2));
    }
}

const canvasWrapper = document.querySelector('.canvas-wrapper');
if (canvasWrapper && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resizeMobileGameCanvas).observe(canvasWrapper);
}
new MutationObserver(resizeMobileGameCanvas).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});
window.addEventListener('resize', resizeMobileGameCanvas);

function flushActiveGameSave() {
    if (saveWritesAuthorized && !saveGame(true)) {
        console.error('La progression active n’a pas pu être sauvegardée.');
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushActiveGameSave();
});
window.addEventListener('pagehide', flushActiveGameSave);

function toggleGamePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        clearInputState();
        leavePlayingState();
        updatePauseStats();
        showOverlay('pause-screen');
        return true;
    }
    if (gameState === 'PAUSED') {
        resumeGame();
        return true;
    }
    return false;
}

window.addEventListener('keydown', e => {
    const targetControl = e.target instanceof Element
        ? e.target.closest('input, textarea, select, button, a, [contenteditable="true"]')
        : null;
    const controlHasFocus = Boolean(targetControl && targetControl.getClientRects().length);
    const gameHasInputFocus = gameState === 'PLAYING' && !controlHasFocus;

    if (gameHasInputFocus && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
        if (toggleGamePause()) return;
        if (gameState === 'WORLD_SELECT') {
            backFromWorldSelect();
            return;
        } else if (gameState === 'OPTIONS') {
            closeOptions();
            return;
        } else if (gameState === 'MISSIONS') {
            closeMissions();
            return;
        } else if (gameState === 'PHASE3') {
            closePhase3();
            return;
        } else if (gameState === 'BOSS_REWARD') {
            return;
        } else if (gameState === 'SHOP') {
            closeShop();
            return;
        } else if (gameState === 'VICTORY' || gameState === 'GAMEOVER') {
            returnToTitle();
            return;
        }
    }

    if (e.code === 'Space') {
        if (!controlHasFocus && (gameState === 'VICTORY' || gameState === 'GAMEOVER')) {
            returnToTitle();
            return;
        }
    }
    if (!gameHasInputFocus) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys['shift'] = true;
    if (e.code === 'Space') keys['space'] = true;
    if (e.key) keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', e => {
    if (e.code === 'Space') keys['space'] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys['shift'] = false;
    if (e.key) keys[e.key.toLowerCase()] = false;
});

document.querySelectorAll('[data-touch-key]').forEach(button => {
    const key = button.dataset.touchKey;
    const press = event => {
        event.preventDefault();
        if (gameState !== 'PLAYING') return;
        setTouchPointerKey(key, event.pointerId, true);
        if (key === 'f') touchParryQueued = true;
        button.setPointerCapture?.(event.pointerId);
    };
    const release = event => {
        event.preventDefault();
        setTouchPointerKey(key, event.pointerId, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
});

document.querySelector('[data-touch-action="pause"]')?.addEventListener('click', () => {
    if (gameState === 'PLAYING') toggleGamePause();
});

const touchJoystick = document.querySelector('.touch-joystick');
if (touchJoystick) {
    const maxOffset = 41;
    const updateJoystick = event => {
        const bounds = touchJoystick.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance > maxOffset) {
            dx = dx / distance * maxOffset;
            dy = dy / distance * maxOffset;
        }

        touchJoystick.style.setProperty('--stick-x', `${dx}px`);
        touchJoystick.style.setProperty('--stick-y', `${dy}px`);
        const strength = Math.min(1, distance / maxOffset);
        const active = strength >= 0.22 && gameState === 'PLAYING';
        touchControlKeys.arrowleft = active && dx / maxOffset < -0.22;
        touchControlKeys.arrowright = active && dx / maxOffset > 0.22;
        touchControlKeys.arrowup = active && dy / maxOffset < -0.22;
        touchControlKeys.arrowdown = active && dy / maxOffset > 0.22;
    };
    const resetJoystick = event => {
        if (event) event.preventDefault();
        ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].forEach(key => {
            delete touchControlKeys[key];
        });
        touchJoystick.style.setProperty('--stick-x', '0px');
        touchJoystick.style.setProperty('--stick-y', '0px');
    };

    touchJoystick.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (gameState !== 'PLAYING') return;
        touchJoystick.setPointerCapture?.(event.pointerId);
        updateJoystick(event);
    });
    touchJoystick.addEventListener('pointermove', event => {
        if (touchJoystick.hasPointerCapture?.(event.pointerId)) updateJoystick(event);
    });
    touchJoystick.addEventListener('pointerup', resetJoystick);
    touchJoystick.addEventListener('pointercancel', resetJoystick);
    touchJoystick.addEventListener('lostpointercapture', resetJoystick);
}

window.addEventListener('blur', clearInputState);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInputState();
});

function pollGamepad() {
    if (gameState !== 'PLAYING' || document.hidden || !document.hasFocus() || !navigator.getGamepads) {
        clearGamepadInput();
        return;
    }
    const pads = navigator.getGamepads();
    if (!pads) {
        clearGamepadInput();
        return;
    }
    const pad = Array.from(pads).find(gamepad => gamepad && gamepad.connected);
    if (!pad) {
        clearGamepadInput();
        return;
    }
    activeGamepadIndex = pad.index;
    const dead = 0.2;
    const axes = pad.axes || [];
    const buttons = pad.buttons || [];
    gamepadInputState = {
        arrowleft: axes[0] < -dead || Boolean(buttons[14] && buttons[14].pressed),
        arrowright: axes[0] > dead || Boolean(buttons[15] && buttons[15].pressed),
        arrowup: axes[1] < -dead || Boolean(buttons[12] && buttons[12].pressed),
        arrowdown: axes[1] > dead || Boolean(buttons[13] && buttons[13].pressed),
        space: Boolean(buttons[0] && buttons[0].pressed),
        shift: Boolean(buttons[1] && buttons[1].pressed)
    };
}

window.addEventListener('gamepaddisconnected', event => {
    if (event.gamepad.index === activeGamepadIndex) clearGamepadInput();
});

function checkCircleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    let testX = cx, testY = cy;
    if (cx < rx) testX = rx; else if (cx > rx + rw) testX = rx + rw;
    if (cy < ry) testY = ry; else if (cy > ry + rh) testY = ry + rh;
    return ((cx - testX)*(cx - testX) + (cy - testY)*(cy - testY)) <= (cr*cr);
}

function generateDynamicPortalPosition(wallsList, playerStartX, playerStartY, doorW, doorH) {
    let candidatePoints = [
        { x: WORLD_WIDTH - 160, y: WORLD_HEIGHT - 160 },
        { x: WORLD_WIDTH - 160, y: 160 },
        { x: 160, y: WORLD_HEIGHT - 160 },
        { x: WORLD_WIDTH / 2, y: 140 },
        { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 140 },
        { x: 140, y: WORLD_HEIGHT / 2 },
        { x: WORLD_WIDTH - 140, y: WORLD_HEIGHT / 2 },
        { x: 350, y: 350 },
        { x: WORLD_WIDTH - 350, y: WORLD_HEIGHT - 350 }
    ];

    let validCandidates = candidatePoints.filter(p => {
        let distFromPlayer = Math.hypot(p.x - playerStartX, p.y - playerStartY);
        if (distFromPlayer < 450) return false;
        for (let w of wallsList) {
            if (checkCircleRectCollision(p.x, p.y, Math.max(doorW, doorH), w.x, w.y, w.w, w.h)) {
                return false;
            }
        }
        return true;
    });

    if (validCandidates.length > 0) {
        let chosen = validCandidates[Math.floor(getLevelRandom() * validCandidates.length)];
        return { x: chosen.x - doorW/2, y: chosen.y - doorH/2, w: doorW, h: doorH, open: false };
    }

    const fallbackCandidates = [
        { x: WORLD_WIDTH - 150, y: WORLD_HEIGHT - 150 },
        { x: WORLD_WIDTH - 150, y: 150 },
        { x: 150, y: WORLD_HEIGHT - 150 },
        { x: 150, y: WORLD_HEIGHT / 2 }
    ];
    const fallback = fallbackCandidates.find(p =>
        Math.hypot(p.x - playerStartX, p.y - playerStartY) >= 300 &&
        wallsList.every(w => !checkCircleRectCollision(p.x, p.y, Math.max(doorW, doorH), w.x, w.y, w.w, w.h))
    );
    if (fallback) {
        return { x: fallback.x - doorW / 2, y: fallback.y - doorH / 2, w: doorW, h: doorH, open: false };
    }

    for (let y = 120; y < WORLD_HEIGHT - 120; y += 80) {
        for (let x = 120; x < WORLD_WIDTH - 120; x += 80) {
            const clear = Math.hypot(x - playerStartX, y - playerStartY) >= 300 &&
                wallsList.every(w => !checkCircleRectCollision(x, y, Math.max(doorW, doorH), w.x, w.y, w.w, w.h));
            if (clear) {
                return { x: x - doorW / 2, y: y - doorH / 2, w: doorW, h: doorH, open: false };
            }
        }
    }

    for (let y = 60; y <= WORLD_HEIGHT - 60; y += 40) {
        for (let x = 60; x <= WORLD_WIDTH - 60; x += 40) {
            const clear = Math.hypot(x - playerStartX, y - playerStartY) >= 300 &&
                wallsList.every(w => !checkCircleRectCollision(
                    x, y, Math.max(doorW, doorH), w.x, w.y, w.w, w.h
                ));
            if (clear) {
                return { x: x - doorW / 2, y: y - doorH / 2, w: doorW, h: doorH, open: false };
            }
        }
    }
    return null;
}

function isPositionFree(x, y, radius, avoidPlayer = true) {
    if (avoidPlayer && Math.hypot(x - player.x, y - player.y) < 180) return false;
    return walls.every(w => !checkCircleRectCollision(x, y, radius, w.x, w.y, w.w, w.h));
}

function isSpawnClear(x, y, radius, avoidDoor = true) {
    if (!isPositionFree(x, y, radius, true)) return false;
    if (avoidDoor && exitDoor) {
        const doorX = exitDoor.x + exitDoor.w / 2;
        const doorY = exitDoor.y + exitDoor.h / 2;
        if (Math.hypot(x - doorX, y - doorY) < radius + Math.max(exitDoor.w, exitDoor.h) / 2 + 30) return false;
    }
    if (items.some(item => !item.collected && Math.hypot(x - item.x, y - item.y) < radius + item.radius + 25)) {
        return false;
    }
    return enemies.every(enemy => Math.hypot(x - enemy.x, y - enemy.y) >= radius + enemy.radius + 35);
}

function findEnemySpawn(radius, avoidDoor = true) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const x = 80 + getLevelRandom() * (WORLD_WIDTH - 160);
        const y = 80 + getLevelRandom() * (WORLD_HEIGHT - 160);
        if (isSpawnClear(x, y, radius, avoidDoor)) return { x, y };
    }
    const fallbackPositions = [
        { x: WORLD_WIDTH - 140, y: WORLD_HEIGHT - 140 },
        { x: WORLD_WIDTH - 140, y: 140 },
        { x: 140, y: WORLD_HEIGHT - 140 },
        { x: WORLD_WIDTH / 2, y: 140 },
        { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 140 },
        { x: 140, y: WORLD_HEIGHT / 2 }
    ];
    const safeFallback = fallbackPositions.find(position => isSpawnClear(position.x, position.y, radius, avoidDoor));
    if (safeFallback) return safeFallback;
    for (let y = 100; y <= WORLD_HEIGHT - 100; y += 80) {
        for (let x = 100; x <= WORLD_WIDTH - 100; x += 80) {
            if (isSpawnClear(x, y, radius, avoidDoor)) return { x, y };
        }
    }
    return null;
}

function findItemSpawn(originX, originY, radius) {
    const candidates = [{ x: originX, y: originY }];
    for (let distance = 20; distance <= 140; distance += 20) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            candidates.push({
                x: originX + Math.cos(angle) * distance,
                y: originY + Math.sin(angle) * distance
            });
        }
    }
    for (const candidate of candidates) {
        if (isSpawnClear(candidate.x, candidate.y, radius, true)) return candidate;
    }
    return null;
}

function isLevelPointWalkable(x, y, radius = player.radius) {
    return x >= 24 + radius &&
        y >= 24 + radius &&
        x <= WORLD_WIDTH - 24 - radius &&
        y <= WORLD_HEIGHT - 24 - radius &&
        walls.every(w => !checkCircleRectCollision(x, y, radius, w.x, w.y, w.w, w.h));
}

function hasWalkablePath(start, target, radius = player.radius) {
    if (!start || !target || !isLevelPointWalkable(start.x, start.y, radius)
        || !isLevelPointWalkable(target.x, target.y, radius)) return false;
    const step = 50;
    const cols = Math.ceil(WORLD_WIDTH / step);
    const rows = Math.ceil(WORLD_HEIGHT / step);
    const toGrid = point => ({
        x: Math.max(0, Math.min(cols - 1, Math.round(point.x / step))),
        y: Math.max(0, Math.min(rows - 1, Math.round(point.y / step)))
    });
    const startGrid = toGrid(start);
    const targetGrid = toGrid(target);
    const key = (x, y) => `${x}:${y}`;
    const queue = [startGrid];
    const visited = new Set([key(startGrid.x, startGrid.y)]);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
        const current = queue.shift();
        if (current.x === targetGrid.x && current.y === targetGrid.y) return true;
        directions.forEach(([dx, dy]) => {
            const next = { x: current.x + dx, y: current.y + dy };
            if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) return;
            const nextKey = key(next.x, next.y);
            if (visited.has(nextKey)) return;
            const point = { x: next.x * step, y: next.y * step };
            if (!isLevelPointWalkable(point.x, point.y, radius)) return;
            visited.add(nextKey);
            queue.push(next);
        });
    }
    return false;
}

function validateGeneratedLevelLayout() {
    const portal = exitDoor && {
        x: exitDoor.x + exitDoor.w / 2,
        y: exitDoor.y + exitDoor.h / 2
    };
    if (!hasWalkablePath({ x: player.x, y: player.y }, portal)) {
        return { valid: false, reason: 'Le portail est inaccessible depuis le point de départ.' };
    }
    const room = getSecretRoomForLevel(currentWorldIndex, currentLevelIndex);
    if (room) {
        const entrance = getSecretRoomEntrancePoint(room);
        if (entrance && !hasWalkablePath(
            { x: player.x, y: player.y },
            entrance,
            player.radius
        )) {
            console.warn(`Entree de salle secrete non garantie pour ${room.id}; le niveau reste charge.`);
        }
    }
    return { valid: true, reason: '' };
}

const ENEMY_NAVIGATION_CELL_SIZE = 40;
const ENEMY_NAVIGATION_DIRECTIONS = Object.freeze([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
]);
let enemyNavigationRevision = 0;
let enemyNavigationTargetCell = -1;
let enemyNavigationFields = new Map();

function invalidateEnemyNavigation() {
    enemyNavigationRevision++;
    enemyNavigationTargetCell = -1;
    enemyNavigationFields.clear();
}

function isEnemyNavigationPointWalkable(x, y, radius) {
    return x >= 24 + radius &&
        y >= 24 + radius &&
        x <= WORLD_WIDTH - 24 - radius &&
        y <= WORLD_HEIGHT - 24 - radius &&
        !walls.some(wall => checkCircleRectCollision(
            x, y, radius, wall.x, wall.y, wall.w, wall.h
        )) &&
        !levelElements.some(element => element.type === 'lockedDoor' && element.locked
            && checkCircleRectCollision(
                x, y, radius,
                element.x - element.w / 2,
                element.y - element.h / 2,
                element.w,
                element.h
            ));
}

function canEnemyNavigateBetween(start, end, radius) {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / 8));
    for (let step = 1; step <= steps; step++) {
        const ratio = step / steps;
        if (!isEnemyNavigationPointWalkable(
            start.x + (end.x - start.x) * ratio,
            start.y + (end.y - start.y) * ratio,
            radius
        )) return false;
    }
    return true;
}

function getEnemyNavigationField(radius) {
    const columns = Math.ceil(WORLD_WIDTH / ENEMY_NAVIGATION_CELL_SIZE);
    const rows = Math.ceil(WORLD_HEIGHT / ENEMY_NAVIGATION_CELL_SIZE);
    const cellX = Math.max(0, Math.min(columns - 1, Math.floor(player.x / ENEMY_NAVIGATION_CELL_SIZE)));
    const cellY = Math.max(0, Math.min(rows - 1, Math.floor(player.y / ENEMY_NAVIGATION_CELL_SIZE)));
    const targetCell = cellY * columns + cellX;
    if (enemyNavigationTargetCell !== targetCell) {
        enemyNavigationTargetCell = targetCell;
        enemyNavigationFields.clear();
    }

    const cacheKey = `${enemyNavigationRevision}:${radius}`;
    if (enemyNavigationFields.has(cacheKey)) return enemyNavigationFields.get(cacheKey);

    const centers = new Array(columns * rows);
    const walkable = new Uint8Array(columns * rows);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            const index = y * columns + x;
            const center = {
                x: (x + 0.5) * ENEMY_NAVIGATION_CELL_SIZE,
                y: (y + 0.5) * ENEMY_NAVIGATION_CELL_SIZE
            };
            centers[index] = center;
            if (isEnemyNavigationPointWalkable(center.x, center.y, radius)) {
                walkable[index] = 1;
            }
        }
    }

    let start = -1;
    let nearestDistance = Infinity;
    for (let index = 0; index < centers.length; index++) {
        if (!walkable[index]) continue;
        const distance = Math.hypot(centers[index].x - player.x, centers[index].y - player.y);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            start = index;
        }
    }

    const nextCell = new Int32Array(columns * rows);
    nextCell.fill(-1);
    if (start >= 0) {
        const visited = new Uint8Array(columns * rows);
        const queue = new Int32Array(columns * rows);
        let queueStart = 0;
        let queueEnd = 0;
        queue[queueEnd++] = start;
        visited[start] = 1;
        while (queueStart < queueEnd) {
            const current = queue[queueStart++];
            const currentX = current % columns;
            const currentY = Math.floor(current / columns);
            for (const [dx, dy] of ENEMY_NAVIGATION_DIRECTIONS) {
                const nextX = currentX + dx;
                const nextY = currentY + dy;
                if (nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rows) continue;
                const next = nextY * columns + nextX;
                if (visited[next] || !walkable[next]
                    || !canEnemyNavigateBetween(centers[current], centers[next], radius)) continue;
                visited[next] = 1;
                nextCell[next] = current;
                queue[queueEnd++] = next;
            }
        }
    }

    const field = { columns, rows, centers, walkable, nextCell };
    enemyNavigationFields.set(cacheKey, field);
    return field;
}

function findEnemyNavigationCell(field, x, y) {
    const xCell = Math.max(0, Math.min(field.columns - 1, Math.floor(x / ENEMY_NAVIGATION_CELL_SIZE)));
    const yCell = Math.max(0, Math.min(field.rows - 1, Math.floor(y / ENEMY_NAVIGATION_CELL_SIZE)));
    const directIndex = yCell * field.columns + xCell;
    if (field.walkable[directIndex]) return directIndex;

    let nearest = -1;
    let nearestDistance = Infinity;
    for (let index = 0; index < field.centers.length; index++) {
        if (!field.walkable[index]) continue;
        const distance = Math.hypot(field.centers[index].x - x, field.centers[index].y - y);
        if (distance < nearestDistance) {
            nearest = index;
            nearestDistance = distance;
        }
    }
    return nearest;
}

function getEnemySeparationVector(enemy) {
    let x = 0;
    let y = 0;
    enemies.forEach(other => {
        if (other === enemy) return;
        const dx = enemy.x - other.x;
        const dy = enemy.y - other.y;
        const distance = Math.hypot(dx, dy);
        const minimumDistance = enemy.radius + other.radius + 10;
        if (distance >= minimumDistance) return;
        if (distance < 0.001) {
            const angle = ((enemies.indexOf(enemy) + 1) * 2.399 + enemies.indexOf(other)) % (Math.PI * 2);
            x += Math.cos(angle);
            y += Math.sin(angle);
            return;
        }
        const strength = (minimumDistance - distance) / minimumDistance;
        x += dx / distance * strength;
        y += dy / distance * strength;
    });
    const magnitude = Math.hypot(x, y);
    return magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
}

function getEnemySteeringVector(enemy) {
    const navigationField = getEnemyNavigationField(enemy.radius);
    const navigationCell = findEnemyNavigationCell(navigationField, enemy.x, enemy.y);
    const nextCell = navigationCell >= 0 ? navigationField.nextCell[navigationCell] : -1;
    let targetX = player.x;
    let targetY = player.y;
    if (nextCell >= 0) {
        targetX = navigationField.centers[nextCell].x;
        targetY = navigationField.centers[nextCell].y;
    } else if (navigationCell >= 0
        && !canEnemyNavigateBetween(enemy, player, enemy.radius)) {
        targetX = navigationField.centers[navigationCell].x;
        targetY = navigationField.centers[navigationCell].y;
    }

    let angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    if (enemy.enemyType === 'skirmisher' && Math.sin(gameTime + enemy.phase) > 0.3) {
        angle += Math.PI / 2;
    }
    let x = Math.cos(angle);
    let y = Math.sin(angle);
    const separation = getEnemySeparationVector(enemy);
    x += separation.x * 1.5;
    y += separation.y * 1.5;
    const magnitude = Math.hypot(x, y);
    return magnitude > 0 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
}

function moveCircleWithCollision(entity, dx, dy, otherEntities = []) {
    const isBlocked = (x, y) => walls.some(w => checkCircleRectCollision(
        x, y, entity.radius, w.x, w.y, w.w, w.h
    )) || levelElements.some(element => element.type === 'lockedDoor' && element.locked
        && checkCircleRectCollision(x, y, entity.radius, element.x - element.w / 2, element.y - element.h / 2, element.w, element.h))
        || otherEntities.some(other => other !== entity
            && Math.hypot(x - other.x, y - other.y) < entity.radius + other.radius);

    if (isBlocked(entity.x, entity.y)) {
        let recovered = false;
        for (let distance = 6; distance <= 120 && !recovered; distance += 6) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const candidateX = entity.x + Math.cos(angle) * distance;
                const candidateY = entity.y + Math.sin(angle) * distance;
                if (!isBlocked(candidateX, candidateY)) {
                    entity.x = candidateX;
                    entity.y = candidateY;
                    recovered = true;
                    break;
                }
            }
        }
    }

    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 6));
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let step = 0; step < steps; step++) {
        const nextX = entity.x + stepX;
        if (!isBlocked(nextX, entity.y)) {
            entity.x = nextX;
        }

        const nextY = entity.y + stepY;
        if (!isBlocked(entity.x, nextY)) {
            entity.y = nextY;
        }
    }
}

function loadLevel(worldIdx, lvlIdx) {
    const world = worldsData[worldIdx];
    const level = world && world.levels[lvlIdx];
    if (!world || !level) {
        reportRuntimeError(new Error(`Niveau invalide (${worldIdx}-${lvlIdx})`), 'Chargement');
        return false;
    }
    if (activeChallenge === 'daily' && dailyChallenge) {
        const levelSeed = dailyChallenge.seed
            ^ Math.imul(worldIdx + 1, 0x9e3779b1)
            ^ Math.imul(lvlIdx + 1, 0x85ebca6b);
        levelGenerationRandom = createSeededRandom(levelSeed);
    } else {
        levelGenerationRandom = null;
    }

    const previousState = {
        worldIndex: currentWorldIndex,
        levelIndex: currentLevelIndex,
        playerX: player.x,
        playerY: player.y,
        enemies,
        items,
        particles,
        damageTexts,
        walls,
        floorTiles,
        exitDoor,
        levelElements,
        bossTelegraphs,
        portalNotificationShown,
        cameraX: camera.x,
        cameraY: camera.y,
        challengeSnapshot: currentLevelChallengeSnapshot
    };

    const restorePreviousLevel = () => {
        currentWorldIndex = previousState.worldIndex;
        currentLevelIndex = previousState.levelIndex;
        player.x = previousState.playerX;
        player.y = previousState.playerY;
        enemies = previousState.enemies;
        items = previousState.items;
        particles = previousState.particles;
        damageTexts = previousState.damageTexts;
        walls = previousState.walls;
        floorTiles = previousState.floorTiles;
        exitDoor = previousState.exitDoor;
        levelElements = previousState.levelElements;
        bossTelegraphs = previousState.bossTelegraphs;
        portalNotificationShown = previousState.portalNotificationShown;
        camera.x = previousState.cameraX;
        camera.y = previousState.cameraY;
        currentLevelChallengeSnapshot = previousState.challengeSnapshot;
        levelGenerationRandom = null;
        return false;
    };

    currentWorldIndex = worldIdx;
    currentLevelIndex = lvlIdx;
    runTimerRemaining = challengeState['speed-run'] ? SPEED_RUN_LIMIT_SECONDS : null;
    updateRunTimerDisplay();
    player.x = 120;
    player.y = 120;
    resetTransientPlayerState();
    enemies = [];
    items = [];
    particles = [];
    damageTexts = [];
    levelElements = [];
    bossRewardShown = false;
    walls = [];
    floorTiles = [];
    portalNotificationShown = false;

    const tileSize = 60;
    for (let gx = 20; gx < WORLD_WIDTH - 20; gx += tileSize) {
        for (let gy = 20; gy < WORLD_HEIGHT - 20; gy += tileSize) {
            floorTiles.push({
                x: gx,
                y: gy,
                w: tileSize,
                h: tileSize,
                variant: Math.floor(Math.abs(Math.sin(gx * 12.9898 + gy * 78.233)) * 4)
            });
        }
    }

    walls.push({ x: 0, y: 0, w: WORLD_WIDTH, h: 24 });
    walls.push({ x: 0, y: WORLD_HEIGHT - 24, w: WORLD_WIDTH, h: 24 });
    walls.push({ x: 0, y: 0, w: 24, h: WORLD_HEIGHT });
    walls.push({ x: WORLD_WIDTH - 24, y: 0, w: 24, h: WORLD_HEIGHT });

    if (worldIdx === 0) {
        walls.push({ x: 400, y: 300, w: 200, h: 24 });
        walls.push({ x: 800, y: 650, w: 200, h: 24 });
    } else if (worldIdx === 1) {
        walls.push({ x: 350, y: 200, w: 28, h: 220 });
        walls.push({ x: 700, y: 400, w: 220, h: 28 });
        walls.push({ x: 500, y: 600, w: 28, h: 240 });
        walls.push({ x: 900, y: 250, w: 240, h: 28 });
    } else {
        walls.push({ x: 380, y: 280, w: 120, h: 28 });
        walls.push({ x: 800, y: 280, w: 120, h: 28 });
        walls.push({ x: 380, y: 680, w: 120, h: 28 });
        walls.push({ x: 800, y: 680, w: 120, h: 28 });
        walls.push({ x: 600, y: 450, w: 100, h: 100 });
    }

    addSecretRoomWalls(getSecretRoomForLevel(worldIdx, lvlIdx));

    const elementSeed = (worldIdx * 7 + lvlIdx) % 3;
    const trapTypes = worldIdx === 0
        ? ['spikes', 'pressure']
        : worldIdx === 1
            ? ['flame', 'pressure']
            : ['void', 'spikes'];
    levelElements.push({
        type: 'trap',
        trapType: trapTypes[(lvlIdx + elementSeed) % trapTypes.length],
        x: 520 + elementSeed * 90,
        y: 180 + (lvlIdx % 3) * 180,
        w: 86,
        h: 54,
        cooldown: 0,
        warningTimer: 0,
        animation: getLevelRandom() * Math.PI * 2,
        damage: 8 + worldIdx * 5
    });
    if (lvlIdx % 2 === 1 && !level.isBoss) {
        levelElements.push({ type: 'key', x: 1040, y: 500, collected: false, radius: 13 });
        levelElements.push({ type: 'lockedDoor', x: 1080, y: 500, w: 52, h: 90, locked: true });
    } else if (!level.isBoss) {
        levelElements.push({ type: 'lever', x: 720, y: 180, activated: false, radius: 15 });
    }
    invalidateEnemyNavigation();

    exitDoor = generateDynamicPortalPosition(walls, player.x, player.y, 64, 88);
    if (!exitDoor) {
        reportRuntimeError(new Error('Impossible de trouver une position sûre pour le portail'), 'Chargement');
        return restorePreviousLevel();
    }
    let altPositions = [
        { x: WORLD_WIDTH - 180, y: 150 },
        { x: 180, y: WORLD_HEIGHT - 180 },
        { x: WORLD_WIDTH / 2, y: 130 },
        { x: WORLD_WIDTH - 150, y: WORLD_HEIGHT / 2 },
        { x: 150, y: WORLD_HEIGHT / 2 },
        { x: WORLD_WIDTH - 180, y: WORLD_HEIGHT - 180 }
    ];
    let altChoice = altPositions[(lvlIdx + worldIdx * 3) % altPositions.length];
    let okAlt = true;
    if (Math.hypot(altChoice.x - player.x, altChoice.y - player.y) < 450) {
        okAlt = false;
    }
    for (let w of walls) {
        if (checkCircleRectCollision(altChoice.x, altChoice.y, Math.max(exitDoor.w, exitDoor.h), w.x, w.y, w.w, w.h)) okAlt = false;
    }
    if (okAlt) {
        exitDoor.x = altChoice.x - exitDoor.w/2;
        exitDoor.y = altChoice.y - exitDoor.h/2;
    }

    // Le premier niveau doit toujours avoir une sortie prévisible et accessible.
    // Une position fixe évite qu'une génération aléatoire soit refusée au démarrage.
    if (worldIdx === 0 && lvlIdx === 0) {
        exitDoor.x = WORLD_WIDTH - 212;
        exitDoor.y = WORLD_HEIGHT - 204;
    }

    const potionSpawn = findItemSpawn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 11) ||
        findItemSpawn(340, 450, 11);
    if (potionSpawn) {
        items.push({ x: potionSpawn.x, y: potionSpawn.y, type: 'potion', radius: 11, collected: false });
    }

    let lData = level;
    let isBossLvl = lData.isBoss;
    const endlessWave = activeChallenge === 'endless' && endlessModeState.active
        ? endlessModeState.currentWave : 0;
    const endlessTier = Math.max(0, endlessWave - 1);
    const endlessEnemyBonus = Math.min(8, Math.floor(endlessTier / 5));
    const enemyCount = activeChallenge === 'boss-rush'
        ? 1
        : Math.min(12, lData.enemyCount + endlessEnemyBonus);
    const newGamePlusTier = activeChallenge === 'endless' ? 0 : Math.min(newGamePlusLevel, 20);
    const newGamePlusHpMultiplier = 1 + newGamePlusTier * 0.15;
    const newGamePlusDamageMultiplier = 1 + newGamePlusTier * 0.08;
    const newGamePlusGoldMultiplier = (1 + newGamePlusTier * 0.1)
        * (1 + Math.min(7, endlessTier * 0.03));
    const endlessHpMultiplier = 1 + Math.min(7, endlessTier * 0.06);
    const endlessDamageMultiplier = 1 + Math.min(3, endlessTier * 0.025);
    const endlessSpeedMultiplier = 1 + Math.min(0.75, endlessTier * 0.005);
    for (let i = 0; i < enemyCount; i++) {
        let isBoss = isBossLvl && i === 0;
        const enemyRadius = isBoss ? (lData.bossType === 2 ? 46 : (lData.bossType === 1 ? 42 : 38)) : 16;
        const spawn = findEnemySpawn(enemyRadius);
        if (!spawn) {
            reportRuntimeError(new Error('Impossible de trouver une position sûre pour un ennemi'), 'Chargement');
            return restorePreviousLevel();
        }
        const dailyModifiers = activeChallenge === 'daily' ? getCurrentDailyChallengeModifiers() : [];
        const isElite = !isBoss && dailyModifiers.includes('elite');
        const dailyHpMultiplier = dailyModifiers.includes('armored') ? 1.25 : 1;
        const dailySpeedMultiplier = dailyModifiers.includes('swift') ? 1.18 : 1;
        const dailyDamageMultiplier = dailyModifiers.includes('fury') ? 1.2 : 1;
        const dailyEliteMultiplier = isElite ? 1.15 : 1;
        const enemySpeed = isBoss
            ? lData.enemySpeed * (lData.bossType === 2 ? 1.15 : 0.95)
            : lData.enemySpeed + (getLevelRandom() * 0.15);
        const goldValue = Math.floor((isBoss
            ? lData.goldDrop
            : lData.goldDrop * (0.8 + getLevelRandom() * 0.4))
            * newGamePlusGoldMultiplier
            * (player.relics.includes('fortune') ? 1.25 : 1));
        const enemyType = isBoss
            ? 'boss'
            : ['chaser', 'skirmisher', 'brute', 'sentinel'][Math.floor(getLevelRandom() * (getDifficultyMultiplier() > 1.2 ? 4 : 3))];
        const enemyPhase = getLevelRandom() * Math.PI * 2;
        enemies.push({
            x: spawn.x,
            y: spawn.y,
            radius: enemyRadius,
            hp: Math.floor(lData.enemyHp * getDifficultyMultiplier() * dailyHpMultiplier * newGamePlusHpMultiplier * endlessHpMultiplier),
            maxHp: Math.floor(lData.enemyHp * getDifficultyMultiplier() * dailyHpMultiplier * newGamePlusHpMultiplier * endlessHpMultiplier),
            speed: enemySpeed * getDifficultyMultiplier() * dailySpeedMultiplier * dailyEliteMultiplier * endlessSpeedMultiplier,
            damage: Math.floor((isBoss ? (lData.bossType === 2 ? 28 : (lData.bossType === 1 ? 24 : 18)) : 8) * lData.damageMult * getDifficultyMultiplier() * dailyDamageMultiplier * dailyEliteMultiplier * newGamePlusDamageMultiplier * endlessDamageMultiplier),
            goldValue,
            isBoss: isBoss,
            isElite,
            bossType: lData.bossType,
            enemyType,
            statusEffects: {},
            telegraph: null,
            bossPhase: isBoss ? 1 : 0,
            bossName: lData.bossName,
            attackCd: 0,
            specialCd: enemyType === 'sentinel' ? 100 : 0,
            sentinelChargeTimer: 0,
            phase: enemyPhase
        });
    }

    const layoutValidation = validateGeneratedLevelLayout();
    if (!layoutValidation.valid) {
        reportRuntimeError(new Error(layoutValidation.reason), 'Validation du niveau');
        return restorePreviousLevel();
    }

    currentLevelChallengeSnapshot = activeChallenge === null
        ? OPTIONAL_CHALLENGE_IDS.filter(id => challengeState[id] === true)
        : [];
    document.getElementById('world-display').innerText = activeChallenge === 'endless'
        ? `SANS FIN · VAGUE ${endlessWave} | ${world.name.split(':')[0]} · Nv ${lvlIdx + 1}/${world.levels.length}`
        : `${world.name.split(':')[0]}${newGamePlusLevel ? ` · NG+ ${newGamePlusLevel}` : ''} | Nv ${lvlIdx + 1}/${world.levels.length}`;
    playWorldCue(worldIdx, Boolean(level.isBoss));
    resetCameraToPlayer();
    return true;
}

function spawnParticles(x, y, color, count = 10) {
    if (!settings.showParticles) return;
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 3.5 + 1;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            color,
            radius: Math.random() * 3 + 1
        });
    }
}

function unlockNextProgression(wIdx, lIdx) {
    let world = worldsData[wIdx];
    if (!world) return;
    let nextLIdx = lIdx + 1;
    let nextWIdx = wIdx;
    if (nextLIdx >= world.levels.length) {
        nextLIdx = 0;
        nextWIdx = wIdx + 1;
    }
    if (nextWIdx >= worldsData.length) {
        maxUnlockedWorld = worldsData.length - 1;
        maxUnlockedLevel = worldsData[maxUnlockedWorld].levels.length - 1;
        return;
    }
    if (nextWIdx > maxUnlockedWorld) {
        maxUnlockedWorld = nextWIdx;
        maxUnlockedLevel = 0;
    } else if (nextWIdx === maxUnlockedWorld && nextLIdx > maxUnlockedLevel) {
        maxUnlockedLevel = nextLIdx;
    }
}

function offerProgressionChoice() {
    const options = [
        { id: 'precision', label: 'Précision : +12% de chances de coup critique' },
        { id: 'ember', label: 'Embrasement : vos coups appliquent un dégât sur la durée' },
        { id: 'frost', label: 'Relique de givre : vos coups ralentissent les ennemis' },
        { id: 'ward', label: 'Égide : les pièges infligent 3 dégâts de moins' },
        { id: 'leech', label: 'Relique sanguinaire : récupérez 4% des dégâts infligés en PV' },
        { id: 'fortune', label: 'Idole dorée : obtenez 25% d’or supplémentaire' },
        { id: 'shell', label: 'Cœur de pierre : subissez 10% de dégâts en moins' }
    ];
    const available = options.filter(option => !player.abilities.includes(option.id) && !player.relics.includes(option.id));
    if (!available.length) return;
    const choice = available[(currentWorldIndex + currentLevelIndex + player.abilities.length) % available.length];
    if (choice.id === 'frost' || choice.id === 'ward') player.relics.push(choice.id);
    else player.abilities.push(choice.id);
    showNotification(`✨ Choix de progression : ${choice.label}`, 4200);
    playCue('reward');
    saveGame();
}

function update(frameScale = 1) {
    if (gameState !== 'PLAYING') return;
    if (!document.hidden && document.hasFocus()) {
        playTimeRemainder += frameScale;
        if (playTimeRemainder >= 60) {
            const previousSeconds = phase3Stats.playSeconds;
            const elapsedSeconds = Math.floor(playTimeRemainder / 60);
            phase3Stats.playSeconds += elapsedSeconds;
            playTimeRemainder %= 60;
            if (Math.floor(previousSeconds / 5) !== Math.floor(phase3Stats.playSeconds / 5)) saveGame();
        }
    }
    gameTime += 0.05 * frameScale;
    if (challengeState['speed-run'] && runTimerRemaining !== null) {
        runTimerRemaining = Math.max(0, runTimerRemaining - frameScale / 60);
        updateRunTimerDisplay();
        if (runTimerRemaining === 0) {
            phase3Stats.deaths++;
            gameState = 'GAMEOVER';
            clearInputState();
            leavePlayingState();
            document.querySelector('#gameover-screen .gameover-title').textContent = 'TEMPS ÉCOULÉ !';
            document.querySelector('#gameover-screen .gameover-subtitle').textContent = 'La limite du Speed-run est atteinte pour ce niveau.';
            document.getElementById('gameover-world').textContent = `Monde : ${currentWorldIndex + 1}`;
            document.getElementById('gameover-level').textContent = `Niveau : ${currentLevelIndex + 1}`;
            document.getElementById('gameover-gold').textContent = `Or : ${player.gold} 🪙`;
            document.getElementById('gameover-score').textContent = `Score : ${score}`;
            showOverlay('gameover-screen');
            return;
        }
    }


    let targetCamX = player.x - camera.width / 2;
    let targetCamY = player.y - camera.height / 2;
    camera.x += (targetCamX - camera.x) * camera.lerp;
    camera.y += (targetCamY - camera.y) * camera.lerp;

    camera.x = Math.max(0, Math.min(WORLD_WIDTH - camera.width, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - camera.height, camera.y));

    if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - frameScale);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - frameScale);
    if (player.dashInvulnerability > 0) player.dashInvulnerability = Math.max(0, player.dashInvulnerability - frameScale);
    if (player.parryTimer > 0) player.parryTimer = Math.max(0, player.parryTimer - frameScale);
    if (player.swingTimer > 0) player.swingTimer = Math.max(0, player.swingTimer - frameScale);
    else player.isSwinging = false;

    if (player.isDashing) {
        let dashSpeed = 13 * (player._buildDashSpeedMultiplier || 1);
        moveCircleWithCollision(
            player,
            player.facing.x * dashSpeed * frameScale,
            player.facing.y * dashSpeed * frameScale
        );

        player.dashTimer -= frameScale;
        spawnParticles(player.x, player.y, '#66fcf1', Math.max(1, Math.round(2 * frameScale)));
        if (player.dashTimer <= 0) player.isDashing = false;
    } else {
        let moveX = 0, moveY = 0;
        if (isMoveUpPressed()) moveY -= 1;
        if (isMoveDownPressed()) moveY += 1;
        if (isMoveLeftPressed()) moveX -= 1;
        if (isMoveRightPressed()) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
            let len = Math.hypot(moveX, moveY);
            player.facing.x = moveX / len;
            player.facing.y = moveY / len;

            moveCircleWithCollision(
                player,
                player.facing.x * player.speed * frameScale,
                player.facing.y * player.speed * frameScale
            );
        }

        if (isInputPressed('shift') && !shiftWasDown && player.dashCooldown === 0) {
            player.isDashing = true;
            player.dashTimer = 8;
            player.dashCooldown = 55;
            player.dashInvulnerability = 12;
            playCue('dash');
        }
    }

    if (isInputPressed('f') && !parryWasDown && !player.isDashing) {
        player.parryTimer = 10;
        playCue('parry');
    }
    if (isInputPressed('space') && !player.isDashing) player.attackCharge = Math.min(36, player.attackCharge + frameScale);
    if (!isInputPressed('space') && player.attackCharge > 0 && player.attackCooldown === 0 && !player.isDashing) {
        const charged = player.attackCharge >= 24;
        player.attackCharge = 0;
        player.attackCooldown = charged ? 24 : 18;
        player.isSwinging = true;
        player.swingTimer = charged ? 15 : 11;
        
        let aimAngle = Math.atan2(player.facing.y, player.facing.x);
        spawnParticles(
            player.x + Math.cos(aimAngle) * 35, 
            player.y + Math.sin(aimAngle) * 35, 
            '#66fcf1', 
            10
        );

        enemies.forEach(e => {
            let dist = Math.hypot(e.x - player.x, e.y - player.y);
            if (dist <= player.attackRange + e.radius) {
                let angleToEnemy = Math.atan2(e.y - player.y, e.x - player.x);
                let diffAngle = Math.abs(aimAngle - angleToEnemy);
                while (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;

                if (diffAngle <= player.attackArc / 2 + 0.45) {
                    const critical = getLevelRandom() < (player.abilities.includes('precision') ? 0.22 : 0.1);
                    const actualDmg = Math.min(Math.max(0, e.hp), player.attackDamage * (charged ? 1.7 : 1) * (critical ? 2 : 1));
                    e.hp -= actualDmg;
                    if (player.relics.includes('leech')) {
                        player.hp = Math.min(player.maxHp, Math.round(player.hp + actualDmg * 0.04));
                    }
                    phase3Stats.damageDealt += actualDmg;
                    e.statusEffects = e.statusEffects || {};
                    if (player.abilities.includes('ember')) e.statusEffects.burn = 100;
                    if (player.relics.includes('frost')) e.statusEffects.slow = 75;
                    spawnDamageText(e.x, e.y - e.radius - 10, actualDmg, critical ? '#ffffff' : '#f9d342');
                    playCue(critical ? 'critical' : 'hit', critical ? 1.25 : 1);
                    score += Math.floor(actualDmg * (1 + currentWorldIndex * 0.5));
                    spawnParticles(e.x, e.y, '#e74c3c', 7);
                }
            }
        });
    }

    enemies.forEach(e => {
        e.previousX = e.x;
        e.previousY = e.y;
        if (e.attackCd > 0) e.attackCd = Math.max(0, e.attackCd - frameScale);
        if (e.specialCd > 0) e.specialCd = Math.max(0, e.specialCd - frameScale);
        if (e.stagger > 0) e.stagger = Math.max(0, e.stagger - frameScale);

        e.statusEffects = e.statusEffects || {};
        if (e.statusEffects.burn > 0) {
            e.statusEffects.burn -= frameScale;
            const burnDamage = Math.min(Math.max(0, e.hp), 0.12 * frameScale);
            e.hp -= burnDamage;
            phase3Stats.damageDealt += burnDamage;
        }
        if (e.statusEffects.slow > 0) e.statusEffects.slow -= frameScale;
        let speedMult = 1;
        if (e.stagger > 0) speedMult = 0;
        if (e.statusEffects.slow > 0) speedMult *= 0.55;
        if (e.enemyType === 'skirmisher' && Math.sin(gameTime + e.phase) > 0.3) speedMult *= 0.8;
        if (e.enemyType === 'brute') speedMult *= 0.7;
        if (e.enemyType === 'sentinel') {
            if (e.specialCd === 0 && e.sentinelChargeTimer === 0) {
                e.sentinelChargeTimer = 22;
                e.specialCd = 130;
            }
            if (e.sentinelChargeTimer > 0) {
                speedMult *= 1.7;
                e.sentinelChargeTimer = Math.max(0, e.sentinelChargeTimer - frameScale);
            } else {
                speedMult *= 0.72;
            }
        }
        if (e.isBoss && e.bossType === 2 && e.specialCd > 90) {
            speedMult = 1.9;
        }
        const steering = getEnemySteeringVector(e);
        moveCircleWithCollision(
            e,
            steering.x * e.speed * speedMult * frameScale,
            steering.y * e.speed * speedMult * frameScale,
            enemies
        );

        if (e.isBoss) {
            const hpRatio = e.hp / e.maxHp;
            const nextPhase = hpRatio <= 0.66 ? (hpRatio <= 0.33 ? 3 : 2) : 1;
            if (e.bossPhase !== nextPhase) {
                e.bossPhase = nextPhase;
                e.specialCd = 30;
                bossTelegraphs.push({ x: e.x, y: e.y, radius: 120 + nextPhase * 18, life: 45, color: '#e056fd', damage: e.damage * 0.8, delay: 28 });
                playCue('bossPhase');
                showNotification(`${e.bossName || 'Le boss'} entre en phase ${nextPhase} !`, 2200);
            }
        }
        if (e.isBoss && e.specialCd === 0) {
            if (e.bossType === 1) {
                let distP = Math.hypot(player.x - e.x, player.y - e.y);
                if (distP < 140) {
                    bossTelegraphs.push({ x: player.x, y: player.y, radius: 72, life: 24, color: '#9b59b6', damage: e.damage, delay: 12, resetCombo: true });
                    playCue('bossAttack');
                }
                e.specialCd = 130;
            } else if (e.bossType === 2) {
                e.specialCd = 120;
            }
        }

        let distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
        let meleeRange = player.radius + e.radius + (e.isBoss ? 10 : 0);
        if (distToPlayer < meleeRange && e.attackCd === 0) {
            if (!player.isDashing && player.dashInvulnerability <= 0) {
                if (player.parryTimer > 0) {
                    e.stagger = 35;
                    e.attackCd = 45;
                    spawnDamageText(e.x, e.y - e.radius - 10, 'PARRY', '#66fcf1');
                    playCue('parry');
                    return;
                }
                const finalDamage = receiveDamage(e.damage);
                consecutiveMonsterKills = 0;
                spawnDamageText(player.x, player.y - player.radius - 10, finalDamage, '#e74c3c');
                e.attackCd = e.isBoss ? 35 : 50;
                spawnParticles(player.x, player.y, '#e74c3c', 12);
            }
        }
    });

    levelElements.forEach(element => {
        if (element.type === 'trap') {
            element.cooldown = Math.max(0, (element.cooldown || 0) - frameScale);
            element.animation = (element.animation || 0) + 0.12 * frameScale;
            const insideTrap = checkCircleRectCollision(
                player.x,
                player.y,
                player.radius,
                element.x - element.w / 2,
                element.y - element.h / 2,
                element.w,
                element.h
            );
            if (insideTrap && element.cooldown === 0 && element.warningTimer === 0) {
                element.warningTimer = 18;
                playCue('trapWarning', 0.8);
            }
            if (element.warningTimer > 0) {
                element.warningTimer = Math.max(0, element.warningTimer - frameScale);
                if (element.warningTimer === 0 && insideTrap) {
                    spawnParticles(element.x, element.y, element.trapType === 'flame' ? '#ff8c42' : '#e74c3c', 18);
                }
            }
            if (element.cooldown === 0 && element.warningTimer === 0 && insideTrap) {
                if (player.dashInvulnerability <= 0) {
                    const damage = receiveDamage(Math.max(1, element.damage - (player.relics.includes('ward') ? 3 : 0)));
                    element.cooldown = element.trapType === 'flame' ? 36 : 52;
                    spawnDamageText(player.x, player.y - 24, damage, '#e74c3c');
                    playCue('trap');
                    spawnParticles(player.x, player.y, '#e74c3c', 12);
                }
            }
        } else if (element.type === 'key' && !element.collected && Math.hypot(player.x - element.x, player.y - element.y) < 30) {
            element.collected = true;
            showNotification('🗝️ Clé trouvée : une porte alternative est ouverte.', 2500);
            const door = levelElements.find(item => item.type === 'lockedDoor');
            if (door) {
                door.locked = false;
                invalidateEnemyNavigation();
            }
        } else if (element.type === 'lever' && isInputPressed('e') && !interactWasDown
            && !element.activated && Math.hypot(player.x - element.x, player.y - element.y) < 45) {
            element.activated = true;
            enemies.forEach(enemy => enemy.speed *= 0.8);
            showNotification('⚙️ Levier activé : les ennemis sont ralentis.', 2500);
        }
    });
    bossTelegraphs.forEach(t => {
        t.life -= frameScale;
        if (!t.hit && t.delay !== undefined && t.life <= t.delay
            && Math.hypot(player.x - t.x, player.y - t.y) <= t.radius
            && player.dashInvulnerability <= 0 && player.parryTimer <= 0) {
            const finalDamage = receiveDamage(t.damage);
            if (t.resetCombo) consecutiveMonsterKills = 0;
            t.hit = true;
            spawnDamageText(player.x, player.y - 24, finalDamage, '#e74c3c');
            spawnParticles(player.x, player.y, t.color, 16);
        }
    });
    bossTelegraphs = bossTelegraphs.filter(t => t.life > 0);

    let prevCount = enemies.length;
    enemies = enemies.filter(e => {
        if (e.hp <= 0) {
            bestiary[e.enemyType || (e.isBoss ? 'boss' : 'unknown')] = (bestiary[e.enemyType || (e.isBoss ? 'boss' : 'unknown')] || 0) + 1;
            updateGameCompletionDisplay();
            if (!e.isBoss) {
                recordMonsterDefeat();
            }
            if (e.isBoss) {
                recordDefeatedBoss(currentWorldIndex);
                if (activeChallenge === 'boss-rush' && bossRushState) {
                    if (!bossRushState.bossesDefeated.includes(currentWorldIndex)) {
                        bossRushState.bossesDefeated.push(currentWorldIndex);
                    }
                } else if (!bossRewardShown) {
                    bossRewardShown = true;
                    const reward = grantBossRewards(currentWorldIndex);
                    if (reward) {
                        spawnParticles(e.x, e.y, '#f9d342', 40);
                        showBossRewardScreen(reward);
                    } else if (claimedBossRewards.includes(currentWorldIndex)) {
                        showNotification('Boss vaincu : récompense déjà récupérée.', 3500);
                    }
                }
            }
            score += Math.floor(e.maxHp * (e.isBoss ? 8 : 4));
            spawnParticles(e.x, e.y, '#f9d342', 24);
            items.push({
                x: e.x,
                y: e.y,
                type: 'gold',
                value: e.goldValue,
                radius: 8,
                collected: false
            });
            if (getLevelRandom() < 0.25) {
                items.push({ x: e.x, y: e.y, type: 'potion', radius: 11, collected: false });
            }
            return false;
        }
        return true;
    });
    if (gameState !== 'PLAYING') return;

    let wasDoorOpen = exitDoor ? exitDoor.open : false;
    if (exitDoor) {
        exitDoor.open = (enemies.length === 0);
    }

    if (exitDoor && !wasDoorOpen && exitDoor.open && prevCount > 0) {
        portalNotificationShown = true;
        let isBossFloor = worldsData[currentWorldIndex].levels[currentLevelIndex].isBoss;
        showNotification(isBossFloor ? "BOSS VAINCU — Portail vers le monde suivant ouvert !" : "PORTAIL OUVERT — La porte vers le niveau suivant est accessible !");
        spawnParticles(exitDoor.x + exitDoor.w/2, exitDoor.y + exitDoor.h/2, '#66fcf1', 30);
        saveGame();
    }

    items.forEach(item => {
        if (!item.collected) {
            let dist = Math.hypot(player.x - item.x, player.y - item.y);
            if (dist < player.radius + item.radius) {
                item.collected = true;
                if (item.type === 'gold') {
                    player.gold += item.value;
                    score += item.value * 2;
                    updateMissionByEvent('goldCollected');
                    spawnParticles(item.x, item.y, '#f9d342', 10);
                    saveGame(true);
                } else if (item.type === 'potion') {
                    if (challengeState['no-potion']) {
                        item.collected = false;
                    } else {
                        const healing = activeChallenge === 'daily'
                            && getCurrentDailyChallengeModifiers().includes('scarce-healing') ? 22 : 45;
                        player.hp = Math.min(player.maxHp, player.hp + healing);
                        spawnParticles(item.x, item.y, '#2ecc71', 14);
                    }
                }
            }
        }
    });

    if (exitDoor && exitDoor.open) {
        let distExit = Math.hypot(player.x - (exitDoor.x + exitDoor.w/2), player.y - (exitDoor.y + exitDoor.h/2));
        if (distExit < 50) {
            score += Math.floor(player.hp * 5) + (currentWorldIndex + 1) * 200;
            if (activeChallenge === 'endless') {
                if (!advanceEndlessWave()) return;
                return;
            }
            if (activeChallenge === 'boss-rush' && bossRushState) {
                const nextBoss = bossRushState.bossOrder[bossRushState.bossesDefeated.length];
                if (nextBoss) {
                    if (!loadLevel(nextBoss.worldIndex, nextBoss.levelIndex)) {
                        returnToTitle();
                        showNotification('Le Boss-Rush a été interrompu : impossible de charger le boss suivant.');
                        return;
                    }
                    showNotification(`Boss ${bossRushState.bossesDefeated.length + 1} / ${bossRushState.bossOrder.length} : ${worldsData[nextBoss.worldIndex].levels[nextBoss.levelIndex].bossName}`);
                    saveGame(true);
                    return;
                }
                if (bossRushState.bossesDefeated.length === bossRushState.bossOrder.length) {
                    player.gold += bossRushState.bonusGold;
                    phase3Stats.victories++;
                    phase3Stats.bossRushWins++;
                    phase3Stats.bestScore = Math.max(phase3Stats.bestScore, score);
                    updateGameCompletionDisplay();
                    bossRushState.active = false;
                    bossRushState.completed = true;
                    activeChallenge = null;
                    saveGame(true);
                    leavePlayingState();
                    showVictoryScreen();
                    return;
                }
                reportRuntimeError(new Error('Progression Boss-Rush incohérente : boss vaincu manquant'), 'Boss-Rush');
                returnToTitle();
                return;
            }
            const completedWorld = currentWorldIndex;
            const completedLevel = currentLevelIndex;
            recordCompletedLevel(completedWorld, completedLevel);
            unlockNextProgression(currentWorldIndex, currentLevelIndex);
            if (completedWorld === 0 && completedLevel === worldsData[completedWorld].levels.length - 1) {
                updateMissionByEvent('worldTwoUnlocked');
            }
            if (completedLevel === worldsData[completedWorld].levels.length - 1) {
                worldCompletionSkins[completedWorld] = player.skin;
                updateMissionProgress('rainbow-worlds', Object.keys(worldCompletionSkins).length, 'set');
                const worldMissionIds = ['sanctuary-of-dawn', 'obsidian-crypt', 'void-throne'];
                updateMissionProgress(worldMissionIds[completedWorld], 1, 'set');
            }
            updateSecondaryMissionMilestones();
            let world = worldsData[currentWorldIndex];
            offerProgressionChoice();
            saveGame();
            if (currentLevelIndex < world.levels.length - 1) {
                if (!loadLevel(currentWorldIndex, currentLevelIndex + 1)) {
                    gameState = 'TITLE';
                    leavePlayingState();
                    showOverlay('title-screen');
                }
            } else if (currentWorldIndex < worldsData.length - 1) {
                if (!loadLevel(currentWorldIndex + 1, 0)) {
                    gameState = 'TITLE';
                    leavePlayingState();
                    showOverlay('title-screen');
                }
            } else {
                phase3Stats.victories++;
                phase3Stats.bestScore = Math.max(phase3Stats.bestScore, score);
                if (newGamePlusRunActive) {
                    updateMissionProgress('new-game-plus-master', 1, 'set');
                    updateSecondaryMissionMilestones();
                }
                newGamePlusUnlocked = true;
                newGamePlusRunActive = false;
                if (activeChallenge === 'daily') {
                    phase3Stats.dailyWins++;
                    updateMissionProgress('daily-seed-master', 1, 'set');
                    updateSecondaryMissionMilestones();
                }
                if (activeChallenge === 'boss-rush') phase3Stats.bossRushWins++;
                finishDailyChallenge('victory');
                updateGameCompletionDisplay();
                activeChallenge = null;
                saveGame(true);
                leavePlayingState();
                showCreditsScreen();
            }
        }
    }

    updateSecretRoomDiscovery();

    particles.forEach(p => {
        p.x += p.vx * frameScale;
        p.y += p.vy * frameScale;
        p.alpha -= 0.03 * frameScale;
    });
    particles = particles.filter(p => p.alpha > 0);
    damageTexts.forEach(text => {
        text.y -= 0.7 * frameScale;
        text.life -= frameScale;
        text.alpha = Math.max(0, text.life / 36);
    });
    damageTexts = damageTexts.filter(text => text.life > 0);
    shiftWasDown = isInputPressed('shift');
    interactWasDown = isInputPressed('e');
    parryWasDown = isInputPressed('f');
    touchParryQueued = false;

    if (player.hp <= 0) {
        player.hp = 0;
        finishDailyChallenge('defeat');
        const endedEndlessRun = activeChallenge === 'endless' && endlessModeState.active;
        if (endedEndlessRun) {
            endlessModeState.bestWave = Math.max(endlessModeState.bestWave, endlessModeState.currentWave);
            endlessModeState.lastRunWave = endlessModeState.currentWave;
            endlessModeState.bestScore = Math.max(endlessModeState.bestScore, Math.floor(score));
            endlessModeState.active = false;
            endlessModeState.currentWave = 0;
            endlessRunEnded = true;
            activeChallenge = null;
            updateGameCompletionDisplay();
        } else {
            endlessRunEnded = false;
        }
        phase3Stats.deaths++;
        gameState = 'GAMEOVER';
        clearInputState();
        leavePlayingState();
        document.querySelector('#gameover-screen .gameover-title').textContent =
            endedEndlessRun ? 'FIN DU MODE SANS FIN' : 'GAME OVER';
        document.querySelector('#gameover-screen .gameover-subtitle').textContent = endedEndlessRun
            ? `Vous avez atteint la vague ${endlessModeState.lastRunWave}. Meilleure série nettoyée : ${endlessModeState.bestClearedWave}.`
            : "Votre aventure s'arrête ici...";
        document.getElementById("gameover-world").textContent = endedEndlessRun
            ? `Vague atteinte : ${endlessModeState.lastRunWave}`
            : `Monde : ${currentWorldIndex + 1}`;
        document.getElementById("gameover-level").textContent = endedEndlessRun
            ? `Vague nettoyée : ${endlessModeState.bestClearedWave}`
            : `Niveau : ${currentLevelIndex + 1}`;
        document.getElementById("gameover-gold").textContent =
            `Or : ${player.gold} 🪙`;
        document.getElementById("gameover-score").textContent =
            `Score : ${score}`;
        const shareButton = document.getElementById('gameover-share-result-btn');
        if (shareButton) shareButton.hidden = !dailyChallenge || !dailyChallenge.result;
        const retryButton = document.getElementById('retry-btn');
        if (retryButton) retryButton.textContent = endedEndlessRun ? 'Recommencer sans fin ↻' : 'Réessayer 🔄';
        if (endedEndlessRun) saveGame(true);
        showOverlay("gameover-screen");
    }

    let hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    document.getElementById('hp-bar-fill').style.width = hpPercent + '%';
    document.getElementById('hp-display').innerText = formatPlayerHealth();
    document.getElementById('gold-display').innerText = `${player.gold} 🪙`;
    document.getElementById('score-display').innerText = score;
    document.getElementById('enemies-display').innerText = enemies.length;

    let activeBoss = enemies.find(e => e.isBoss);
    let bossUI = document.getElementById('boss-ui-container');
    if (activeBoss) {
        bossUI.classList.add('active');
        document.getElementById('boss-ui-name').innerText = activeBoss.bossName || 'BOSS FINAL';
        let bHpPct = Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100);
        document.getElementById('boss-hp-bar-fill').style.width = bHpPct + '%';
        document.getElementById('boss-hp-display').innerText = `${Math.max(0, Math.floor(activeBoss.hp))}/${activeBoss.maxHp}`;
    } else {
        bossUI.classList.remove('active');
    }
}

function drawMysticPortal(door) {
    ctx.save();
    let cx = door.x + door.w / 2;
    let cy = door.y + door.h / 2;
    let isOpen = door.open;

    ctx.save();
    ctx.translate(cx, cy);
    let auraGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, isOpen ? 65 : 25);
    if (isOpen) {
        auraGrad.addColorStop(0, 'rgba(102, 252, 241, 0.55)');
        auraGrad.addColorStop(0.5, 'rgba(69, 162, 158, 0.25)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
        auraGrad.addColorStop(0, 'rgba(231, 76, 60, 0.2)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, isOpen ? 65 : 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isOpen ? '#66fcf1' : '#455a64';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, door.w * 0.46, 0, Math.PI * 2);
    ctx.stroke();

    if (isOpen) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(gameTime * 1.6);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, door.w * 0.36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, door.w * 0.3, door.h * 0.3, 0, 0, Math.PI * 2);
    ctx.clip();

    if (isOpen) {
        let vortexGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, door.w * 0.35);
        vortexGrad.addColorStop(0, '#ffffff');
        vortexGrad.addColorStop(0.25, '#66fcf1');
        vortexGrad.addColorStop(0.65, '#1f4068');
        vortexGrad.addColorStop(1, '#0b0c10');
        ctx.fillStyle = vortexGrad;
        ctx.fillRect(door.x, door.y, door.w, door.h);

        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(gameTime * (2 + i * 0.5) + i * (Math.PI / 2));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(door.w * 0.32, 0);
            ctx.stroke();
            ctx.restore();
        }

        let orbAngle = gameTime * 3;
        let ox = cx + Math.cos(orbAngle) * 11;
        let oy = cy + Math.sin(orbAngle) * 11;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(door.x, door.y, door.w, door.h);
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 12);
        ctx.lineTo(cx + 12, cy + 12);
        ctx.moveTo(cx + 12, cy - 12);
        ctx.lineTo(cx - 12, cy + 12);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isOpen ? '#66fcf1' : '#37474f';
    ctx.lineWidth = 3;
    ctx.strokeRect(door.x, door.y, door.w, door.h);

    if (isOpen) {
        ctx.shadowColor = '#66fcf1';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(door.x + 5, door.y + 5, door.w - 10, door.h - 10);
    } else {
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 2;
        ctx.strokeRect(door.x + 4, door.y + 4, door.w - 8, door.h - 8);
    }
    ctx.restore();
    ctx.restore();
}

function draw() {
    // Chaque frame repart d'un contexte propre : une transformation ou un clip
    // Un etat residuel d'une frame precedente ne peut plus masquer le niveau.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'TITLE') {
        ctx.fillStyle = '#060709';
        ctx.fillRect(
            0, 
            0, 
            canvas.width, 
            canvas.height
        );
        return;
    }

    const currentWorld = worldsData[currentWorldIndex];
    if (!currentWorld) {
        reportRuntimeError(new Error(`Monde invalide (${currentWorldIndex})`), 'Rendu');
        return;
    }
    let theme = currentWorld.theme;

    ctx.save();
    ctx.scale(mobileCanvasScale, mobileCanvasScale);
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    // Fond de secours : le terrain reste visible m?me si un ?l?ment dynamique ?choue.
    ctx.fillStyle = theme.floorBase;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    floorTiles.forEach(tile => {
        ctx.fillStyle = (tile.variant === 0) ? theme.floorBase : theme.floorGrid;
        ctx.fillRect(tile.x, tile.y, tile.w - 1, tile.h - 1);

        ctx.fillStyle = theme.floorDetail;
        ctx.fillRect(tile.x + 4, tile.y + 4, tile.w - 9, tile.h - 9);

        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.x, tile.y, tile.w, tile.h);
    });

    const currentSecretRoom = secretRoomDefinitions.find(room =>
        room.world === currentWorldIndex && room.level === currentLevelIndex
    );
    if (currentSecretRoom) {
        drawSecretRoom(currentSecretRoom);
    }

    if (exitDoor) {
        try {
            drawMysticPortal(exitDoor);
        } catch (error) {
            reportRuntimeError(error, 'Portail');
        }
    }

    walls.forEach(w => {
        ctx.save();
        ctx.fillStyle = theme.wallFill;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y + w.h);
        ctx.lineTo(w.x, w.y);
        ctx.lineTo(w.x + w.w, w.y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.moveTo(w.x + w.w, w.y);
        ctx.lineTo(w.x + w.w, w.y + w.h);
        ctx.lineTo(w.x, w.y + w.h);
        ctx.stroke();

        ctx.strokeStyle = theme.wallBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        ctx.restore();
    });

    levelElements.forEach(element => {
        ctx.save();
        if (element.type === 'trap') {
            const trapType = element.trapType || 'spikes';
            const warning = element.warningTimer > 0;
            const coolingDown = element.cooldown > 0;
            const pulse = 0.5 + Math.sin((element.animation || 0) * 2) * 0.5;
            const left = element.x - element.w / 2;
            const top = element.y - element.h / 2;
            const accent = warning ? '#ffd166' : theme.wallBorder;
            const hazard = trapType === 'flame'
                ? '#ff8c42'
                : trapType === 'void' ? '#d66bff'
                    : trapType === 'spikes' ? '#e74c3c' : '#c79a68';
            const inset = 5;

            ctx.shadowColor = warning ? hazard : accent;
            ctx.shadowBlur = warning ? 20 + pulse * 12 : coolingDown ? 2 : 9;
            ctx.fillStyle = 'rgba(5, 8, 14, 0.94)';
            ctx.fillRect(left, top, element.w, element.h);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = accent;
            ctx.globalAlpha = coolingDown && !warning ? 0.5 : 0.95;
            ctx.lineWidth = 2;
            ctx.strokeRect(left, top, element.w, element.h);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.strokeRect(left + inset, top + inset, element.w - inset * 2, element.h - inset * 2);

            ctx.fillStyle = warning
                ? `rgba(255, 120, 70, ${0.12 + pulse * 0.12})`
                : `rgba(20, 24, 34, ${coolingDown ? 0.32 : 0.12})`;
            ctx.fillRect(left + inset + 1, top + inset + 1, element.w - (inset + 1) * 2, element.h - (inset + 1) * 2);

            ctx.fillStyle = warning ? '#fff1b8' : accent;
            for (let i = 0; i < 4; i++) {
                const markerX = left + 14 + i * (element.w - 28) / 3;
                ctx.globalAlpha = warning ? 0.45 + pulse * 0.5 : 0.45;
                ctx.fillRect(markerX - 2, top + 2, 4, 2);
                ctx.fillRect(markerX - 2, top + element.h - 4, 4, 2);
            }
            ctx.globalAlpha = 1;

            if (trapType === 'spikes') {
                const deployed = warning || !coolingDown;
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(left + 9, element.y + 9, element.w - 18, 5);
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(left + 10, element.y + 11);
                ctx.lineTo(left + element.w - 10, element.y + 11);
                ctx.stroke();
                const count = 5;
                for (let i = 0; i < count; i++) {
                    const spikeX = left + 15 + i * ((element.w - 30) / (count - 1));
                    const height = deployed ? 15 + (warning ? pulse * 9 : 0) : 3;
                    ctx.beginPath();
                    ctx.moveTo(spikeX - 7, element.y + 11);
                    ctx.lineTo(spikeX, element.y + 11 - height);
                    ctx.lineTo(spikeX + 7, element.y + 11);
                    ctx.closePath();
                    ctx.fillStyle = warning ? '#fff1b8' : '#b9c7d8';
                    ctx.shadowColor = warning ? '#ffd166' : accent;
                    ctx.shadowBlur = deployed ? 5 : 0;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#e6edf5';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            } else if (trapType === 'flame') {
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2;
                ctx.strokeRect(element.x - 19, element.y + 8, 38, 5);
                ctx.fillStyle = '#252b38';
                ctx.fillRect(element.x - 15, element.y + 4, 30, 7);
                ctx.fillStyle = warning ? '#fff3b0' : hazard;
                ctx.shadowColor = hazard;
                ctx.shadowBlur = coolingDown ? 2 : 13 + pulse * 8;
                ctx.beginPath();
                ctx.moveTo(element.x, element.y + 7);
                ctx.bezierCurveTo(element.x - 17, element.y - 1, element.x - 4, element.y - 9 - pulse * 7, element.x, element.y - 22 - pulse * 9);
                ctx.bezierCurveTo(element.x + 19, element.y - 3, element.x + 14, element.y + 2, element.x, element.y + 7);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff0b3';
                ctx.beginPath();
                ctx.moveTo(element.x, element.y + 5);
                ctx.bezierCurveTo(element.x - 7, element.y - 1, element.x - 1, element.y - 7 - pulse * 3, element.x + 1, element.y - 12);
                ctx.bezierCurveTo(element.x + 9, element.y - 2, element.x + 6, element.y + 2, element.x, element.y + 5);
                ctx.fill();
            } else if (trapType === 'void') {
                const voidGlow = ctx.createRadialGradient(element.x, element.y, 2, element.x, element.y, 27);
                voidGlow.addColorStop(0, 'rgba(4, 0, 14, 0.98)');
                voidGlow.addColorStop(0.65, `rgba(112, 42, 170, ${coolingDown ? 0.25 : 0.7})`);
                voidGlow.addColorStop(1, 'rgba(214, 107, 255, 0)');
                ctx.fillStyle = voidGlow;
                ctx.beginPath();
                ctx.arc(element.x, element.y, 27, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(element.x, element.y, 23 + pulse * 3, 11 + pulse * 2, (element.animation || 0) * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = warning ? '#ffe082' : '#d66bff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(element.x, element.y, 12 + pulse * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#10091d';
                ctx.beginPath();
                ctx.arc(element.x, element.y, 5, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < 4; i++) {
                    const angle = (element.animation || 0) + i * Math.PI / 2;
                    ctx.fillStyle = warning ? '#ffe082' : accent;
                    ctx.beginPath();
                    ctx.arc(element.x + Math.cos(angle) * 19, element.y + Math.sin(angle) * 9, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                ctx.strokeStyle = '#9c7950';
                ctx.lineWidth = 3;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(element.x - 28, element.y + i * 12);
                    ctx.lineTo(element.x + 28, element.y + i * 12);
                    ctx.stroke();
                }
                ctx.strokeStyle = accent;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(element.x - 13, element.y - 13, 26, 26);
                ctx.beginPath();
                ctx.arc(element.x, element.y, 7 + pulse * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = warning ? '#fff1b8' : accent;
                ctx.beginPath();
                ctx.arc(element.x, element.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            if (warning) {
                ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + pulse * 0.55})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
                ctx.strokeRect(left - 3, top - 3, element.w + 6, element.h + 6);
                ctx.setLineDash([]);
            }
        } else if (element.type === 'key' && !element.collected) {
            ctx.fillStyle = '#f9d342';
            ctx.shadowColor = '#f9d342';
            ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#6b4f00'; ctx.fillRect(element.x + 7, element.y - 2, 15, 4);
        } else if (element.type === 'lever') {
            ctx.fillStyle = element.activated ? '#2ecc71' : '#9b59b6';
            ctx.fillRect(element.x - 5, element.y - 18, 10, 36);
            ctx.strokeStyle = '#fff'; ctx.strokeRect(element.x - 10, element.y - 10, 20, 20);
        } else if (element.type === 'lockedDoor') {
            ctx.fillStyle = element.locked ? '#45202b' : '#1c6b55';
            ctx.fillRect(element.x - element.w / 2, element.y - element.h / 2, element.w, element.h);
            ctx.strokeStyle = element.locked ? '#e74c3c' : '#66fcf1';
            ctx.lineWidth = 3; ctx.strokeRect(element.x - element.w / 2, element.y - element.h / 2, element.w, element.h);
        }
        ctx.restore();
    });
    bossTelegraphs.forEach(t => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life / 45);
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    });

    items.forEach(item => {
        if (!item.collected) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
            if (item.type === 'gold') {
                ctx.fillStyle = '#f9d342';
                ctx.shadowColor = '#f9d342';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#e74c3c';
                ctx.shadowColor = '#e74c3c';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
        }
    });

    enemies.forEach(e => {
        ctx.save();
        e.phase += 0.05;
        let pulse = Math.sin(e.phase) * 3;
        const drawX = Number.isFinite(e.previousX)
            ? e.previousX + (e.x - e.previousX) * renderAlpha
            : e.x;
        const drawY = Number.isFinite(e.previousY)
            ? e.previousY + (e.y - e.previousY) * renderAlpha
            : e.y;

        if (e.isBoss) {
            if (e.bossType === 0) {
                ctx.shadowColor = '#66fcf1';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#1e3d59';
                ctx.beginPath();
                ctx.arc(drawX, drawY, e.radius + pulse*0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#66fcf1';
                ctx.stroke();
            } else if (e.bossType === 1) {
                ctx.shadowColor = '#9b59b6';
                ctx.shadowBlur = 20;
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(gameTime * 0.8);
                ctx.fillStyle = '#4a235a';
                ctx.fillRect(-e.radius, -e.radius, e.radius*2, e.radius*2);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#9b59b6';
                ctx.strokeRect(-e.radius, -e.radius, e.radius*2, e.radius*2);
                ctx.restore();
            } else if (e.bossType === 2) {
                ctx.shadowColor = '#e056fd';
                ctx.shadowBlur = 25;
                ctx.fillStyle = '#2c003e';
                ctx.beginPath();
                ctx.arc(drawX, drawY, e.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#e056fd';
                ctx.beginPath();
                ctx.arc(drawX, drawY, e.radius + 6 + pulse, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(drawX, drawY, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            const isSentinel = e.enemyType === 'sentinel';
            ctx.shadowColor = isSentinel ? '#c09d63' : '#c0392b';
            ctx.shadowBlur = isSentinel && e.sentinelChargeTimer > 0 ? 16 : 10;
            ctx.fillStyle = isSentinel ? '#55462f' : '#7a1c1c';
            ctx.beginPath();
            ctx.arc(drawX, drawY, e.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = isSentinel ? '#c09d63' : '#e74c3c';
            ctx.stroke();

            if (e.isElite) {
                ctx.strokeStyle = '#f9d342';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#f9d342';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(drawX, drawY, e.radius + 5 + pulse * 0.35, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            if (isSentinel) {
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = '#d8bd83';
                ctx.fillRect(-5, -5, 10, 10);
                ctx.restore();
            }

            let angleToPlayer = Math.atan2(player.y - drawY, player.x - drawX);
            let eyeX = drawX + Math.cos(angleToPlayer) * 5;
            let eyeY = drawY + Math.sin(angleToPlayer) * 5;
            ctx.fillStyle = '#f9d342';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
            ctx.fill();

            if (settings.showEnemyBars) {
                let barW = 28;
                let barH = 4;
                let barX = drawX - barW / 2;
                let barY = drawY - e.radius - 8;
                ctx.fillStyle = '#0b0c10';
                ctx.fillRect(barX, barY, barW, barH);
                let pct = Math.max(0, e.hp / e.maxHp);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(barX, barY, barW * pct, barH);
                ctx.strokeStyle = '#202b36';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(barX, barY, barW, barH);
            }
        }
        ctx.restore();
    });

    ctx.save();
let aimAngle = Math.atan2(player.facing.y, player.facing.x);

let playerColor = '#1f3a40';
let glowColor = '#66fcf1';

if (player.skin === 'red') {
    playerColor = '#b71c1c';
    glowColor = '#ff4d4d';
}

if (player.skin === 'green') {
    playerColor = '#1b5e20';
    glowColor = '#4dff88';
}

if (player.skin === 'purple') {
    playerColor = '#4a148c';
    glowColor = '#bb66ff';
}

if (player.skin === 'gold') {
    playerColor = '#b8860b';
    glowColor = '#ffd700';
}

if (player.skin === 'cyan') {
    playerColor = '#007c91';
    glowColor = '#00d9ff';
}

if (player.skin === 'crimson') {
    playerColor = '#8b1028';
    glowColor = '#ff335d';
}

if (player.skin === 'shadow') {
    playerColor = '#272936';
    glowColor = '#a8b0c5';
}

if (player.skin === 'secret') {
    playerColor = '#d946ef';
    glowColor = '#f9a8d4';
}

if (player.skin === 'astral') {
    playerColor = '#5b4b9a';
    glowColor = '#a78bfa';
}

if (player.skin === 'abyssal') {
    playerColor = '#171329';
    glowColor = '#8b7cff';
}

if (player.skin === 'seed-warden') {
    playerColor = '#087f5b';
    glowColor = '#63e6be';
}

if (player.skin === 'ngplus-ascendant') {
    playerColor = '#8a5b16';
    glowColor = '#ffd166';
}

if (player.skin === 'endless-sentinel') {
    playerColor = '#6b21a8';
    glowColor = '#c084fc';
}

ctx.shadowColor = glowColor;
ctx.shadowBlur = player.isDashing ? 22 : 8;

ctx.fillStyle = player.isDashing ? glowColor : playerColor;

ctx.beginPath();
ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
ctx.fill();

ctx.lineWidth = 2.5;
ctx.strokeStyle = '#ffffff';
ctx.stroke();

    let visorX = player.x + Math.cos(aimAngle) * 7;
    let visorY = player.y + Math.sin(aimAngle) * 7;
    ctx.fillStyle = '#66fcf1';
    ctx.beginPath();
    ctx.arc(visorX, visorY, 4, 0, Math.PI * 2);
    ctx.fill();

    if (player.isSwinging) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.arc(player.x, player.y, player.attackRange, aimAngle - player.attackArc/2, aimAngle + player.attackArc/2);
        ctx.closePath();
        let grad = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, player.attackRange);
        grad.addColorStop(0, 'rgba(102, 252, 241, 0.85)');
        grad.addColorStop(1, 'rgba(102, 252, 241, 0.05)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#66fcf1';
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();

    if (settings.showParticles) {
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.restore();
        });
    }

    damageTexts.forEach(text => {
        ctx.save();
        ctx.globalAlpha = text.alpha;
        ctx.fillStyle = text.color;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(6, 7, 9, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText(`-${text.value}`, text.x, text.y);
        ctx.fillText(`-${text.value}`, text.x, text.y);
        ctx.restore();
    });

    ctx.restore();

    if (gameState === 'VICTORY' || gameState === 'GAMEOVER') {
        document.getElementById('boss-ui-container').classList.remove('active');
        ctx.fillStyle = 'rgba(6, 7, 9, 0.92)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#66fcf1';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#66fcf1';
        ctx.shadowBlur = 10;
        if (gameState === 'VICTORY') {
            ctx.fillText('TOUS LES MONDES SONT NETTOYÉS !', canvas.width/2, canvas.height/2 - 40);
        } else {
            ctx.fillText('VOUS ÊTES MORT...', canvas.width/2, canvas.height/2 - 40);
        }
        ctx.shadowBlur = 0;
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#f9d342';
        ctx.fillText(`Or amassé : ${player.gold} 🪙`, canvas.width/2, canvas.height/2 - 5);
        ctx.fillStyle = '#c5c6c7';
        ctx.fillText(`Score Tactique Final : ${score}`, canvas.width/2, canvas.height/2 + 25);
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#66fcf1';
    }
}

let lastAutoSave = 0;
let lastFrameTime = 0;
const SIMULATION_STEP = 1000 / 60;
let simulationAccumulator = 0;
let renderAlpha = 1;

function reportRuntimeError(error, source) {
    runtimeError = {
        source,
        message: error && error.message ? error.message : String(error)
    };
    console.error(`Erreur ${source} :`, error);
}

function drawRuntimeError() {
    if (!runtimeError) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(80, 0, 0, 0.82)';
    ctx.fillRect(8, 8, canvas.width - 16, 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Erreur ${runtimeError.source}: ${runtimeError.message}`, 18, 32);
    ctx.font = '12px sans-serif';
    ctx.fillText('Ouvrez la console (F12) pour le detail.', 18, 52);
    ctx.restore();
}

function runPhaseOneSelfTests() {
    const levelIds = worldsData.flatMap(world => world.levels.map(level => level.id));
    const bossIds = worldsData.map((world, index) => `world-${index + 1}-boss`);
    const missionIds = secondaryMissionDefinitions.map(mission => mission.id);
    const missionGoalKeys = secondaryMissionDefinitions.map(mission =>
        `${mission.description}|${mission.target}|${mission.unit}`
    );
    const missionRewardIds = Object.keys(SECONDARY_MISSION_REWARDS);
    const missionRewardSkins = secondaryMissionDefinitions
        .map(mission => SECONDARY_MISSION_REWARDS[mission.id]?.skin)
        .filter(Boolean);
    const assertions = [
        ['21 niveaux sont définis', levelIds.length === 21],
        ['Les PV de départ sont 120 et le plafond est 300', Boolean(
            BASE_PLAYER_HP * BUILD_DEFINITIONS.vanguard.hp === 120
            && MAX_PLAYER_HP === 300
            && formatPlayerHealth(120, 120) === '120 / 120'
            && formatPlayerHealth(300, 300) === '300 / 300 · MAX'
        )],
        ['Les identifiants de niveaux sont uniques', new Set(levelIds).size === levelIds.length],
        ['Les 3 identifiants de boss sont uniques', new Set(bossIds).size === 3],
        ['Les 7 salles secrètes sont uniques', new Set(secretRoomDefinitions.map(room => room.id)).size === 7],
        ['Les 30 missions sont définies', secondaryMissionDefinitions.length === 30],
        ['Les identifiants des missions sont uniques', new Set(missionIds).size === missionIds.length],
        ['Les noms et objectifs des missions ne sont pas dupliqués', Boolean(
            new Set(secondaryMissionDefinitions.map(mission => mission.name)).size === missionIds.length
            && new Set(missionGoalKeys).size === missionIds.length
        )],
        ['Les missions du monde 2 distinguent son déblocage de son achèvement', Boolean(
            getMissionDefinition('world-master')?.description === 'Débloquez le monde 2.'
            && getMissionDefinition('obsidian-crypt')?.description === 'Terminez le monde 2.'
        )],
        ['La mission des secrets couvre les 7 salles', getMissionDefinition('world-secrets')?.target === secretRoomDefinitions.length],
        ['La mission de complétion couvre les 30 missions', getMissionDefinition('side-missions-finished')?.target === secondaryMissionDefinitions.length],
        ['Chaque mission a une récompense valide et aucun bonus ne référence une mission absente', Boolean(
            missionRewardIds.length === missionIds.length
            && missionIds.every(id => missionRewardIds.includes(id))
            && missionRewardIds.every(id => missionIds.includes(id))
            && secondaryMissionDefinitions.every(mission => {
                const reward = SECONDARY_MISSION_REWARDS[mission.id];
                return reward && Number.isFinite(reward.gold)
                    && (mission.id === 'adventure-starts' ? reward.gold === 0 : reward.gold > 0)
                    && typeof reward.label === 'string' && reward.label.length > 0
                    && (!reward.skin || (VALID_SKIN_IDS.has(reward.skin)
                        && typeof reward.skinLabel === 'string' && reward.skinLabel.length > 0));
            })
        )],
        ['Chaque skin de mission est valide et attribué une seule fois', Boolean(
            new Set(missionRewardSkins).size === missionRewardSkins.length
            && missionRewardSkins.every(skin => VALID_SKIN_IDS.has(skin))
        )],
        ['La mission New Game+ a une récompense exclusive', Boolean(
            getMissionDefinition('new-game-plus-master')
            && SECONDARY_MISSION_REWARDS['new-game-plus-master']?.skin === 'ngplus-ascendant'
        )],
        ['La mission de seed fixe a sa récompense exclusive', Boolean(
            getMissionDefinition('daily-seed-master')
            && SECONDARY_MISSION_REWARDS['daily-seed-master']?.gold === 1500
            && SECONDARY_MISSION_REWARDS['daily-seed-master']?.skin === 'seed-warden'
            && SECONDARY_MISSION_REWARDS['daily-seed-master']?.countsAsRareSkin === false
        )],
        ['La mission sans fin récompense 10 vagues dans une série', Boolean(
            getMissionDefinition('endless-ten-waves')?.target === 1
            && SECONDARY_MISSION_REWARDS['endless-ten-waves']?.gold === 2000
            && SECONDARY_MISSION_REWARDS['endless-ten-waves']?.skin === 'endless-sentinel'
            && SECONDARY_MISSION_REWARDS['endless-ten-waves']?.countsAsRareSkin === false
            && VALID_SKIN_IDS.has('endless-sentinel')
        )],
        ['Les objectifs de maîtrise du sans-fin sont ordonnés et uniques', Boolean(
            ENDLESS_MASTERY_GOALS.length === 5
            && ENDLESS_MASTERY_GOALS.every((goal, index, goals) =>
                Number.isSafeInteger(goal.wave)
                && goal.wave > 0
                && (!index || goal.wave > goals[index - 1].wave)
                && Number.isFinite(goal.gold)
                && goal.gold > 0
            )
            && ENDLESS_MASTERY_GOALS.at(-1).wave === 50
            && ENDLESS_MASTERY_GOALS.at(-1).skin === 'endless-conqueror'
        )],
        ['La version de sauvegarde est valide', SAVE_VERSION >= 3]
    ];
    assertions.forEach(([label, valid]) => {
        if (!valid) console.error(`Test de non-régression échoué : ${label}`);
    });
    return assertions.every(([, valid]) => valid);
}

let firstLoadingFrameReported = false;

function loop() {
    const now = performance.now();
    const elapsed = lastFrameTime === 0 ? SIMULATION_STEP : Math.min(100, now - lastFrameTime);
    lastFrameTime = now;
    simulationAccumulator += elapsed;
    fpsFrames++;
    if (fpsTimestamp === 0) fpsTimestamp = now;
    if (now - fpsTimestamp >= 500) {
        const fpsCounter = document.getElementById('fps-counter');
        const fps = Math.round(fpsFrames * 1000 / (now - fpsTimestamp));
        if (fpsCounter) fpsCounter.textContent = `FPS : ${fps}`;
        fpsFrames = 0;
        fpsTimestamp = now;
    }

    try {
        pollGamepad();
        syncOverlayVisibility();
        while (simulationAccumulator >= SIMULATION_STEP) {
            update(1);
            simulationAccumulator -= SIMULATION_STEP;
        }
        renderAlpha = simulationAccumulator / SIMULATION_STEP;
        draw();
        drawRuntimeError();
        if (!firstLoadingFrameReported) {
            firstLoadingFrameReported = true;
            window.dispatchEvent(new Event('dungeons:first-frame'));
        }
    } catch (error) {
        reportRuntimeError(error, 'Boucle de jeu');
        drawRuntimeError();
    }

    if (now - lastAutoSave > 30000) {
        try { saveGame(); } catch (error) { reportRuntimeError(error, 'Sauvegarde'); }
        lastAutoSave = now;
    }

    requestAnimationFrame(loop);
}

document.getElementById('retry-btn').onclick = () => {
    if (endlessRunEnded) {
        startEndlessMode();
        return;
    }
    if (activeChallenge === 'daily' && dailyChallenge) {
        startDailyChallenge(dailyChallenge.seed, dailyChallenge.date);
        return;
    }

    player.hp = player.maxHp;
    updateMissionByEvent('restart');
    document.querySelector('#gameover-screen .gameover-title').textContent = 'GAME OVER';
    document.querySelector('#gameover-screen .gameover-subtitle').textContent = "Votre aventure s'arrête ici...";

    const loaded = loadLevel(
        currentWorldIndex,
        currentLevelIndex
    );

    if (loaded) enterPlayingState();
};

document.getElementById('shop-from-death-btn').onclick = () => {

    openShop();

};

document.getElementById('back-title-btn').onclick = () => {
    returnToTitle();
};

document.getElementById('victory-retry-btn').onclick = () => {

    player.hp = player.maxHp;
    updateMissionByEvent('restart');

    const loaded = loadLevel(
        currentWorldIndex,
        currentLevelIndex
    );

    if (loaded) enterPlayingState();
};

document.getElementById('victory-newgame-btn').onclick = () => {
    resetGameData();
    gameState = 'TITLE';
    leavePlayingState();
    showOverlay('title-screen');
};

document.getElementById('victory-menu-btn').onclick = () => {
    returnToTitle();
};

window.addEventListener('error', event => {
    console.error('Erreur de demarrage du jeu :', event.error || event.message);
    const message = document.getElementById('notification-banner');
    if (message) {
        message.textContent = 'Erreur JavaScript : ouvrez la console (F12).';
        message.classList.add('show');
    }
});

runPhaseOneSelfTests();
loadGameSave();
syncOptionsControls();
const startupPlayButton = document.getElementById('btn-continue');
if (startupPlayButton) startupPlayButton.disabled = false;

// Prepare le premier niveau sans le demarrer : le menu titre reste affiche.
gameState = 'TITLE';
leavePlayingState();
const initialWorld = hasSavedProgress ? currentWorldIndex : 0;
const initialLevel = hasSavedProgress ? currentLevelIndex : 0;
if (!loadLevel(initialWorld, initialLevel)) {
    loadLevel(0, 0);
}
showOverlay('title-screen');
startDailyChallengeFromUrl();

loop();
window.__dungeonsEngineReady = true;
window.dispatchEvent(new Event('dungeons:engine-ready'));
