import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronRight, Folder } from 'lucide-react';

export default function Course() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [curso, setCurso] = useState<any>(null);
  const [modulos, setModulos] = useState<any[]>([]);
  const [modulosAbertos, setModulosAbertos] = useState<Record<string, boolean>>({});
  const [aulas, setAulas] = useState<any[]>([]);
  const [aulaAtual, setAulaAtual] = useState<any>(null);
  const [progressoAulas, setProgressoAulas] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mostrarToastMeta, setMostrarToastMeta] = useState(false);
  const [mensagemToastMeta, setMensagemToastMeta] = useState('');
  const [efeitoMetaBatida, setEfeitoMetaBatida] = useState(false);
  const [metaMinutos, setMetaMinutos] = useState(0);
  const [segundosEstudadosHoje, setSegundosEstudadosHoje] = useState(0);
  const [metaBatidaHoje, setMetaBatidaHoje] = useState(false);
  const [streakAtual, setStreakAtual] = useState(0);
  
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const aulaAtualRef = useRef<any>(null);
  const lastTimeRef = useRef<number | null>(null);
  const aulasRef = useRef<any[]>([]);

  useEffect(() => {
    aulasRef.current = aulas;
  }, [aulas]);

  useEffect(() => {
    const fetchData = async () => {
      // Buscar usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const hoje = new Date().toLocaleDateString('en-CA');
      const isNelson = user.email?.toLowerCase() === 'nelsonvilhasantos@gmail.com';

      // Disparar queries de Curso, Metas, Progresso Diário e Módulos em paralelo
      const promises: Promise<any>[] = [
        Promise.resolve(supabase.from('cursos').select('*').eq('id', id).single()),
        Promise.resolve(supabase.from('metas_estudo').select('*').eq('user_id', user.id).eq('curso_id', id).maybeSingle()),
        Promise.resolve(supabase.from('progresso_diario').select('*').eq('user_id', user.id).eq('curso_id', id).eq('data_estudo', hoje).maybeSingle()),
        Promise.resolve(supabase.from('modulos').select('*').eq('curso_id', id).order('ordem', { ascending: true }))
      ];

      // Se não for admin, adicionamos a query de permissão
      if (!isNelson) {
        promises.push(
          Promise.resolve(supabase.from('permissoes').select('id').eq('curso_id', id).eq('user_email', user.email).maybeSingle())
        );
      }

      const [cursoRes, metaRes, progressoDiarioRes, modulosRes, permissaoRes] = await Promise.all(promises);

      // Verificar permissão
      if (!isNelson) {
        const permissao = permissaoRes?.data;
        if (!permissao) {
          setCurso(null);
          setLoading(false);
          return;
        }
      }

      const cursoData = cursoRes.data;
      if (!cursoData) {
        setLoading(false);
        return;
      }
      setCurso(cursoData);

      const metaData = metaRes.data;
      const progHoje = progressoDiarioRes.data;
      if (metaData) {
        setMetaMinutos(metaData.meta_minutos);
        setStreakAtual(metaData.streak_atual || 0);
        const segs = progHoje?.segundos_estudados || 0;
        setSegundosEstudadosHoje(segs);
        setMetaBatidaHoje(segs >= metaData.meta_minutos * 60 - 5);
      }

      const modulosData = modulosRes.data || [];
      setModulos(modulosData);
      const abertos: Record<string, boolean> = {};
      modulosData.forEach((m: any) => abertos[m.id] = false);
      setModulosAbertos(abertos);

      // Buscar aulas do curso
      if (modulosData.length > 0) {
        const moduloIds = modulosData.map((m: any) => m.id);
        const { data: aulasData } = await supabase
          .from('aulas')
          .select('*')
          .in('modulo_id', moduloIds)
          .order('ordem', { ascending: true });
        
        if (aulasData) {
          // Ordenar as aulas primeiro pela ordem do módulo correspondente e depois pela ordem da aula
          const modulosOrderMap = new Map<string, number>(modulosData.map((m: any, index: number) => [m.id, index]));
          const aulasOrdenadas = [...aulasData].sort((a, b) => {
            const orderA = modulosOrderMap.get(a.modulo_id) ?? 999;
            const orderB = modulosOrderMap.get(b.modulo_id) ?? 999;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return a.ordem - b.ordem;
          });

          setAulas(aulasOrdenadas);
          
          // Buscar todo o progresso do usuário para estas aulas
          let progressoMap: Record<string, any> = {};
          let aulaParaIniciar = aulasOrdenadas.length > 0 ? aulasOrdenadas[0] : null;

          if (user && aulasOrdenadas.length > 0) {
            const aulasIds = aulasOrdenadas.map(a => a.id);
            const { data: progData } = await supabase
              .from('progresso')
              .select('*')
              .eq('user_id', user.id)
              .in('aula_id', aulasIds)
              .order('updated_at', { ascending: false });

            if (progData && progData.length > 0) {
              progData.forEach(p => {
                progressoMap[p.aula_id] = p;
              });
              // Pega a aula que foi assistida mais recentemente
              const lastWatchedId = progData[0].aula_id;
              const lastWatchedClass = aulasOrdenadas.find(a => a.id === lastWatchedId);
              if (lastWatchedClass) {
                aulaParaIniciar = lastWatchedClass;
              }
            }
          }
          
          setProgressoAulas(progressoMap);

          if (aulaParaIniciar) {
            selecionarAula(aulaParaIniciar, progressoMap[aulaParaIniciar.id]?.tempo_segundos || 0);
          }
        }
      }
      setLoading(false);
    };

    fetchData();
    
    // Load YT API se nao existir
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      // Salva progresso ao desmontar (sair da página)
      const aula = aulaAtualRef.current;
      if (playerRef.current && aula && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const tempo = Math.floor(playerRef.current.getCurrentTime());
          const duracao = playerRef.current.getDuration ? Math.floor(playerRef.current.getDuration()) : 0;
          if (tempo > 0) {
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) {
                supabase.from('progresso').upsert({
                  user_id: user.id,
                  aula_id: aula.id,
                  tempo_segundos: tempo,
                  duracao_total: duracao,
                  updated_at: new Date().toISOString()
                }).then(() => {});
              }
            });
          }
        } catch (e) {
          console.error('Erro ao salvar progresso no desmontar:', e);
        }
      }

      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [id]);

  const selecionarAula = async (aula: any, startTimeEnviado?: number) => {
    // Salva o progresso da aula anterior imediatamente antes de carregar a nova
    if (aulaAtualRef.current && aulaAtualRef.current.id !== aula.id) {
      await salvarProgresso();
    }

    setAulaAtual(aula);
    aulaAtualRef.current = aula;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    let startTime = 0;
    if (startTimeEnviado !== undefined) {
      startTime = startTimeEnviado;
    } else {
      const p = progressoAulas[aula.id];
      if (p && p.tempo_segundos > 0) {
        startTime = p.tempo_segundos;
      }
    }

    aula.startTime = startTime;

    if (window.YT && window.YT.Player) {
       initPlayer(aula);
    } else {
       window.onYouTubeIframeAPIReady = () => initPlayer(aula);
    }
  };

  const initPlayer = (aula: any) => {
    // Evita acumular iframes destruindo o antigo sempre que muda a aula
    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
      try {
        playerRef.current.destroy();
      } catch(e) {}
    }

    playerRef.current = null;

    if (!aula.youtube_id) {
      return;
    }

    // Usando setTimeout leve para garantir que o container do player exista no DOM apos a re-renderizacao
    setTimeout(() => {
      playerRef.current = new window.YT.Player(`yt-player-${aula.id}`, {
        height: '100%',
        width: '100%',
        videoId: aula.youtube_id,
        playerVars: {
          start: aula.startTime || 0,
          rel: 0,
          modestbranding: 1,
          autoplay: 1
        },
        events: {
          onStateChange: onPlayerStateChange
        }
      });
    }, 100);
  };

  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      lastTimeRef.current = Date.now();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(salvarProgresso, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      salvarProgresso();
      lastTimeRef.current = null;

      // Autoplay: quando acabar uma aula, começa a próxima automaticamente
      const endedState = window.YT ? window.YT.PlayerState.ENDED : 0;
      if (event.data === endedState) {
        const index = aulasRef.current.findIndex(a => a.id === aulaAtualRef.current?.id);
        if (index !== -1 && index < aulasRef.current.length - 1) {
          const proxima = aulasRef.current[index + 1];
          setTimeout(() => {
            selecionarAula(proxima);
          }, 500);
        }
      }
    }
  };

  const salvarProgresso = async () => {
    const aula = aulaAtualRef.current;
    if (playerRef.current && aula && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const tempo = Math.floor(playerRef.current.getCurrentTime());
        const duracao = playerRef.current.getDuration ? Math.floor(playerRef.current.getDuration()) : 0;
        
        if (tempo <= 0) return;

        let segundosEstudadosNaSessao = 0;
        if (lastTimeRef.current) {
          const agora = Date.now();
          segundosEstudadosNaSessao = Math.floor((agora - lastTimeRef.current) / 1000);
          lastTimeRef.current = agora;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('progresso').upsert({
            user_id: user.id,
            aula_id: aula.id,
            tempo_segundos: tempo,
            duracao_total: duracao,
            updated_at: new Date().toISOString()
          });

          // Atualiza estado local da sidebar dinamicamente
          setProgressoAulas(prev => ({
            ...prev,
            [aula.id]: {
              ...prev[aula.id],
              tempo_segundos: tempo,
              duracao_total: duracao
            }
          }));

          // Adiciona progresso diário se houve tempo real de estudo
          if (segundosEstudadosNaSessao > 0 && id) {
            const hoje = new Date().toLocaleDateString('en-CA');
            
            // Busca o progresso diário de hoje para somar (evita sobrescrever com valor estático em concorrência)
            const { data: progHoje } = await supabase
              .from('progresso_diario')
              .select('segundos_estudados')
              .eq('user_id', user.id)
              .eq('curso_id', id)
              .eq('data_estudo', hoje)
              .maybeSingle();

            const novoTotal = (progHoje?.segundos_estudados || 0) + segundosEstudadosNaSessao;

            await supabase.from('progresso_diario').upsert({
              user_id: user.id,
              curso_id: id,
              data_estudo: hoje,
              segundos_estudados: novoTotal,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,curso_id,data_estudo' });

            // Atualiza o progresso local de segundos estudados hoje
            setSegundosEstudadosHoje(novoTotal);

            // Verificar se atingiu a meta e atualizar streak
            if (metaMinutos > 0) {
              const metaSegundos = metaMinutos * 60;
              const bateuAgora = novoTotal >= metaSegundos - 5;

              if (!metaBatidaHoje && bateuAgora) {
                // Acabou de bater a meta de hoje nesta sessão!
                setMetaBatidaHoje(true);
                setEfeitoMetaBatida(true);
                setTimeout(() => setEfeitoMetaBatida(false), 4000);

                const { data: meta } = await supabase
                  .from('metas_estudo')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('curso_id', id)
                  .maybeSingle();

                if (meta) {
                  const ontem = new Date();
                  ontem.setDate(ontem.getDate() - 1);
                  const dataOntem = ontem.toLocaleDateString('en-CA');
                  
                  let novoStreak = 1;
                  // Se o último estudo foi ontem, mantém a meta (streak)
                  if (meta.ultimo_estudo === dataOntem) {
                    novoStreak = (meta.streak_atual || 0) + 1;
                  } else if (meta.ultimo_estudo === hoje) {
                    // Já tinha batido hoje (proteção dupla)
                    novoStreak = meta.streak_atual;
                  } else {
                    // Quebrou a meta (streak), volta pro 1
                    novoStreak = 1;
                  }

                  await supabase.from('metas_estudo').update({
                    streak_atual: novoStreak,
                    ultimo_estudo: hoje,
                    updated_at: new Date().toISOString()
                  }).eq('id', meta.id);

                  setStreakAtual(novoStreak);

                  // Exibe toast de meta batida
                  setMensagemToastMeta(`Parabéns! Você completou sua meta diária de estudos de ${metaMinutos} min neste curso. Streak: 🔥 ${novoStreak} dias!`);
                  setMostrarToastMeta(true);
                  setTimeout(() => setMostrarToastMeta(false), 5000);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro ao salvar progresso:', err);
      }
    }
  };

  const marcarAulaLida = async () => {
    if (!aulaAtual) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('progresso').upsert({
          user_id: user.id,
          aula_id: aulaAtual.id,
          tempo_segundos: 100,
          duracao_total: 100,
          updated_at: new Date().toISOString()
        });
        
        // Atualiza progresso local
        setProgressoAulas(prev => ({
          ...prev,
          [aulaAtual.id]: {
            user_id: user.id,
            aula_id: aulaAtual.id,
            tempo_segundos: 100,
            duracao_total: 100,
            updated_at: new Date().toISOString()
          }
        }));
      }
    } catch (e) {
      console.error('Erro ao marcar como lido:', e);
    }
  };

  const obterVizinhosAula = () => {
    if (!aulaAtual || aulas.length === 0) return { anterior: null, proxima: null };
    const index = aulas.findIndex(a => a.id === aulaAtual.id);
    return {
      anterior: index > 0 ? aulas[index - 1] : null,
      proxima: index < aulas.length - 1 ? aulas[index + 1] : null
    };
  };

  const { anterior, proxima } = obterVizinhosAula();

  const toggleModulo = (moduloId: string) => {
    setModulosAbertos(prev => ({ ...prev, [moduloId]: !prev[moduloId] }));
  };

  // Calcula Overall Completion
  let totalDuracao = 0;
  let totalAssistido = 0;
  
  aulas.forEach(aula => {
    const prog = progressoAulas[aula.id];
    if (prog && prog.duracao_total > 0) {
      totalDuracao += prog.duracao_total;
      totalAssistido += prog.tempo_segundos;
    }
  });

  const overallCompletion = totalDuracao > 0 ? Math.min(100, (totalAssistido / totalDuracao) * 100).toFixed(2) : '0.00';

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando conteúdo...</div>;
  if (!curso) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Curso não encontrado ou sem permissão.</h2>
      <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>Voltar</button>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
        
        {/* Cabeçalho do Curso e Player */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           <div>
             <h4 style={{ textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Curso Ativo</h4>
             <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{curso.nome_curso}</h1>
           </div>

           {/* Widget de Progresso Diário da Meta */}
           {metaMinutos > 0 && (
             <div style={{ 
               padding: '0.75rem 1rem', 
               background: 'rgba(255, 255, 255, 0.02)', 
               border: '1px solid var(--border-color)', 
               borderRadius: '12px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'space-between',
               gap: '1rem',
               fontSize: '0.85rem',
               boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
               transition: 'all 0.5s ease',
               borderColor: efeitoMetaBatida ? '#22c55e' : 'var(--border-color)'
             }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                 <span style={{ fontSize: '1.2rem' }}>🔥</span>
                 <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                     <span style={{ fontWeight: 600, opacity: 0.9 }}>Meta Diária do Curso</span>
                     <span style={{ fontWeight: 700, opacity: 0.8 }}>
                       {Math.floor(segundosEstudadosHoje / 60)} / {metaMinutos} min
                     </span>
                   </div>
                   <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                     <div style={{ 
                       width: `${Math.min(100, (segundosEstudadosHoje / (metaMinutos * 60)) * 100)}%`, 
                       height: '100%', 
                       background: metaBatidaHoje ? '#22c55e' : 'var(--primary-color)', 
                       boxShadow: metaBatidaHoje ? '0 0 10px rgba(34, 197, 94, 0.6)' : 'none',
                       transition: 'width 0.5s ease, background-color 0.5s ease' 
                     }}></div>
                   </div>
                 </div>
               </div>
               {metaBatidaHoje && (
                 <span style={{ 
                   color: '#22c55e', 
                   fontWeight: 700, 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: '0.3rem',
                   background: 'rgba(34, 197, 94, 0.1)',
                   padding: '0.3rem 0.6rem',
                   borderRadius: '8px',
                   fontSize: '0.8rem',
                   border: '1px solid rgba(34, 197, 94, 0.2)'
                 }}>
                   Meta Batida! 🏆 {streakAtual > 0 && `(🔥 ${streakAtual} dias)`}
                 </span>
               )}
             </div>
           )}
           
           {aulaAtual?.youtube_id ? (
              <div style={{ 
                position: 'relative', 
                width: '100%', 
                paddingBottom: '56.25%', 
                backgroundColor: '#000', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                boxShadow: efeitoMetaBatida ? '0 0 25px rgba(34, 197, 94, 0.8)' : 'var(--shadow)',
                border: efeitoMetaBatida ? '2px solid #22c55e' : '2px solid transparent',
                transition: 'all 0.5s ease'
              }}>
                <div key={aulaAtual.id} id={`yt-player-${aulaAtual.id}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
              </div>
            ) : (
              <div style={{ 
                width: '100%', 
                minHeight: '260px', 
                backgroundColor: 'var(--surface-color)', 
                border: efeitoMetaBatida ? '2px solid #22c55e' : '1px dashed var(--border-color)', 
                borderRadius: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center',
                boxShadow: efeitoMetaBatida ? '0 0 25px rgba(34, 197, 94, 0.8)' : 'var(--shadow)',
                transition: 'all 0.5s ease'
              }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  padding: '1rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>Material de Leitura</h3>
                  <p style={{ fontSize: '0.9rem', opacity: 0.6, maxWidth: '400px', margin: '0 auto' }}>
                    Esta aula é um material de apoio em formato PDF e não possui vídeo associado. Use o botão abaixo para baixar a apostila.
                  </p>
                </div>
              </div>
            )}

           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{aulaAtual?.nome_aula}</h2>
             <div style={{ display: 'flex', gap: '1rem' }}>
               <button className="btn btn-outline" disabled={!anterior} onClick={() => anterior && selecionarAula(anterior)} style={{ borderRadius: '50%', padding: '0.75rem', opacity: anterior ? 1 : 0.4 }}>←</button>
               <button className="btn btn-outline" disabled={!proxima} onClick={() => proxima && selecionarAula(proxima)} style={{ borderRadius: '50%', padding: '0.75rem', opacity: proxima ? 1 : 0.4 }}>→</button>
             </div>
           </div>

           {aulaAtual?.pdf_url && (
              <div style={{ padding: '0 0.5rem', marginTop: '-0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <a 
                  href={aulaAtual.pdf_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    borderColor: 'var(--primary-color)',
                    color: 'var(--text-color)',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Baixar Material de Apoio (PDF)
                </a>

                {!aulaAtual.youtube_id && (
                  <button
                    onClick={marcarAulaLida}
                    className="btn btn-primary"
                    disabled={progressoAulas[aulaAtual.id]?.tempo_segundos >= 95}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 600
                    }}
                  >
                    {progressoAulas[aulaAtual.id]?.tempo_segundos >= 95 ? (
                      <>Leitura Concluída ✓</>
                    ) : (
                      <>Concluir Leitura</>
                    )}
                  </button>
                )}
              </div>
            )}
        </div>

        {/* Overall Completion Dashboard */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6, marginBottom: '0.5rem' }}>Progresso Geral</h3>
          <div style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: 1 }}>{overallCompletion}%</div>
          <div className="overall-progress-container">
            <div className="overall-progress-fill" style={{ width: `${overallCompletion}%` }}></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '3rem' }}>
             {modulos.map(modulo => {
               const isAberto = modulosAbertos[modulo.id];
               const aulasDoModulo = aulas.filter(a => a.modulo_id === modulo.id);
               
               // Calcular progresso do modulo
               let modTotalDuracao = 0;
               let modTotalAssistido = 0;
               aulasDoModulo.forEach(a => {
                 const p = progressoAulas[a.id];
                 if (p && p.duracao_total > 0) {
                   modTotalDuracao += p.duracao_total;
                   modTotalAssistido += p.tempo_segundos;
                 }
               });
               const modPct = modTotalDuracao > 0 ? Math.min(100, (modTotalAssistido / modTotalDuracao) * 100).toFixed(1) : '0.0';

               return (
                 <div key={`mod-prog-${modulo.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                   
                   <button 
                     onClick={() => toggleModulo(modulo.id)}
                     className="btn"
                     style={{ justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-color)', border: '1px solid var(--glass-border)', borderRadius: '12px', width: '100%' }}
                   >
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                       {isAberto ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                       <Folder size={20} style={{ opacity: 0.5 }} />
                       <span style={{ fontWeight: 600, fontSize: '1.1rem', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>{modulo.nome_modulo}</span>
                     </div>
                     <span style={{ fontSize: '1.1rem', fontWeight: 700, color: Number(modPct) > 0 ? 'var(--text-color)' : 'var(--primary-color)', opacity: Number(modPct) > 0 ? 1 : 0.5 }}>{modPct}%</span>
                   </button>

                   {isAberto && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0.5rem 1rem 2rem' }}>
                        {aulasDoModulo.map(aula => {
                          const prog = progressoAulas[aula.id];
                          let pct = 0;
                          if (prog && prog.duracao_total > 0) {
                            pct = Math.min(100, (prog.tempo_segundos / prog.duracao_total) * 100);
                          }
                          const isActive = aulaAtual?.id === aula.id;
                          
                          return (
                            <div 
                              key={`det-${aula.id}`} 
                              onClick={() => selecionarAula(aula)}
                              className="class-row-interactive"
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.75rem',
                                cursor: 'pointer',
                                padding: '1rem',
                                borderRadius: '12px',
                                transition: 'all 0.2s ease',
                                borderLeft: isActive ? '4px solid var(--text-color)' : '4px solid transparent',
                                backgroundColor: isActive ? 'rgba(128, 128, 128, 0.12)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, paddingRight: '1rem' }}>
                                  <h4 style={{ 
                                    fontSize: '1.1rem', 
                                    fontWeight: isActive ? 700 : 500, 
                                    marginBottom: '0.25rem', 
                                    wordBreak: 'break-word', 
                                    whiteSpace: 'normal', 
                                    lineHeight: 1.4,
                                    color: isActive ? 'var(--text-color)' : 'inherit',
                                    opacity: isActive ? 1 : 0.85
                                  }}>
                                    {aula.nome_aula}
                                    {isActive && (
                                      <span style={{ 
                                        fontSize: '0.8rem', 
                                        fontWeight: 500, 
                                        marginLeft: '0.75rem', 
                                        padding: '0.2rem 0.6rem', 
                                        borderRadius: '20px', 
                                        background: 'var(--text-color)', 
                                        color: 'var(--bg-color)',
                                        opacity: 0.9
                                      }}>
                                        Reproduzindo agora
                                      </span>
                                    )}
                                  </h4>
                                  {prog?.updated_at && <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Último acesso: {new Date(prog.updated_at).toLocaleDateString()}</span>}
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: pct > 0 ? 'var(--text-color)' : 'var(--primary-color)', opacity: pct > 0 ? 1 : 0.5 }}>{pct.toFixed(2)}%</span>
                              </div>
                              <div className="progress-bar-container" style={{ marginTop: '0' }}>
                                <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: pct >= 95 ? 'var(--text-color)' : 'var(--primary-color)', opacity: pct >= 95 ? 0.3 : 1 }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                 </div>
               );
             })}
          </div>
         </div>

      {/* Toast de Meta Batida */}
      {mostrarToastMeta && (
        <div 
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            background: 'rgba(20, 20, 20, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem 1.75rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            maxWidth: '380px',
          }}
        >
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            padding: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Meta Diária Batida! 🏆
            </h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-color)', opacity: 0.8, lineHeight: 1.4 }}>
              {mensagemToastMeta}
            </p>
          </div>
          <button 
            onClick={() => setMostrarToastMeta(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-color)',
              opacity: 0.5,
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '0.25rem',
              alignSelf: 'flex-start'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}
