import { listQuery } from '../shared.js';
const RECORDING_MAX = 500 * 1024 * 1024;
export const meetCommands = [
    { name: 'meet contacts list', method: 'GET', path: '/meet/contacts' },
    {
        name: 'meet token create',
        method: 'POST',
        path: '/meet/token',
        body: {
            'room-name': { apiName: 'roomName', maxLength: 200 },
        },
        requiredOptions: ['room-name'],
    },
    {
        name: 'meet recordings list',
        method: 'GET',
        path: '/meet/recordings',
        query: listQuery(),
    },
    {
        name: 'meet recordings get',
        method: 'GET',
        path: '/meet/recordings/:recordingId',
        pathParams: { 'recording-id': { apiName: 'recordingId', format: 'object-id' } },
        requiredOptions: ['recording-id'],
    },
    {
        name: 'meet recordings analysis',
        method: 'GET',
        path: '/meet/recordings/:recordingId/analysis',
        pathParams: { 'recording-id': { apiName: 'recordingId', format: 'object-id' } },
        requiredOptions: ['recording-id'],
    },
    {
        name: 'meet recordings upload',
        method: 'POST',
        path: '/meet/recordings',
        body: {
            'room-name': { apiName: 'roomName', maxLength: 200 },
            title: { apiName: 'title', maxLength: 200 },
        },
        multipartFiles: [{ flag: 'file', fieldName: 'recording', maxBytes: RECORDING_MAX, required: true }],
    },
    {
        name: 'meet egress start',
        method: 'POST',
        path: '/meet/egress/start/:roomName',
        pathParams: { 'room-name': { apiName: 'roomName' } },
        requiredOptions: ['room-name'],
    },
    {
        name: 'meet egress stop',
        method: 'POST',
        path: '/meet/egress/stop/:egressId',
        pathParams: { 'egress-id': { apiName: 'egressId' } },
        requiredOptions: ['egress-id'],
        body: {
            'room-name': { apiName: 'roomName', maxLength: 200 },
        },
    },
    {
        name: 'meet egress status',
        method: 'GET',
        path: '/meet/egress/status/:egressId',
        pathParams: { 'egress-id': { apiName: 'egressId' } },
        requiredOptions: ['egress-id'],
    },
    {
        name: 'meet egress active',
        method: 'GET',
        path: '/meet/egress/active/:roomName',
        pathParams: { 'room-name': { apiName: 'roomName' } },
        requiredOptions: ['room-name'],
    },
];
//# sourceMappingURL=specs.js.map