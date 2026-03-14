import { defineCommand, runMain } from 'citty'
import { installCommand } from './commands/install'
import { updateCommand } from './commands/update'
import { setupCommand } from './commands/setup'
import { listCommand } from './commands/list'
import { uninstallCommand } from './commands/uninstall'
import { statusCommand } from './commands/status'

const main = defineCommand({
  meta: {
    name: 'ai-config',
    version: '0.2.0',
    description: 'Provider-agnostic AI coding assistant config installer',
  },
  subCommands: {
    install: installCommand,
    uninstall: uninstallCommand,
    update: updateCommand,
    setup: setupCommand,
    list: listCommand,
    status: statusCommand,
  },
})

runMain(main)
