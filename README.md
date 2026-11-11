# Dungeons: The Curse of the Dungeon

[Français](README.md) · [English](README_en.md)

**Jouer en ligne :** [wiyotl.github.io/dungeons-the-curse-of-the-dungeon](https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/)

Jeu d’action fantastique jouable dans un navigateur, sur ordinateur et sur mobile. Explorez les donjons, combattez leurs gardiens et levez la malédiction.

## Contenu

- Une campagne de **3 mondes et 21 niveaux**, avec des boss et **7 salles secrètes**.
- Combat en temps réel, plusieurs archétypes de héros, améliorations et boutique.
- Défis quotidiens à seed partageable, mode sans fin et **New Game+**.
- Tutoriel interactif et options d’accessibilité : contraste renforcé, texte agrandi et animations réduites.
- Installation possible comme application web progressive (PWA).

## Commandes

| Action | Clavier |
| --- | --- |
| Déplacement | Z, Q, S, D ou flèches directionnelles |
| Attaque | Espace |
| Interagir | E |
| Parade | F |
| Dash | Maj |
| Pause | P ou Échap |

Sur écran tactile, utilisez le joystick et les boutons affichés à l’écran.

## Jouer en local

Le jeu est statique et ne nécessite pas de backend pour jouer. Avec Python 3 :

```sh
python3 -m http.server 8000
```

Ouvrez ensuite <http://localhost:8000/>. Pour tester depuis un téléphone sur le même Wi-Fi, démarrez plutôt le serveur avec `python3 -m http.server 8000 --bind 0.0.0.0`, puis ouvrez `http://<adresse-IP-de-l-ordinateur>:8000/`. L’ordinateur et le serveur doivent rester allumés pendant le test local.

Pour tester la version publiée, rendez-vous sur le [site GitHub Pages](https://wiyotl.github.io/dungeons-the-curse-of-the-dungeon/). L’accès à cette version ne dépend pas de votre ordinateur.

## Progression et confidentialité

La progression est enregistrée localement dans le navigateur. La synchronisation cloud Supabase est facultative et **n’est pas configurée par défaut**. Les données, l’assistance et les détails de confidentialité sont présentés dans la [politique de confidentialité](privacy.html).

La PWA doit être ouverte une première fois en ligne pour mettre ses fichiers en cache; certaines fonctionnalités nécessitent toujours une connexion.

## Développement et tests

Prérequis : Node.js et npm.

```sh
npm ci
npx playwright install chromium
npm test
npm run build
```

`npm test` lance les tests unitaires et les parcours navigateur Playwright. Le workflow [GitHub Actions](.github/workflows/pages.yml) exécute les tests et le build avant chaque publication sur Pages.

Voir le [guide de déploiement](DEPLOYMENT.md) pour les détails de publication et de configuration des sauvegardes cloud.
