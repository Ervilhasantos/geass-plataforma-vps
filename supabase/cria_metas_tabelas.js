import { createDbClient } from './db.js';

const client = createDbClient();

const sql = `
-- Criar a tabela metas_estudo se não existir
CREATE TABLE IF NOT EXISTS public.metas_estudo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
  meta_minutos INTEGER NOT NULL DEFAULT 30,
  streak_atual INTEGER NOT NULL DEFAULT 0,
  ultimo_estudo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, curso_id)
);

-- Habilitar RLS para metas_estudo
ALTER TABLE public.metas_estudo ENABLE ROW LEVEL SECURITY;

-- Políticas para metas_estudo
DROP POLICY IF EXISTS "Usuarios gerenciam proprias metas" ON public.metas_estudo;
CREATE POLICY "Usuarios gerenciam proprias metas" ON public.metas_estudo
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin gerencia todas metas" ON public.metas_estudo;
CREATE POLICY "Admin gerencia todas metas" ON public.metas_estudo
  FOR ALL USING (
    (SELECT auth.jwt() ->> 'email') = 'nelsonvilhasantos@gmail.com'
  );

-- Criar a tabela progresso_diario se não existir
CREATE TABLE IF NOT EXISTS public.progresso_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
  data_estudo TEXT NOT NULL,
  segundos_estudados INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, curso_id, data_estudo)
);

-- Habilitar RLS para progresso_diario
ALTER TABLE public.progresso_diario ENABLE ROW LEVEL SECURITY;

-- Políticas para progresso_diario
DROP POLICY IF EXISTS "Usuarios gerenciam proprio progresso diario" ON public.progresso_diario;
CREATE POLICY "Usuarios gerenciam proprio progresso diario" ON public.progresso_diario
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin gerencia todos progressos diarios" ON public.progresso_diario;
CREATE POLICY "Admin gerencia todos progressos diarios" ON public.progresso_diario
  FOR ALL USING (
    (SELECT auth.jwt() ->> 'email') = 'nelsonvilhasantos@gmail.com'
  );
`;

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase com sucesso.');

    console.log('Executando o script de criação das tabelas de metas...');
    await client.query(sql);
    console.log('Tabelas e políticas criadas com sucesso!');
  } catch (err) {
    console.error('Erro durante a execução do script:', err);
  } finally {
    await client.end();
  }
}

main();
