# Devil's Dice

A real-time multiplayer dice game for 2-6 players featuring strategic dice selection, hidden information, and prediction bonuses. Players roll dice, select their best hand of 3, and compete across multiple rounds with a "Noir Casino" themed interface.

## Features

- Real-time multiplayer with WebSocket communication
- Strategic gameplay with hidden dice (red/blue) and public dice (white)
- Prediction system with bonus points for correct guesses
- Beautiful animations with Framer Motion
- Responsive "Noir Casino" design with crimson/gold color scheme

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand
- **Backend**: NestJS, Socket.IO, XState state machine, Redis
- **Shared**: TypeScript types and constants package

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Redis (or use Docker)

### Development

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Start Redis (using Docker):

```bash
docker compose up -d redis
```

3. Start both client and server in development mode:

```bash
pnpm dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

### Using Docker Compose (Full Stack)

```bash
docker compose --profile production up --build
```

- Client: http://localhost
- Server: http://localhost:3001

## Project Structure

```
devilsdice/
├── apps/
│   ├── client/          # React frontend
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   ├── pages/       # Route pages
│   │   │   ├── services/    # Socket service
│   │   │   └── stores/      # Zustand state
│   │   └── Dockerfile
│   └── server/          # NestJS backend
│       ├── src/
│       │   ├── game/        # Game logic & WebSocket gateway
│       │   └── redis/       # Redis service
│       └── Dockerfile
├── packages/
│   └── shared/          # Shared types & constants
├── docker-compose.yml
└── fly.toml             # Fly.io deployment config
```

## Deployment

### Client (Vercel/Netlify)

The client can be deployed to any static hosting platform:

```bash
# Build
pnpm --filter @devilsdice/shared build
pnpm --filter @devilsdice/client build

# Output in apps/client/dist
```

Set `VITE_WS_URL` environment variable to your server URL.

### Server (Fly.io)

```bash
# Deploy to Fly.io
fly deploy

# Set secrets
fly secrets set REDIS_URL=redis://your-redis:6379
fly secrets set CORS_ORIGIN=https://your-frontend.com
```

### Docker

```bash
# Build images
docker compose --profile production build

# Run
docker compose --profile production up -d
```

## Environment Variables

See `.env.example` for all configuration options:

- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 3001)
- `CORS_ORIGIN` - Allowed CORS origins
- `VITE_WS_URL` - WebSocket server URL for client

## License

MIT

