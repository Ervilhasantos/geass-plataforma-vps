import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Atualizando a função is_admin() para um modelo mais robusto baseado em auth.uid()...');
    
    // Atualiza a função is_admin para consultar diretamente na tabela auth.users pelo ID do usuário autenticado.
    // Isso é mais seguro e evita problemas de JWTs desatualizados ou sem claim de email.
    const query = `
      CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
        SELECT COALESCE(email = 'nelsonvilhasantos@gmail.com', FALSE) 
        FROM auth.users 
        WHERE id = auth.uid();
      $$ LANGUAGE sql SECURITY DEFINER;
    `;
    
    await client.query(query);
    console.log('Função is_admin() atualizada com sucesso!');

  } catch (err) {
    console.error('Erro ao atualizar a função is_admin():', err);
  } finally {
    await client.end();
  }
}

main();
