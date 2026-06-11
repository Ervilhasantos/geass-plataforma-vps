import { createDbClient } from './db.js';

const client = createDbClient();

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao banco de dados Supabase.');

    console.log('Restaurando a função is_admin() para ler do auth.jwt()...');
    
    // Restaura a função is_admin para ler direto do JWT decodificado pelo Supabase.
    // Isso evita o erro de "permission denied for table users", pois não consulta tabelas restritas do schema auth.
    const query = `
      CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
        SELECT COALESCE(auth.jwt() ->> 'email' = 'nelsonvilhasantos@gmail.com', FALSE);
      $$ LANGUAGE sql SECURITY DEFINER;
    `;
    
    await client.query(query);
    console.log('Função is_admin() restaurada com sucesso!');

  } catch (err) {
    console.error('Erro ao restaurar a função is_admin():', err);
  } finally {
    await client.end();
  }
}

main();
