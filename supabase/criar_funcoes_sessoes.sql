-- Função para obter todas as sessões ativas dos usuários com seus respectivos IPs e dispositivos
CREATE OR REPLACE FUNCTION public.obter_sessoes_ativas()
RETURNS TABLE (
  id_sessao UUID,
  user_id UUID,
  email TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Segurança: Garantir que apenas o admin Nelson possa rodar esta consulta
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem visualizar as sessões ativas.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id::UUID as id_sessao,
    s.user_id::UUID,
    u.email::TEXT,
    s.user_agent::TEXT,
    s.ip::TEXT,
    s.created_at::TIMESTAMPTZ,
    s.updated_at::TIMESTAMPTZ
  FROM auth.sessions s
  JOIN auth.users u ON s.user_id = u.id
  ORDER BY s.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para encerrar uma sessão específica (desconectar dispositivo)
CREATE OR REPLACE FUNCTION public.encerrar_sessao(sessao_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Segurança: Garantir que apenas o admin Nelson possa encerrar sessões
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem desconectar dispositivos.';
  END IF;

  DELETE FROM auth.sessions WHERE id = sessao_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para encerrar todas as sessões de um usuário específico (desconectar todas as contas dele)
CREATE OR REPLACE FUNCTION public.encerrar_todas_sessoes_usuario(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Segurança: Garantir que apenas o admin Nelson possa encerrar sessões
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem desconectar usuários.';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
