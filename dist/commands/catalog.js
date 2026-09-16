import { analyticsCommands } from './analytics/specs.js';
import { announcementCommands } from './announcements/specs.js';
import { authCommands } from './auth/specs.js';
import { boardCommands } from './boards/specs.js';
import { chatCommands } from './chat/specs.js';
import { documentationCommands } from './documentation/specs.js';
import { eventCommands } from './events/specs.js';
import { kooyapediaCommands } from './kooyapedia/specs.js';
import { meetCommands } from './meet/specs.js';
import { notificationCommands } from './notifications/specs.js';
import { postCommands } from './posts/specs.js';
import { presenceCommands } from './presence/specs.js';
import { projectCommands } from './projects/specs.js';
import { settingsCommands } from './settings/specs.js';
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
    ...eventCommands,
    ...announcementCommands,
    ...presenceCommands,
    ...settingsCommands,
    ...documentationCommands,
    ...kooyapediaCommands,
    ...postCommands,
    ...chatCommands,
    ...meetCommands,
];
export function commandNames(catalog) {
    return catalog.map((command) => command.name);
}
//# sourceMappingURL=catalog.js.map