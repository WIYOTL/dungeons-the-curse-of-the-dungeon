# Changelog

## V1.1.2 — 25 novembre 2026

### Ajout
- Panneau « Progression & Défis » : ligne « Leviers activés · X / 10 » dans les Statistiques avancées (leviers de campagne activés sur l'objectif de 10, plafonné à 10) ; localisée FR/EN
- Panneau « Progression & Défis » : stat « Leviers X / 10 » en tête du panneau (zone statistiques), visible immédiatement sans défiler sur mobile
- Compteur de leviers fiabilisé : suivi par clé unique `w{monde}-l{niveau}` persistée dans la sauvegarde — le compteur se reconstruit automatiquement depuis ces clés s'il est perdu (`max(compteur, clés)`), est sauvegardé immédiatement à chaque activation (plus aucune fenêtre de perte en cas de mort/quit/crash), et rejouer un niveau à levier ne le gonfle plus (comptage de leviers uniques)
- Sauvegarde du levier désormais immédiate (`saveGame(true)`, sans le debounce de 400 ms) à l'activation — sur mobile, quitter/verrouiller l'écran pendant la fenêtre du debounce perdait le levier qui venait d'être activé (compteur 0/10 au relancement alors que la notification s'était affichée)
- Affichage auto-réparé du compteur de leviers : le panneau « Progression & Défis » prend le max entre le compteur en mémoire et celui persisté dans la sauvegarde (`dungeonsSave`) — même si l'état en mémoire est perdu, l'affichage reflète la sauvegarde
- Pied de page diagnostique étendu : « Version 1.1.2 · build … · save … · storage OK/FAIL · saved levers N » — en un coup d'œil sur téléphone : fichiers JS à jour (build + save), écriture du stockage fonctionnelle (storage), nombre de leviers réellement persistés (saved levers) ; marqueurs non traduits volontairement (diagnostic neutre) ; cache service worker passé à `dungeons-shell-v7`
- Diagnostics « vieux JS en cache » : marqueur de build `window.__DUNGEONS_BUILD = '1.1.2-build6-levers'` affiché au pied de l'écran titre (« Version 1.1.2 · build … ») — si ce libellé est absent sur un téléphone, c'est la preuve visuelle que le JS exécuté est périmé (cache Safari/service worker) et non un bug du jeu ; cache du service worker passé à `dungeons-shell-v6` pour pousser ces changements aux appareils déjà venus
- Buffer de tap sur les contrôles tactiles (joystick, boutons d'action) : sur mobile, un tap très court peut durer moins d'une frame et être raté par la boucle de jeu — tout appui est désormais maintenu au minimum 100 ms (release différé avec annulation au ré-appui), l'activation des leviers via le bouton AGIR devient fiable sur iPhone

### Correction
- Compteur de leviers toujours à 0/10 sur iPhone déjà venu : le service worker servait les scripts en cache-first sans revalidation — même après déploiement du nouveau code, l'iPhone continuait d'exécuter l'ancien `js/save-progression.js` (le pied de page diagnostique n'affichait que « Version 1.1.2 », sans marqueur de build). Le fetch des assets passe en réseau-d'abord avec cache en secours hors ligne (chaque réponse réseau rafraîchit le cache), cache bumpé à `dungeons-shell-v8`, script du SW exclu du cache HTTP (`updateViaCache: 'none'`), vérification de mise à jour au chargement, et rechargement automatique unique quand un nouveau SW prend le contrôle (garde-fou anti-boucle via `sessionStorage`). Vérifié par simulation WebKit (moteur Safari) : vieux JS en cache → déploiement sans bump → nouveau code servi au rechargement, cache de secours alimenté ; tests leviers (tap AGIR mobile, affichage 0/10, plafond, EN) et 14 e2e passants
- Serveur de test local : `python3 -m http.server` n'envoyait aucun en-tête `Cache-Control` — Safari iPhone pouvait servir des scripts périmés depuis son cache heuristique (d'où « ligne leviers toujours absente » en test local malgré le code à jour). `Serveur-Test-Iphone.command` remplace le serveur par un équivalent avec `Cache-Control: no-cache, no-store, must-revalidate` ; si une ancienne version persiste, fermer l'onglet Safari puis rouvrir l'URL
- Mises à jour invisibles sur iPhone/Android : le service worker servait les scripts en cache-first sans revalidation et `CACHE_NAME` était resté à `dungeons-shell-v4` — les téléphones continuaient d'exécuter l'ancien `js/save-progression.js` (ligne leviers absente) et l'ancien correctif anti-zoom. Cache passé à `dungeons-shell-v5` : à la prochaine visite, le nouveau service worker recache tous les assets depuis le réseau et purge le cache v4 (vérifié par simulation : ancien SW v4 en cache → bump → nouveau code servi). Après publication, fermer puis rouvrir la page/PWA suffit ; en cas de doute, recharger une seconde fois
- Zoom tactile accidentel en partie (iPhone/Android) : appuyer sur les contrôles (joystick, boutons d'action) déclenchait fréquemment un zoom de la page qui rendait la partie injouable. Triple correction — meta viewport durcie (`maximum-scale=1.0, user-scalable=no`, ôte le zoom double-tap Android) ; `touch-action: none` sur le canvas et son conteneur et `touch-action: manipulation` sur l'HUD/boutons en partie (supprime le zoom double-tap là où l'utilisateur joue) ; blocage des gestes `gesturestart`/`gesturechange` iOS en pleine partie uniquement (les menus restent zoomables pour l'accessibilité). Durcissement : `gestureend` également bloqué, pincement à deux doigts (`touchmove` multi-touch) bloqué, double-tap (`dblclick`) et zoom Ctrl+molette bloqués en pleine partie, sélection de texte et appel long-press désactivés (`user-select: none`, `-webkit-touch-callout: none`) pour éviter la loupe iOS sur l'HUD. Nouveau durcissement (zoom résiduel sur le joystick) : les contrôles tactiles (joystick, boutons d'action) coupent tout comportement tactile par défaut au niveau des événements `touchstart`/`touchmove`/`touchend` (Safari décide du zoom via les événements touch, ignorés jusque-là) ; un second doigt posé en pleine partie ne peut plus initier de pincement ; garde double-tap au niveau document (second tap < 350 ms prévenu, tap isolé préservé, overlays de pause/menus exclus pour ne pas avaler leurs clics)
- Écran noir au lancement (iPhone, macOS, Windows) : balise `</div>` manquante dans `#victory-screen` — l'HUD, le canvas, le tutoriel et les contrôles tactiles étaient imbriqués dans cet écran masqué (`display: none`) et restaient à 0×0 ; aucun CSS ne pouvait corriger les dimensions
- Libellé « · MAX » des PV désormais réservé au plafond de 300 PV atteint (menu et HUD en jeu) — « 120 / 120 » en début de partie n'affiche plus MAX ; aligné sur la sémantique vitesse/défense/dégâts
- CSS : accolade `}` excédentaire après `@media (max-width: 420px)` supprimée (résidu inerte mais source de confusion)
- M1: Timer Speed-run basé sur `performance.now()` (temps mural) au lieu de comptage de frames — fiable même en cas de lag ou onglet en arrière-plan
- M2: `saveWritesAuthorized` autorisé dès que le stockage local fonctionne (test écriture/lecture), plus bloqué si une sauvegarde existe déjà
- CSP: Ajout Content-Security-Policy stricte (`script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`, `connect-src 'self' https://*.supabase.co`)
- N6: Fallback 3s sur le jalon `screen-painted` (écran de chargement) pour éviter blocage si rAF ne tire pas (onglet arrière-plan)
- `buyDamageUpgrade` (alias inutilisé de `buyAttackUpgrade`) supprimé
- Plancher défense 0.1 appliqué dans `applyBuildStats()` (cohérence avec vitesse 0.1)
- Date défi quotidien : utilise fuseau horaire local (`getLocalDateString()`) au lieu d'UTC (`toISOString()`)

