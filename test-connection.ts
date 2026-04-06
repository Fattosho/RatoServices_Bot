import { pool } from './src/db/pool.js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function testConnection() {
  try {
    console.log('--- TESTANDO CONEXAO COM SUPABASE ---');
    const res = await pool.query('SELECT NOW()');
    console.log('Conexao realizada com sucesso. Horario no banco:', res.rows[0].now);

    console.log('--- INICIALIZANDO SCHEMA ---');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const schemaSql = await readFile(join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');
    await pool.query(schemaSql);
    console.log('Banco de dados pronto (schema criado e validado).');

    process.exit(0);
  } catch (error) {
    console.error('Falha na conexao:', error);
    process.exit(1);
  }
}

testConnection();
