# Documentation du Nouveau Systeme IkoChess

Cette documentation decrit les changements implementes sur le flux OpenClaw x IkoChess, les garanties a conserver, et la maniere d'utiliser le systeme durci.

## Objectif

Le systeme a ete durci sans changer l'experience Telegram existante :

- les defis continuent d'etre lances depuis les groupes Telegram ;
- les boutons du groupe restent des boutons callback, pas des boutons lien ;
- les liens de jeu continuent d'etre envoyes en DM ;
- le lien de spectateur continue d'etre partage dans le groupe ;

Le but etait de corriger les faiblesses critiques sans casser le workflow actuel.

## Ce qui a ete fait

### 1. Liens signes pour les joueurs et les spectateurs

Avant :

- les URLs de jeu utilisaient `?game=<id>&player=<telegramId>`;
- le serveur faisait confiance a l'identite envoyee par le client ;
- un lien modifie pouvait permettre d'usurper une place.

Maintenant :

- les URLs joueur utilisent `?game=<id>&seat=<token_signe>`;
- les URLs spectateur utilisent `?watch=<id>&spectate=<token_signe>`;
- les tokens sont signes cote serveur avec la cle de service Supabase deja presente ;
- le serveur verifie le token avant d'autoriser l'entree, les coups, l'abandon, le profil et les themes.

Consequence :

- un joueur ne peut plus simplement changer l'URL pour prendre la place de l'autre ;
- un spectateur ne peut pas devenir joueur via le socket ;
- les actions sensibles ne reposent plus sur un `telegramId` fourni par le client.

### 2. Authentification socket durcie

Les evenements socket suivants sont maintenant proteges par la session joueur authentifiee :

- `join-challenge`
- `player-ready`
- `make-move`
- `resign`
- `get-profile`
- `get-themes`
- `set-theme`
- `get-active-theme`

Le serveur derive l'identite du joueur depuis le token signe, pas depuis le payload du navigateur.

### 3. Nouveau cycle de vie des defis

Le cycle de vie est maintenant explicite :

- `pending`
- `accepted`
- `playing`
- `finished`
- `cancelled`
- `expired`

Regles principales :

- un defi humain cree via `/chess` expire apres 10 minutes s'il n'est pas accepte ;
- un defi accepte passe ensuite sur une fenetre d'ouverture/preparation ;
- si les joueurs ne deviennent pas prets a temps, la partie expire ;
- un ancien lien `finished`, `cancelled` ou `expired` ne peut plus recreer une partie.

### 4. Acceptation atomique d'un defi

L'acceptation d'un defi n'est plus un simple read-then-update fragile.

Le serveur :

- n'accepte le defi que si son statut est encore `pending` ;
- rejette les doubles acceptations concurrentes ;
- rejette l'auto-acceptation du createur ;
- retourne directement les URLs signees des deux joueurs et du mode spectateur.

### 5. Watch flow et liste des parties en cours

Le mode spectateur a ete aligne sur le nouveau systeme :

- le lien de spectateur est genere par IkoChess ;
- `/games` dans OpenClaw ne reconstruit plus les liens ;
- la liste des parties en cours passe par l'API IkoChess ;
- le lien de watch reste partage dans le groupe comme avant.

### 6. IA corrigee

Deux corrections importantes ont ete faites :

- le bug de variable `userId` dans `/chess_ai` a ete corrige ;
- le niveau `master` est maintenant mappe vers le preset moteur le plus fort.

### 7. Classement canonique en ELO

Le classement principal renvoye par l'API et affiche dans OpenClaw est maintenant trie par `elo`.

Le `score` reste visible comme metrique secondaire, mais le systeme de competition principal devient :

- ELO pour la force ;
- score en metrique communautaire / saisonniere.

### 8. Normalisation des groupes

Le code chess n'utilise plus `groups.id` comme identifiant Telegram implicite.

La reference groupe cote chess devient :

- `groups.telegram_chat_id`

Cela evite les divergences entre OpenClaw et IkoChess.

### 9. Persistance des parties actives

Une couche de persistance `active_games` a ete preparee pour stocker :

- FEN courant ;
- historique des coups ;
- timers ;
- etat ready ;
- statut de partie ;
- metadonnees IA ;
- groupe d'origine ;
- resultat / raison / vainqueur ;
- derniere activite.

But :

- permettre reprise, reprise apres redemarrage, et mode spectateur durable.

Important :

- le code est pret ;
- le schema SQL est fourni ;
- si la table `active_games` n'existe pas encore en base, le systeme bascule en mode de compatibilite pour ne pas casser le workflow actuel.

## Comment utiliser le nouveau systeme

## 1. Partie joueur contre joueur

### Depuis Telegram

1. Dans un groupe, un joueur lance `/chess`.
2. OpenClaw publie le message de defi dans le groupe avec les boutons existants :
   - `Accepter le defi`
   - `Annuler`
