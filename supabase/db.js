import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente do .env na raiz do projeto
config({ path: resolve(__dirname, '..', '.env') });

const { Client } = pg;

/**
 * Cria e retorna uma instância do cliente PostgreSQL
 * usando variáveis de ambiente do arquivo .env
 */
export function createDbClient() {
  const host = process.env.DB_HOST;
  const password = process.env.DB_PASSWORD;

  if (!host || !password) {
    console.error('ERRO: As variáveis DB_HOST e DB_PASSWORD devem estar definidas no arquivo .env');
    console.error('Consulte o arquivo .env.example para referência.');
    process.exit(1);
  }

  return new Client({
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password,
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  });
}
