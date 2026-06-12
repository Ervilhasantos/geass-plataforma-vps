import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const formattedEmail = email.toLowerCase().trim();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formattedEmail, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: formattedEmail, password });
        if (error) throw error;
        setMessage('Cadastro realizado com sucesso! Redirecionando...');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, preencha o e-mail.');
      return;
    }
    
    setLoading(true);
    setMessage('');
    setError('');

    const formattedEmail = email.toLowerCase().trim();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formattedEmail, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      setMessage('Um link de recuperação foi enviado para seu e-mail.');
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao enviar o link de recuperação.');
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
          
          <h2 style={{ marginBottom: '1.5rem' }}>
            {isForgotPassword ? 'Recuperar Senha' : (isLogin ? 'Entrar' : 'Cadastrar')}
          </h2>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
          {message && <div style={{ color: 'var(--primary-color)', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</div>}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="email"
                placeholder="Seu E-mail"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                {loading ? 'Aguarde...' : 'Enviar Link de Recuperação'}
              </button>
              <button 
                type="button" 
                onClick={() => { setIsForgotPassword(false); setError(''); setMessage(''); }} 
                className="btn btn-outline" 
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Voltar para Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="email"
                placeholder="Seu E-mail"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Sua Senha"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              
              {isLogin && (
                <div style={{ textAlign: 'right' }}>
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem', opacity: 0.8 }}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                {loading ? 'Aguarde...' : (isLogin ? 'Entrar na Plataforma' : 'Criar Conta')}
              </button>
            </form>
          )}

          {!isForgotPassword && (
            <div style={{ marginTop: '1.5rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-color)', opacity: 0.8 }}>
                {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
              </span>
              {' '}
              <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} 
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              >
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
