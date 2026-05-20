# PixlPlayground Studio

PixlPlayground Studio is the Pixlland visual editor. It keeps the existing editor interface and adds a dual-viewport direction:

- `3D`: Three.js, React Three Fiber and Rapier.
- `2D`: Phaser 3.90.
- `Phaser 3D export`: Enable3D for Phaser + Three.js + Ammo runtime builds.

## Local Development

From the monorepo root:

```bash
pnpm install
pnpm engine:dev
```

## Configuration

Copy `.env.example` to `.env.local` when local platform connectivity is needed. The app can open without those variables, but Pixlland cloud/auth features will stay disabled until configured.

## Dev Login

For local development only, set these values in `.env.local`:

```bash
VITE_ENABLE_DEV_AUTH=true
VITE_DEV_AUTH_EMAIL=dev@example.com
VITE_DEV_AUTH_PASSWORD=change-me
```

When enabled in `pnpm engine:dev`, the login modal shows `Entrar como dev`. This path is gated by Vite development mode and is not active in production builds.
