import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Lock, User, Shield, Info, LogIn } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, logoUrl } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicrosoftLogin = () => {
        window.location.href = '/api/auth/login/microsoft';
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img 
                        src={logoUrl || "/static/applogo.svg"} 
                        alt="GeoMon Logo" 
                        className="login-logo" 
                        style={{ height: '80px', width: 'auto', objectFit: 'contain', marginBottom: '1.5rem' }} 
                    />
                    <h1 className="login-title">GeoMon</h1>
                    <p className="login-subtitle">Enterprise Security & Log Intelligence</p>
                </div>

                {error && (
                    <div className="error-alert" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <Info size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ animation: 'fadeInDown 0.8s ease-out' }}>
                    <div className="login-input-group">
                        <User className="login-input-icon" size={18} />
                        <input
                            type="text"
                            className="login-input"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-input-group">
                        <Lock className="login-input-icon" size={18} />
                        <input
                            type="password"
                            className="login-input"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="login-button" 
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '0.6rem',
                            background: 'var(--gradient-primary)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s',
                            marginTop: '0.1rem',
                            marginBottom: '0.1rem'
                        }}
                    >
                        {isLoading ? (
                            <div className="loader" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        ) : (
                            <>
                                <span>Sign In</span>
                                <LogIn size={18} />
                            </>
                        )}
                    </button>

                    <div className="divider" style={{ display: 'flex', alignItems: 'center', margin: '0.2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                        <span style={{ padding: '0 10px' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                    </div>

                    <button 
                        type="button"
                        onClick={handleMicrosoftLogin}
                        className="btn-oauth"
                        style={{
                            width: '100%',
                            padding: '0.85rem',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            color: '#1e293b',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <img src="/static/microsoft.svg" alt="" style={{ width: '20px', height: '20px' }} />
                        <span>Sign in with Microsoft</span>
                    </button>

                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Shield size={12} />
                        <span>Encrypted Enterprise Session</span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
