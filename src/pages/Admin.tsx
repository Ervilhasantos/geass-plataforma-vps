import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, UserPlus, Edit3, Trash2, Check, X, Folder, Play, BookOpen, ChevronDown, ChevronRight, Monitor, Smartphone, RefreshCw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Admin() {
  const navigate = useNavigate();
  const [cursos, setCursos] = useState<any[]>([]);
  const [permissoes, setPermissoes] = useState<any[]>([]);
  const [mostrarGerenciarAcessos, setMostrarGerenciarAcessos] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // State for course filtering
  const [cursoSelecionadoId, setCursoSelecionadoId] = useState<string>('');
  
  // State for collapsible modules
  const [modulosExpandidos, setModulosExpandidos] = useState<Record<string, boolean>>({});

  // States for new items
  const [novoCurso, setNovoCurso] = useState({ nome: '', descricao: '' });
  const [novoModulo, setNovoModulo] = useState({ curso_id: '', nome: '', ordem: 0 });
  const [novaAula, setNovaAula] = useState({ modulo_id: '', nome: '', youtube_id: '', ordem: 0, pdf_url: '' });
  const [novaPermissao, setNovaPermissao] = useState({ curso_id: '', email: '' });

  // States for editing inline
  const [editingCurso, setEditingCurso] = useState<{ id: string; nome: string; descricao: string } | null>(null);
  const [editingModulo, setEditingModulo] = useState<{ id: string; nome: string; ordem: number } | null>(null);
  const [editingAula, setEditingAula] = useState<{ id: string; nome: string; youtube_id: string; ordem: number; pdf_url: string } | null>(null);

  // States for batch import
  const [aulaCadastroModo, setAulaCadastroModo] = useState<'individual' | 'lote'>('individual');
  const [linksLote, setLinksLote] = useState('');
  const [aulasIdentificadas, setAulasIdentificadas] = useState<Array<{ youtube_id: string; nome: string; loading: boolean }>>([]);
  const [buscandoNomes, setBuscandoNomes] = useState(false);
  const [carregandoLote, setCarregandoLote] = useState(false);
  const [subindoPdf, setSubindoPdf] = useState(false);

  // Estados para sessões e dispositivos ativos
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [mostrarSessoes, setMostrarSessoes] = useState(false);
  const [loadingSessoes, setLoadingSessoes] = useState(false);

  // Estados para perfis
  const [perfis, setPerfis] = useState<any[]>([]);
  const [mostrarPerfis, setMostrarPerfis] = useState(false);
  const [loadingPerfis, setLoadingPerfis] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Proteção rigorosa: Somente este e-mail pode acessar a página
    if (!user || user.email?.toLowerCase() !== 'nelsonvilhasantos@gmail.com') {
      navigate('/');
      return;
    }
    
    await fetchCursos();
    await fetchPermissoes();
  };

  const fetchCursos = async () => {
    const { data, error } = await supabase.from('cursos').select(`
      *,
      modulos ( *, aulas ( * ) )
    `).order('created_at', { ascending: false });
    
    if (error) {
      alert('Erro ao carregar cursos: ' + error.message);
    }
    if (data) setCursos(data);
    setLoading(false);
  };

  const fetchPermissoes = async () => {
    const { data, error } = await supabase
      .from('permissoes')
      .select('*')
      .order('user_email', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar permissões:', error.message);
    } else if (data) {
      setPermissoes(data);
    }
  };

  const fetchSessoes = async () => {
    setLoadingSessoes(true);
    try {
      const { data, error } = await supabase.rpc('obter_sessoes_ativas');
      if (error) {
        alert('Erro ao carregar sessões ativas: ' + error.message);
      } else if (data) {
        setSessoes(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar sessões:', err.message);
    } finally {
      setLoadingSessoes(false);
    }
  };

  const fetchPerfis = async () => {
    setLoadingPerfis(true);
    const { data, error } = await supabase.from('perfis').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar perfis:', error.message);
    } else if (data) {
      setPerfis(data);
    }
    setLoadingPerfis(false);
  };

  useEffect(() => {
    if (mostrarPerfis) {
      fetchPerfis();
    }
  }, [mostrarPerfis]);

  const handleDerrubarSessao = async (sessaoId: string, email: string, device: string) => {
    if (!confirm(`Tem certeza que deseja desconectar o dispositivo "${device}" logado na conta ${email}?`)) return;
    
    try {
      const { error } = await supabase.rpc('encerrar_sessao', { sessao_id: sessaoId });
      if (error) throw error;
      
      alert('Dispositivo desconectado com sucesso!');
      await fetchSessoes();
    } catch (err: any) {
      alert('Erro ao desconectar dispositivo: ' + err.message);
    }
  };

  const handleDerrubarTodasSessoes = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja desconectar TODOS os dispositivos logados na conta ${email}?`)) return;
    
    try {
      const { error } = await supabase.rpc('encerrar_todas_sessoes_usuario', { target_user_id: userId });
      if (error) throw error;
      
      alert(`Todas as sessões de ${email} foram encerradas!`);
      await fetchSessoes();
    } catch (err: any) {
      alert('Erro ao desconectar todos os dispositivos: ' + err.message);
    }
  };

  const formatarUserAgent = (ua: string) => {
    if (!ua) return 'Dispositivo desconhecido';
    
    let os = 'Dispositivo';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'Mac OS';
    else if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';

    let browser = 'Navegador';
    if (ua.includes('Chrome') && !ua.includes('Chromium') && !ua.includes('Edg') && !ua.includes('OPR')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
    
    return `${os} (${browser})`;
  };

  useEffect(() => {
    if (mostrarSessoes) {
      fetchSessoes();
    }
  }, [mostrarSessoes]);

  const handleRemoverAcesso = async (id: string, email: string, nomeCurso: string) => {
    if (!confirm(`Tem certeza que deseja remover o acesso do e-mail ${email} ao curso "${nomeCurso}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('permissoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      alert(`Acesso removido com sucesso para ${email}!`);
      await fetchPermissoes();
    } catch (err: any) {
      alert('Erro ao remover acesso: ' + err.message);
    }
  };

  const handleCriarCurso = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('cursos').insert([{ nome_curso: novoCurso.nome, descricao: novoCurso.descricao }]);
    if (error) {
      alert('Erro ao criar curso: ' + error.message);
    } else {
      setNovoCurso({ nome: '', descricao: '' });
      fetchCursos();
    }
  };

  const handleCriarModulo = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('modulos').insert([{ 
      curso_id: novoModulo.curso_id, 
      nome_modulo: novoModulo.nome, 
      ordem: novoModulo.ordem 
    }]);
    if (error) {
      alert('Erro ao criar módulo: ' + error.message);
    } else {
      setNovoModulo({ curso_id: '', nome: '', ordem: 0 });
      fetchCursos();
    }
  };

  const handleCriarAula = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!novaAula.modulo_id) {
      alert('Por favor, selecione a pasta (módulo) antes de adicionar a aula.');
      return;
    }

    if (subindoPdf) {
      alert('Aguarde a conclusão do upload do PDF antes de salvar a aula.');
      return;
    }
    
    let ordemFinal = novaAula.ordem;
    if (!ordemFinal || ordemFinal <= 0) {
      let maiorOrdem = 0;
      cursos.forEach(c => {
        const m = c.modulos?.find((mod: any) => mod.id === novaAula.modulo_id);
        if (m && m.aulas) {
          m.aulas.forEach((a: any) => {
            if (a.ordem > maiorOrdem) {
              maiorOrdem = a.ordem;
            }
          });
        }
      });
      ordemFinal = maiorOrdem + 1;
    }

    const { error } = await supabase.from('aulas').insert([{ 
      modulo_id: novaAula.modulo_id, 
      nome_aula: novaAula.nome, 
      youtube_id: novaAula.youtube_id || null,
      ordem: ordemFinal,
      pdf_url: novaAula.pdf_url || null
    }]);
    if (error) {
      alert('Erro ao adicionar aula: ' + error.message);
    } else {
      setNovaAula({ modulo_id: '', nome: '', youtube_id: '', ordem: 0, pdf_url: '' });
      fetchCursos();
    }
  };

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.trim().match(regExp);
    return (match && match[2].length === 11) ? match[2] : (url.trim().length === 11 ? url.trim() : null);
  };

  const fetchVideoTitle = async (id: string): Promise<string> => {
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
      const data = await res.json();
      return data.title || `Aula ${id}`;
    } catch (err) {
      return `Aula ${id}`;
    }
  };

  const handleIdentificarAulas = async () => {
    if (!linksLote.trim()) {
      alert('Por favor, cole pelo menos um link do YouTube.');
      return;
    }

    setBuscandoNomes(true);
    const linhas = linksLote.split('\n').map(l => l.trim()).filter(l => l !== '');
    const identificadas: Array<{ youtube_id: string; nome: string; loading: boolean }> = [];

    for (const linha of linhas) {
      const ytId = extractYoutubeId(linha);
      if (ytId) {
        identificadas.push({ youtube_id: ytId, nome: `Carregando título (${ytId})...`, loading: true });
      }
    }

    if (identificadas.length === 0) {
      alert('Nenhum link ou ID do YouTube válido foi encontrado.');
      setBuscandoNomes(false);
      return;
    }

    setAulasIdentificadas(identificadas);

    const promessas = identificadas.map(async (aula, index) => {
      const titulo = await fetchVideoTitle(aula.youtube_id);
      setAulasIdentificadas(prev => {
        const copy = [...prev];
        if (copy[index]) {
          copy[index] = { ...copy[index], nome: titulo, loading: false };
        }
        return copy;
      });
    });

    await Promise.all(promessas);
    setBuscandoNomes(false);
  };

  const handleCriarAulasLote = async (e: FormEvent) => {
    e.preventDefault();
    if (!novaAula.modulo_id) {
      alert('Por favor, selecione a pasta/módulo.');
      return;
    }

    if (aulasIdentificadas.length === 0) {
      alert('Por favor, identifique as aulas colando os links primeiro.');
      return;
    }

    setCarregandoLote(true);

    let baseOrdem = 0;
    const moduloId = novaAula.modulo_id;
    let targetCurso = cursos.find(c => c.modulos?.some((m: any) => m.id === moduloId));
    let targetModulo = targetCurso?.modulos?.find((m: any) => m.id === moduloId);
    if (targetModulo?.aulas && targetModulo.aulas.length > 0) {
      baseOrdem = Math.max(...targetModulo.aulas.map((a: any) => a.ordem || 0)) + 1;
    }

    const inserts = aulasIdentificadas.map((aula, index) => ({
      modulo_id: moduloId,
      nome_aula: aula.nome,
      youtube_id: aula.youtube_id,
      ordem: baseOrdem + index
    }));

    const { error } = await supabase.from('aulas').insert(inserts);

    if (error) {
      alert('Erro ao cadastrar aulas em lote: ' + error.message);
    } else {
      alert(`${aulasIdentificadas.length} aulas cadastradas com sucesso!`);
      setLinksLote('');
      setAulasIdentificadas([]);
      fetchCursos();
    }
    setCarregandoLote(false);
  };

  const handleUpdateCurso = async (id: string) => {
    if (!editingCurso) return;
    const { error } = await supabase.from('cursos').update({ 
      nome_curso: editingCurso.nome, 
      descricao: editingCurso.descricao 
    }).eq('id', id);

    if (error) {
      alert('Erro ao editar curso: ' + error.message);
    } else {
      setEditingCurso(null);
      fetchCursos();
    }
  };

  const handleDeleteCurso = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este curso? Todos os módulos e aulas vinculados a ele também serão excluídos permanentemente!')) return;
    const { error } = await supabase.from('cursos').delete().eq('id', id);
    
    if (error) {
      alert('Erro ao excluir curso: ' + error.message);
    } else {
      // Se excluir o curso selecionado, limpa a seleção
      if (cursoSelecionadoId === id) {
        setCursoSelecionadoId('');
      }
      fetchCursos();
    }
  };

  const handleUpdateModulo = async (id: string) => {
    if (!editingModulo) return;
    const { error } = await supabase.from('modulos').update({ 
      nome_modulo: editingModulo.nome, 
      ordem: editingModulo.ordem 
    }).eq('id', id);

    if (error) {
      alert('Erro ao editar pasta/módulo: ' + error.message);
    } else {
      setEditingModulo(null);
      fetchCursos();
    }
  };

  const handleDeleteModulo = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pasta/módulo? Todas as aulas contidas nela serão excluídas!')) return;
    const { error } = await supabase.from('modulos').delete().eq('id', id);
    
    if (error) {
      alert('Erro ao excluir módulo: ' + error.message);
    } else {
      fetchCursos();
    }
  };

  const handleUpdateAula = async (id: string) => {
    if (!editingAula) return;
    const { error } = await supabase.from('aulas').update({ 
      nome_aula: editingAula.nome, 
      youtube_id: editingAula.youtube_id || null,
      ordem: editingAula.ordem,
      pdf_url: editingAula.pdf_url || null
    }).eq('id', id);

    if (error) {
      alert('Erro ao editar aula: ' + error.message);
    } else {
      setEditingAula(null);
      fetchCursos();
    }
  };

  const handleDeleteAula = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta aula?')) return;
    const { error } = await supabase.from('aulas').delete().eq('id', id);
    
    if (error) {
      alert('Erro ao excluir aula: ' + error.message);
    } else {
      fetchCursos();
    }
  };

  const toggleModulo = (moduloId: string) => {
    setModulosExpandidos(prev => ({ ...prev, [moduloId]: !prev[moduloId] }));
  };

  if (loading) return <div>Verificando permissões...</div>;

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Painel Administrativo</h1>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Criar Curso */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: '1 1 300px' }}>
          <h3><Plus size={16} /> Novo Curso</h3>
          <form onSubmit={handleCriarCurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input type="text" placeholder="Nome do Curso" className="input-field" value={novoCurso.nome} onChange={e => setNovoCurso({...novoCurso, nome: e.target.value})} required />
            <textarea placeholder="Descrição" className="input-field" value={novoCurso.descricao} onChange={e => setNovoCurso({...novoCurso, descricao: e.target.value})} required rows={3}></textarea>
            <button type="submit" className="btn btn-primary">Criar Curso</button>
          </form>
        </div>

        {/* Criar Módulo */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: '1 1 300px' }}>
          <h3><Plus size={16} /> Nova Pasta / Módulo</h3>
          <form onSubmit={handleCriarModulo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <select className="input-field" value={novoModulo.curso_id} onChange={e => setNovoModulo({...novoModulo, curso_id: e.target.value})} required>
              <option value="">Selecione o Curso</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nome_curso}</option>)}
            </select>
            <input type="text" placeholder="Nome da Pasta" className="input-field" value={novoModulo.nome} onChange={e => setNovoModulo({...novoModulo, nome: e.target.value})} required />
            <input type="number" placeholder="Ordem" className="input-field" value={novoModulo.ordem} onChange={e => setNovoModulo({...novoModulo, ordem: parseInt(e.target.value)})} required />
            <button type="submit" className="btn btn-primary">Criar Pasta</button>
          </form>
        </div>

         {/* Criar Aula */}
        <div className="glass-panel" style={{ padding: '1.5rem', flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <span><Plus size={16} /> Nova Aula</span>
            <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem', borderRadius: '4px' }}>
              <button 
                onClick={() => setAulaCadastroModo('individual')} 
                className={`btn ${aulaCadastroModo === 'individual' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: 'none' }}
              >
                Individual
              </button>
              <button 
                onClick={() => setAulaCadastroModo('lote')} 
                className={`btn ${aulaCadastroModo === 'lote' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: 'none' }}
              >
                Em Lote
              </button>
            </div>
          </h3>

          <select 
            className="input-field" 
            style={{ marginTop: '1rem' }} 
            value={novaAula.modulo_id} 
            onChange={e => {
              const moduloId = e.target.value;
              let proximaOrdem = 1;
              if (moduloId) {
                let maiorOrdem = 0;
                cursos.forEach(c => {
                  const m = c.modulos?.find((mod: any) => mod.id === moduloId);
                  if (m && m.aulas) {
                    m.aulas.forEach((a: any) => {
                      if (a.ordem > maiorOrdem) {
                        maiorOrdem = a.ordem;
                      }
                    });
                  }
                });
                proximaOrdem = maiorOrdem + 1;
              }
              setNovaAula(prev => ({
                ...prev,
                modulo_id: moduloId,
                ordem: proximaOrdem
              }));
            }} 
            required
          >
            <option value="">Selecione a Pasta</option>
            {cursos.map(c => c.modulos?.map((m: any) => (
              <option key={m.id} value={m.id}>{c.nome_curso} &gt; {m.nome_modulo}</option>
            )))}
          </select>

          {aulaCadastroModo === 'individual' ? (
            <form onSubmit={handleCriarAula} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', flex: 1 }}>
              <input type="text" placeholder="Nome da Aula" className="input-field" value={novaAula.nome} onChange={e => setNovaAula({...novaAula, nome: e.target.value})} required />
              <input type="text" placeholder="ID do YouTube (11 carac. - Opcional se houver PDF)" maxLength={11} className="input-field" value={novaAula.youtube_id} onChange={e => setNovaAula({...novaAula, youtube_id: e.target.value})} />
              <input type="number" placeholder="Ordem (Pré-calculada automaticamente)" className="input-field" value={novaAula.ordem || ''} onChange={e => setNovaAula({...novaAula, ordem: parseInt(e.target.value) || 0})} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input 
                  type="text" 
                  placeholder="URL do PDF (Material de Apoio)" 
                  className="input-field" 
                  value={novaAula.pdf_url} 
                  onChange={e => setNovaAula({...novaAula, pdf_url: e.target.value})} 
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    id="file-upload-nova-aula"
                    style={{ display: 'none' }} 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Validação de segurança: tipo MIME e tamanho
                      if (file.type !== 'application/pdf') {
                        alert('Apenas arquivos PDF são permitidos.');
                        e.target.value = '';
                        return;
                      }
                      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
                      if (file.size > MAX_SIZE) {
                        alert('O arquivo excede o limite de 50MB.');
                        e.target.value = '';
                        return;
                      }
                      
                      const btn = document.getElementById('upload-btn-nova-aula');
                      if (btn) btn.innerText = 'Subindo PDF...';
                      setSubindoPdf(true);
                      
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                        
                        const { error: uploadError } = await supabase.storage
                          .from('materiais')
                          .upload(fileName, file);
                          
                        if (uploadError) throw new Error(uploadError.message);
                        
                        const { data: { publicUrl } } = supabase.storage
                          .from('materiais')
                          .getPublicUrl(fileName);
                          
                        setNovaAula(prev => ({ ...prev, pdf_url: publicUrl }));
                        if (btn) btn.innerText = 'PDF Carregado!';
                      } catch (err: any) {
                        console.error('Erro de upload:', err.message);
                        alert(`Não foi possível fazer o upload automático para o Storage (${err.message}). Por favor, crie o bucket "materiais" no painel do Supabase online ou insira uma URL direta para o PDF no campo acima.`);
                        if (btn) btn.innerText = 'Upload de PDF';
                      } finally {
                        setSubindoPdf(false);
                      }
                    }} 
                  />
                  <button 
                    type="button" 
                    id="upload-btn-nova-aula"
                    className="btn btn-outline" 
                    disabled={subindoPdf}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => document.getElementById('file-upload-nova-aula')?.click()}
                  >
                    Upload de PDF
                  </button>
                  <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>PDF local ou link externo</span>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={subindoPdf} style={{ marginTop: 'auto' }}>
                {subindoPdf ? 'Aguardando Upload...' : 'Adicionar Aula'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', flex: 1 }}>
              <textarea 
                placeholder="Cole os links das aulas (um por linha)&#10;Ex:&#10;https://www.youtube.com/watch?v=xxxx&#10;https://youtu.be/yyyy" 
                className="input-field" 
                value={linksLote} 
                onChange={e => setLinksLote(e.target.value)} 
                rows={5} 
                disabled={buscandoNomes}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleIdentificarAulas}
                disabled={buscandoNomes || !linksLote.trim()}
              >
                {buscandoNomes ? 'Buscando nomes no YouTube...' : 'Identificar Títulos das Aulas'}
              </button>

              {aulasIdentificadas.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 'bold' }}>Aulas identificadas ({aulasIdentificadas.length}):</span>
                  {aulasIdentificadas.map((aula, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ opacity: 0.5 }}>#{i + 1}</span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, color: aula.loading ? 'rgba(255,255,255,0.4)' : 'inherit' }}>
                        {aula.nome}
                      </span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>({aula.youtube_id})</span>
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleCriarAulasLote}
                disabled={carregandoLote || buscandoNomes || aulasIdentificadas.length === 0}
                style={{ marginTop: 'auto' }}
              >
                {carregandoLote ? 'Salvando no Banco...' : 'Salvar Aulas em Lote'}
              </button>
            </div>
          )}
        </div>

      </div>

      <h2 style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>Gerenciar Conteúdo</h2>
      
      {/* Seletor de Curso para Gerenciar */}
      <div style={{ marginBottom: '2rem' }}>
        <select 
          className="input-field" 
          value={cursoSelecionadoId} 
          onChange={e => setCursoSelecionadoId(e.target.value)}
          style={{ maxWidth: '400px' }}
        >
          <option value="">Selecione o curso que deseja gerenciar/editar...</option>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nome_curso}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
        {cursos.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            Nenhum curso cadastrado ainda.
          </div>
        ) : !cursoSelecionadoId ? (
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.7 }}>
            Selecione um curso acima para visualizar e editar seus módulos e aulas.
          </div>
        ) : (
          cursos.filter(c => c.id === cursoSelecionadoId).map(curso => (
            <div key={curso.id} className="glass-panel" style={{ padding: '1.5rem' }}>
              {/* Cabeçalho do Curso */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                {editingCurso?.id === curso.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editingCurso?.nome || ''} 
                      onChange={e => setEditingCurso(prev => prev ? { ...prev, nome: e.target.value } : null)} 
                      placeholder="Nome do Curso"
                    />
                    <textarea 
                      className="input-field" 
                      value={editingCurso?.descricao || ''} 
                      onChange={e => setEditingCurso(prev => prev ? { ...prev, descricao: e.target.value } : null)} 
                      placeholder="Descrição do Curso"
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleUpdateCurso(curso.id)} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}><Check size={14} /> Salvar</button>
                      <button onClick={() => setEditingCurso(null)} className="btn btn-outline" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}><X size={14} /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookOpen size={20} style={{ color: 'var(--primary-color)' }} />
                      {curso.nome_curso}
                    </h3>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>{curso.descricao}</p>
                  </div>
                )}
                
                {editingCurso?.id !== curso.id && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setEditingCurso({ id: curso.id, nome: curso.nome_curso, descricao: curso.descricao || '' })} 
                      className="btn btn-outline" 
                      style={{ padding: '0.4rem', border: 'none', background: 'rgba(255,255,255,0.05)' }} 
                      title="Editar Curso"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCurso(curso.id)} 
                      className="btn btn-outline" 
                      style={{ padding: '0.4rem', border: 'none', color: '#ef4444', background: 'rgba(239,68,68,0.05)' }} 
                      title="Excluir Curso"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Módulos (Pastas) do Curso */}
              <div style={{ marginTop: '1.5rem', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {curso.modulos && curso.modulos.length > 0 ? (
                  [...curso.modulos]
                    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                    .map(modulo => (
                      <div key={modulo.id} style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                          {editingModulo?.id === modulo.id ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, flexWrap: 'wrap' }}>
                              <input 
                                type="text" 
                                className="input-field" 
                                style={{ flex: 2, minWidth: '150px' }} 
                                value={editingModulo?.nome || ''} 
                                onChange={e => setEditingModulo(prev => prev ? { ...prev, nome: e.target.value } : null)} 
                                placeholder="Nome do Módulo"
                              />
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ width: '80px' }} 
                                value={editingModulo?.ordem || 0} 
                                onChange={e => setEditingModulo(prev => prev ? { ...prev, ordem: parseInt(e.target.value) || 0 } : null)} 
                                placeholder="Ordem"
                              />
                              <button onClick={() => handleUpdateModulo(modulo.id)} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem' }}><Check size={14} /></button>
                              <button onClick={() => setEditingModulo(null)} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem' }}><X size={14} /></button>
                            </div>
                          ) : (
                            <div 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => toggleModulo(modulo.id)}
                            >
                              {modulosExpandidos[modulo.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <Folder size={16} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />
                              <strong style={{ fontSize: '0.95rem' }}>
                                {modulo.ordem !== undefined ? `${modulo.ordem}. ` : ''}{modulo.nome_modulo}
                              </strong>
                            </div>
                          )}

                          {editingModulo?.id !== modulo.id && (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button 
                                onClick={() => setEditingModulo({ id: modulo.id, nome: modulo.nome_modulo, ordem: modulo.ordem || 0 })} 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem', border: 'none', background: 'transparent' }} 
                                title="Editar Pasta"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteModulo(modulo.id)} 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem', border: 'none', color: '#ef4444', background: 'transparent' }} 
                                title="Excluir Pasta"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Aulas do Módulo (Recolhível) */}
                        {modulosExpandidos[modulo.id] && (
                          <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                            {modulo.aulas && modulo.aulas.length > 0 ? (
                              [...modulo.aulas]
                                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                .map(aula => (
                                  <div key={aula.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                    {editingAula?.id === aula.id ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <input 
                                            type="text" 
                                            className="input-field" 
                                            style={{ flex: 3, minWidth: '120px', padding: '0.3rem' }} 
                                            value={editingAula?.nome || ''} 
                                            onChange={e => setEditingAula(prev => prev ? { ...prev, nome: e.target.value } : null)} 
                                            placeholder="Nome da Aula"
                                          />
                                          <input 
                                            type="text" 
                                            className="input-field" 
                                            style={{ flex: 2, minWidth: '90px', padding: '0.3rem' }} 
                                            value={editingAula?.youtube_id || ''} 
                                            onChange={e => setEditingAula(prev => prev ? { ...prev, youtube_id: e.target.value } : null)} 
                                            placeholder="ID YouTube"
                                            maxLength={11}
                                          />
                                          <input 
                                            type="number" 
                                            className="input-field" 
                                            style={{ width: '60px', padding: '0.3rem' }} 
                                            value={editingAula?.ordem || 0} 
                                            onChange={e => setEditingAula(prev => prev ? { ...prev, ordem: parseInt(e.target.value) || 0 } : null)} 
                                            placeholder="Ordem"
                                          />
                                          <button onClick={() => !subindoPdf && handleUpdateAula(aula.id)} className="btn btn-primary" disabled={subindoPdf} style={{ padding: '0.2rem 0.5rem' }}>{subindoPdf ? '...' : <Check size={12} />}</button>
                                          <button onClick={() => setEditingAula(null)} className="btn btn-outline" disabled={subindoPdf} style={{ padding: '0.2rem 0.5rem' }}><X size={12} /></button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                          <input 
                                            type="text" 
                                            className="input-field" 
                                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem' }} 
                                            value={editingAula?.pdf_url || ''} 
                                            onChange={e => setEditingAula(prev => prev ? { ...prev, pdf_url: e.target.value } : null)} 
                                            placeholder="URL do PDF (Opcional)"
                                          />
                                          <input 
                                            type="file" 
                                            accept=".pdf" 
                                            id={`file-upload-edit-${aula.id}`}
                                            style={{ display: 'none' }} 
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;

                                              // Validação de segurança: tipo MIME e tamanho
                                              if (file.type !== 'application/pdf') {
                                                alert('Apenas arquivos PDF são permitidos.');
                                                e.target.value = '';
                                                return;
                                              }
                                              const MAX_SIZE = 50 * 1024 * 1024; // 50MB
                                              if (file.size > MAX_SIZE) {
                                                alert('O arquivo excede o limite de 50MB.');
                                                e.target.value = '';
                                                return;
                                              }
                                              
                                              const btn = document.getElementById(`upload-btn-edit-${aula.id}`);
                                              if (btn) btn.innerText = '...';
                                              setSubindoPdf(true);
                                              
                                              try {
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
                                                
                                                const { error: uploadError } = await supabase.storage
                                                  .from('materiais')
                                                  .upload(fileName, file);
                                                  
                                                if (uploadError) throw new Error(uploadError.message);
                                                
                                                const { data: { publicUrl } } = supabase.storage
                                                  .from('materiais')
                                                  .getPublicUrl(fileName);
                                                  
                                                setEditingAula(prev => prev ? { ...prev, pdf_url: publicUrl } : null);
                                                if (btn) btn.innerText = 'OK';
                                              } catch (err: any) {
                                                console.error('Erro de upload:', err.message);
                                                alert(`Não foi possível fazer o upload automático para o Storage (${err.message}). Por favor, crie o bucket "materiais" no painel do Supabase online ou insira uma URL direta para o PDF no campo ao lado.`);
                                                if (btn) btn.innerText = 'Upload';
                                              } finally {
                                                setSubindoPdf(false);
                                              }
                                            }} 
                                          />
                                          <button 
                                            type="button" 
                                            id={`upload-btn-edit-${aula.id}`}
                                            className="btn btn-outline" 
                                            disabled={subindoPdf}
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                            onClick={() => document.getElementById(`file-upload-edit-${aula.id}`)?.click()}
                                          >
                                            Upload
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <Play size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                        <span>
                                          {aula.ordem !== undefined ? `${aula.ordem}. ` : ''}{aula.nome_aula}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>(YouTube: {aula.youtube_id})</span>
                                        {aula.pdf_url && (
                                          <span style={{ fontSize: '0.75rem', color: '#3b82f6', opacity: 0.8 }}>(PDF material atrelado)</span>
                                        )}
                                      </div>
                                    )}

                                    {editingAula?.id !== aula.id && (
                                      <div style={{ display: 'flex', gap: '0.2rem' }}>
                                        <button 
                                          onClick={() => setEditingAula({ id: aula.id, nome: aula.nome_aula, youtube_id: aula.youtube_id, ordem: aula.ordem || 0, pdf_url: aula.pdf_url || '' })} 
                                          className="btn btn-outline" 
                                          style={{ padding: '0.2rem', border: 'none', background: 'transparent' }} 
                                          title="Editar Aula"
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteAula(aula.id)} 
                                          className="btn btn-outline" 
                                          style={{ padding: '0.2rem', border: 'none', color: '#ef4444', background: 'transparent' }} 
                                          title="Excluir Aula"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))
                            ) : (
                              <span style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>Nenhuma aula cadastrada nesta pasta.</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <span style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>Nenhuma pasta cadastrada neste curso.</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <h2 style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>Liberação de Acessos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {cursos.map(curso => (
          <div key={curso.id} className="glass-panel" style={{ padding: '1.5rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>{curso.nome_curso}</h4>
            <form onSubmit={e => {
              e.preventDefault();
              setNovaPermissao({...novaPermissao, curso_id: curso.id});
              supabase.from('permissoes').insert([{ curso_id: curso.id, user_email: novaPermissao.email.toLowerCase().trim() }]).then(({ error }) => {
                if (error) {
                  alert('Erro ao liberar acesso: ' + error.message);
                } else {
                  alert(`Acesso liberado para ${novaPermissao.email.toLowerCase().trim()}`);
                  setNovaPermissao({ curso_id: '', email: '' });
                  fetchPermissoes();
                  const form = e.target as HTMLFormElement;
                  form.reset();
                }
              });
            }} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="email" 
                placeholder="E-mail do Aluno" 
                className="input-field" 
                required
                onChange={e => setNovaPermissao({...novaPermissao, email: e.target.value})}
              />
              <button type="submit" className="btn btn-primary" title="Liberar Acesso"><UserPlus size={20}/></button>
            </form>
          </div>
        ))}
      </div>

      {/* Aba com função de recolher para visualizar e excluir acessos */}
      <div className="glass-panel" style={{ marginTop: '3rem', padding: '1.5rem' }}>
        <button 
          onClick={() => setMostrarGerenciarAcessos(!mostrarGerenciarAcessos)}
          className="btn"
          style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-color)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} style={{ color: 'var(--primary-color)' }} /> 
            Visualizar e Excluir Acessos Ativos
          </span>
          {mostrarGerenciarAcessos ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {mostrarGerenciarAcessos && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {cursos.map(curso => {
              const acessosDoCurso = permissoes.filter(p => p.curso_id === curso.id);

              return (
                <div key={`acessos-${curso.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <BookOpen size={16} style={{ color: 'var(--primary-color)', opacity: 0.8 }} /> 
                    {curso.nome_curso}
                  </h4>
                  
                  {acessosDoCurso.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic', paddingLeft: '1.5rem' }}>
                      Nenhum aluno com acesso liberado para este curso.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', paddingLeft: '1.5rem' }}>
                      {acessosDoCurso.map(acesso => (
                        <div 
                          key={acesso.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: 'rgba(255,255,255,0.02)', 
                            padding: '0.5rem 0.75rem', 
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}
                        >
                          <span style={{ fontSize: '0.85rem', opacity: 0.9, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, paddingRight: '0.5rem' }}>
                            {acesso.user_email}
                          </span>
                          <button 
                            onClick={() => handleRemoverAcesso(acesso.id, acesso.user_email, curso.nome_curso)} 
                            className="btn" 
                            style={{ 
                              padding: '0.25rem', 
                              color: '#ef4444', 
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }} 
                            title="Remover Acesso"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aba de Usuários Cadastrados (Perfis) */}
      <div className="glass-panel" style={{ marginTop: '3rem', padding: '1.5rem' }}>
        <button 
          onClick={() => setMostrarPerfis(!mostrarPerfis)}
          className="btn"
          style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-color)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} style={{ color: 'var(--primary-color)' }} /> 
            Todos os Usuários Cadastrados
          </span>
          {mostrarPerfis ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {mostrarPerfis && (
          <div style={{ marginTop: '1.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                Total de cadastros: <strong style={{ color: 'var(--primary-color)' }}>{perfis.length}</strong> usuário(s).
              </div>
              <button 
                onClick={fetchPerfis} 
                className="btn btn-outline" 
                disabled={loadingPerfis}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} className={loadingPerfis ? 'spin-animation' : ''} />
                {loadingPerfis ? 'Atualizando...' : 'Atualizar Lista'}
              </button>
            </div>

            {loadingPerfis && perfis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>Carregando perfis...</div>
            ) : perfis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6, fontStyle: 'italic' }}>Nenhum usuário cadastrado.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {perfis.map((perfil) => (
                  <div 
                    key={perfil.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      background: 'rgba(255,255,255,0.02)', 
                      padding: '0.75rem', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                      {perfil.email}
                    </span>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Status: {perfil.confirmado ? 'Confirmado' : 'Pendente'}</span>
                      <span>{new Date(perfil.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aba de Sessões e Dispositivos Online */}
      <div className="glass-panel" style={{ marginTop: '3rem', padding: '1.5rem' }}>
        <button 
          onClick={() => setMostrarSessoes(!mostrarSessoes)}
          className="btn"
          style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: 'var(--text-color)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={20} style={{ color: 'var(--primary-color)' }} /> 
            Contas Conectadas e Dispositivos Logados
          </span>
          {mostrarSessoes ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {mostrarSessoes && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                Total de sessões ativas: <strong style={{ color: 'var(--primary-color)' }}>{sessoes.length}</strong> dispositivo(s) em <strong style={{ color: 'var(--primary-color)' }}>{Object.keys(sessoes.reduce((acc: any, s) => ({ ...acc, [s.email]: true }), {})).length}</strong> conta(s).
              </div>
              <button 
                onClick={fetchSessoes} 
                className="btn btn-outline" 
                disabled={loadingSessoes}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} className={loadingSessoes ? 'spin-animation' : ''} />
                {loadingSessoes ? 'Atualizando...' : 'Atualizar Lista'}
              </button>
            </div>

            {loadingSessoes && sessoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>Carregando sessões...</div>
            ) : sessoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6, fontStyle: 'italic' }}>Nenhuma sessão ativa encontrada.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {Object.entries(
                  sessoes.reduce((acc: Record<string, any[]>, sessao) => {
                    const email = sessao.email || 'Sem e-mail';
                    if (!acc[email]) acc[email] = [];
                    acc[email].push(sessao);
                    return acc;
                  }, {})
                ).map(([email, userSessoes]) => {
                  const hasSuspiciousSharing = userSessoes.length >= 3;
                  const firstUserId = userSessoes[0]?.user_id;

                  return (
                    <div 
                      key={email} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.05)', 
                        paddingBottom: '1.5rem',
                        backgroundColor: hasSuspiciousSharing ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                        padding: hasSuspiciousSharing ? '1rem' : '0rem',
                        borderRadius: hasSuspiciousSharing ? '8px' : '0px',
                        border: hasSuspiciousSharing ? '1px dashed rgba(239, 68, 68, 0.2)' : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', margin: 0 }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{email}</span>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', opacity: 0.7 }}>
                            {userSessoes.length} {userSessoes.length === 1 ? 'dispositivo' : 'dispositivos'}
                          </span>
                          {hasSuspiciousSharing && (
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.25rem', 
                                fontSize: '0.75rem', 
                                color: '#f87171', 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                padding: '0.1rem 0.5rem', 
                                borderRadius: '4px',
                                fontWeight: 'bold' 
                              }}
                            >
                              <ShieldAlert size={12} /> Compartilhamento Suspeito!
                            </span>
                          )}
                        </h4>
                        
                        {firstUserId && (
                          <button
                            onClick={() => handleDerrubarTodasSessoes(firstUserId, email)}
                            className="btn btn-outline"
                            style={{ 
                              padding: '0.25rem 0.6rem', 
                              fontSize: '0.75rem', 
                              color: '#ef4444', 
                              borderColor: 'rgba(239, 68, 68, 0.2)',
                              background: 'rgba(239, 68, 68, 0.02)'
                            }}
                          >
                            Derrubar Todas as Sessões
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem', paddingLeft: hasSuspiciousSharing ? '0rem' : '1rem' }}>
                        {userSessoes.map((sessao) => {
                          const deviceFriendly = formatarUserAgent(sessao.user_agent);
                          const isMobile = sessao.user_agent?.includes('iPhone') || sessao.user_agent?.includes('Android') || sessao.user_agent?.includes('iPad');
                          const formatarData = (dataStr: string) => {
                            const date = new Date(dataStr);
                            return date.toLocaleString('pt-BR');
                          };

                          return (
                            <div 
                              key={sessao.id_sessao} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: 'rgba(255,255,255,0.01)', 
                                padding: '0.6rem 0.8rem', 
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.04)'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                <div style={{ opacity: 0.6 }}>
                                  {isMobile ? <Smartphone size={16} /> : <Monitor size={16} />}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={sessao.user_agent}>
                                    {deviceFriendly}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', opacity: 0.5, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.1rem' }}>
                                    <span>IP: {sessao.ip?.replace('/32', '')}</span>
                                    <span>• Atividade: {formatarData(sessao.updated_at)}</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDerrubarSessao(sessao.id_sessao, email, deviceFriendly)} 
                                className="btn" 
                                style={{ 
                                  padding: '0.3rem', 
                                  color: '#ef4444', 
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }} 
                                title="Desconectar dispositivo"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
