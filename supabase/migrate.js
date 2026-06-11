import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDbClient } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase com sucesso.');

    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executando o script schema.sql...');
    await client.query(sql);
    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Erro durante a migração:', err);
  } finally {
    await client.end();
  }
}

main();
