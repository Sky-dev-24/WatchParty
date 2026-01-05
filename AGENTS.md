# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` Next.js App Router pages and API routes (`src/app/api/.../route.ts`, `/admin`, `/watch/[slug]`).
- `src/components/` React UI components (PascalCase files like `SimulatedLivePlayer.tsx`).
- `src/lib/` core modules and integrations (simulive sync, Mux client, auth, Redis, Prisma).
- `prisma/schema.prisma` database schema; `public/` static assets; `docs/` design notes.
- `cluster.js` runs the standalone clustered server used by Docker.

## Build, Test, and Development Commands
- `npm run dev` start the dev server at `http://localhost:3000`.
- `npm run build` generate Prisma client and build Next.js (standalone output).
- `npm run start` run the production Next server (single process).
- `npm run lint` run ESLint via Next.
- `npm run db:push` apply schema changes to Postgres; `npm run db:studio` open Prisma Studio.
- `docker-compose up -d` bring up app + Postgres + Redis; `docker-compose down` stop.
- After `npm run build`, `node cluster.js` runs the clustered production server (Docker does this).

## Coding Style & Naming Conventions
- TypeScript + React; keep 2-space indentation and double quotes as in existing files.
- Tailwind CSS for styling; add reusable UI in `src/components/`.
- File naming: components use PascalCase, utilities use lowercase; keep route segments under `src/app/`.
- Use the path alias `@/*` for imports (e.g., `@/lib/db`).

## Testing Guidelines
- No automated test runner is configured yet and there are no test files.
- If you add tests, prefer `*.test.ts(x)` or a `__tests__/` folder under `src/` and document the new script in `package.json`.

## Commit & Pull Request Guidelines
- Commit messages are short, sentence-case phrases in Git history (e.g., "Updating player UX"). Follow this style and avoid long prefixes.
- PRs should include a brief summary, testing notes (commands or manual steps), and screenshots for UI changes. Link related issues when available.

## Security & Configuration Tips
- Copy `.env.example` to `.env.local` and fill required values (Mux, database, Redis).
- Never commit secrets; use `.env.production.example` as a reference for production config.
