# 📋 Changelog – IkoChess

## v2.1.0 – Sprint 1 · Titres & Profils (11 mars 2026)

### ✨ Ajouts
- **Système de titres** avec icônes pièces d'échecs :
  - ♟ Novice (<800) → ♞ Amateur → ♝ Joueur → ♜ Expert → ♛ Maître → ♚ Grand Maître → 👑 Légende (1800+)
  - Titre mis à jour automatiquement après chaque partie
- **Suivi des streaks** : série de victoires actuelle + meilleur streak historique
- **Profil joueur** via socket `get-profile` (stats complètes, 10 dernières parties, historique des saisons)
- **Leaderboard global** via socket `get-leaderboard` (classement ELO)
- **Table `season_history`** pour archiver les performances par saison

### 🐛 Corrections (pré-Sprint)
- Promotion : choix Dame/Tour/Cavalier/Fou (plus de promotion auto en Dame)
- Règle des 50 coups détectée avec raison distincte
- Game Over Modal : affiche correctement titre, message, ELO, variation
- AI : clone du game state (plus de race condition move/undo)
- Protection du tour en mode AI (plus de bypass)
- Promotion + capture détectée en tap-to-move
- Statut challenge → `finished` dans Supabase
- Émojis : `send-emoji` (plus de mismatch)
- Abandon et Nulle : fonctionnels
- Nettoyage mémoire des parties terminées (60s)

### 🗃️ Supabase
- `players` : colonnes `title`, `win_streak`, `best_streak` ajoutées
- Table `season_history` créée
- Titres calculés pour les joueurs existants

---

## v2.0.0 – Refactoring Architecture (mars 2026)

- Migration monolithique → architecture modulaire (controllers, game engine)
- Intégration Socket.io avec rooms dédiées
- Stockfish AI avec niveaux de difficulté
- Système ELO complet
- Mode spectateur en temps réel
- Émojis en jeu
- Timers validés côté serveur
