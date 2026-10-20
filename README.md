+# ROLNET Fleet Management

ROLNET is a mobile-first tricycle fleet management app for owners and staff.

## Start quickly

For UI review without a backend:

    corepack pnpm install
    corepack pnpm dev

Open http://localhost:3000/login.

Demo account:

- Email: owner@demo.local
- Password: demo1234

For Docker/Compose development:

    Copy-Item .env.docker.example .env.docker
    docker compose up --build

## Backend mode

ROLNET uses Supabase Auth, PostgreSQL, Row Level Security, and private Storage. A working Docker/Podman Linux runtime is required for the local Supabase stack. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for complete setup, migrations, validation, deployment, and troubleshooting instructions.

## Project documents

- [Detailed development guide](docs/DEVELOPMENT.md)
- [Feature specification](specs/001-fleet-management/spec.md)
- [Implementation plan](specs/001-fleet-management/plan.md)
- [Task list](specs/001-fleet-management/tasks.md)
- [Constitution](.specify/memory/constitution.md)

## Common commands

    corepack pnpm lint
    corepack pnpm typecheck
    corepack pnpm test
    corepack pnpm test:e2e
    corepack pnpm check
    corepack pnpm build:vinext
