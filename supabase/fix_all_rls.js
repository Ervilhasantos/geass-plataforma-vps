import { createDbClient } from './db.js';

const client = createDbClient();

const sql = `
-- 1. Atualizar a função is_admin() para usar auth.uid() com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT email = 'nelsonvilhasantos@gmail.com' FROM auth.users WHERE id = auth.uid()),
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar a função get_user_email() com SECURITY DEFINER para permitir que políticas consultem o e-mail sem dar erro de permissão
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar as políticas das tabelas principais para Alunos (Select) usando get_user_email()
-- Cursos
DROP POLICY IF EXISTS "Alunos veem cursos permitidos" ON public.cursos;
CREATE POLICY "Alunos veem cursos permitidos" ON public.cursos 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.permissoes p 
    WHERE p.curso_id = public.cursos.id 
    AND LOWER(p.user_email) = LOWER(COALESCE(get_user_email(), ''))
  ));

-- Módulos
DROP POLICY IF EXISTS "Alunos veem modulos de cursos permitidos" ON public.modulos;
CREATE POLICY "Alunos veem modulos de cursos permitidos" ON public.modulos 
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.cursos c 
    JOIN public.permissoes p ON p.curso_id = c.id 
    WHERE c.id = public.modulos.curso_id 
    AND LOWER(p.user_email) = LOWER(COALESCE(get_user_email(), ''))
  ));

-- Aulas
DROP POLICY IF EXISTS "Alunos veem aulas de cursos permitidos" ON public.aulas;
CREATE POLICY "Alunos veem aulas de cursos permitidos" ON public.aulas 
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.modulos m
    JOIN public.cursos c ON c.id = m.curso_id
    JOIN public.permissoes p ON p.curso_id = c.id
    WHERE m.id = public.aulas.modulo_id 
    AND LOWER(p.user_email) = LOWER(COALESCE(get_user_email(), ''))
  ));

-- 4. Atualizar as políticas de Admin com WITH CHECK
-- Cursos
DROP POLICY IF EXISTS "Admin tem acesso total aos cursos" ON public.cursos;
CREATE POLICY "Admin tem acesso total aos cursos" ON public.cursos 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Módulos
DROP POLICY IF EXISTS "Admin tem acesso total aos modulos" ON public.modulos;
CREATE POLICY "Admin tem acesso total aos modulos" ON public.modulos 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Aulas
DROP POLICY IF EXISTS "Admin tem acesso total as aulas" ON public.aulas;
CREATE POLICY "Admin tem acesso total as aulas" ON public.aulas 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Permissões
DROP POLICY IF EXISTS "Admin tem acesso total as permissoes" ON public.permissoes;
CREATE POLICY "Admin tem acesso total as permissoes" ON public.permissoes 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Perfis
DROP POLICY IF EXISTS "Admin tem acesso total aos perfis" ON public.perfis;
CREATE POLICY "Admin tem acesso total aos perfis" ON public.perfis 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Metas de Estudo (Admin)
DROP POLICY IF EXISTS "Admin gerencia todas metas" ON public.metas_estudo;
CREATE POLICY "Admin gerencia todas metas" ON public.metas_estudo 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Progresso Diário (Admin)
DROP POLICY IF EXISTS "Admin gerencia todos progressos diarios" ON public.progresso_diario;
CREATE POLICY "Admin gerencia todos progressos diarios" ON public.progresso_diario 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Progresso (Admin)
DROP POLICY IF EXISTS "Admin tem acesso total ao progresso" ON public.progresso;
CREATE POLICY "Admin tem acesso total ao progresso" ON public.progresso 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- 5. Otimização da política do Supabase Storage para restringir o bucket 'materiais' apenas ao Admin para uploads
-- Nota: se a política padrão de INSERT do storage do Supabase para materiais existir, podemos atualizá-la
DO $$
BEGIN
  -- Tenta atualizar a política do storage se o schema existir e a política existir
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    DROP POLICY IF EXISTS "Permitir upload para materiais" ON storage.objects;
    DROP POLICY IF EXISTS "Upload de materiais por autenticados" ON storage.objects;
    DROP POLICY IF EXISTS "Upload de materiais restrito ao Admin" ON storage.objects;
    
    -- Cria nova política exigindo ser admin para upload no bucket materiais
    CREATE POLICY "Upload de materiais restrito ao Admin" ON storage.objects 
      FOR INSERT 
      WITH CHECK (bucket_id = 'materiais' AND is_admin());
  END IF;
END $$;
`;

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');
    console.log('Aplicando correções de RLS e funções de segurança no banco de dados...');
    await client.query(sql);
    console.log('Todas as correções de RLS e segurança do banco de dados foram aplicadas com sucesso!');
  } catch (err) {
    console.error('Erro ao aplicar correções RLS no banco de dados:', err);
  } finally {
    await client.end();
  }
}

main();
