import { ValidationError } from '../core/errors.js';
import { validateBaseUrl } from './url.js';
const KEYS = [
    'KOOYAHQ_BASE_URL',
    'KOOYAHQ_ACCESS_KEY_ID',
    'KOOYAHQ_SECRET_ACCESS_KEY',
];
export function resolveCredentialsFromEnv(environment) {
    const present = KEYS.filter((key) => environment[key] !== undefined);
    if (present.length === 0)
        return undefined;
    if (present.length !== KEYS.length) {
        throw new ValidationError(`${KEYS.join(', ')} must be set together.`);
    }
    const [baseUrl, accessKeyId, secretAccessKey] = KEYS.map((key) => environment[key].trim());
    if (!baseUrl || !accessKeyId || !secretAccessKey) {
        throw new ValidationError('KooyaHQ environment credentials must not be blank.');
    }
    return { baseUrl: validateBaseUrl(baseUrl), accessKeyId, secretAccessKey };
}
//# sourceMappingURL=env.js.map