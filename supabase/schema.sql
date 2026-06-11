-- Criação da tabela de Perfis
CREATE TABLE public.perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  confirmado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para criar o perfil automaticamente ao cadastrar um novo usuário no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, email, confirmado)
  VALUES (new.id, new.email, FALSE);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Criação da Tabela de Cursos
CREATE TABLE public.cursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_curso TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criação da Tabela de Módulos
CREATE TABLE public.modulos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
  nome_modulo TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criação da Tabela de Aulas
CREATE TABLE public.aulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo_id UUID REFERENCES public.modulos(id) ON DELETE CASCADE,
  nome_aula TEXT NOT NULL,
  youtube_id VARCHAR(11) NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criação da Tabela de Permissões
CREATE TABLE public.permissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, curso_id)
);

-- Criação da Tabela de Progresso
CREATE TABLE public.progresso (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id UUID REFERENCES public.aulas(id) ON DELETE CASCADE,
  tempo_segundos INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, aula_id)
);

-- Enable RLS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progresso ENABLE ROW LEVEL SECURITY;

-- Funções Auxiliares para Políticas
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT auth.jwt() ->> 'email' = 'nelsonvilhasantos@gmail.com';
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas: Cursos
-- Admin pode tudo, Usuário vê cursos onde ele tem permissão
CREATE POLICY "Admin tem acesso total aos cursos" ON public.cursos FOR ALL USING (is_admin());
CREATE POLICY "Alunos veem cursos permitidos" ON public.cursos FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.permissoes p WHERE p.curso_id = public.cursos.id AND p.user_email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())));

-- Políticas: Módulos
CREATE POLICY "Admin tem acesso total aos modulos" ON public.modulos FOR ALL USING (is_admin());
CREATE POLICY "Alunos veem modulos de cursos permitidos" ON public.modulos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.cursos c 
    JOIN public.permissoes p ON p.curso_id = c.id 
    WHERE c.id = public.modulos.curso_id AND p.user_email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
  ));

-- Políticas: Aulas
CREATE POLICY "Admin tem acesso total as aulas" ON public.aulas FOR ALL USING (is_admin());
CREATE POLICY "Alunos veem aulas de cursos permitidos" ON public.aulas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.modulos m
    JOIN public.cursos c ON c.id = m.curso_id
    JOIN public.permissoes p ON p.curso_id = c.id
    WHERE m.id = public.aulas.modulo_id AND p.user_email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
  ));

-- Políticas: Permissões
CREATE POLICY "Admin tem acesso total as permissoes" ON public.permissoes FOR ALL USING (is_admin());

-- Políticas: Progresso
CREATE POLICY "Usuarios gerenciam proprio progresso" ON public.progresso FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas: Perfis
CREATE POLICY "Admin tem acesso total aos perfis" ON public.perfis FOR ALL USING (is_admin());
CREATE POLICY "Usuarios veem proprio perfil" ON public.perfis FOR SELECT USING (auth.uid() = id);
