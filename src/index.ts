import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Telegraf } from 'telegraf';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { registerBotHandlers, MyContext } from './bot/register_next.js';
import { syncServices } from './services/syncServices.js';
import { startAutomationWorkers } from './services/automationWorkers.js';

async function initDatabase(): Promise<void> {
  const schemaCandidates = [
    fileURLToPath(new URL('./db/schema.sql', import.meta.url)),
    join(process.cwd(), 'src', 'db', 'schema.sql'),
    join(process.cwd(), 'dist', 'db', 'schema.sql')
  ];

  let schema: string | null = null;
  for (const schemaPath of schemaCandidates) {
    try {
      schema = await readFile(schemaPath, 'utf8');
      break;
    } catch {
      // Try the next path.
    }
  }

  if (!schema) {
    throw new Error('Nao foi possivel localizar o schema.sql para inicializar o banco.');
  }

  await pool.query(schema);
}

async function bootstrap(): Promise<void> {
  await initDatabase();

  if (env.syncOnStart) {
    try {
      const total = await syncServices();
      console.log(`Servicos sincronizados: ${total}`);
    } catch (error) {
      console.error('Falha ao sincronizar servicos no start:', error);
    }
  }

  const bot = new Telegraf<MyContext>(env.botToken);
  registerBotHandlers(bot);
  const stopWorkers = startAutomationWorkers(bot);
  bot.catch((error, ctx) => {
    console.error('Erro nao tratado no bot:', {
      updateId: ctx.update.update_id,
      error
    });
  });

  await bot.launch();
  console.log(`Bot online: ${env.botUsername}`);

  process.once('SIGINT', () => {
    stopWorkers();
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    stopWorkers();
    bot.stop('SIGTERM');
  });
}

bootstrap().catch((error) => {
  console.error('Erro fatal ao iniciar o bot:', error);
  process.exit(1);
});
