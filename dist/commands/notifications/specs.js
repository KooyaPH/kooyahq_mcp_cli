import { listQuery } from '../shared.js';
export const notificationCommands = [
    { name: 'notifications list', method: 'GET', path: '/notifications', query: listQuery({
            'unread-only': { apiName: 'unreadOnly', type: 'boolean' },
        }) },
    { name: 'notifications count', method: 'GET', path: '/notifications/count' },
];
//# sourceMappingURL=specs.js.map