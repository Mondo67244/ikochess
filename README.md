<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" width="80" alt="Logo Telegram" />
  <img src="https://cdn-icons-png.flaticon.com/512/811/811462.png" width="80" alt="Logo Échecs" />

  # ♟️ IkoChess

  **L'application web d'échecs multijoueur en temps réel ultime, parfaitement intégrée aux groupes Telegram.**
  
  [English](README.en.md) | [**Français**](README.md)
</div>

<br />

IkoChess permet aux communautés Telegram de se défier directement dans leurs discussions de groupe, de jouer de manière transparente via les WebApps Telegram, d'augmenter leur classement mondial (ELO) et de regarder les matchs de leurs amis en direct en tant que spectateurs.

---

## ✨ Fonctionnalités

- ⚔️ **Intégration Telegram Profonde** : Lancez une partie directement depuis n'importe quel groupe Telegram en utilisant la commande `/chess` via le bot OpenClaw. Pas besoin de créer un compte – votre profil Telegram *est* votre compte.
- ⚡ **Multijoueur en Temps Réel Autoritaire** : Les coups sont validés côté serveur par `chess.js`, diffusés à toute la room via un flux autoritaire, et rollbackés proprement en cas de rejet.
- 🏆 **Système de Classement ELO** : Gagnez ou perdez des points ELO en fonction des résultats de vos matchs (Victoire/Défaite/Nul) contre des joueurs du monde entier.
- 👀 **Mode Spectateur en Direct** : Les membres du groupe peuvent ouvrir le même lien pour regarder les matchs en cours, avec un compteur de spectateurs en temps réel.
- 🤖 **IA Stockfish** : Entraînez-vous contre le moteur d'échecs directement sur le serveur, avec les niveaux `easy`, `medium`, `hard` et `master`.
- 💬 **Interactions Sociales** : Lancez des emojis (😤, 🔥, 💀) à travers le plateau pour distraire ou féliciter votre adversaire en pleine partie !
- ⏳ **Minuteurs Validés par le Serveur** : Des comptes à rebours très précis, synchronisés et validés purement côté serveur pour empêcher toute manipulation côté client.
- 🎯 **Lisibilité du Plateau** : Dernier coup mis en évidence, roi en échec highlighté, bandeau de statut enrichi, et historique compact des coups côté mobile.
- ♟️ **Promotion Complète sur Mobile** : Le tap-to-move ouvre désormais un vrai sélecteur de promotion, comme le drag-and-drop.
- 📱 **Interface Telegram Mobile-First** : Palette Telegram, modales cohérentes, feuilles scrollables, header et badges resserrés pour les petits écrans.

---

## 🧭 État Actuel du Jeu

Le flux Telegram reste volontairement inchangé :

- le défi est lancé dans le groupe via `/chess` ;
- les boutons du groupe restent des boutons callback ;
- les liens de jeu sont toujours envoyés en DM ;
- le lien spectateur continue d’être publié dans le groupe.

Le moteur de partie a en revanche été durci :

- liens joueur et spectateur signés ;
- serveur autoritaire sur l’identité et les coups ;
- synchronisation de partie unifiée via `move-applied` ;
- rejet propre des coups via `move-rejected` ;
- garde anti-double coup côté IA.

Point encore important :

- la persistance `active_games` est prête dans le code et le schéma, mais reste inactive tant que la table n’est pas appliquée dans Supabase.
- un script SQL autonome est aussi fourni dans [`sql/active_games.sql`](./sql/active_games.sql) pour créer uniquement cette table.

---

## 🛠️ Pile Technologique

IkoChess repose sur une pile JavaScript moderne et robuste, conçue pour une connectivité en temps réel extrêmement rapide et une scalabilité horizontale.

### Frontend
- ⚛️ **React 18** (`react`, `react-dom`) — Pour construire une interface utilisateur réactive à base de composants.
- ⚡ **Vite** — Outil et bundler frontend ultra-rapide.
- ♜ **React-Chessboard** & **Chess.js** — Pour un rendu visuel impeccable du plateau et une génération/validation stricte des mouvements légaux.
- 🔌 **Socket.io-Client** — Transmission instantanée et bidirectionnelle d'événements.

### Backend
- 🟢 **Node.js** & **Express** — Couche API rapide, pilotée par les événements et aux E/S non bloquantes.
- 🔌 **Socket.io** — L'épine dorsale de la diffusion des événements en temps réel (rooms, namespaces).
- 🗄️ **Supabase (PostgreSQL)** — Base de données en tant que service (Database-as-a-Service) pour stocker en toute sécurité les statistiques des joueurs, l'ELO et l'historique des matchs.
- 🐳 **Docker & Docker Compose** — Entièrement conteneurisé pour des déploiements rapides et agnostiques vis-à-vis des plateformes.
- 🧠 **Stockfish.js** *(Nouveau dans la V2)* — Moteur d'évaluation côté serveur.

---

## 🚀 Pour Commencer

Pour lancer une instance de développement locale de IkoChess, assurez-vous d'avoir installé **Node.js 20+** et **Docker**.

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-nom/ikochess.git
cd ikochess
```

### 2. Configurer les Variables d'Environnement

Créez un fichier `.env` à la racine et dans le répertoire `server/` :

```env
# Configuration Supabase
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anonyme_supabase
SUPABASE_SERVICE_KEY=votre_cle_de_service_supabase

# Ports
PORT=3000
VITE_SERVER_URL=http://localhost:3000
```

### 3. Construire et Démarrer via Docker

La façon la plus simple de démarrer à la fois le client compilé et le serveur backend :

```bash
docker compose up --build -d
```
*(L'application sera exposée sur `http://localhost:3000`)*

---

## 🏛️ Architecture & Refactoring (V2)
IkoChess a récemment subi un refactoring architectural majeur pour passer d'une structure monolithique à une conception de services hautement modulaire et découplée, comprenant des composants React, des contrôleurs Socket spécialisés et une intégration pub/sub Redis.

Pour une plongée en profondeur dans les modèles de conception du système, lisez la [**Documentation d'Architecture**](./IkoChess_Architecture.md).

---

## 📘 Documentation du Nouveau Systeme

Une documentation francaise dediee au systeme durci est disponible ici :

- [**NOUVEAU_SYSTEME.md**](./NOUVEAU_SYSTEME.md)

Elle explique :

- ce qui a ete modifie ;
- comment fonctionne le nouveau flux OpenClaw x IkoChess ;
- comment utiliser les nouveaux liens joueur et spectateur ;
- comment fonctionne le nouveau flux temps reel du plateau ;
- quelles ameliorations visuelles ont ete ajoutees dans le jeu ;
- ce qui reste a faire cote schema Supabase pour activer toute la persistance ;
- ou trouver le SQL autonome de `active_games`.

---

## 📜 Licence
Ce projet est sous [Licence MIT](LICENSE).
