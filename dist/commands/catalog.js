import { analyticsCommands } from './analytics/specs.js';
import { authCommands } from './auth/specs.js';
import { boardCommands } from './boards/specs.js';
import { notificationCommands } from './notifications/specs.js';
import { projectCommands } from './projects/specs.js';
import { ticketCommands } from './tickets/specs.js';
import { timeCommands } from './time/specs.js';
import { userCommands } from './users/specs.js';
export const commandCatalog = [
    ...authCommands,
    ...projectCommands,
    ...boardCommands,
    ...ticketCommands,
    ...timeCommands,
    ...analyticsCommands,
    ...userCommands,
    ...notificationCommands,
];
export function commandNames(catalog) {
    return catalog.map((command) => command.name);
}
//# sourceMappingURL=catalog.js.map