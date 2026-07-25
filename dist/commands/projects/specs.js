import { legacyIdSelector, listQuery } from '../shared.js';
const body = {
    name: { apiName: 'name' }, emoji: { apiName: 'emoji' }, 'icon-url': { apiName: 'iconUrl' },
};
export const projectCommands = [
    { name: 'projects list', method: 'GET', path: '/projects', query: listQuery({
            search: { apiName: 'search' },
        }) },
    { name: 'projects get', method: 'GET', ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId') },
    { name: 'projects create', method: 'POST', path: '/projects', body, requireBody: true, requiredOptions: ['name'] },
    { name: 'projects update', method: 'PATCH', ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId'), body, requireBody: true },
    { name: 'projects delete', method: 'DELETE', ...legacyIdSelector('project-id', 'projectId', '/projects/:projectId'), confirmation: 'Delete project {project-id}?' },
    {
        name: 'projects keyword-migration preview',
        method: 'POST',
        path: '/projects/keyword-migration/preview',
        body: { 'source-projects': { apiName: 'sourceProjects', type: 'csv', maxItems: 100, uniqueItems: true } },
    },
    {
        name: 'projects keyword-migration apply',
        method: 'POST',
        path: '/projects/keyword-migration',
        body: { 'source-projects': { apiName: 'sourceProjects', type: 'csv', maxItems: 100, uniqueItems: true } },
        confirmation: 'Apply keyword-based time entry migration?',
    },
];
//# sourceMappingURL=specs.js.map