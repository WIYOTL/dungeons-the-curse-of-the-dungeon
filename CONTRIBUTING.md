# Contribuer / Contributing

Merci de vouloir améliorer *Dungeons: The Curse of the Dungeon* ! Les corrections, retours de test, améliorations d’accessibilité et idées de contenu sont les bienvenus.

Thanks for helping improve *Dungeons: The Curse of the Dungeon*! Bug fixes, testing feedback, accessibility improvements, and content ideas are welcome.

## Avant de commencer / Before you start

- Pour un bug ou une idée, utilisez les modèles d’issue du dépôt.
- Pour un changement important, ouvrez d’abord une issue afin de discuter de son périmètre.
- Gardez les contributions ciblées et cohérentes avec le jeu web statique.
- N’incluez jamais de secrets, jetons, données personnelles ni captures contenant des informations privées.

- Use the repository issue templates for bugs and feature ideas.
- For a larger change, open an issue first to discuss its scope.
- Keep contributions focused and consistent with the static web game.
- Never include secrets, tokens, personal data, or screenshots containing private information.

## Préparer l’environnement / Set up

Prérequis : Node.js 22 ou une version compatible et npm. Depuis la racine du projet :

Requirements: Node.js 22 or a compatible version, and npm. From the project root:

```sh
npm ci
npx playwright install chromium
```

Pour lancer le jeu localement, démarrez un serveur statique :

To run the game locally, start a static server:

```sh
python3 -m http.server 8000
```

Ouvrez <http://localhost:8000/>. Pour vérifier l’affichage mobile, testez aussi un viewport étroit ou un appareil tactile.

Open <http://localhost:8000/>. To check mobile layouts, also test a narrow viewport or a touch device.

## Vérifications / Checks

Avant d’ouvrir une pull request, lancez :

Before opening a pull request, run:

```sh
npm test
npm run build
```

Signalez les commandes exécutées et leurs résultats. Pour les changements visuels, ajoutez des captures d’écran ordinateur et/ou mobile.

List the commands you ran and their results. For visual changes, include desktop and/or mobile screenshots.

## Ouvrir une pull request / Open a pull request

1. Créez une branche dédiée à votre changement.
2. Décrivez le problème, la solution et les éventuelles limites.
3. Reliez l’issue correspondante, le cas échéant.
4. Vérifiez les tests, le build, l’affichage mobile et les liens de documentation concernés.

1. Create a branch dedicated to your change.
2. Describe the problem, your solution, and any limitations.
3. Link the related issue, if applicable.
4. Check tests, build, mobile rendering, and any affected documentation links.

Les contributions soumises au dépôt sont proposées sous les termes de la licence Apache-2.0, sauf indication écrite contraire.

Contributions submitted to this repository are offered under the Apache-2.0 license unless explicitly stated otherwise in writing.
