# MongoDB Migrations (migrate-mongo)

This repo includes a ready-to-use CLI setup for running database migrations with
[`migrate-mongo`](https://www.npmjs.com/package/migrate-mongo).

If you consume this library in another app, replicate this setup in your app
repository (config + scripts + migrations directory). Migrations are app-specific,
not library-specific.

## Requirements

Install dependencies (already configured in this repo):

```bash
bun install
```

## Environment variables

The migration config uses the same variables as `MongoClientFactory`:

```bash
MONGO_USER=
MONGO_PASS=
MONGO_SERVER=
MONGO_DB=
```

Or provide a full connection string:

```bash
MONGO_URI=
MONGO_DB=
```

## Config

The CLI uses `migrate-mongo-config.js` at the repo root. It stores migration state
in the `migrations` collection.

## Create a migration

```bash
bun run migrate:create add-users-index
```

This creates a file inside `migrations/` with `up` and `down` functions.

## Run migrations (up)

```bash
bun run migrate:up
```

Runs all pending migrations in order.

## Roll back migrations (down)

```bash
bun run migrate:down
```

Rolls back the last executed migration.

## Status (optional)

```bash
bun run migrate:status
```

Shows which migrations have been applied.

## Example migration

```js
module.exports = {
  async up(db) {
    await db.collection("users").createIndex({ email: 1 }, { unique: true })
  },

  async down(db) {
    await db.collection("users").dropIndex("email_1")
  },
}
```
