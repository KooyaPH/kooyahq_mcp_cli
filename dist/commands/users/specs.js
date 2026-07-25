import { legacyIdSelector, listQuery } from '../shared.js';
const userBody = {
    name: { apiName: 'name', maxLength: 200 },
    email: { apiName: 'email', format: 'email' }, position: { apiName: 'position', maxLength: 200 },
    birthday: { apiName: 'birthday', format: 'date' },
    status: { apiName: 'status', choices: ['online', 'busy', 'away', 'offline'] },
    permissions: { apiName: 'permissions', type: 'csv' }, bio: { apiName: 'bio' },
    'monthly-salary': { apiName: 'monthlySalary', type: 'number', min: 0 },
};
const userUpdateBody = { ...userBody, disabled: { apiName: 'disabled', type: 'boolean' } };
export const userCommands = [
    { name: 'users list', method: 'GET', path: '/users', query: listQuery({
            search: { apiName: 'search' }, 'include-disabled': { apiName: 'includeDisabled', type: 'boolean' },
        }) },
    { name: 'users get', method: 'GET', ...legacyIdSelector('user-id', 'userId', '/users/:userId') },
    { name: 'users create', method: 'POST', path: '/users', body: userBody, requireBody: true, requiredOptions: ['name', 'email'] },
    { name: 'users update', method: 'PATCH', ...legacyIdSelector('user-id', 'userId', '/users/:userId'), body: userUpdateBody, requireBody: true },
    { name: 'users delete', method: 'DELETE', ...legacyIdSelector('user-id', 'userId', '/users/:userId'), confirmation: 'Delete user {user-id}?' },
    { name: 'users stats', method: 'GET', path: '/users/stats' },
    { name: 'users permissions get', method: 'GET', ...legacyIdSelector('user-id', 'userId', '/users/:userId/permissions') },
    { name: 'users permissions update', method: 'PATCH', ...legacyIdSelector('user-id', 'userId', '/users/:userId/permissions'), body: {
            permissions: { apiName: 'permissions', type: 'csv' },
        }, requireBody: true },
    { name: 'users templates list', method: 'GET', path: '/users/templates', query: listQuery({ search: { apiName: 'search' } }) },
    { name: 'users templates get', method: 'GET', ...legacyIdSelector('template-id', 'templateId', '/users/templates/:templateId') },
    {
        name: 'users clients create',
        method: 'POST',
        path: '/users/clients',
        body: {
            name: { apiName: 'name', maxLength: 200 },
            email: { apiName: 'email', format: 'email', maxLength: 320 },
            'client-company-id': { apiName: 'clientCompanyId', maxLength: 200 },
        },
        requiredOptions: ['name', 'email'],
    },
    {
        name: 'users activity list',
        method: 'GET',
        path: '/users/activity',
        query: listQuery({
            action: { apiName: 'action', maxLength: 100 },
            'start-date': { apiName: 'startDate', format: 'date' },
            'end-date': { apiName: 'endDate', format: 'date' },
        }),
        dateRange: { startOption: 'start-date', endOption: 'end-date', maxDays: 366 },
        pairedOptions: [['start-date', 'end-date']],
    },
    {
        name: 'users export',
        method: 'GET',
        path: '/users/export',
        query: { format: { apiName: 'format', choices: ['csv', 'json'] } },
        requiredOptions: ['format'],
    },
];
//# sourceMappingURL=specs.js.map