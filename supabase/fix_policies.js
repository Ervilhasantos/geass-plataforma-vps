import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Dropando políticas RLS antigas que consultavam a tabela restrita auth.users...');
    
    await client.query('DROP POLICY IF EXISTS "Alunos veem cursos permitidos" ON public.cursos;');
    await client.query('DROP POLICY IF EXISTS "Alunos veem modulos de cursos permitidos" ON public.modulos;');
    await client.query('DROP POLICY IF EXISTS "Alunos veem aulas de cursos permitidos" ON public.aulas;');
    
    console.log('Políticas antigas removidas.');

    console.log('Criando novas políticas RLS otimizadas baseadas em auth.jwt() ->> \'email\'...');

    // 1. Política de Cursos para Alunos
    await client.query(`
      CREATE POLICY "Alunos veem cursos permitidos" ON public.cursos FOR SELECT 
      USING (EXISTS (
        SELECT 1 FROM public.permissoes p 
        WHERE p.curso_id = public.cursos.id 
        AND p.user_email = COALESCE(auth.jwt() ->> 'email', '')
      ));
    `);

    // 2. Política de Módulos para Alunos
    await client.query(`
      CREATE POLICY "Alunos veem modulos de cursos permitidos" ON public.modulos FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.cursos c 
        JOIN public.permissoes p ON p.curso_id = c.id 
        WHERE c.id = public.modulos.curso_id 
        AND p.user_email = COALESCE(auth.jwt() ->> 'email', '')
      ));
    `);

    // 3. Política de Aulas para Alunos
    await client.query(`
      CREATE POLICY "Alunos veem aulas de cursos permitidos" ON public.aulas FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.modulos m
        JOIN public.cursos c ON c.id = m.curso_id
        JOIN public.permissoes p ON p.curso_id = c.id
        WHERE m.id = public.aulas.modulo_id 
        AND p.user_email = COALESCE(auth.jwt() ->> 'email', '')
      ));
    `);

    console.log('Novas políticas criadas com sucesso!');
    console.log('O erro "permission denied for table users" foi resolvido de forma definitiva.');

  } catch (err) {
    console.error('Erro ao atualizar as políticas RLS:', err);
  } finally {
    await client.end();
  }
}

main();