### Divers
- Tests e2e : 14/14 passants ; poll de la parade dans `campaign-combat.spec.js` élargi de 1 s à 3 s (test instable sous charge parallèle headful)
- Script de vérification anti-zoom tactile ajouté (`.vibe-scratch/touch-zoom-test.js`) : meta viewport, touch-action calculé, gardes de gestes (gesture*, touchmove/touchstart multi-touch, dblclick, Ctrl+molette, user-select), defaults touch coupés sur joystick/boutons, garde double-tap document avec clics préservés, pause cliquable, double-tap sur écran mobile émulé (26 vérifications)
- Script de vérification du compteur de leviers ajouté (`.vibe-scratch/levers-panel-test.js`) : affichage 0/7/10 en table ET en stat héros, plafond, traduction EN (9 vérifications)
- Script e2e de mise à jour du service worker ajouté (`.vibe-scratch/sw-update-test.js`) : ancien cache v4 simulé → bump v5 → nouveau code servi, ancien cache purgé
- Tests repro levier relancés après buffer de tap : activation mobile via bouton AGIR (tap court), repro clavier complet (10/10 : activation, persistance, rechargement, auto-réparation, pas de double comptage), anti-zoom 26 vérifications — tous passants
- Script de vérification du pied de page diagnostique ajouté (`.vibe-scratch/build-stamp-test.js`) : marqueurs build/save présents, storage OK, compteur persisté affiché et mis à jour après activation + rechargement (5 vérifications)
- README FR/EN : version 1.1.2, 4e archétype (Paladin) mentionné, suivi de complétion détaillé (défis, builds, difficultés, leviers)
- 100 % de complétion audité et atteignable : poids = 100 exactement, 10 leviers générés par campagne (= cible), mission « Fini les missions secondaires ! » auto-complétée à 29/29 autres missions
- Lanceur `Serveur-Test-Iphone.command` ajouté à la racine pour les tests locaux sur iPhone

## V1.1.1 — 21 novembre 2026

### Correction
- Paladin "Bouclier absorbant" implémenté : 25% chance de bloquer un coup entrant (sonnerie + texte "BLOQUÉ")
- AudioContext resume : `playUiTone`, `startAmbientMusic`, `playCue` maintenant async avec `await audioContext.resume()`
- `validateImportedSave` assoupli : `buildModifiers` et `shopUpgrades` optionnels (null/undefined acceptés pour vieilles sauvegardes)
- Séparation vector optimisé : spatial hash grid (80px cells) O(n²) → O(n)
- `runtimeError` remis à null sur `loadLevel()` succès
- Typos FR : "déjà" (était "deja"), "Récupère" (était "Récupérez"), "Obtient" (était "Obtenez"), "Subit" (était "Subissez")
- HTML : suppression `</div>` orphelin, wrapper cloud-save-section, verbes boutique harmonisés (3e personne)

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

### Responsive & Mobile (V1.1.1)
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
- Passage de la version 1.1.0 à 1.1.1
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
