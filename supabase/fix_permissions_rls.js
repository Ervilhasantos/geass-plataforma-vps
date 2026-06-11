import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Adicionando a política SELECT na tabela public.permissoes para os alunos...');
    
    // Dropa se já existir (para evitar erros)
    await client.query('DROP POLICY IF EXISTS "Alunos consultam as proprias permissoes" ON public.permissoes;');
    
    // Adiciona a política que permite SELECT para o aluno correspondente ao e-mail
    await client.query(`
      CREATE POLICY "Alunos consultam as proprias permissoes" ON public.permissoes FOR SELECT
      USING (LOWER(user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')));
    `);

    console.log('Política na tabela public.permissoes criada com sucesso!');

  } catch (err) {
    console.error('Erro ao adicionar política RLS na tabela permissoes:', err);
  } finally {
    await client.end();
  }
}

main();
