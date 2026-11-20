# Changelog

## V1.1.0 — 20 novembre 2026

### Ajout
- Plafond de vitesse du joueur (8 maximum)
- Section « Complétion du jeu » visible dans le menu titre
- Nouveau build : Paladin (bouclier absorbant + soin par parade réussie)
- Nouvel artefact boutique : Vampirisme (soins sur coup critique)
- Badge visuel « Collectionneur complet » quand les 19 produits de la boutique sont achetés
- Interface FR/EN

### Correction
- PV de départ fixés à 120 (étaient 100, le build Vanguard appliquait un multiplicateur ×1,2)
- Plancher de 120 PV appliqué aussi à la sélection de build : Duelist et Ranger restaient à 114 PV, et les PV changeaient au rechargement
- Bornes de validation des modificateurs de build dérivées de `BUILD_DEFINITIONS` : les sauvegardes Paladin (`dashSpeed` 0,9) étaient rejetées au rechargement
- Sous-titre de victoire scindé pour être traduit, et boutons « PARTAGER LE RÉSULTAT » localisés
- Textes canvas « +N PV » et « PARADE » localisés en FR/EN
- Défense de départ fixée à 10 % pour tous les builds (le bonus défense spécifique de Vanguard est restauré)
- Bouton « ACHETÉ » qui s'affiche après l'achat d'un artefact permanent dans la boutique
- Vitesse d'achat : `player.speed += 0.3` rétabli avant `applyBuildStats()` pour atteindre le plafond de 8.0
- Artefacts bloqués : filtre des capacités au chargement incluait désormais 'vampirism'
- Boutons de la boutique traduits (window.t : ACHETER, ACHETÉ / OWNED ✓, ÉQUIPÉ ✓, MAX)
- Notifications traduites automatiquement au changement de langue (écouteur dungeons:language-changed)
- Tous les showNotification() enveloppés avec window.t() pour le support FR/EN complet
- Traduction des messages de progression, sauvetage, Boss-Rush, Mode Sans Fin, sauvegarde cloud, slots
- Sauvegarde : `saveWritesAuthorized` correctement déclaré et remis à `true` dans `loadGameSave()` quand il n'y a pas de fichier de sauvegarde. Les achats étaient perdus au rechargement sans cela.
- Bouton boutique : affiche "ACHETÉ" / "OWNED" quand l'artefact est déjà possédé (y compris via un choix de progression en niveau), pas seulement quand acheté en boutique.
- Notification « ACHETÉ » lors de l'achat d'un artefact ou d'un skin (au lieu du message d'activation personnalisé).
- Bouton vitesse : affiche "MAX" quand la vitesse atteint le plafond de 8.0
- Collectionneur : `markPurchasedProduct()` appelé aussi quand un artefact est obtenu via un choix de progression en niveau (Precision, Flamme ardente, Relique de givre, Égide protectrice, Relique sanguinaire, Idole dorée, Cœur de pierre). La mission « Le collectionneur » peut maintenant atteindre 19/19 produits.
- Tous les messages de jeu traduits (builds, ennemis, difficultés, choix de progression, récompenses de missions, maîtrise du sans-fin)

### Responsive & Mobile (V1.1.0)
- Viewport meta : `interactive-widget=resizes-content` ajouté (clavier mobile ne recouvre plus le contenu)
- CSS custom properties : breakpoints (`--bp-xs` à `--bp-xxl`) et `--touch-target` (44px) définis
- Boutons : `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, `min-height: 44px` (WCAG)
- Contrôles tactiles : dimensionnement fluide avec `clamp()` au lieu de tailles fixes par breakpoint
- Joystick : `clamp(100px, 18vw, 140px)`, boutons action : `clamp(44px, 8vw, 54px)`
- Paysage mobile : media query dédiée pour canvas et contrôles tactiles en paysage
- Suppression des overrides redondants de taille de touche dans les media queries
- Body : `overflow-x: hidden`, `overscroll-behavior: none`, `-webkit-overflow-scrolling: touch`
- Boutons overlay : `min-height: 44px`, `touch-action: manipulation` déjà présents
- Menu titre paysage : grille en colonne unique, zones grid pour menu / progression / stats / complétion, boutons avec retour à la ligne automatique
- Panneau « Progression et Défis » : positionné dans la grid du menu titre, largeur max 100% sur mobile
- Encadré « Complétion du jeu » : positionné dans la grid du menu titre, entre stats et mentions légales
- Stats joueur : `overflow-wrap: anywhere`, `white-space: normal` sur les boutons et divs de stats pour éviter le tronçage des nombres (PV, attaque, défense, vitesse, or) sur mobile
- `min-width: 0` sur tous les items de grid du menu titre pour prévenir le débordement
- Sauvegarde : `player.maxHp` forcé à `BASE_PLAYER_HP` (120) minimum au chargement, même sur anciennes sauvegardes v12 — Vanguard donne bien 120 PV sur tous les appareils
- Sauvegarde : `player.defense` forcé à 0.1 minimum au chargement — cohérence entre PC et mobile

### Divers
- Passage de la version 1.0.0 à 1.1.0
- Test unitaire shop audit mis à jour (18 → 19 produits)
- Test e2e `build-stats.spec.js` : plancher de PV et stabilité des 4 builds en session et après rechargement
- Workflow Pages : artefact limité à `dist/` (index, privacy, manifeste, service worker, scripts, icônes, logo) au lieu du dépôt complet

## V1.0.0 — 11 novembre 2026

- Version initiale
- Campagne : 3 mondes, 21 niveaux, 3 boss
- 7 salles secrètes
- 3 builds : Vanguard, Duelist, Ranger
- 30 missions secondaires avec récompenses
- Modes : New Game+, Mode Sans Fin, Boss-Rush, Défi Quotidien seedé
- Boutique : skins, améliorations de caractéristiques, artefacts permanents
- Sauvegarde locale + cloud Supabase optionnel (désactivé par défaut)
- PWA, contrôles tactiles, accessibilité
