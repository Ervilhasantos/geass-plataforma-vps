import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    // 1. Verificar usuários
    const resUsers = await client.query("SELECT id, email, email_confirmed_at FROM auth.users");
    console.log('Usuários no banco auth.users:', resUsers.rows);

    // 2. Verificar perfis
    const resPerfis = await client.query("SELECT * FROM public.perfis");
    console.log('Perfis na tabela public.perfis:', resPerfis.rows);

    // 3. Verificar cursos
    const resCursos = await client.query("SELECT * FROM public.cursos");
    console.log('Cursos na tabela public.cursos:', resCursos.rows);

    // 4. Verificar permissões
    const resPermissoes = await client.query("SELECT * FROM public.permissoes");
    console.log('Permissões na tabela public.permissoes:', resPermissoes.rows);

  } catch (err) {
    console.error('Erro ao buscar dados:', err);
  } finally {
    await client.end();
  }
}

main();
