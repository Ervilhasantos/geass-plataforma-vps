import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Dropando políticas RLS antigas (case-sensitive)...');
    
    await client.query('DROP POLICY IF EXISTS "Alunos veem cursos permitidos" ON public.cursos;');
    await client.query('DROP POLICY IF EXISTS "Alunos veem modulos de cursos permitidos" ON public.modulos;');
    await client.query('DROP POLICY IF EXISTS "Alunos veem aulas de cursos permitidos" ON public.aulas;');
    
    console.log('Criando novas políticas RLS case-insensitive usando LOWER()...');

    // 1. Política de Cursos para Alunos (case-insensitive)
    await client.query(`
      CREATE POLICY "Alunos veem cursos permitidos" ON public.cursos FOR SELECT 
      USING (EXISTS (
        SELECT 1 FROM public.permissoes p 
        WHERE p.curso_id = public.cursos.id 
        AND LOWER(p.user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      ));
    `);

    // 2. Política de Módulos para Alunos (case-insensitive)
    await client.query(`
      CREATE POLICY "Alunos veem modulos de cursos permitidos" ON public.modulos FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.cursos c 
        JOIN public.permissoes p ON p.curso_id = c.id 
        WHERE c.id = public.modulos.curso_id 
        AND LOWER(p.user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      ));
    `);

    // 3. Política de Aulas para Alunos (case-insensitive)
    await client.query(`
      CREATE POLICY "Alunos veem aulas de cursos permitidos" ON public.aulas FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.modulos m
        JOIN public.cursos c ON c.id = m.curso_id
        JOIN public.permissoes p ON p.curso_id = c.id
        WHERE m.id = public.aulas.modulo_id 
        AND LOWER(p.user_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      ));
    `);

    console.log('Políticas case-insensitive criadas com sucesso!');

  } catch (err) {
    console.error('Erro ao atualizar as políticas RLS:', err);
  } finally {
    await client.end();
  }
}

main();
