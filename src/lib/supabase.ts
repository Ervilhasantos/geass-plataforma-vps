import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no arquivo .env. Consulte o .env.example para referência.'
  );
}

const client = createClient(supabaseUrl, supabaseAnonKey);

// Interceptamos o supabase.auth para injetar o comportamento de impersonation
const authHandler = {
  get(target: any, prop: string, receiver: any) {
    if (prop === 'getUser') {
      return async (...args: any[]) => {
        // Obter o usuário real autenticado no Supabase
        const res = await target.getUser(...args);
        const realUser = res.data?.user;
        
        if (!realUser) {
          return res;
        }

        // Se o usuário real for admin, podemos aplicar impersonate
        const isAdmin = realUser.email?.toLowerCase() === 'nelsonvilhasantos@gmail.com';
        if (isAdmin) {
          const impersonatedData = localStorage.getItem('geass:impersonate');
          if (impersonatedData) {
            try {
              const impersonated = JSON.parse(impersonatedData);
              if (impersonated && impersonated.id && impersonated.email) {
                // Retornamos um objeto mock que simula o usuário impersonado,
                // mantendo as propriedades necessárias e o flag is_impersonated
                return {
                  data: {
                    user: {
                      ...realUser,
                      id: impersonated.id,
                      email: impersonated.email,
                      is_impersonated: true,
                      real_user: realUser
                    }
                  },
                  error: null
                };
              }
            } catch (e) {
              console.error('Erro ao analisar impersonate no localStorage:', e);
            }
          }
        } else {
          // Se não for admin, limpamos qualquer tentativa de impersonação do localStorage
          localStorage.removeItem('geass:impersonate');
        }

        return res;
      };
    }
    return Reflect.get(target, prop, receiver);
  }
};

// Substituímos o auth original por um Proxy
const originalAuth = client.auth;
client.auth = new Proxy(originalAuth, authHandler) as any;

export const supabase = client;
