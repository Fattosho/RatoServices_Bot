import { existsSync } from 'node:fs';

const distEntry = new URL('./dist/index.js', import.meta.url);

if (!existsSync(distEntry)) {
  throw new Error('dist/index.js nao foi encontrado. Execute o build antes de iniciar o bot.');
}

await import('./dist/index.js');
