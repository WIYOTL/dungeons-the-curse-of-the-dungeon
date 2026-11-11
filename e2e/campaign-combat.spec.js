const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('dungeonsTutorialSeen', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('#app-loading-screen')).toHaveCount(0, { timeout: 10_000 });
});

async function startFirstLevel(page) {
    await page.getByRole('button', { name: /NOUVELLE PARTIE/ }).click();
    await page.locator('#newgame-confirm-screen').getByRole('button', { name: 'OUI' }).click();
    await expect.poll(async () => page.evaluate(() => ({
        hp: player.hp,
        maxHp: player.maxHp
    }))).toEqual({ hp: 120, maxHp: 120 });
    await expect(page.locator('#world-select-screen')).toBeVisible();
    await page.locator('#world-select-container .btn-level').first().click();
    await expect(page.locator('#world-display')).toContainText('Monde 1');
}

test('a new campaign launches its first level and persists progress after reload', async ({ page }) => {
    await startFirstLevel(page);

    await expect.poll(async () => page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('dungeonsSave'));
        return save && save.hasSavedProgress && save.currentWorldIndex === 0 && save.currentLevelIndex === 0;
    })).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('#app-loading-screen')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /JOUER/ })).toBeEnabled();
    await page.getByRole('button', { name: /JOUER/ }).click();
    await expect(page.locator('#world-select-container .btn-level').first()).toBeEnabled();
});

test('a player attack damages an enemy during an active level', async ({ page }) => {
    await startFirstLevel(page);
    const initialHealth = await page.evaluate(() => {
        const target = enemies[0];
        target.x = player.x + 55;
        target.y = player.y;
        target.hp = 500;
        target.radius = 10;
        target.speed = 0;
        player.facing = { x: 1, y: 0 };
        return target.hp;
    });

    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up('Space');

    await expect.poll(async () => page.evaluate(() => enemies[0].hp)).toBeLessThan(initialHealth);
    await page.keyboard.down('f');
    await expect.poll(async () => page.evaluate(() => player.parryTimer), {
        interval: 20,
        timeout: 1_000
    }).toBeGreaterThan(0);
    await page.keyboard.up('f');
});

test('mobile playfield fills the available screen and follows orientation changes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.body.classList.add('mobile-touch-enabled'));
    await startFirstLevel(page);

    const portraitSize = await page.waitForFunction(() => {
        const bounds = document.querySelector('#gameCanvas').getBoundingClientRect();
        const horizontalScale = canvas.width / camera.width;
        const verticalScale = canvas.height / camera.height;
        const fitScale = Math.max(bounds.width / 800, bounds.height / 600);
        return canvas.width === Math.round(bounds.width)
            && canvas.height === Math.round(bounds.height)
            && getComputedStyle(document.querySelector('#gameCanvas')).objectFit === 'contain'
            && Math.abs(horizontalScale - verticalScale) < 0.01
            && Math.abs(horizontalScale - mobileCanvasScale) < 0.01
            && Math.abs(mobileCanvasScale / fitScale - MOBILE_GAME_ZOOM) < 0.01
            && bounds.height > window.innerHeight * 0.72;
    }).then(() => page.evaluate(() => ({
        width: canvas.width,
        height: canvas.height,
        cameraWidth: camera.width,
        cameraHeight: camera.height,
        zoom: MOBILE_GAME_ZOOM
    })));
    expect(portraitSize.width).toBeGreaterThan(350);
    expect(portraitSize.cameraWidth).toBeLessThan(800);
    expect(portraitSize.cameraHeight).toBeLessThanOrEqual(600);
    expect(portraitSize.zoom).toBe(1.2);
    await expect(page.locator('#ui')).toBeVisible();
    await expect(page.locator('.touch-controls button[aria-label="Attaquer"]')).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => {
        const bounds = document.querySelector('#gameCanvas').getBoundingClientRect();
        const horizontalScale = canvas.width / camera.width;
        const verticalScale = canvas.height / camera.height;
        const fitScale = Math.max(bounds.width / 800, bounds.height / 600);
        return canvas.width === Math.round(bounds.width)
            && canvas.height === Math.round(bounds.height)
            && getComputedStyle(document.querySelector('#gameCanvas')).objectFit === 'contain'
            && Math.abs(horizontalScale - verticalScale) < 0.01
            && Math.abs(horizontalScale - mobileCanvasScale) < 0.01
            && Math.abs(mobileCanvasScale / fitScale - MOBILE_GAME_ZOOM) < 0.01;
    });
    const landscapeSize = await page.evaluate(() => ({
        width: canvas.width,
        height: canvas.height
    }));
    expect(landscapeSize.width).toBeGreaterThan(800);
    expect(landscapeSize.height).toBeGreaterThan(250);
});
