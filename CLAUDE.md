# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Start Redis (required for server)
docker compose up -d redis

# Development - start both client and server
pnpm dev

# Or start individually:
pnpm --filter @devilsdice/server start:dev   # Server on :3001
pnpm --filter @devilsdice/client dev         # Client on :5173

# Build (must build shared first)
pnpm --filter @devilsdice/shared build
pnpm --filter @devilsdice/server build
pnpm --filter @devilsdice/client build

# Run all tests
pnpm --filter @devilsdice/server test

# Run a single test file
pnpm --filter @devilsdice/server test -- hand-evaluator.spec.ts

# Run tests in watch mode
pnpm --filter @devilsdice/server test:watch
```

## Architecture Overview

This is a **pnpm monorepo** with three packages:

### packages/shared (`@devilsdice/shared`)
Shared TypeScript types and constants used by both client and server:
- `types/game.types.ts` - Core game types: Die, Player, GameState, GamePhase, HandRank
- `types/events.types.ts` - WebSocket event interfaces (ClientToServerEvents, ServerToClientEvents)
- `constants/` - Game limits, scoring rules

**Important**: Must be built with CommonJS output for NestJS compatibility. Run `pnpm --filter @devilsdice/shared build` after any changes.

### apps/server (`@devilsdice/server`)
NestJS backend with WebSocket (Socket.IO) support:

- **game/game.gateway.ts** - WebSocket event handlers, main entry point for client communication
- **game/room.service.ts** - Room creation, joining, player management
- **game/game.service.ts** - Game orchestration, manages XState machine instances per room
- **game/state-machine/** - XState v5 state machine:
  - `game.machine.ts` - State definitions: lobby → initial_roll → prediction → set_selection → set_reveal → round_summary → game_over
  - `actions.ts` - State transition logic (roll dice, process selections, calculate scores)
  - `guards.ts` - Transition conditions
- **game/scoring/** - Pure functions with unit tests:
  - `hand-evaluator.ts` - Evaluates 3-dice hands (Triple > Straight > Double > Single)
  - `scorer.ts` - Calculates placements and prediction bonuses
  - `turn-order.ts` - Determines player turn order

### apps/client (`@devilsdice/client`)
React 19 + Vite + Tailwind CSS frontend:

- **stores/gameStore.ts** - Zustand store, single source of truth for all game state
- **services/socket.ts** - Socket.IO client singleton, handles connection and reconnection
- **components/dice/** - Die, DicePool, DiceSelection, DiceRoll components
- **components/game/** - GameBoard, Scoreboard, PredictionPanel, ResultsModal
- **components/lobby/** - CreateRoom, JoinRoom, PlayerList
- **pages/** - Home (create/join), Lobby (waiting room), Game (main gameplay)

## Game Flow

1. **Lobby** → Players join room via 6-char code, ready up
2. **Initial Roll** (Round 1 only) → 2 dice rolled per player to determine turn order
3. **Prediction** → All players simultaneously predict their round score (ZERO/MIN/MORE/MAX)
4. **Set Selection** → Turn-based: each player selects 3 dice from their 11 (9 white visible, 2 hidden)
5. **Set Reveal** → Hands evaluated, placements and points awarded
6. **Repeat** Set Selection + Reveal for Set 2
7. **Round Summary** → Prediction bonuses applied
8. **Repeat** rounds until game over

## Key Types

- **Die**: { id, color (WHITE/RED/BLUE), value (1-6), isSpent, isRevealed }
- **GamePhase**: LOBBY | INITIAL_ROLL | PREDICTION | SET_SELECTION | SET_REVEAL | ROUND_SUMMARY | GAME_OVER
- **HandRank**: SINGLE=1 | DOUBLE=2 | STRAIGHT=3 | TRIPLE=4

## Design System

"Noir Casino" theme with CSS custom properties in `apps/client/src/index.css`:
- Colors: `--color-ruby`, `--color-gold`, `--color-void` (see CSS for full palette)
- Fonts: Playfair Display (display), DM Sans (body), JetBrains Mono (monospace)
- Component classes: `.card-noir`, `.btn-crimson`, `.btn-gold`, `.input-noir`, `.die-white`, `.die-red`, `.die-blue`

## Deployment (Railway)

Hosted on Railway with two services using Nixpacks builder:

### Client Service
- **URL**: https://triple-dice-production.up.railway.app
- **Root Directory**: /
- **Build Command**: `pnpm install && pnpm --filter @devilsdice/shared build && pnpm --filter @devilsdice/client build`
- **Start Command**: `npx serve apps/client/dist -s -l 3000`
- **Static file config**: `apps/client/public/serve.json` controls SPA rewrites (allows sitemap.xml, robots.txt to be served directly)

### Server Service
- **URL**: https://devilsdiceserver-production.up.railway.app
- **Root Directory**: /
- **Build Command**: `pnpm install && pnpm --filter @devilsdice/shared build && pnpm --filter @devilsdice/server build`
- **Start Command**: `node apps/server/dist/main.js`

### SEO Files
- `apps/client/public/sitemap.xml` - Sitemap for Google Search Console
- `apps/client/index.html` - Contains meta tags for SEO and Google verification
- User-facing branding is "Triple Dice" (internal package scope remains `@devilsdice`)
