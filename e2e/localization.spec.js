const { test, expect } = require('@playwright/test');

test.use({ locale: 'en-US' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('dungeonsTutorialSeen', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('#app-loading-screen')).toHaveCount(0, { timeout: 10_000 });
});

async function findAccentedFrenchText(locator) {
    return locator.evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const values = [];
        let node = walker.nextNode();
        while (node) {
            const text = node.nodeValue.trim();
            if (text !== 'Français' && /[àâçéèêëîïôùûüÿœ]/i.test(text)) values.push(text);
            node = walker.nextNode();
        }
        return [...new Set(values)];
    });
}

test('detects the browser language and remembers an explicit language choice', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#title-screen .menu-container button').first()).toContainText('NEW GAME');
    await expect.poll(() => findAccentedFrenchText(page.locator('#title-screen'))).toEqual([]);

    await page.locator('#language-select-title').selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('#title-screen .menu-container button').first()).toContainText('NOUVELLE PARTIE');
    await expect(page.locator('#language-select-options')).toHaveValue('fr');

    await page.reload();
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.getByRole('button', { name: /OPTIONS/ }).click();
    await expect(page.locator('#options-screen')).toBeVisible();
    await expect(page.locator('#options-screen h3').first()).toContainText('LANGUE');
    await page.locator('#language-select-options').selectOption('en');
    await expect(page.locator('#language-select-title')).toHaveValue('en');
    await expect(page.locator('#options-screen label[for="language-select-options"]')).toHaveText('Language');
    await expect.poll(() => findAccentedFrenchText(page.locator('#options-screen'))).toEqual([]);

    await page.reload();
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('translates campaign selection and generated level buttons', async ({ page }) => {
    await page.getByRole('button', { name: /NEW GAME/ }).click();
    await page.locator('#newgame-confirm-screen').getByRole('button', { name: 'YES' }).click();

    await expect(page.locator('#world-select-screen h2')).toHaveText('WORLD SELECT');
    await expect(page.locator('#world-select-container')).toContainText('World 1: The Sanctuary of Dawn');
    await expect(page.locator('#world-select-container .btn-level').first()).toHaveText('Lvl 1');
    await expect.poll(() => page.evaluate(() => t('SALLE SECRÈTE'))).toBe('SECRET ROOM');

    await page.locator('#world-select-screen .btn-ui').click();
    await page.getByRole('button', { name: /SIDE MISSIONS/ }).click();
    await expect(page.locator('#missions-screen')).toContainText('The Adventure Begins!');
    await expect(page.locator('#missions-screen')).toContainText('Start your first run.');
    await expect(page.locator('#missions-screen')).toContainText('Getting Started');
    await expect.poll(() => findAccentedFrenchText(page.locator('#missions-screen'))).toEqual([]);

    await page.getByRole('button', { name: 'BACK' }).click();
    await page.evaluate(() => openShop());
    await expect(page.locator('#shop-screen')).toContainText('Red Skin');
    await expect(page.locator('#shop-screen').getByRole('button', { name: 'BUY' }).first()).toBeVisible();
    await expect.poll(() => findAccentedFrenchText(page.locator('#shop-screen'))).toEqual([]);
});

test('keeps the privacy and support page in the selected language', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Optional Cloud Saves' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
    await expect(page.locator('.notice')).toContainText('Information to finalize before public cloud accounts are opened.');

    await page.locator('#language-select-privacy').selectOption('fr');
    await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sauvegarde cloud facultative' })).toBeVisible();
});

test('localizes progression, builds, and challenge details', async ({ page }) => {
    await page.evaluate(() => openPhase3());

    await expect(page.locator('#phase3-screen')).toContainText('Persistent Difficulty');
    await expect(page.locator('#phase3-screen')).toContainText('Hero Build');
    await expect(page.locator('#phase3-screen')).toContainText('Special Modes');
    await expect(page.locator('#difficulty-description')).toContainText('A balanced experience.');
    await expect(page.locator('#build-perks')).toContainText('+10% defense');
    await expect(page.locator('#challenge-list')).toContainText('No Potions');
    await expect(page.locator('#challenge-list')).toContainText('Glass Cannon');
    await expect(page.locator('#bestiary-list')).toContainText('Stalker');

    await page.evaluate(() => setGameLanguage('fr'));
    await expect(page.locator('#difficulty-description')).toContainText('Expérience équilibrée.');
    await page.evaluate(() => setGameLanguage('en'));
    await expect(page.locator('#difficulty-description')).toContainText('A balanced experience.');

    const remainingFrench = await findAccentedFrenchText(page.locator('#phase3-screen'));
    expect(remainingFrench).toEqual([]);
});
