import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';
import { BookOpen, LogOut, Settings, BarChart3, Target } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === 'nelsonvilhasantos@gmail.com') {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
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
      <main className="main-content">
        <div className="glass-panel main-panel animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
