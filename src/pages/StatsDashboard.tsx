import { useEffect, useState } from 'react';
import { Clock, CheckCircle, BarChart3, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';

interface HistoricoItem {
  id: string;
  aulaNome: string;
  cursoNome: string;
  pct: number;
  data: string;
}

const COLORS = ['var(--text-color)', 'var(--primary-color)', 'rgba(128, 128, 128, 0.4)', 'rgba(128, 128, 128, 0.2)'];

export default function StatsDashboard() {
  const [stats, setStats] = useState({
    totalCursos: 0,
    aulasConcluidas: 0,
    horasAssistidas: 0,
    taxaConclusao: 0
  });
  const [historicoAulas, setHistoricoAulas] = useState<HistoricoItem[]>([]);
  
  // Recharts States
  const [chartDataMensal, setChartDataMensal] = useState<any[]>([]);
  const [chartDataSemanal, setChartDataSemanal] = useState<any[]>([]);
  const [chartDataCursos, setChartDataCursos] = useState<any[]>([]);
  const [topCursos, setTopCursos] = useState<string[]>([]);
  
  // Filtros
  const [filtroMeses, setFiltroMeses] = useState<number>(1);
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  
  // Dados brutos salvos para recálculo
  const [progressoBruto, setProgressoBruto] = useState<any[]>([]);
  const [cursosDisponiveis, setCursosDisponiveis] = useState<any[]>([]);
  const [aulasMap, setAulasMap] = useState<Record<string, any>>({});
  const [modulosMap, setModulosMap] = useState<Record<string, any>>({});
  const [cursosMap, setCursosMap] = useState<Record<string, any>>({});
  
  const [loading, setLoading] = useState(true);

  // 1. Carregamento inicial de dados brutos
  useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Buscar progresso e permissões em paralelo
        const [progressoRes, permissoesRes] = await Promise.all([
          Promise.resolve(supabase.from('progresso').select('*').eq('user_id', user.id)),
          Promise.resolve(supabase.from('permissoes').select('curso_id').eq('user_email', user.email))
        ]);

        const progressoData = progressoRes.data;
        const permissoesData = permissoesRes.data;

        let concluidas = 0;
        let segundosT = 0;
        let progressoValido = progressoData || [];

        // Pré-carregar todas as aulas, módulos e cursos relacionados ao progresso
        const aulaIds = [...new Set(progressoValido.map((p: any) => p.aula_id))];
        let localAulasMap: Record<string, any> = {};
        let localModulosMap: Record<string, any> = {};
        let localCursosMap: Record<string, any> = {};
        let cursosPermitidosList: any[] = [];

        const promises: Promise<any>[] = [];

        // 1. Busca relacional de aulas, módulos e cursos
        let aulasPromise = Promise.resolve<any>(null);
        if (aulaIds.length > 0) {
          aulasPromise = Promise.resolve(supabase
            .from('aulas')
            .select('*, modulos(*, cursos(*))')
            .in('id', aulaIds));
          promises.push(aulasPromise);
        }

        // 2. Busca de cursos permitidos
        const cursoIdsPermitidos = permissoesData ? permissoesData.map((p: any) => p.curso_id) : [];
        let cursosPromise = Promise.resolve<any>(null);
        if (cursoIdsPermitidos.length > 0) {
          cursosPromise = Promise.resolve(supabase
            .from('cursos')
            .select('id, nome_curso')
            .in('id', cursoIdsPermitidos));
          promises.push(cursosPromise);
        }

        await Promise.all(promises);

        // Processar resultados das aulas (desmembrando o select relacional)
        if (aulaIds.length > 0) {
          const aDataRes = await aulasPromise;
          const aData = aDataRes?.data;
          if (aData) {
            aData.forEach((a: any) => {
              let m = a.modulos;
              if (Array.isArray(m)) m = m[0];
              
              const aulaInfo = { ...a };
              delete aulaInfo.modulos;
              localAulasMap[a.id] = aulaInfo;
              
              if (m) {
                let c = m.cursos;
                if (Array.isArray(c)) c = c[0];
                
                const moduloInfo = { ...m };
                delete moduloInfo.cursos;
                localModulosMap[m.id] = moduloInfo;
                
                if (c) {
                  localCursosMap[c.id] = c;
                }
              }
            });
          }
        }

        // Processar resultados dos cursos permitidos
        if (cursoIdsPermitidos.length > 0) {
          const cDataRes = await cursosPromise;
          const cDataPermitidos = cDataRes?.data;
          if (cDataPermitidos) {
            cursosPermitidosList = cDataPermitidos.map((c: any) => ({
              id: c.id,
              nome_curso: c.nome_curso
            }));
          }
        }

        progressoValido.forEach((p: any) => {
          segundosT += p.tempo_segundos;
          if (p.duracao_total > 0 && p.tempo_segundos / p.duracao_total >= 0.95) {
            concluidas++;
          }
        });

        setStats({
          totalCursos: permissoesData ? permissoesData.length : 0,
          aulasConcluidas: concluidas,
          horasAssistidas: Number((segundosT / 3600).toFixed(1)),
          taxaConclusao: progressoValido.length > 0 
            ? Number(((concluidas / progressoValido.length) * 100).toFixed(1)) 
            : 0
        });

        // ============================================
        // Lógica dos Gráficos com Dados Reais
        // ============================================

        // 1. Distribuição de Tempo por Curso (Donut Chart)
        let cursoTempo: Record<string, number> = {};
        progressoValido.forEach((p: any) => {
            const aula = localAulasMap[p.aula_id];
            const modulo = aula ? localModulosMap[aula.modulo_id] : null;
            const curso = modulo ? localCursosMap[modulo.curso_id] : null;
            const cursoNome = curso ? curso.nome_curso : 'Outros';
            
            if (!cursoTempo[cursoNome]) cursoTempo[cursoNome] = 0;
            cursoTempo[cursoNome] += p.tempo_segundos;
        });
        
        const chartDataCursosRaw = Object.keys(cursoTempo).map(nome => ({
            name: nome,
            value: cursoTempo[nome]
        })).sort((a, b) => b.value - a.value);
        
        let finalChartDataCursos: any[] = [];
        let outrosValue = 0;
        chartDataCursosRaw.forEach((item, index) => {
            if (index < 3) finalChartDataCursos.push(item);
            else outrosValue += item.value;
        });
        if (outrosValue > 0) finalChartDataCursos.push({ name: 'Outros', value: outrosValue });
        setChartDataCursos(finalChartDataCursos);

        // 2. Engajamento Semanal (Bar Chart - Últimos 7 dias)
        let weeklyData: Record<string, any> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera as horas para evitar inconsistências de fuso horário
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            
            const ano = d.getFullYear();
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            const key = `${ano}-${mes}-${dia}`;
            
            weeklyData[key] = { name: dayName.charAt(0).toUpperCase() + dayName.slice(1), tempo: 0, dateStr: key };
        }
        
        progressoValido.forEach((p: any) => {
            const dateLocal = new Date(p.updated_at);
            const ano = dateLocal.getFullYear();
            const mes = String(dateLocal.getMonth() + 1).padStart(2, '0');
            const dia = String(dateLocal.getDate()).padStart(2, '0');
            const pDateStr = `${ano}-${mes}-${dia}`;
            
            if (weeklyData[pDateStr]) {
                weeklyData[pDateStr].tempo += p.tempo_segundos;
            }
        });
        
        const finalWeeklyData = Object.values(weeklyData).map((d: any) => ({
            name: d.name,
            tempo: Math.round(d.tempo / 60), // convertido para minutos
        }));
        setChartDataSemanal(finalWeeklyData);

        // Buscar progresso recente (processado em memória para economizar uma chamada ao banco)
        const progressoRecente = [...progressoValido]
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);

        if (progressoRecente && progressoRecente.length > 0) {
            const listaHistorica = progressoRecente.map((p: any) => {
              const aula = localAulasMap[p.aula_id];
              const modulo = aula ? localModulosMap[aula.modulo_id] : null;
              const curso = modulo ? localCursosMap[modulo.curso_id] : null;
              return {
                id: p.aula_id,
                aulaNome: aula?.nome_aula || 'Aula sem nome',
                cursoNome: curso?.nome_curso || 'Curso Geral',
                pct: p.duracao_total > 0 ? Math.min(100, (p.tempo_segundos / p.duracao_total) * 100) : 0,
                data: new Date(p.updated_at).toLocaleDateString('pt-BR')
              };
            });
            setHistoricoAulas(listaHistorica);
        }

        // Adicionar cursos que possam ter progresso mas não estejam explicitamente no cDataPermitidos
        const cursosMapeadosIds = Object.keys(localCursosMap);
        cursosMapeadosIds.forEach(id => {
          if (!cursosPermitidosList.some(c => c.id === id)) {
            cursosPermitidosList.push({ id, nome_curso: localCursosMap[id].nome_curso || 'Curso Geral' });
          }
        });

        // Remover possíveis duplicatas
        const uniqueCursosList = Array.from(new Map(cursosPermitidosList.map(c => [c.id, c])).values());

        // Salvar tudo no estado para reatividade
        setAulasMap(localAulasMap);
        setModulosMap(localModulosMap);
        setCursosMap(localCursosMap);
        setProgressoBruto(progressoValido);
        setCursosDisponiveis(uniqueCursosList);
        setCursosSelecionados(uniqueCursosList.map(c => c.id));

      } catch (err) {
        console.error('Erro ao buscar estatísticas do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // 2. useEffect secundário para computar o gráfico mensal dinamicamente quando os filtros mudam
  useEffect(() => {
    if (progressoBruto.length === 0 || cursosDisponiveis.length === 0) {
      setChartDataMensal([]);
      setTopCursos([]);
      return;
    }

    // Filtrar progresso bruto apenas pelos cursos selecionados
    const progressoFiltrado = progressoBruto.filter((p: any) => {
      const aula = aulasMap[p.aula_id];
      const modulo = aula ? modulosMap[aula.modulo_id] : null;
      const cursoId = modulo ? modulo.curso_id : null;
      return cursoId && cursosSelecionados.includes(cursoId);
    });

    let monthlyData: Record<string, any> = {};
    const today = new Date();
    
    // Gerar meses de acordo com o filtro de tempo
    for (let i = filtroMeses; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      
      monthlyData[monthKey] = { 
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1) 
      };

      // Inicializar valores de tempo de cada curso selecionado como 0
      cursosSelecionados.forEach(cId => {
        const cursoObj = cursosDisponiveis.find(c => c.id === cId);
        const nomeCurso = cursoObj ? cursoObj.nome_curso : 'Outros';
        monthlyData[monthKey][nomeCurso] = 0;
      });
    }

    // Preencher as horas para cada mês e curso
    progressoFiltrado.forEach((p: any) => {
      const d = new Date(p.updated_at);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey]) {
        const aula = aulasMap[p.aula_id];
        const modulo = aula ? modulosMap[aula.modulo_id] : null;
        const cursoId = modulo ? modulo.curso_id : null;
        const cursoObj = cursosDisponiveis.find(c => c.id === cursoId);
        const nomeCurso = cursoObj ? cursoObj.nome_curso : 'Outros';
        
        if (monthlyData[monthKey][nomeCurso] !== undefined) {
          monthlyData[monthKey][nomeCurso] += p.tempo_segundos;
        }
      }
    });

    const nomesCursosSelecionados = cursosSelecionados.map(cId => {
      const cursoObj = cursosDisponiveis.find(c => c.id === cId);
      return cursoObj ? cursoObj.nome_curso : 'Outros';
    });

    // Formatar para o Recharts em horas estudadas
    const finalMonthlyData = Object.values(monthlyData).map((d: any) => {
      const row: any = { name: d.name };
      nomesCursosSelecionados.forEach(nome => {
        row[nome] = Number((d[nome] / 3600).toFixed(1)); // horas assistidas
      });
      return row;
    });

    setChartDataMensal(finalMonthlyData);
    setTopCursos(nomesCursosSelecionados);
  }, [filtroMeses, cursosSelecionados, progressoBruto, aulasMap, modulosMap, cursosMap, cursosDisponiveis]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', opacity: 0.7 }}>
        Carregando estatísticas...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '1rem 0' }}>
      
      {/* Título e Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: '2rem', marginBottom: '0.25rem' }}>Estatísticas Gerais</h1>
          <span style={{ opacity: 0.5, fontSize: '0.95rem' }}>Acompanhe o seu desempenho de estudos na plataforma</span>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        
        {/* Card 1 */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <BookOpen size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cursos Ativos</span>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.totalCursos}</div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <Clock size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horas de Vídeo</span>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.horasAssistidas}h</div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <CheckCircle size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aulas Concluídas</span>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.aulasConcluidas}</div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <BarChart3 size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taxa Média</span>
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>{stats.taxaConclusao}%</div>
        </div>

      </div>

      {/* Gráficos do Meio */}
      <div className="stats-grid-middle">
        
        {/* Gráfico 1: Visão Geral de Engajamento */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '440px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Visão Geral de Engajamento</h3>
              <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Horas assistidas por curso (últimos {filtroMeses} meses)</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 500 }}>Últimos</span>
              <input 
                type="number" 
                value={filtroMeses} 
                min={1} 
                max={48} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) {
                    setFiltroMeses(val);
                  }
                }}
                style={{
                  width: '35px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-color)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none',
                  padding: 0
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 500 }}>Meses</span>
            </div>
          </div>

          {/* Seção de Chips de Filtro por Curso */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Filtrar Cursos no Gráfico:
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => setCursosSelecionados(cursosDisponiveis.map(c => c.id))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-color)', opacity: 0.5, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Selecionar Todos
                </button>
                <button 
                  onClick={() => setCursosSelecionados([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-color)', opacity: 0.5, fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Limpar
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxHeight: '90px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {cursosDisponiveis.length === 0 ? (
                <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Nenhum curso disponível.</span>
              ) : (
                cursosDisponiveis.map(curso => {
                  const isSelected = cursosSelecionados.includes(curso.id);
                  return (
                    <button
                      key={curso.id}
                      onClick={() => {
                        if (isSelected) {
                          setCursosSelecionados(cursosSelecionados.filter(id => id !== curso.id));
                        } else {
                          setCursosSelecionados([...cursosSelecionados, curso.id]);
                        }
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: isSelected ? 'var(--text-color)' : 'rgba(128, 128, 128, 0.05)',
                        color: isSelected ? 'var(--bg-color)' : 'var(--text-color)',
                        border: isSelected ? '1px solid var(--text-color)' : '1px solid var(--border-color)',
                        opacity: isSelected ? 1 : 0.6,
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {curso.nome_curso}
                    </button>
                  );
                })
              )}
            </div>
          </div>
 
          <div style={{ flex: 1, width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataMensal} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  {topCursos.map((curso, index) => (
                    <linearGradient key={curso} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-color)', opacity: 0.5 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-color)', opacity: 0.5 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-color)' }}
                  labelStyle={{ color: 'var(--text-color)', fontWeight: 600 }}
                  formatter={(value: any) => [`${value} h`, '']}
                />
                {topCursos.map((curso, index) => (
                  <Area 
                    key={curso}
                    type="monotone" 
                    dataKey={curso} 
                    stackId="1"
                    stroke={COLORS[index % COLORS.length]} 
                    fillOpacity={1} 
                    fill={`url(#color${index})`} 
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
 
          {/* Legenda */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {topCursos.map((curso, idx) => (
              <div key={curso} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', opacity: 0.8 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }}></div>
                <span>{curso}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Engajamento Semanal */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Engajamento Semanal</h3>
              <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Minutos assistidos na semana</span>
            </div>
            <div style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', opacity: 0.7 }}>
              Semanal
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {chartDataSemanal.reduce((acc, curr) => acc + curr.tempo, 0)} <span style={{ fontSize: '1rem', opacity: 0.5 }}>min</span>
            </div>
            <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Total da semana atual</span>
          </div>

          <div style={{ flex: 1, width: '100%', height: '180px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataSemanal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-color)', opacity: 0.5 }} interval={0} />
                <Tooltip 
                  cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }}
                  formatter={(value: any) => [`${value} min`, 'Estudado']}
                  contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-color)' }}
                  labelStyle={{ color: 'var(--text-color)', fontWeight: 600 }}
                />
                <Bar dataKey="tempo" radius={[6, 6, 6, 6]}>
                  {chartDataSemanal.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={
                      index === chartDataSemanal.length - 1 
                        ? 'var(--text-color)' 
                        : 'rgba(128, 128, 128, 0.2)'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Grid Inferior */}
      <div className="stats-grid-bottom">
        
        {/* Gráfico da Esquerda: Donut Chart */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '340px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Distribuição de Tempo</h3>
            <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Divisão de tempo por curso (total)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', margin: '1.5rem 0', flex: 1 }}>
            
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataCursos}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartDataCursos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${Math.round(value/60)} minutos`, 'Tempo']}
                    contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', zIndex: 10 }}
                    itemStyle={{ color: 'var(--text-color)' }}
                    labelStyle={{ color: 'var(--text-color)', fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {chartDataCursos.map((curso, idx) => {
                  const totalValue = chartDataCursos.reduce((acc, curr) => acc + curr.value, 0);
                  const pct = totalValue > 0 ? Math.round((curso.value / totalValue) * 100) : 0;
                  return (
                    <div key={curso.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span style={{ fontWeight: 600 }}>{pct}%</span>
                        <span style={{ opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{curso.name}</span>
                      </div>
                    </div>
                  );
              })}
            </div>

          </div>
        </div>

        {/* Tabela de Histórico */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '340px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Acessos Recentes</h3>
            <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>Histórico de aulas iniciadas pelo usuário</span>
          </div>

          <div style={{ flex: 1, overflowX: 'auto', marginTop: '1rem' }}>
            {historicoAulas.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '140px', opacity: 0.5, fontSize: '0.95rem' }}>
                Nenhuma aula assistida recentemente.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.5 }}>
                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Aula</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Curso</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', width: '100px' }}>Progresso</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', width: '100px', textAlign: 'right' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoAulas.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, wordBreak: 'break-word', maxWidth: '180px' }}>{item.aulaNome}</td>
                      <td style={{ padding: '0.85rem 0.5rem', opacity: 0.7, wordBreak: 'break-word', maxWidth: '140px' }}>{item.cursoNome}</td>
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.pct.toFixed(0)}%</span>
                          <div className="progress-bar-container" style={{ margin: 0, height: '4px', width: '50px' }}>
                            <div className="progress-bar-fill" style={{ width: `${item.pct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', opacity: 0.6, fontSize: '0.85rem' }}>{item.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
