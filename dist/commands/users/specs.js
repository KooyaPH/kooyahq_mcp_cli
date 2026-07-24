import { id, listQuery } from '../shared.js';
const userBody = {
    name: { apiName: 'name' }, email: { apiName: 'email' }, position: { apiName: 'position' },
    birthday: { apiName: 'birthday' }, status: { apiName: 'status' },
    permissions: { apiName: 'permissions', type: 'csv' }, bio: { apiName: 'bio' },
};
const userUpdateBody = { ...userBody, disabled: { apiName: 'disabled', type: 'boolean' } };
export const userCommands = [
    { name: 'users list', method: 'GET', path: '/users', query: listQuery({
            search: { apiName: 'search' }, 'include-disabled': { apiName: 'includeDisabled', type: 'boolean' },
        }) },
    { name: 'users get', method: 'GET', path: '/users/:id', positionals: [id()] },
    { name: 'users create', method: 'POST', path: '/users', body: userBody, requireBody: true, requiredOptions: ['name', 'email'] },
    { name: 'users update', method: 'PATCH', path: '/users/:id', positionals: [id()], body: userUpdateBody, requireBody: true },
    { name: 'users delete', method: 'DELETE', path: '/users/:id', positionals: [id()], confirmation: 'Delete user {id}?' },
    { name: 'users stats', method: 'GET', path: '/users/stats' },
    { name: 'users permissions get', method: 'GET', path: '/users/:id/permissions', positionals: [id()] },
    { name: 'users permissions update', method: 'PATCH', path: '/users/:id/permissions', positionals: [id()], body: {
            permissions: { apiName: 'permissions', type: 'csv' },
        }, requireBody: true },
    { name: 'users templates list', method: 'GET', path: '/users/templates', query: listQuery({ search: { apiName: 'search' } }) },
    { name: 'users templates get', method: 'GET', path: '/users/templates/:id', positionals: [id()] },
];
//# sourceMappingURL=specs.js.map