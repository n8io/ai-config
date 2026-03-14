import { defineCommand, runMain } from 'citty'
import { installCommand } from './commands/install'
import { updateCommand } from './commands/update'
import { setupCommand } from './commands/setup'

const main = defineCommand({
  meta: {
    name: 'ai-config',
    version: '0.1.0',
    description: 'Provider-agnostic AI coding assistant config installer',
  },
  subCommands: {
    install: installCommand,
    update: updateCommand,
    setup: setupCommand,
  },
})

runMain(main)
