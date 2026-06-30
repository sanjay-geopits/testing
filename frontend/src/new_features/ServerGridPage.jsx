import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { 
    Database, 
    ArrowLeft, 
    Sliders,
    Activity, 
    ShieldAlert, 
    Cpu, 
    Terminal, 
    Layers,
    CheckCircle,
    ArrowRight
} from 'lucide-react';

const ServerGridPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [clientsList, setClientsList] = useState([]);
    const [selectedTech, setSelectedTech] = useState(searchParams.get('tech') || 'PostgreSQL');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        api.get('/new-features/admin/clients')
            .then(res => {
                setClientsList(res.data.clients || []);
            })
            .catch(err => console.error("Error fetching db server grid clients:", err))
            .finally(() => setIsLoading(false));
    }, []);

    const themeStyles = {
        background: isLight 
            ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)' 
            : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        headerBg: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(5, 7, 16, 0.8)',
        headerBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.05)',
        cardBg: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.4)',
        cardBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#0f172a' : '#f8fafc',
        textMuted: isLight ? '#475569' : '#94a3b8',
        inputBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)'
    };

    const techOptions = [
        { name: 'PostgreSQL', color: '#336791' },
        { name: 'MySQL', color: '#f29111' },
        { name: 'MongoDB', color: '#47a248' },
        { name: 'Oracle', color: '#f80000' },
        { name: 'MSSQL', color: '#0078d4' }
    ];

    // Filter server clients dynamically strictly based on selected technology
    const filteredServers = clientsList.filter(c => 
        (c.db_tech?.toLowerCase() === selectedTech.toLowerCase()) || 
        (c.db_type?.toLowerCase() === selectedTech.toLowerCase())
    );

    return (
        <div style={{ 
            background: themeStyles.background, 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            color: themeStyles.textMain,
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.3s ease, color 0.3s ease'
        }}>
            {/* ENTERPRISE APPBAR */}
            <header style={{ 
                borderBottom: themeStyles.headerBorder, 
                background: themeStyles.headerBg,
                backdropFilter: 'blur(20px)',
                padding: '1rem 2.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 1000
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: themeStyles.textMain,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                            borderRadius: '8px',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ 
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)', 
                            padding: '8px', 
                            borderRadius: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center'
                        }}>
                            <Layers style={{ color: 'white' }} size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0, color: themeStyles.textMain }}>
                                GeoPITS <span style={{ fontWeight: '400', fontSize: '0.9rem', color: '#2563eb' }}>Server Grid</span>
                            </h1>
                            <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Active Cluster Registry Console</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {(user?.role === 'admin' || user?.isAdmin) && (
                        <button
                            onClick={() => navigate('/admin/setup')}
                            style={{
                                background: 'none',
                                border: themeStyles.inputBorder,
                                borderRadius: '8px',
                                color: themeStyles.textMain,
                                padding: '8px 16px',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Sliders size={14} />
                            <span>Manage Servers</span>
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN CORE BODY */}
            <main style={{ flex: 1, padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
                
                {/* Visual Technology Sliding Filter Matrix Selector */}
                <div style={{ 
                    background: themeStyles.cardBg, 
                    border: themeStyles.cardBorder, 
                    borderRadius: '20px', 
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                }}>
                    <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Technology Selectors</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {techOptions.map((opt) => {
                            const isSelected = selectedTech === opt.name;
                            const count = clientsList.filter(c => 
                                (c.db_tech?.toLowerCase() === opt.name.toLowerCase()) || 
                                (c.db_type?.toLowerCase() === opt.name.toLowerCase())
                            ).length;

                            return (
                                <button
                                    key={opt.name}
                                    onClick={() => setSelectedTech(opt.name)}
                                    style={{
                                        background: isSelected 
                                            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                                            : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)'),
                                        border: isSelected 
                                            ? 'none' 
                                            : themeStyles.inputBorder,
                                        borderRadius: '12px',
                                        padding: '12px 24px',
                                        color: isSelected ? 'white' : themeStyles.textMain,
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '0.88rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                        boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none'
                                    }}
                                >
                                    <Database size={16} style={{ color: isSelected ? 'white' : opt.color }} />
                                    <span>{opt.name}</span>
                                    <span style={{ 
                                        fontSize: '0.72rem', 
                                        background: isSelected ? 'rgba(255,255,255,0.2)' : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)'), 
                                        color: isSelected ? 'white' : themeStyles.textMuted,
                                        padding: '2px 8px', 
                                        borderRadius: '8px',
                                        marginLeft: '4px'
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Servers Display Grid Container */}
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '1.5rem', color: themeStyles.textMain, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Active {selectedTech} Clusters</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '500', color: themeStyles.textMuted }}>({filteredServers.length} Servers Online)</span>
                    </h2>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                    ) : filteredServers.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {filteredServers.map((srv) => (
                                <div
                                    key={srv.id}
                                    style={{
                                        background: themeStyles.cardBg,
                                        border: themeStyles.cardBorder,
                                        borderRadius: '16px',
                                        padding: '1.75rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px',
                                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.borderColor = '#2563eb';
                                        e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Tech color top accent indicator bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: techOptions.find(o => o.name === selectedTech)?.color || '#2563eb' }}></div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Database size={20} style={{ color: techOptions.find(o => o.name === selectedTech)?.color }} />
                                            <strong style={{ fontSize: '1rem', fontWeight: '800', color: themeStyles.textMain }}>
                                                {srv.client_name?.toUpperCase()}
                                            </strong>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '3px 10px', borderRadius: '20px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                                            <span style={{ fontSize: '0.62rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>ONLINE</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: themeStyles.inputBorder }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                            <span style={{ color: themeStyles.textMuted }}>Server Host</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: themeStyles.textMain }}>{srv.server_name}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                            <span style={{ color: themeStyles.textMuted }}>Database Port</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: themeStyles.textMain }}>{srv.db_port || 'Default'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                            <span style={{ color: themeStyles.textMuted }}>Admin Username</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: themeStyles.textMain }}>{srv.db_user || 'sa'}</span>
                                        </div>
                                    </div>

                                    {/* Cluster Status details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.72rem' }}>
                                        <div style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '8px', border: themeStyles.inputBorder }}>
                                            <div style={{ color: themeStyles.textMuted, fontSize: '0.62rem', textTransform: 'uppercase' }}>Session Pool</div>
                                            <strong style={{ fontSize: '0.8rem', color: themeStyles.textMain }}>12 Active</strong>
                                        </div>
                                        <div style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '8px', border: themeStyles.inputBorder }}>
                                            <div style={{ color: themeStyles.textMuted, fontSize: '0.62rem', textTransform: 'uppercase' }}>Ping Latency</div>
                                            <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>8ms (Nominal)</strong>
                                        </div>
                                    </div>

                                    {/* Integrated Action Bridges */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                        <button
                                            onClick={() => navigate('/reports')}
                                            style={{
                                                flex: 1,
                                                background: '#2563eb',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                padding: '8px 0',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#1d4ed8'}
                                            onMouseLeave={(e) => e.target.style.background = '#2563eb'}
                                        >
                                            <span>Reports</span>
                                        </button>
                                        <button
                                            onClick={() => navigate('/tickets')}
                                            style={{
                                                flex: 1,
                                                background: 'none',
                                                border: themeStyles.inputBorder,
                                                borderRadius: '8px',
                                                color: themeStyles.textMain,
                                                padding: '8px 0',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'}
                                            onMouseLeave={(e) => e.target.style.background = 'none'}
                                        >
                                            <span>Tickets</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ 
                            background: themeStyles.cardBg, 
                            border: themeStyles.cardBorder, 
                            borderRadius: '20px', 
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem',
                            boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                        }}>
                            <Database size={48} style={{ color: themeStyles.textMuted, opacity: 0.5 }} />
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: themeStyles.textMain, margin: '0 0 4px 0' }}>No Clusters Registered</h3>
                                <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, maxWidth: '460px', margin: 0, lineHeight: '1.6' }}>
                                    There are currently no active database nodes provisioned for <strong>{selectedTech}</strong> inside the Postgres central datastore.
                                </p>
                            </div>
                            {(user?.role === 'admin' || user?.isAdmin) && (
                                <button
                                    onClick={() => navigate('/admin/setup')}
                                    style={{
                                        background: '#2563eb',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        padding: '10px 20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginTop: '8px'
                                    }}
                                >
                                    <span>Register New Server Node</span>
                                    <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

            </main>

            <footer style={{ 
                textAlign: 'center', 
                padding: '2.5rem', 
                borderTop: themeStyles.headerBorder, 
                color: themeStyles.textMuted, 
                fontSize: '0.8rem',
                background: isLight ? '#ffffff' : 'rgba(5, 7, 16, 0.4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircle style={{ color: '#16a34a' }} size={14} />
                    <span>GeoPITS Enterprise Service Active</span>
                </div>
                <span>&copy; {new Date().getFullYear()} GeoPITS Security Core. Prepared By SANJAY G. All database log streams are encrypted.</span>
            </footer>
        </div>
    );
};

export default ServerGridPage;
