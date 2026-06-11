import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    // 1. Procurar o ID do Administrador (Nelson) no banco
    const resAdmin = await client.query("SELECT id, email FROM auth.users WHERE email = 'nelsonvilhasantos@gmail.com'");
    if (resAdmin.rows.length === 0) {
      console.log('ATENÇÃO: Usuário administrador Nelson não encontrado no banco de dados. Cadastre o usuário primeiro!');
      return;
    }

    const adminId = resAdmin.rows[0].id;
    console.log(`Administrador encontrado. ID: ${adminId}`);

    // Inspecionar onde is_admin está declarada
    const resIsAdminSearch = await client.query(`
      SELECT n.nspname as schema, p.proname as function 
      FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'is_admin'
    `);
    console.log('Onde is_admin está declarada:', resIsAdminSearch.rows);

    // Inspecionar definição de auth.uid()
    const resUidDef = await client.query(`
      SELECT pg_get_functiondef(p.oid) as definition
      FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'uid' AND n.nspname = 'auth'
    `);
    if (resUidDef.rows.length > 0) {
      console.log('Definição de auth.uid():\n', resUidDef.rows[0].definition);
    }

    // 2. Simular o contexto JWT do Nelson no PostgreSQL para que is_admin() e obter_sessoes_ativas() funcionem
    console.log('Simulando o contexto de autenticação do Admin...');
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [adminId]);

    const resUidVal = await client.query("SELECT auth.uid() as uid, public.is_admin() as is_admin");
    console.log('Valores simulados:', resUidVal.rows[0]);

    // 3. Testar a função obter_sessoes_ativas()
    console.log('Testando obter_sessoes_ativas()...');
    const resSessoes = await client.query("SELECT * FROM public.obter_sessoes_ativas()");
    console.log('Resultado obter_sessoes_ativas():');
    console.log(`Total de sessões encontradas: ${resSessoes.rows.length}`);
    console.table(resSessoes.rows);

    // 4. Testar a negação de acesso para usuários comuns (simulando um UID inexistente ou não-admin)
    console.log('\nTestando segurança: simulando um usuário não-admin...');
    await client.query("SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', false)");
    
    try {
      await client.query("SELECT * FROM public.obter_sessoes_ativas()");
      console.error('FALHA: A função obter_sessoes_ativas() permitiu acesso a um não-admin!');
    } catch (err) {
      console.log('SUCESSO: Acesso negado como esperado para não-admin:', err.message);
    }

  } catch (err) {
    console.error('Erro durante o teste das sessões:', err);
  } finally {
    await client.end();
  }
}

main();
