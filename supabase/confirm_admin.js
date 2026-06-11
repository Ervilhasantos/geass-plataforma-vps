import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    // 1. Procurar o usuário
    const resUsers = await client.query("SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'nelsonvilhasantos@gmail.com'");
    if (resUsers.rows.length === 0) {
      console.log('ATENÇÃO: O usuário nelsonvilhasantos@gmail.com ainda NÃO se cadastrou no novo projeto do Supabase!');
      console.log('Por favor, cadastre-se primeiro na tela de cadastro do aplicativo.');
      return;
    }

    const userId = resUsers.rows[0].id;
    console.log(`Usuário encontrado com ID: ${userId}. Confirmando email...`);

    // 2. Confirmar no auth.users
    await client.query(
      "UPDATE auth.users SET email_confirmed_at = NOW(), last_sign_in_at = NOW() WHERE id = $1",
      [userId]
    );
    console.log('Email confirmado na tabela auth.users.');

    // 3. Confirmar na tabela public.perfis
    const resPerfis = await client.query("SELECT * FROM public.perfis WHERE id = $1", [userId]);
    if (resPerfis.rows.length === 0) {
      console.log('Perfil não encontrado na tabela public.perfis. Criando perfil manualmente...');
      await client.query(
        "INSERT INTO public.perfis (id, email, confirmado) VALUES ($1, 'nelsonvilhasantos@gmail.com', true) ON CONFLICT (id) DO UPDATE SET confirmado = true",
        [userId]
      );
    } else {
      await client.query("UPDATE public.perfis SET confirmado = true WHERE id = $1", [userId]);
    }
    console.log('Perfil confirmado na tabela public.perfis.');
    console.log('Procedimento concluído com SUCESSO! Agora você pode criar cursos e módulos como Administrador.');

  } catch (err) {
    console.error('Erro durante a confirmação do administrador:', err);
  } finally {
    await client.end();
  }
}

main();
