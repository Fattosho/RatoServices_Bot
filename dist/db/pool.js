import { Pool } from 'pg';
import { env } from '../config/env.js';
export const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl
        ? {
            rejectUnauthorized: env.databaseSslRejectUnauthorized
        }
        : undefined
});
