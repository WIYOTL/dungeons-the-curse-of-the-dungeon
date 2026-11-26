# Publication web and sauvegardes cloud

## GitHub Pages

1. Placez le projet dans un dépôt GitHub et poussez la branche `main` ou `master`.
2. Dans **Settings → Pages**, choisissez **GitHub Actions** comme source de publication.
3. Le workflow `.github/workflows/pages.yml` vérifie les tests et le build, puis publie le site en HTTPS. Les URL relatives permettent le déploiement sous le chemin du dépôt.
4. Le manifeste et le service worker rendent le jeu installable et mettent en cache le shell statique. Le premier lancement hors ligne exige une visite en ligne réussie.

La publication effective nécessite un dépôt GitHub et l’activation de Pages ; elle n’est pas déclenchée depuis ce dossier local.

## Supabase Auth et synchronisation

1. Créez un projet Supabase et exécutez `supabase-schema.sql` une fois dans son SQL Editor.
2. Dans `js/supabase-config.js`, renseignez l’URL du projet et sa clé **anon/publishable** publique. Cette configuration est visible dans le navigateur ; n’y mettez jamais la clé `service_role`.
3. Dans Supabase Auth, configurez l’URL de redirection du site Pages et les règles de confirmation d’adresse e-mail souhaitées.
4. Créez un compte depuis **Options → Sauvegarde cloud**, connectez-vous, puis choisissez explicitement **Envoyer** ou **Charger**.

Les politiques RLS limitent chaque ligne à son propriétaire. Le chargement cloud valide le format avant de remplacer la progression locale ; l’envoi n’est jamais automatique. Le client Supabase est chargé depuis jsDelivr uniquement lorsqu’une fonction cloud est utilisée. Les comptes et la synchronisation nécessitent HTTPS et une connexion.

## Vérification locale

```sh
npm ci
npx playwright install chromium
npm test
npm run build
```

`npm test` exécute les tests unitaires et les parcours Playwright dans Chromium. GitHub Actions installe le navigateur automatiquement avant de lancer les tests.

## Confidentialité et assistance

La page `privacy.html` décrit le stockage local, la synchronisation Supabase facultative et le contact de support. Avant d’ouvrir les comptes cloud au public, compléter les coordonnées juridiques de Wiyotl, fixer une durée de conservation et définir une procédure de suppression des comptes et sauvegardes. La configuration Supabase est vide par défaut ; l’authentification cloud nécessite un projet configuré et le schéma déployé.
