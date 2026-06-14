import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Course from './pages/Course';
import ResetPassword from './pages/ResetPassword';
import StatsDashboard from './pages/StatsDashboard';
import GoalsDashboard from './pages/GoalsDashboard';
import { supabase } from './lib/supabase';

// Code-splitting: o Admin (~48KB) é carregado apenas quando o admin acessa a rota
const Admin = React.lazy(() => import('./pages/Admin'));
function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detecta se o usuário veio de um link de recuperação de senha (contém type=recovery na URL)
    const hasRecovery = window.location.hash.includes('type=recovery') || 
                        window.location.search.includes('type=recovery');
                        
    if (hasRecovery) {
      sessionStorage.setItem('is_resetting_password', 'true');
      if (window.location.pathname !== '/reset-password') {
        window.location.href = '/reset-password';
        return;
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('is_resetting_password', 'true');
        if (window.location.pathname !== '/reset-password') {
          window.location.href = '/reset-password';
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>Carregando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="stats" element={<StatsDashboard />} />
          <Route path="metas" element={<GoalsDashboard />} />
          <Route path="curso/:id" element={<Course />} />
          <Route path="admin" element={<Suspense fallback={<div>Carregando painel...</div>}><Admin /></Suspense>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
