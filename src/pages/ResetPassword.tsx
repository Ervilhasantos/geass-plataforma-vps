import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Segurança: Só permite acesso se veio do fluxo de recuperação de senha
    const isResetting = sessionStorage.getItem('is_resetting_password') === 'true';
    if (!isResetting) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate('/');
        } else {
          navigate('/login');
        }
      });
    }
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      // Limpa a flag de segurança após a redefinição bem-sucedida
      sessionStorage.removeItem('is_resetting_password');
      
      setMessage('Senha atualizada com sucesso! Redirecionando...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <ThemeToggle />
      </div>
      
      <div style={{ margin: 'auto', width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <img src="/GEASS.png" alt="GEASS Logo" style={{ maxWidth: '200px', marginBottom: '2rem' }} />
          
          <h2 style={{ marginBottom: '1.5rem' }}>Nova Senha</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
            Digite abaixo sua nova senha de acesso à plataforma.
          </p>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
          {message && <div style={{ color: 'var(--primary-color)', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</div>}

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              placeholder="Digite a nova senha"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Aguarde...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
