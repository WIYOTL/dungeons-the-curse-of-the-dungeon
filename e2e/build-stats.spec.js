const { test, expect } = require('@playwright/test');

test.use({ locale: 'fr-FR' });

const BUILD_IDS = ['vanguard', 'duelist', 'ranger', 'paladin'];

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('dungeonsTutorialSeen', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
});

function readStats(page) {
    return page.evaluate(() => ({
        build: selectedBuild,
        maxHp: player.maxHp,
        hp: player.hp,
        defense: player.defense,
        attackDamage: player.attackDamage,
        speed: player.speed
    }));
}

test('every build keeps the 120 HP floor in session and after reload', async ({ page }) => {
    for (const build of BUILD_IDS) {
        await page.evaluate(id => {
            saveWritesAuthorized = true;
            setBuild(id);
        }, build);
        const session = await readStats(page);
        expect(session.build).toBe(build);
        expect(session.maxHp).toBeGreaterThanOrEqual(120);
        expect(session.maxHp).toBeLessThanOrEqual(300);

        await page.evaluate(() => saveGame(true));
        await page.reload();
        await page.waitForFunction(() => window.__dungeonsEngineReady === true);
        const reloaded = await readStats(page);

        expect(reloaded.build).toBe(build);
        expect(reloaded.maxHp).toBe(session.maxHp);
        expect(reloaded.hp).toBeLessThanOrEqual(reloaded.maxHp);
        expect(reloaded.defense).toBeCloseTo(session.defense, 5);
        expect(reloaded.attackDamage).toBeCloseTo(session.attackDamage, 5);
        expect(reloaded.speed).toBeCloseTo(session.speed, 5);
    }
});

test('switching builds does not drift the HP floor', async ({ page }) => {
    const sequence = ['vanguard', 'duelist', 'vanguard', 'ranger', 'vanguard', 'paladin', 'vanguard'];
    const observed = [];
    for (const build of sequence) {
        await page.evaluate(id => {
            saveWritesAuthorized = true;
            setBuild(id);
        }, build);
        const stats = await readStats(page);
        observed.push({ build, maxHp: stats.maxHp });
    }
    for (const { build, maxHp } of observed) {
        expect(build === 'paladin' ? 126 : 120).toBe(maxHp);
    }
});
