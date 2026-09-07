export function hermesManualRegistrationMessages(descriptor) {
    return [
        'Hermes requires manual registration because this CLI cannot safely verify its persisted descriptor.',
        'Add this local stdio entry to ~/.hermes/config.yaml from the operating system that owns Hermes:',
        'mcp_servers:',
        '  kooyahq:',
        `    command: ${JSON.stringify(descriptor.command)}`,
        '    args:',
        `      - ${JSON.stringify(descriptor.args[0])}`,
        'Restart Hermes or reload its MCP configuration before using the tools.',
    ];
}
//# sourceMappingURL=hermes.js.map