import { createDbClient } from './db.js';

const client = createDbClient();

async function run() {
  try {
    await client.connect();
    console.log('Conectado ao PostgreSQL.');

    const query = `
      ALTER TABLE public.progresso
      ADD COLUMN IF NOT EXISTS duracao_total INTEGER DEFAULT 0;
    `;

    await client.query(query);
    console.log('Coluna duracao_total adicionada com sucesso!');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.end();
  }
}

run();
