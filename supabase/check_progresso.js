import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    // Verificar progresso
    const resProgresso = await client.query("SELECT * FROM public.progresso");
    console.log('Progresso na tabela public.progresso:', resProgresso.rows);

  } catch (err) {
    console.error('Erro ao buscar progresso:', err);
  } finally {
    await client.end();
  }
}

main();
