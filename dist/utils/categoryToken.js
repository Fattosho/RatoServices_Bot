import { createHash } from 'node:crypto';
export function makeCategoryToken(category) {
    return createHash('md5').update(category).digest('hex').slice(0, 16);
}
