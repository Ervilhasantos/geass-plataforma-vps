import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';
import { BookOpen, LogOut, Settings, BarChart3, Target } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedEmail, setImpersonatedEmail] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se for o admin real, ele vê as opções de admin
      const realUser = (user as any)?.real_user || user;
      if (realUser?.email === 'nelsonvilhasantos@gmail.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
      
      if (user && (user as any).is_impersonated) {
        setIsImpersonating(true);
        setImpersonatedEmail(user.email || '');
      } else {
        setIsImpersonating(false);
        setImpersonatedEmail('');
      }
    };
    checkUser();
  }, [location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('geass:impersonate');
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleSairImpersonate = () => {
    localStorage.removeItem('geass:impersonate');
    setIsImpersonating(false);
    setImpersonatedEmail('');
    navigate('/admin');
    window.location.reload();
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/GEASS1.png" alt="GEASS Logo" style={{ maxWidth: '40px' }} />
        </div>
        
        <nav className="sidebar-nav">
          <Link 
            to="/" 
            title="Meus Cursos"
            className="btn sidebar-btn" 
            style={{ 
              backgroundColor: location.pathname === '/' ? 'var(--primary-color)' : 'transparent',
              color: location.pathname === '/' ? 'var(--bg-color)' : 'var(--text-color)'
            }}
          >
            <BookOpen size={22} />
          </Link>

          <Link 
            to="/stats" 
            title="Estatísticas"
            className="btn sidebar-btn" 
            style={{ 
              backgroundColor: location.pathname === '/stats' ? 'var(--primary-color)' : 'transparent',
              color: location.pathname === '/stats' ? 'var(--bg-color)' : 'var(--text-color)'
            }}
          >
            <BarChart3 size={22} />
          </Link>

          <Link 
            to="/metas" 
            title="Metas de Estudo"
            className="btn sidebar-btn" 
            style={{ 
              backgroundColor: location.pathname === '/metas' ? 'var(--primary-color)' : 'transparent',
              color: location.pathname === '/metas' ? 'var(--bg-color)' : 'var(--text-color)'
            }}
          >
            <Target size={22} />
          </Link>
          
          {isAdmin && (
            <Link 
              to="/admin" 
              title="Painel Admin"
              className="btn sidebar-btn"
              style={{ 
                backgroundColor: location.pathname.includes('/admin') ? 'var(--primary-color)' : 'transparent',
                color: location.pathname.includes('/admin') ? 'var(--bg-color)' : 'var(--text-color)'
              }}
            >
              <Settings size={22} />
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <button onClick={handleLogout} className="btn sidebar-btn" style={{ border: 'none', color: '#ef4444' }} title="Sair">
            <LogOut size={22} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ paddingTop: isImpersonating ? '1rem' : '1.5rem' }}>
        {isImpersonating && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '0.75rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--text-color)',
            fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span>
                Visualizando a plataforma como aluno: <strong style={{ color: '#ef4444' }}>{impersonatedEmail}</strong>
              </span>
            </div>
            <button 
              onClick={handleSairImpersonate}
              className="btn"
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Voltar ao Admin
            </button>
          </div>
        )}
        <div className="glass-panel main-panel animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
