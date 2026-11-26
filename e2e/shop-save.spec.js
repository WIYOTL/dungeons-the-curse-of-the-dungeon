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
    await page.locator('#world-select-container .btn-level').first().click();
    await expect(page.locator('#world-display')).toContainText('Monde 1');
}

test('buying a skin deducts gold and survives a reload', async ({ page }) => {
    await startFirstLevel(page);
    await page.evaluate(() => {
        player.gold = 100;
        saveGame(true);
    });
    await page.keyboard.press('p');
    await page.locator('#pause-screen').getByRole('button', { name: /BOUTIQUE/ }).click();
    await page.evaluate(() => {
        player.gold = 100;
        saveGame(true);
        updateShopGold();
    });

    await page.locator('#shop-screen [data-product-id="skin-red"]').click();

    await expect(page.locator('#shop-gold-display')).toHaveText('40');
    await expect.poll(async () => page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('dungeonsSave'));
        return save.ownedSkins.includes('red') && save.skin === 'red' && save.gold === 40;
    })).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.__dungeonsEngineReady === true);
    await expect(page.locator('#app-loading-screen')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#menu-gold')).toHaveText('40');
});

test('a saved slot restores the stored player progress', async ({ page }) => {
    await startFirstLevel(page);
    await page.evaluate(() => {
        player.gold = 173;
        saveGame(true);
    });
    await page.keyboard.press('p');
    await page.locator('#pause-screen').getByRole('button', { name: /MENU TITRE/ }).click();
    await page.getByRole('button', { name: 'Ouvrir la progression et les défis' }).click();
    await page.locator('#save-slot-select').selectOption('1');
    await page.getByRole('button', { name: 'ENREGISTRER SLOT' }).click();
    await expect.poll(async () => page.evaluate(() => {
        const save = JSON.parse(localStorage.getItem('dungeonsSaveSlot1'));
        return save && save.gold;
    })).toBe(173);

    await page.evaluate(() => {
        player.gold = 0;
        saveGame(true);
        updateMenuStats();
    });
    await page.getByRole('button', { name: 'CHARGER SLOT' }).click();
    await expect(page.locator('#menu-gold')).toHaveText('173');
});
