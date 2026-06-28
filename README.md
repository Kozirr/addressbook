# Address Book

A secure, encrypted address book built with Next.js. Contacts are encrypted
client-side with a key derived from your password, and a 24-word recovery key
lets you regain access if you forget it.

## Project structure

```
.
├── web/                # Next.js application (includes its own Dockerfile)
├── docker-compose.yaml
├── web/.env.example
└── README.md
```

All application code, dependencies, and npm scripts live in `web/`.

## Prerequisites

- Node.js 22+
- PostgreSQL 16+

## Local development

1. Copy the example env file and adjust values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies and run the database migration from the `web/`
   directory:

   ```bash
   cd web
   npm install
   npm run db:migrate
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Email confirmation

In development, confirmation emails are logged to the server console when
`RESEND_API_KEY` and `FROM_EMAIL` are not set. For production, configure
[Resend](https://resend.com) and set those variables.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL and the app on port 3000.

## Available scripts (run from `web/`)

| Script               | Description                  |
| -------------------- | ---------------------------- |
| `npm run dev`        | Start the dev server         |
| `npm run build`      | Production build             |
| `npm run lint`       | Run ESLint                   |
| `npm run test`       | Run the test suite (Vitest)  |
| `npm run db:migrate` | Apply database migrations    |  

## Environment variables

See [`.env.example`](web/.env.example) for the full list and descriptions.
