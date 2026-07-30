export function openClawManualRegistrationMessages(descriptor) {
    return [
        'OpenClaw requires manual registration because this CLI cannot safely verify its persisted descriptor.',
        'From the operating system that owns OpenClaw, run this documented local stdio registration with literal shell quoting:',
        '  openclaw mcp add kooyahq --command <node-executable> --arg <kooyahq-mcp-script>',
        `  node-executable: ${JSON.stringify(descriptor.command)}`,
        `  kooyahq-mcp-script: ${JSON.stringify(descriptor.args[0])}`,
        'Then run: openclaw mcp doctor kooyahq --probe',
    ];
}
//# sourceMappingURL=openclaw.js.map