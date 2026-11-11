# Dungeons: The Curse of the Dungeon

[Français](README.md) · [English](README_en.md)

**Play online:** [wiyotl.github.io/dungeons-the-curse-of-the-dungeon](https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/)

A fantasy action game you can play in a browser on desktop or mobile. Explore the dungeons, fight their guardians, and lift the curse.

## Features

- A campaign with **3 worlds and 21 levels**, including bosses and **7 secret rooms**.
- Real-time combat, multiple hero archetypes, upgrades, and a shop.
- Shareable seeded daily challenges, Endless mode, and **New Game+**.
- An interactive tutorial and accessibility options: high contrast, larger text, and reduced motion.
- Installable as a Progressive Web App (PWA).

## Controls

| Action | Keyboard |
| --- | --- |
| Move | Z, Q, S, D or arrow keys |
| Attack | Space |
| Interact | E |
| Parry | F |
| Dash | Shift |
| Pause | P or Esc |

On touchscreens, use the on-screen joystick and action buttons.

## Run locally

The game is static and does not require a backend to play. With Python 3:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. To test on a phone on the same Wi-Fi network, start the server with `python3 -m http.server 8000 --bind 0.0.0.0`, then open `http://<your-computer-IP>:8000/`. The computer and local server must stay on while testing this way.

To play the published version, visit the [GitHub Pages site](https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/). You do not need to keep your computer running to access it.

## Progress and privacy

Progress is saved locally in the browser. Optional Supabase cloud sync is **not configured by default**. See the [privacy policy](privacy.html) for information about data, privacy, and support.

The PWA must be opened online once to cache its files; some features still require an internet connection.

## Development and tests

Requirements: Node.js and npm.

```sh
npm ci
npx playwright install chromium
npm test
npm run build
```

`npm test` runs unit tests and Playwright browser journeys. The [GitHub Actions workflow](.github/workflows/pages.yml) runs tests and the build before each Pages deployment.

See the [deployment guide](DEPLOYMENT.md) for publishing and cloud-save configuration details.
