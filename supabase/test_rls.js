import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Simulando requisição autenticada do amigo (nelsonvilhasantosl@gmail.com) no RLS...');

    // Simulando o contexto de autenticação do Supabase dentro de uma transação.
    // 1. Iniciamos a transação
    await client.query('BEGIN');
    
    // 2. Definimos as claims JWT simulando o amigo logado
    const claims = JSON.stringify({
      sub: '127f97c9-ba07-4544-a80f-950b7cc2eb60',
      email: 'nelsonvilhasantosl@gmail.com',
      role: 'authenticated'
    });
    
    await client.query(`SET LOCAL request.jwt.claims = '${claims}'`);
    await client.query('SET LOCAL role = \'authenticated\'');

    // 3. Executamos a consulta na tabela cursos para ver o que a RLS retorna
    const resCursos = await client.query('SELECT * FROM public.cursos');
    
    console.log('Cursos retornados pela RLS:', resCursos.rows);

    await client.query('COMMIT');
    console.log('Simulação concluída.');

  } catch (err) {
    console.error('Erro na simulação do RLS:', err);
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
  } finally {
    await client.end();
  }
}

main();
