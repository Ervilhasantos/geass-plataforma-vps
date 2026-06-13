import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';

export default function Dashboard() {
  const [cursos, setCursos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCursos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase.from('cursos').select('*');

      // Se não for admin de verdade (ou for admin simulando o aluno), filtra pelos cursos que ele tem acesso
      if (user.email?.toLowerCase() !== 'nelsonvilhasantos@gmail.com') {
        const { data: permissaoData } = await supabase
          .from('permissoes')
          .select('curso_id')
          .eq('user_email', user.email);

        const permitidos = permissaoData?.map(p => p.curso_id) || [];
        if (permitidos.length > 0) {
          query = query.in('id', permitidos);
        } else {
          setCursos([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
        
      if (!error && data) {
        setCursos(data);
      }
      setLoading(false);
    };

    fetchCursos();
  }, []);

  if (loading) {
    return <div>Carregando seus cursos...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2.5rem', fontWeight: 700, fontSize: '2rem' }}>Meus Cursos</h1>
      
      {cursos.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', opacity: 0.7 }}>
          <p>Você ainda não tem acesso a nenhum curso.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {cursos.map(curso => (
            <div key={curso.id} className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease', cursor: 'pointer' }} onClick={() => window.location.href = `/curso/${curso.id}`}>
              <div style={{ height: '180px', backgroundColor: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                 <PlayCircle size={64} color="var(--primary-color)" strokeWidth={1.5} style={{ opacity: 0.8 }} />
              </div>
              <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>{curso.nome_curso}</h3>
                <p style={{ fontSize: '0.95rem', opacity: 0.6, marginBottom: '2rem', flex: 1, lineHeight: 1.6 }}>
                  {curso.descricao}
                </p>
                <Link to={`/curso/${curso.id}`} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', borderRadius: '12px' }}>
                  Continuar Aprendendo
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