3. Un autre joueur clique sur `Accepter le defi`.
4. OpenClaw envoie un DM a chaque joueur avec son lien personnel de jeu.
5. OpenClaw met a jour le message de groupe avec le lien de spectateur.

### Cote joueur

1. Ouvrir le lien recu en DM.
2. Le navigateur rejoint la partie avec le token `seat`.
3. Cliquer sur `Je suis pret`.
4. Quand les deux joueurs sont prets, la pendule commence.

Ce qui change pour l'utilisateur :

- rien visuellement dans le workflow Telegram ;
- mais le lien DM est maintenant personnel et non falsifiable facilement.

## 2. Partie contre l'IA

### Depuis Telegram

1. Lancer `/chess_ai`.
2. Choisir un niveau :
   - `easy`
   - `medium`
   - `hard`
   - `master`
3. OpenClaw envoie le lien de jeu en DM.

### Cote joueur

1. Ouvrir le DM.
2. Cliquer sur `Jouer maintenant`.
3. Le lien contient un token `seat` signe.
4. La partie charge directement avec l'IA.

## 3. Regarder une partie

### Depuis Telegram

1. Une fois le defi accepte, le groupe affiche toujours `Regarder en direct`.
2. Ce lien pointe maintenant vers une URL de spectateur signee.

### Cote spectateur

1. Ouvrir le lien du groupe.
2. Le client rejoint le salon en mode `watch`.
3. Le spectateur ne peut ni jouer, ni resign, ni agir comme un joueur.

## 4. Voir les parties en cours

La commande `/games` :

- interroge maintenant l'API IkoChess ;
- affiche les parties actives ;
- conserve les boutons Telegram existants.

## 5. Voir le classement

La commande `/games_ranking` :

- utilise l'API IkoChess ;
- affiche un classement trie par ELO ;
- conserve le format Telegram existant.

## Comportement attendu et invariants

Ces points doivent rester vrais apres toute modification future :

- ne pas remplacer les boutons callback du groupe par des boutons lien ;
- ne pas supprimer l'envoi des liens de jeu en DM ;
- ne pas supprimer le lien de watch dans le groupe ;
- ne pas refaire confiance a `telegramId` envoye par le client ;
- ne pas reutiliser `groups.id` comme identifiant Telegram de groupe ;
- ne pas reouvrir une partie terminee avec un ancien lien ;
- ne pas casser les commandes existantes `/chess`, `/chess_ai`, `/chess_accept`, `/chess_decline`, `/games`, `/games_ranking`.

## Schema et exploitation

Le fichier de reference du schema est :

- `supabase-schema.sql`

Il contient maintenant :

- `players`
- `games`
- `chess_challenges`
- `active_games`
- `themes`
- `player_themes`
- `tournaments`
- `tournament_participants`
- `season_history`

## Etat actuel de deploiement

Le code applicatif est pret, mais il y a un point important cote base :

- si `active_games` n'est pas encore cree dans Supabase, la persistance complete des parties actives n'est pas encore activee ;
- le systeme reste compatible grace au mode fallback ;
- pour activer totalement la reprise durable et la persistence des spectateurs, il faut appliquer `supabase-schema.sql` dans Supabase.

## Limitations temporaires tant que `active_games` n'est pas applique

- reprise apres redemarrage limitee ;
- spectateur durable apres restart non garanti ;
- certaines protections de persistence fonctionnent en mode degrade.

Les protections suivantes restent actives meme sans `active_games` :

- liens signes ;
- verification d'identite ;
- acceptation atomique ;
- expiration des defis ;
- protection contre la reouverture d'anciens liens ;
- classement ELO cote API ;
- nouveau flow OpenClaw -> IkoChess.

## Checklist d'utilisation

### Cote produit

- `/chess` cree un defi dans le groupe ;
- `/chess_accept` envoie les deux liens joueurs en DM ;
- le groupe affiche le lien `Regarder en direct` ;
- `/chess_decline` annule le defi via l'API ;
- `/games` liste les parties actives ;
- `/games_ranking` affiche le classement ELO.

### Cote securite

- modifier `seat` dans l'URL doit echouer ;
- reutiliser un lien termine doit echouer ;
- un spectateur ne doit pas pouvoir jouer ;
- un joueur ne doit pas pouvoir changer de place.

### Cote exploitation

- appliquer `supabase-schema.sql` pour activer la persistence `active_games` ;
- verifier que les URLs publiques pointent vers la bonne instance ;
- verifier les flows DM/groupe apres deploiement.

## Resume

Le nouveau systeme garde le meme usage Telegram, mais renforce fortement la securite et la coherence :

- liens joueurs/spectateurs signes ;
- serveur autoritaire sur l'identite ;
- cycle de vie des defis explicite ;
- acceptation concurrente securisee ;
- classement principal en ELO ;
- base preparee pour la persistence des parties actives.
