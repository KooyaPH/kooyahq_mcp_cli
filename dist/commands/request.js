import { ValidationError } from '../core/errors.js';
export function buildRequest(catalog, argv) {
    const command = findCommand(catalog, argv);
    const commandTokenCount = command.name.split(' ').length;
    const remaining = argv.slice(commandTokenCount);
    const firstOption = remaining.findIndex((token) => token.startsWith('--'));
    const positionalTokens = firstOption === -1 ? remaining : remaining.slice(0, firstOption);
    const optionTokens = firstOption === -1 ? [] : remaining.slice(firstOption);
    const positionals = bindPositionals(command, positionalTokens);
    const fileOptions = command.fileInput
        ? {
            file: { apiName: 'file' },
            stdin: { apiName: 'stdin', type: 'switch' },
            format: { apiName: 'format', choices: ['json', 'csv'] },
        }
        : {};
    const multipartOptions = Object.fromEntries((command.multipartFiles ?? []).map((file) => [file.flag, { apiName: file.flag }]));
    const allowed = {
        ...command.pathParams,
        ...command.query,
        ...command.body,
        ...fileOptions,
        ...multipartOptions,
    };
    const parsed = parseOptions(optionTokens, allowed, Boolean(command.confirmation));
    if (parsed.all && (!command.query?.page || !command.query.limit)) {
        throw new ValidationError('--all is available only for paginated list commands.');
    }
    if (parsed.all && parsed.values.page !== undefined) {
        throw new ValidationError('Do not combine --all with --page.');
    }
    if (command.fileInput) {
        const sources = ['file', 'stdin'].filter((flag) => parsed.values[flag] !== undefined);
        if (sources.length !== 1) {
            throw new ValidationError(`${command.name} requires exactly one of --file or --stdin.`);
        }
    }
    for (const file of command.multipartFiles ?? []) {
        if (file.required && parsed.values[file.flag] === undefined) {
            throw new ValidationError(`${command.name} requires --${file.flag}.`);
        }
    }
    const warnings = [];
    for (const positional of command.positionals ?? []) {
        if (!positional.aliasFor || positionals[positional.name] === undefined)
            continue;
        if (parsed.values[positional.aliasFor] !== undefined) {
            throw new ValidationError(`Do not combine positional <${positional.name}> with --${positional.aliasFor}.`);
        }
        parsed.values[positional.aliasFor] = positionals[positional.name];
        if (positional.deprecated) {
            warnings.push(`Positional <${positional.name}> is deprecated; use --${positional.aliasFor}.`);
        }
    }
    for (const group of command.exactlyOne ?? []) {
        const supplied = group.filter((flag) => parsed.values[flag] !== undefined);
        if (supplied.length !== 1) {
            throw new ValidationError(`${command.name} requires exactly one of ${formatFlags(group)}.`);
        }
    }
    for (const group of command.atLeastOne ?? []) {
        const supplied = group.filter((flag) => parsed.values[flag] !== undefined);
        if (supplied.length === 0) {
            throw new ValidationError(`${command.name} requires at least one of ${formatFlags(group)}.`);
        }
    }
    for (const group of command.atMostOne ?? []) {
        const supplied = group.filter((flag) => parsed.values[flag] !== undefined);
        if (supplied.length > 1) {
            throw new ValidationError(`${command.name} accepts at most one of ${formatFlags(group)}.`);
        }
    }
    for (const required of command.requiredOptions ?? []) {
        if (parsed.values[required] === undefined) {
            throw new ValidationError(`${command.name} requires --${required}.`);
        }
    }
    for (const rule of command.conditionalRequirements ?? []) {
        if (parsed.values[rule.option] !== undefined
            && parsed.values[rule.requires] !== rule.value) {
            throw new ValidationError(`--${rule.option} requires --${rule.requires} ${rule.value}.`);
        }
    }
    for (const rule of command.conditionalExactlyOne ?? []) {
        if (parsed.values[rule.when.option] !== rule.when.value)
            continue;
        const supplied = rule.options.filter((flag) => parsed.values[flag] !== undefined);
        if (supplied.length !== 1) {
            throw new ValidationError(`${command.name} with --${rule.when.option} ${rule.when.value} requires exactly one of ${formatFlags(rule.options)}.`);
        }
    }
    for (const group of command.pairedOptions ?? []) {
        const supplied = group.filter((option) => parsed.values[option] !== undefined);
        if (supplied.length > 0 && supplied.length < group.length) {
            const missing = group.find((option) => parsed.values[option] === undefined);
            throw new ValidationError(`${command.name} requires --${missing} when --${supplied[0]} is supplied.`);
        }
    }
    for (const range of normalizeRanges(command.dateRange))
        validateDateRange(parsed.values, range);
    for (const range of normalizeRanges(command.dateTimeRange))
        validateDateTimeRange(parsed.values, range);
    const query = mapOptions(parsed.values, command.query ?? {});
    const providedBody = mapOptions(parsed.values, command.body ?? {});
    const positionalBody = Object.fromEntries(Object.entries(command.bodyPositionals ?? {}).flatMap(([positional, apiName]) => {
        const value = positionals[positional];
        return value === undefined ? [] : [[apiName, value]];
    }));
    const body = { ...command.staticBody, ...positionalBody, ...providedBody };
    if (command.requireBody && Object.keys(providedBody).length === 0) {
        throw new ValidationError(`${command.name} requires at least one data option.`);
    }
    let path = selectPath(command, parsed.values);
    for (const [flag, definition] of Object.entries(command.pathParams ?? {})) {
        const value = parsed.values[flag];
        if (value !== undefined) {
            const converted = convertValue(value, definition, flag);
            if (definition.choices && (typeof converted !== 'string' || !definition.choices.includes(converted))) {
                throw new ValidationError(`--${flag} must be ${formatChoices(definition.choices)}.`);
            }
            if (definition.numericChoices && (typeof converted !== 'number' || !definition.numericChoices.includes(converted))) {
                throw new ValidationError(`--${flag} must be ${definition.numericChoices.join(', ')}.`);
            }
            if (typeof converted !== 'string' && typeof converted !== 'number') {
                throw new ValidationError(`--${flag} must be a path-safe scalar value.`);
            }
            path = path.replace(`:${definition.apiName}`, encodeURIComponent(String(converted)));
        }
    }
    for (const [name, value] of Object.entries(positionals)) {
        const definition = command.positionals?.find((candidate) => candidate.name === name);
        if (value !== undefined && !definition?.aliasFor) {
            path = path.replace(`:${name}`, encodeURIComponent(value));
        }
    }
    const confirmation = command.confirmation && !parsed.yes
        ? interpolate(command.confirmation, { ...positionals, ...parsed.values })
        : undefined;
    const request = { method: command.method, path, query, output: parsed.output };
    if (Object.keys(body).length > 0)
        request.body = body;
    if (confirmation)
        request.confirmation = confirmation;
    if (command.timerEligibility) {
        request.timerEligibility = command.timerEligibility;
        request.positionalValues = { ...positionals, ...parsed.values };
    }
    if (warnings.length > 0)
        request.warnings = warnings;
    if (parsed.dryRun)
        request.dryRun = true;
    if (parsed.all)
        request.all = true;
    if (command.fileInput) {
        const requestedFormat = parsed.values.format;
        const inferredFormat = parsed.values.file?.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
        request.fileInput = {
            ...command.fileInput,
            ...(parsed.values.file === undefined ? {} : { path: parsed.values.file }),
            stdin: parsed.values.stdin !== undefined,
            format: requestedFormat === 'csv' ? 'csv' : requestedFormat === 'json' ? 'json' : inferredFormat,
        };
    }
    if (command.multipartFiles?.length) {
        const files = command.multipartFiles.flatMap((file) => {
            const path = parsed.values[file.flag];
            return path === undefined ? [] : [{ ...file, path }];
        });
        if (files.length > 0)
            request.multipartFiles = files;
    }
    return request;
}
function selectPath(command, values) {
    const variant = command.pathVariants?.find((candidate) => candidate.when.every((flag) => values[flag] !== undefined));
    return variant?.path ?? command.path;
}
function findCommand(catalog, argv) {
    const matches = catalog.filter((command) => {
        const nameTokens = command.name.split(' ');
        return nameTokens.every((token, index) => argv[index] === token);
    }).sort((left, right) => right.name.length - left.name.length);
    if (!matches[0])
        throw new ValidationError('Unknown command. Run `kooyahq --help`.');
    return matches[0];
}
function bindPositionals(command, tokens) {
    const definitions = command.positionals ?? [];
    if (tokens.length > definitions.length)
        throw new ValidationError(`Too many arguments for ${command.name}.`);
    const values = {};
    definitions.forEach((definition, index) => {
        const value = tokens[index];
        if (!value && !definition.optional) {
            throw new ValidationError(`Missing required argument <${definition.name}> for ${command.name}.`);
        }
        values[definition.name] = value;
    });
    return values;
}
function parseOptions(tokens, allowed, allowYes) {
    const values = {};
    let yes = false;
    let output = 'table';
    let dryRun = false;
    let all = false;
    const suppliedOptions = new Set();
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!token.startsWith('--'))
            throw new ValidationError(`Unexpected argument ${token}.`);
        const option = token.slice(2);
        const equalsIndex = option.indexOf('=');
        const rawName = equalsIndex === -1 ? option : option.slice(0, equalsIndex);
        const inlineValue = equalsIndex === -1 ? undefined : option.slice(equalsIndex + 1);
        if (!rawName)
            throw new ValidationError('Option name must not be blank.');
        if (suppliedOptions.has(rawName)) {
            throw new ValidationError(`Option --${rawName} must not be repeated.`);
        }
        suppliedOptions.add(rawName);
        if (rawName === 'yes') {
            if (!allowYes)
                throw new ValidationError('Unknown option --yes.');
            if (inlineValue !== undefined)
                throw new ValidationError('--yes does not take a value.');
            yes = true;
            continue;
        }
        if (rawName === 'dry-run') {
            if (inlineValue !== undefined)
                throw new ValidationError('--dry-run does not take a value.');
            dryRun = true;
            continue;
        }
        if (rawName === 'all') {
            if (inlineValue !== undefined)
                throw new ValidationError('--all does not take a value.');
            all = true;
            continue;
        }
        if (rawName === 'output') {
            const value = inlineValue ?? tokens[index + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new ValidationError('Option --output requires a value.');
            }
            if (inlineValue === undefined)
                index += 1;
            if (value !== 'table' && value !== 'json' && value !== 'raw' && value !== 'ndjson') {
                throw new ValidationError('--output must be table, json, raw, or ndjson.');
            }
            output = value;
            continue;
        }
        const definition = allowed[rawName];
        if (!definition)
            throw new ValidationError(`Unknown option --${rawName}.`);
        if (definition.type === 'switch') {
            if (inlineValue !== undefined)
                throw new ValidationError(`--${rawName} does not take a value.`);
            values[rawName] = 'true';
            continue;
        }
        const value = inlineValue ?? tokens[index + 1];
        if (value === undefined || value.startsWith('--')) {
            throw new ValidationError(`Option --${rawName} requires a value.`);
        }
        if (inlineValue === undefined)
            index += 1;
        values[rawName] = value;
    }
    return { values, yes, output, dryRun, all };
}
function mapOptions(values, definitions) {
    const result = {};
    for (const [flag, definition] of Object.entries(definitions)) {
        const raw = values[flag];
        if (raw === undefined)
            continue;
        const converted = convertValue(raw, definition, flag);
        if (definition.choices && typeof converted === 'string' && !definition.choices.includes(converted)) {
            throw new ValidationError(`--${flag} must be ${formatChoices(definition.choices)}.`);
        }
        if (definition.numericChoices && (typeof converted !== 'number' || !definition.numericChoices.includes(converted))) {
            throw new ValidationError(`--${flag} must be ${definition.numericChoices.join(', ')}.`);
        }
        result[definition.apiName] = 'constant' in definition ? definition.constant : converted;
    }
    return result;
}
function convertValue(value, definition, flag) {
    const type = definition.type ?? 'string';
    if (type === 'integer') {
        const number = Number(value);
        const minimum = definition.min ?? 1;
        if (!Number.isSafeInteger(number) || number < minimum || (definition.max !== undefined && number > definition.max)) {
            const range = definition.max === undefined
                ? `an integer of at least ${minimum}`
                : `an integer from ${minimum} to ${definition.max}`;
            throw new ValidationError(`--${flag} must be ${range}.`);
        }
        return number;
    }
    if (type === 'number') {
        const number = Number(value);
        const minimum = definition.min;
        if (!Number.isFinite(number) || (minimum !== undefined && number < minimum) || (definition.max !== undefined && number > definition.max)) {
            const range = minimum === undefined && definition.max === undefined
                ? 'a finite number'
                : minimum !== undefined && definition.max !== undefined
                    ? `a number from ${minimum} to ${definition.max}`
                    : minimum !== undefined
                        ? `a number of at least ${minimum}`
                        : `a number no greater than ${definition.max}`;
            throw new ValidationError(`--${flag} must be ${range}.`);
        }
        return number;
    }
    if (type === 'boolean') {
        if (value !== 'true' && value !== 'false') {
            throw new ValidationError(`--${flag} must be true or false.`);
        }
        return value === 'true';
    }
    if (type === 'switch')
        return true;
    if (type === 'csv') {
        const values = value.split(',').map((item) => item.trim()).filter(Boolean);
        if (values.length === 0)
            throw new ValidationError(`--${flag} must not be blank.`);
        if (definition.maxItems !== undefined && values.length > definition.maxItems) {
            throw new ValidationError(`--${flag} accepts at most ${definition.maxItems} values.`);
        }
        if (definition.uniqueItems && new Set(values).size !== values.length) {
            throw new ValidationError(`--${flag} must not contain duplicates.`);
        }
        if (definition.caseInsensitiveUniqueItems
            && new Set(values.map((item) => item.toLocaleLowerCase())).size !== values.length) {
            throw new ValidationError(`--${flag} must not contain duplicates, including case-insensitive duplicates.`);
        }
        if (definition.itemMaxLength !== undefined
            && values.some((item) => item.length > definition.itemMaxLength)) {
            throw new ValidationError(`--${flag} values must be at most ${definition.itemMaxLength} characters.`);
        }
        if (definition.itemChoices) {
            const unsupported = values.find((item) => !definition.itemChoices.includes(item));
            if (unsupported) {
                throw new ValidationError(`--${flag} contains unsupported value ${unsupported}.`);
            }
        }
        return values;
    }
    if (type === 'singleton') {
        const normalized = value.trim();
        if (!normalized)
            throw new ValidationError(`--${flag} must not be blank.`);
        if (definition.maxLength !== undefined && normalized.length > definition.maxLength) {
            throw new ValidationError(`--${flag} must be at most ${definition.maxLength} characters.`);
        }
        return [normalized];
    }
    if (type === 'json-object' || type === 'json-array') {
        let parsed;
        try {
            parsed = JSON.parse(value);
        }
        catch {
            throw new ValidationError(`--${flag} must be a valid JSON ${type === 'json-array' ? 'array' : 'object'}.`);
        }
        const valid = type === 'json-array'
            ? Array.isArray(parsed)
            : Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
        if (!valid) {
            throw new ValidationError(`--${flag} must be a valid JSON ${type === 'json-array' ? 'array' : 'object'}.`);
        }
        if (definition.jsonSchema && !matchesJsonSchema(parsed, definition.jsonSchema, 0)) {
            throw new ValidationError(`--${flag} does not match its JSON schema.`);
        }
        for (const order of definition.jsonNumericOrder ?? []) {
            const record = parsed;
            const lower = record[order.lower];
            const upper = record[order.upper];
            if (typeof lower === 'number' && typeof upper === 'number' && lower > upper) {
                throw new ValidationError(`--${flag} ${order.lower} must not exceed ${order.upper}.`);
            }
        }
        return parsed;
    }
    const trimmed = value.trim();
    if (!trimmed)
        throw new ValidationError(`--${flag} must not be blank.`);
    if (definition.maxLength !== undefined && trimmed.length > definition.maxLength) {
        throw new ValidationError(`--${flag} must be at most ${definition.maxLength} characters.`);
    }
    if (definition.pattern && !new RegExp(definition.pattern).test(trimmed)) {
        throw new ValidationError(`--${flag} must match ${definition.patternDescription ?? definition.pattern}.`);
    }
    validateFormat(trimmed, definition.format, flag);
    return trimmed;
}
function formatChoices(choices) {
    if (choices.length === 2)
        return `${choices[0]} or ${choices[1]}`;
    return choices.join(', ');
}
function formatFlags(flags) {
    if (flags.length === 2)
        return `--${flags[0]} or --${flags[1]}`;
    return flags.map((flag) => `--${flag}`).join(', ');
}
function validateFormat(value, format, flag) {
    if (!format)
        return;
    if (format === 'date') {
        if (!isCalendarDate(value)) {
            throw new ValidationError(`--${flag} must be a valid YYYY-MM-DD date.`);
        }
        return;
    }
    if (format === 'datetime') {
        const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
        if (!match || !isCalendarDate(match[1]) || Number.isNaN(Date.parse(value))) {
            throw new ValidationError(`--${flag} must be a zoned ISO-8601 timestamp.`);
        }
        return;
    }
    if (format === 'hex-color') {
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
            throw new ValidationError(`--${flag} must be a #RRGGBB color.`);
        }
        return;
    }
    if (format === 'email') {
        if (value.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new ValidationError(`--${flag} must be a valid email address.`);
        }
        return;
    }
    if (format === 'board-key') {
        if (!/^[A-Za-z0-9]{1,10}$/.test(value)) {
            throw new ValidationError(`--${flag} must be an alphanumeric board key of at most 10 characters.`);
        }
        return;
    }
    if (format === 'ticket-key') {
        if (!/^[A-Za-z0-9]{1,10}-[1-9]\d*$/.test(value)) {
            throw new ValidationError(`--${flag} must look like BOARD-123 with a positive ticket sequence.`);
        }
        return;
    }
    if (format === 'object-id') {
        if (!/^[0-9a-f]{24}$/.test(value)) {
            throw new ValidationError(`--${flag} must be a 24-character lowercase hexadecimal ObjectId.`);
        }
        return;
    }
    if (format === 'uuid') {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
            throw new ValidationError(`--${flag} must be a canonical lowercase UUID.`);
        }
        return;
    }
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new ValidationError(`--${flag} must be an HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new ValidationError(`--${flag} must be an HTTPS URL.`);
    }
}
function isCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function validateDateRange(values, range) {
    const start = values[range.startOption];
    const end = values[range.endOption];
    if (!start || !end)
        return;
    if (!isCalendarDate(start) || !isCalendarDate(end))
        return;
    const days = (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`))
        / 86_400_000;
    if (days < 0)
        throw new ValidationError(`--${range.startOption} must not be after --${range.endOption}.`);
    if (range.requireDistinctDates && days === 0) {
        throw new ValidationError(`--${range.startOption} must be before --${range.endOption}.`);
    }
    if (days + 1 > range.maxDays) {
        throw new ValidationError(`Date range must not exceed ${range.maxDays} inclusive calendar dates.`);
    }
}
function matchesJsonSchema(value, schemaValue, depth) {
    if (depth > 50 || !schemaValue || typeof schemaValue !== 'object' || Array.isArray(schemaValue))
        return false;
    const schema = schemaValue;
    if ('const' in schema && value !== schema.const)
        return false;
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return false;
        const record = value;
        const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
            ? schema.properties
            : {};
        const required = Array.isArray(schema.required) ? schema.required : [];
        if (required.some((key) => typeof key !== 'string' || !(key in record)))
            return false;
        if (schema.additionalProperties === false && Object.keys(record).some((key) => !(key in properties)))
            return false;
        return Object.entries(record).every(([key, child]) => (!(key in properties) || matchesJsonSchema(child, properties[key], depth + 1)));
    }
    if (schema.type === 'array') {
        if (!Array.isArray(value))
            return false;
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems)
            return false;
        if (typeof schema.minItems === 'number' && value.length < schema.minItems)
            return false;
        return schema.items === undefined || value.every((item) => matchesJsonSchema(item, schema.items, depth + 1));
    }
    if (schema.type === 'string') {
        return typeof value === 'string'
            && (!Array.isArray(schema.enum) || schema.enum.includes(value))
            && (typeof schema.pattern !== 'string' || new RegExp(schema.pattern).test(value))
            && (typeof schema.maxLength !== 'number' || value.length <= schema.maxLength)
            && (typeof schema.minLength !== 'number' || value.length >= schema.minLength);
    }
    if (schema.type === 'number') {
        return typeof value === 'number' && Number.isFinite(value)
            && (typeof schema.minimum !== 'number' || value >= schema.minimum)
            && (typeof schema.maximum !== 'number' || value <= schema.maximum);
    }
    if (schema.type === 'integer') {
        return Number.isSafeInteger(value)
            && (typeof schema.minimum !== 'number' || value >= schema.minimum)
            && (typeof schema.maximum !== 'number' || value <= schema.maximum);
    }
    if (schema.type === 'boolean')
        return typeof value === 'boolean';
    if (schema.type === 'null')
        return value === null;
    return schema.type === undefined;
}
function validateDateTimeRange(values, range) {
    const start = values[range.startOption];
    const end = values[range.endOption];
    if (!start || !end)
        return;
    const startValue = Date.parse(start);
    const endValue = Date.parse(end);
    if (Number.isNaN(startValue) || Number.isNaN(endValue))
        return;
    if (startValue > endValue) {
        throw new ValidationError(`--${range.startOption} must not be after --${range.endOption}.`);
    }
}
function normalizeRanges(range) {
    if (!range)
        return [];
    return Array.isArray(range) ? range : [range];
}
function interpolate(template, values) {
    return template.replace(/\{([^}]+)\}/g, (_, name) => values[name] ?? 'resource');
}
//# sourceMappingURL=request.js.map