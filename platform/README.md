# ft_root — Plateforme

Plateforme événementielle du club cybersécurité **ft_root** de 42Lyon.
Sera utilisée pour les CTF, workshops, et autres événements du club.

À ce stade, seules **la structure du projet** et **l'authentification 42**
sont implémentées. Les modules CTF/scoreboard/etc. viendront ensuite.

## Stack

- **Backend** — NestJS + Prisma (PostgreSQL) + JWT
- **Frontend** — Next.js (App Router)
- **Monorepo** — pnpm workspaces
- **Auth** — OAuth2 via l'intra 42 *uniquement* (aucun mot de passe)

## Structure

```
platform/
├── back/                NestJS API
│   ├── src/
│   │   ├── auth/        Routes OAuth 42, JWT, refresh
│   │   ├── users/       /me
│   │   └── core/        Prisma, env, guards, decorators
│   └── prisma/schema.prisma
├── front/               Next.js (App Router)
│   └── src/app/
│       ├── login/
│       ├── auth/callback/
│       └── dashboard/
├── shared/              Types/constants partagés
└── docker-compose.yml   Postgres dev
```

## Setup

### 1. Pré-requis

- Node.js ≥ 20
- pnpm
- Docker (pour Postgres)

### 2. Créer une app OAuth sur l'intra 42

Va sur <https://profile.intra.42.fr/oauth/applications/new> et crée une app
avec ce redirect URI :

```
http://localhost:3000/auth/callback
```

Note le **client_uid** et le **client_secret**.

### 3. Variables d'environnement

```bash
cd platform
cp back/.env.example back/.env
cp front/.env.example front/.env.local
```

Remplis dans `back/.env` :
- `API42_CLIENT_UID` / `API42_CLIENT_SECRET` (depuis l'étape 2)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (n'importe quelle longue chaîne aléatoire)

### 4. Tout en une commande

```bash
make setup           # copie les .env, install, lance Postgres, migrate
make dev             # lance back + front
```

`make help` liste toutes les cibles. Pour la première migration, Prisma demande
un nom — n'importe quoi va, par exemple `init`.

### Commandes utiles

| Commande              | Description                                  |
|-----------------------|----------------------------------------------|
| `make dev`            | back + front en parallèle                    |
| `make build`          | build production                             |
| `make db-up` / `down` | start/stop Postgres                          |
| `make db-migrate`     | applique / crée une migration                |
| `make db-studio`      | ouvre Prisma Studio                          |
| `make db-reset`       | drop + re-migrate (⚠ détruit les données)    |
| `make clean`          | supprime `node_modules`, `dist`, `.next`     |
| `make reclean`        | `clean` + supprime le volume DB              |
| `make re`             | `reclean` + `setup` + `dev` (full reset)     |

- Front: <http://localhost:3000>
- API: <http://localhost:3001>

## Flow d'authentification

1. Front → `GET /api/auth/42/url` → URL OAuth (avec un `state` CSRF stocké en DB)
2. Front redirige le navigateur vers cette URL
3. L'utilisateur autorise sur l'intra 42
4. 42 redirige vers `http://localhost:3000/auth/callback?code=...&state=...`
5. La page callback → `POST /api/auth/42/callback { code, state }`
6. Backend échange `code` contre un access_token 42, fetch `/v2/me`,
   upsert l'utilisateur, retourne un **access JWT** (15min) et pose un
   **refresh cookie** httpOnly (7 jours)
7. Front stocke l'access token en mémoire ; au refresh page → `POST /api/auth/refresh`

## Endpoints actuels

| Méthode | Route                  | Auth          | Description                       |
|---------|------------------------|---------------|-----------------------------------|
| GET     | `/api/auth/42/url`     | —             | Génère l'URL OAuth 42             |
| POST    | `/api/auth/42/callback`| —             | Échange code → JWT                |
| POST    | `/api/auth/refresh`    | refresh cookie| Renouvelle l'access token         |
| POST    | `/api/auth/logout`     | refresh cookie| Invalide la session               |
| GET     | `/api/users/me`        | Bearer JWT    | Profil utilisateur courant        |

## Prochaines étapes (non implémentées)

- Modèle Event / Challenge / Submission (style CTFd custom)
- Page d'admin pour créer un événement et ses challenges
- Scoreboard temps réel
- Système d'équipes
- Gestion des rôles (staff/admin)
