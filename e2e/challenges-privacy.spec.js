const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('dungeonsTutorialSeen', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('#app-loading-screen')).toHaveCount(0, { timeout: 10_000 });
});

test('a daily challenge launches and records its deterministic challenge state', async ({ page }) => {
    await page.getByRole('button', { name: 'Ouvrir la progression et les défis' }).click();
    await page.locator('#phase3-screen').getByRole('button', { name: /DÉFI QUOTIDIEN/ }).click();

    await expect(page.locator('#world-display')).toContainText('Monde 1');
    await expect.poll(async () => page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('dungeonsSave'));
        return save && save.activeChallenge === 'daily'
            && save.dailyChallenge && save.dailyChallenge.modifiers.length === 2;
    })).toBe(true);
});

test('a shared challenge code is validated before its campaign starts', async ({ page }) => {
    await page.getByRole('button', { name: 'Ouvrir la progression et les défis' }).click();
    const input = page.locator('#challenge-code-input');

    await input.fill('not-a-challenge');
    await page.locator('#phase3-screen').getByRole('button', { name: /JOUER CE DÉFI/ }).click();
    await expect(page.locator('#notification-banner')).toContainText('invalide');
    await expect(page.locator('#phase3-screen')).toBeVisible();

    await input.fill('DNG1-20261111-00000001');
    await page.locator('#phase3-screen').getByRole('button', { name: /JOUER CE DÉFI/ }).click();
    await expect(page.locator('#world-display')).toContainText('Monde 1');
    await expect.poll(async () => page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('dungeonsSave'));
        return save && save.activeChallenge === 'daily'
            && save.dailyChallenge && save.dailyChallenge.seed === 1;
    })).toBe(true);
});

test('the privacy page explains data use and provides the configured support address', async ({ page }) => {
    await expect(page.locator('.title-legal-links a[href="./privacy.html"]')).toBeVisible();
    await expect(page.locator('.title-legal-links a[href="mailto:contact.wiyotl@gmail.com"]'))
        .toBeVisible();
    await page.locator('.title-legal-links a[href="./privacy.html"]').click();

    await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sauvegarde cloud facultative' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'contact.wiyotl@gmail.com' }).first())
        .toHaveAttribute('href', /^mailto:contact\.wiyotl@gmail\.com/);
});
