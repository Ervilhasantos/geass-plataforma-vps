import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Target, Flame, Clock, Plus, Trophy, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MetaEstudo {
  id: string;
  curso_id: string;
  meta_minutos: number;
  streak_atual: number;
  ultimo_estudo: string;
}

interface Curso {
  id: string;
  nome_curso: string;
}

interface ProgressoDiario {
  data_estudo: string;
  segundos_estudados: number;
  meta_batida: boolean;
}

export default function GoalsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cursosDisponiveis, setCursosDisponiveis] = useState<Curso[]>([]);
  const [metas, setMetas] = useState<MetaEstudo[]>([]);
  const [historicoDiario, setHistoricoDiario] = useState<Record<string, ProgressoDiario>>({});
  
  // States do formulário
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cursoSelecionado, setCursoSelecionado] = useState('');
  const [metaMinutos, setMetaMinutos] = useState('30');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const hoje = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD
      const isNelson = user.email === 'nelsonvilhasantos@gmail.com';

      // Disparar todas as queries em paralelo
      const promises: Promise<any>[] = [
        Promise.resolve(supabase.from('cursos').select('id, nome_curso').order('created_at', { ascending: false })),
        Promise.resolve(supabase.from('metas_estudo').select('*').eq('user_id', user.id)),
        Promise.resolve(supabase.from('progresso_diario').select('*').eq('user_id', user.id).eq('data_estudo', hoje))
      ];

      if (!isNelson) {
        promises.push(
          Promise.resolve(supabase.from('permissoes').select('curso_id').eq('user_email', user.email))
        );
      }

      const [cursosRes, metasRes, progressoRes, permissoesRes] = await Promise.all(promises);

      const cursosData = cursosRes.data || [];
      const metasData = metasRes.data || [];
      const progressoData = progressoRes.data || [];

      let cursosFinais = cursosData;
      if (!isNelson && permissoesRes) {
        const permissaoData = permissoesRes.data || [];
        const permitidos = permissaoData.map((p: any) => p.curso_id) || [];
        cursosFinais = cursosFinais.filter((c: any) => permitidos.includes(c.id));
      }

      setCursosDisponiveis(cursosFinais);
      setMetas(metasData);

      const mapDiario: Record<string, ProgressoDiario> = {};
      if (progressoData) {
        progressoData.forEach((p: any) => {
          mapDiario[p.curso_id] = p;
        });
      }
      setHistoricoDiario(mapDiario);

    } catch (err) {
      console.error('Erro ao carregar dados de metas:', err);
    } finally {
      setLoading(false);
    }
  };

  const salvarNovaMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoSelecionado || !metaMinutos) return;

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('metas_estudo')
        .upsert({
          user_id: user.id,
          curso_id: cursoSelecionado,
          meta_minutos: parseInt(metaMinutos),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,curso_id' });

      if (error) throw error;

      setMostrarFormulario(false);
      setCursoSelecionado('');
      setMetaMinutos('30');
      await carregarDados();
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      alert('Houve um erro ao salvar sua meta. Verifique se as tabelas foram criadas no Supabase.');
    } finally {
      setSalvando(false);
    }
  };

  const apagarMeta = async (metaId: string) => {
    if (!window.confirm('Tem certeza que deseja apagar essa meta?')) return;
    try {
      const { error } = await supabase.from('metas_estudo').delete().eq('id', metaId);
      if (error) throw error;
      await carregarDados();
    } catch (err) {
      console.error('Erro ao apagar meta:', err);
      alert('Houve um erro ao apagar a meta.');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando suas metas...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Target size={32} /> Metas e Cronograma
          </h1>
          <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>Defina metas diárias de estudo e mantenha sua meta ativa!</p>
        </div>
        {!mostrarFormulario && (
          <button 
            className="btn btn-primary" 
            onClick={() => setMostrarFormulario(true)}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
          >
            <Plus size={20} /> Nova Meta
          </button>
        )}
      </div>

      {mostrarFormulario && (
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--primary-color)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Configurar Nova Meta Diária</h2>
          <form onSubmit={salvarNovaMeta} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Selecione o Curso</label>
              <select 
                className="input-field" 
                value={cursoSelecionado} 
                onChange={(e) => setCursoSelecionado(e.target.value)}
                required
              >
                <option value="">Escolha um curso...</option>
                {cursosDisponiveis.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_curso}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Quantos minutos por dia deseja estudar?</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Clock size={20} style={{ opacity: 0.5 }} />
                <input 
                  type="number" 
                  min="1" 
                  step="1" 
                  className="input-field" 
                  value={metaMinutos} 
                  onChange={(e) => setMetaMinutos(e.target.value)}
                  style={{ maxWidth: '150px' }}
                  required
                />
                <span style={{ opacity: 0.7 }}>minutos</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setMostrarFormulario(false)} disabled={salvando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Meta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {metas.length === 0 && !mostrarFormulario && (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', opacity: 0.8 }}>
          <Trophy size={48} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Você ainda não possui metas.</h3>
          <p>Estabeleça sua primeira meta de estudos para ganhar foco e criar uma rotina vencedora.</p>
        </div>
      )}

      {metas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {metas.map(meta => {
            const curso = cursosDisponiveis.find(c => c.id === meta.curso_id);
            const hoje = historicoDiario[meta.curso_id];
            
            const minutosEstudados = hoje ? (hoje.segundos_estudados / 60) : 0;
            const metaBatida = hoje ? hoje.segundos_estudados >= (meta.meta_minutos * 60) - 5 : false;
            const pctCompleto = metaBatida ? 100 : Math.min(100, (minutosEstudados / meta.meta_minutos) * 100);

            return (
              <div key={meta.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                
                {metaBatida && (
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.25rem 2rem', background: '#22c55e', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', transform: 'rotate(45deg) translate(25%, -50%)', transformOrigin: 'center' }}>
                    CONCLUÍDO
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, paddingRight: '2rem' }}>{curso?.nome_curso || 'Curso Desconhecido'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
                      <Target size={16} /> Meta: {meta.meta_minutos} min / dia
                    </div>
                  </div>
                  <button onClick={() => apagarMeta(meta.id)} className="btn" style={{ padding: '0.5rem', color: '#ef4444', backgroundColor: 'transparent' }} title="Apagar Meta">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Flame size={32} color={meta.streak_atual > 0 ? '#ef4444' : 'gray'} style={{ opacity: meta.streak_atual > 0 ? 1 : 0.3 }} />
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{meta.streak_atual}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase' }}>Dias Seguidos</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <span>Progresso de Hoje</span>
                    <span style={{ fontWeight: 600 }}>
                      {metaBatida ? meta.meta_minutos : minutosEstudados.toFixed(1)} / {meta.meta_minutos} min
                    </span>
                  </div>
                  <div className="progress-bar-container" style={{ height: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pctCompleto}%`, backgroundColor: metaBatida ? '#22c55e' : 'var(--text-color)' }}></div>
                  </div>
                </div>

                {!metaBatida && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
                    <AlertCircle size={16} />
                    <span>Estude mais {Math.max(0.1, Number((meta.meta_minutos - minutosEstudados).toFixed(1)))} minutos hoje para não perder a sua meta!</span>
                  </div>
                )}

                <button 
                  onClick={() => navigate(`/curso/${meta.curso_id}`)}
                  className="btn btn-outline" 
                  style={{ width: '100%', marginTop: 'auto' }}
                >
                  {metaBatida ? 'Continuar Estudando' : 'Estudar Agora'}
                </button>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
