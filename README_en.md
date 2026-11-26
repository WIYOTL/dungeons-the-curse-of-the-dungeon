# Dungeons: The Curse of the Dungeon <sup>WEB Edition</sup>

[Français](README.md) · **English** · **V1.1.2**

> **Enter the dungeon. Break the curse.**<br>
> A fantasy action game you can play in your browser on desktop or mobile.

<p align="center">
  <a href="https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/"><strong>PLAY NOW</strong></a>
  &nbsp;·&nbsp;
  <a href="privacy.html">Privacy</a>
  &nbsp;·&nbsp;
  <a href="mailto:contact.wiyotl@gmail.com">Support</a>
</p>

## Screenshots

<p align="center">
  <img src="screenshots/title-screen.png" alt="Dungeons: The Curse of the Dungeon title screen" width="49%">
  <img src="screenshots/desktop-gameplay.png" alt="Campaign combat in the first world on desktop" width="49%">
</p>
<p align="center"><em>Title screen · Desktop campaign</em></p>

<p align="center">
  <img src="screenshots/mobile-gameplay.png" alt="Portrait mobile gameplay with on-screen joystick and touch controls" width="30%">
</p>
<p align="center"><em>Portrait mobile gameplay</em></p>

## The adventure

Explore **3 worlds and 21 levels**, face their guardians, and uncover **7 secret rooms**. Master the combat, choose your approach, and improve your hero as you push deeper into the dungeon.

### What awaits

- **A full campaign** with levels, enemies, bosses, and persistent progression.
- **Action combat** with attacks, quick dashes, parries, and interactions.
- **A French and English interface**, selected from your browser language and changeable at any time.
- **Four hero archetypes** — Vanguard, Duelist, Ranger, and Paladin — for different play styles.
- **Upgrades and a shop** to shape your progression.
- **Shareable seeded daily challenges**: invite friends to tackle the same setup.
- **Endless mode and mastery goals**, followed by **New Game+** after the campaign.
- An **interactive tutorial** and accessibility options: high contrast, larger text, and reduced motion.
- **Completion tracking** to guide your 100% run: campaign, missions, secret rooms, bestiary, special challenges, builds, difficulties, and levers.

## Play on mobile

The playfield adapts to your screen and includes an **on-screen joystick** plus dedicated buttons for attack, dash, parry, interaction, and pause. Both portrait and landscape layouts are supported. Accidental page zoom during gameplay (double-tap or pinch on the controls) is disabled mid-game; menus remain zoomable.

On iPhone or iPad:

1. Open the [HTTPS game site](https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/) in Safari.
2. Tap **Share**, then **Add to Home Screen** to install it as a web app.
3. Launch the game once while online so its files can load and be cached.

After the first load, the PWA can keep the game shell available offline. Features that require an internet connection, including any cloud functionality, remain unavailable offline.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | ZQSD, WASD, or arrow keys |
| Attack | Space |
| Interact | E |
| Parry | F |
| Dash | Shift |
| Pause | P or Esc |

On phones and tablets, use the on-screen joystick and action buttons.

## Run locally

This is a static web app; no backend is required to play. Install Python 3 and start a local server from the project root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/> in your browser. To test on a phone connected to the same Wi-Fi, start the server with:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open `http://<your-computer-IP>:8000/` on the phone. For local testing, keep the computer and server running. The GitHub Pages version is available without your computer.

## Progress and privacy

Progress is stored locally in the browser you play with, so it does not automatically sync between devices. Optional Supabase cloud saves are **disabled by default** and require separate configuration.

Read the [privacy policy](privacy.html) for information about data and support. Cloud features require an internet connection.

## Development

Requirements: Node.js and npm.

```sh
npm ci
npx playwright install chromium
npm test
npm run build
```

- `npm test` runs unit tests and Playwright browser journeys.
- `npm run build` verifies scripts, the PWA manifest, and required files.
- The [GitHub Actions workflow](.github/workflows/pages.yml) runs checks before publishing the site.

### Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Game, interface, and styles |
| `js/` | Game engine, progression, saves, and gameplay systems |
| `icons/` | App icons |
| `screenshots/` | Screenshots featured in this README |
| `e2e/`, `test/` | Browser and unit tests |
| `privacy.html` | Privacy policy and support |
| `service-worker.js`, `manifest.webmanifest` | PWA support |

For publishing or Supabase setup, see the [deployment guide](DEPLOYMENT.md).

## Updates

### V1.1.2 (November 25, 2026)

- Black screen fixed (iPhone, macOS, Windows): missing `</div>` in `#victory-screen` — the interface and canvas were nested inside a hidden screen
- « MAX » HP label now reserved for the reached 300 HP cap (menu and in-game HUD), aligned with other stats
- Lever counter « Levers X / 10 » added to the Progression & Challenges panel (stat at the top + row in advanced stats)
- Accidental touch zoom fixed during gameplay (hardened viewport, touch-action, iOS gestures blocked, text selection disabled); menus remain zoomable
- Service worker cache bumped to v5: updates are now properly served on iPhone/Android (old cache purged)
- Local test server with caching disabled (`Serveur-Test-Iphone.command`): Safari always reloads the latest version
- 100% completion verified as attainable: exact weights, 10 generated levers, recursive side mission working
- Speed-run timer based on `performance.now()`, strict CSP, local timezone for the daily challenge
- Parry e2e test stabilized (widened polling window)

### V1.1.1 (November 21, 2026)

- Paladin "Absorbing Shield" implemented: 25% chance to block incoming hit
- AudioContext resume fixed (playUiTone, startAmbientMusic, playCue async with await)
- validateImportedSave relaxed for old saves (buildModifiers, shopUpgrades optional)
- Separation vector optimized: spatial hash grid (80px cells) O(n²) → O(n)
- runtimeError reset to null on successful loadLevel()
- FR typos: "déjà", "Récupère", "Obtient", "Subit" (3rd person consistency)
- HTML: orphan div removed, cloud-save-section wrapper, shop verbs harmonized

### V1.1.0 (November 12, 2026)

- Starting HP fixed at 120 (base)
- Starting defense fixed at 10 % for all builds
- Speed cap added (8 max)
- New build: Paladin (shield absorption, heal on successful parry)
- New shop artifact: Vampirism (heal on critical hit)
- « Collectionneur complet » badge when all 19 shop products are purchased
- « OWNED » button fixed for permanent artifacts in the shop
- « Game completion » section now visible in the title menu
- Version bumped from 1.0.0 to 1.1.1

### V1.0.0 (November 11, 2026)

- Initial release
- Campaign: 3 worlds, 21 levels, 3 bosses
- 7 secret rooms
- 3 builds: Vanguard, Duelist, Ranger
- 30 side missions with rewards
- Modes: New Game+, Endless Mode, Boss Rush, seeded Daily Challenge
- Shop: skins, stat upgrades, permanent artifacts
- Local save + optional Supabase cloud (disabled by default)
- PWA, touch controls, accessibility
- FR/EN interface

## Community and license

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Apache-2.0 license](LICENSE)
- [Report a bug or suggest a feature](https://github.com/WIYOTL/dungeons-the-curse-of-the-dungeon/issues)

The contents of this repository are distributed under the Apache-2.0 license, except for the Wiyotl name, trademarks, and logos, which are not licensed by it.

---

**Wiyotl est une marque déposée. Tous droits réservés.**
