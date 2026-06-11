import { createDbClient } from './db.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados correto do Supabase (via .env).');

    // Ler o arquivo SQL
    const sqlPath = resolve(__dirname, 'criar_funcoes_sessoes.sql');
    console.log(`Lendo script SQL de: ${sqlPath}`);
    const sql = readFileSync(sqlPath, 'utf8');

    // Executar as queries SQL no banco
    console.log('Aplicando funções obter_sessoes_ativas e encerrar_sessao...');
    await client.query(sql);
    console.log('Funções aplicadas com SUCESSO no banco de dados correto!');

  } catch (err) {
    console.error('Erro ao aplicar as funções no banco de dados:', err);
  } finally {
    await client.end();
  }
}

main();
