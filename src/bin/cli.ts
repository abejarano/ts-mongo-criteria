#!/usr/bin/env node

import { execSync } from "child_process"

const args = process.argv.slice(2)
const command = args[0]
const otherArgs = args.slice(1).join(" ")

if (!command) {
  console.error("Please provide a command: migrate:create, migrate:up, migrate:down, migrate:status")
  process.exit(1)
}

// Map short commands to full migrate-mongo commands if desired,
// or just pass them through if they match.
// The user asked for `bun run migrate:create`, so we want to support `ts-mongo migrate:create`
// essentially proxying.

// Actually, migrate-mongo CLI expects: `migrate-mongo <command> [options]`
// commands: init, up, down, status, create

// If user maps `ts-mongo migrate:create <name>`, we should map it to `migrate-mongo create <name>`

const validCommands = ["init", "create", "up", "down", "status"]

// Handle "migrate:create" style input from the user request
const normalizedCommand = command.replace("migrate:", "")

if (!validCommands.includes(normalizedCommand)) {
    console.error(`Unknown command: ${command}.`)
    console.error(`Available commands: ${validCommands.map(c => `migrate:${c}`).join(", ")}`)
    process.exit(1)
}

try {
  // Execute migrate-mongo from the dependency
  // Using `bunx` or `npx` might be safer to find the binary, or resolve it directly.
  // Since it is a dependency, it should be in node_modules/.bin/migrate-mongo
  
  const binPath = "./node_modules/.bin/migrate-mongo"
  const finalCommand = `${binPath} ${normalizedCommand} ${otherArgs}`
  
  console.log(`Running: ${finalCommand}`)
  execSync(finalCommand, { stdio: "inherit" })
} catch (error) {
  process.exit(1)
}
