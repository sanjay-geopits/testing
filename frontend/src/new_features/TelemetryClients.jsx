import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { 
    Database, 
    ArrowLeft, 
    Search, 
    RefreshCw, 
    CheckCircle, 
    TrendingUp, 
    Server,
    ShieldAlert,
    Layers
} from 'lucide-react';

const TECH_COLORS = {
    mysql:      { from: '#f59e0b', to: '#d97706', badge: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#f59e0b' },
    postgresql: { from: '#3b82f6', to: '#1d4ed8', badge: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
    mongodb:    { from: '#10b981', to: '#059669', badge: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
    mssql:      { from: '#8b5cf6', to: '#7c3aed', badge: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', text: '#8b5cf6' },
    oracle:     { from: '#ef4444', to: '#dc2626', badge: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' },
};

const getTechColor = (dbType = '') => {
    return TECH_COLORS[dbType.toLowerCase().trim()] || { 
        from: '#0ea5e9', to: '#2563eb', 
        badge: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)', text: '#0ea5e9' 
    };
};

const TelemetryClients = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [pairs, setPairs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPairs();
    }, []);

    const fetchPairs = () => {
        setIsLoading(true);
        setError('');
        api.get('/new-features/telemetry/client-tech-grid')
            .then(res => {
                setPairs(res.data.client_tech_pairs || []);
            })
            .catch(err => {
                console.error("Error fetching telemetry client-tech grid:", err);
                setError("Failed to load client-technology telemetry grid. Please check server logs.");
            })
            .finally(() => setIsLoading(false));
    };

    const handleSync = () => {
        setSyncing(true);
        setSyncResult(null);
        setError('');
        api.post('/new-features/telemetry/sync')
            .then(res => {
                setSyncResult(res.data);
                fetchPairs();
            })
            .catch(err => {
                console.error("Manual sync failed:", err);
                setError(err.response?.data?.detail || "Manual email telemetry sync failed.");
            })
            .finally(() => setSyncing(false));
    };

    const themeStyles = {
        background: isLight 
            ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)' 
            : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        headerBg: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(5, 7, 16, 0.8)',
        headerBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.05)',
        cardBg: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.4)',
        cardBorder: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#0f172a' : '#f8fafc',
        textMuted: isLight ? '#475569' : '#94a3b8',
        inputBg: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.5)',
        inputBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)'
    };

    const filtered = pairs.filter(p =>
        p.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.db_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.server_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group counts for summary
    const techCounts = pairs.reduce((acc, p) => {
        const key = (p.db_type || 'Unknown').toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

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
            {/* HEADER */}
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
                            background: 'none', border: 'none', color: themeStyles.textMain,
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: '8px', borderRadius: '8px',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ 
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)', 
                            padding: '8px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Server style={{ color: 'white' }} size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0 }}>
                                Server Telemetry
                            </h1>
                            <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                                Client × Technology Grid
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSync}
                    disabled={syncing}
                    style={{
                        background: syncing ? '#1d4ed8' : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                        border: 'none', borderRadius: '8px', color: 'white',
                        padding: '9px 18px', fontSize: '0.8rem', fontWeight: '700',
                        cursor: syncing ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                    }}
                >
                    <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{syncing ? 'Ingesting Mail Reports...' : 'Sync Email Telemetry'}</span>
                </button>
            </header>

            <main style={{ flex: 1, padding: '3rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
                
                {/* ALERTS */}
                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '1rem 1.5rem', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldAlert size={18} /><span>{error}</span>
                    </div>
                )}
                {syncResult && (
                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', padding: '1rem 1.5rem', borderRadius: '12px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
                            <CheckCircle size={18} /><span>Telemetry Sync Succeeded!</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', opacity: 0.9, marginLeft: '28px' }}>
                            Ingested {syncResult.mails_processed} size report emails. Inserted {syncResult.records_inserted} new records.
                        </span>
                    </div>
                )}

                {/* TECH SUMMARY PILLS */}
                {!isLoading && pairs.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {Object.entries(techCounts).map(([tech, count]) => {
                            const c = getTechColor(tech);
                            return (
                                <div key={tech} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: c.badge, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '6px 14px' }}>
                                    <Database size={12} style={{ color: c.text }} />
                                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: c.text, textTransform: 'uppercase' }}>
                                        {tech} — {count} {count === 1 ? 'client' : 'clients'}
                                    </span>
                                </div>
                            );
                        })}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '20px', padding: '6px 14px' }}>
                            <Layers size={12} style={{ color: themeStyles.textMuted }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: themeStyles.textMuted }}>
                                {pairs.length} total cards
                            </span>
                        </div>
                    </div>
                )}

                {/* SEARCH */}
                <div style={{ background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, borderRadius: '20px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Search size={18} style={{ color: themeStyles.textMuted }} />
                    <input
                        type="text"
                        placeholder="Search by client name, technology, or server..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'none', border: 'none', color: themeStyles.textMain, width: '100%', fontSize: '0.9rem', fontWeight: '500', outline: 'none' }}
                    />
                </div>

                {/* CLIENT × TECHNOLOGY GRID */}
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Client × Technology Registry</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '500', color: themeStyles.textMuted }}>({filtered.length} profiles)</span>
                    </h2>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        </div>
                    ) : filtered.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {filtered.map((pair) => {
                                const c = getTechColor(pair.db_type);
                                const cardKey = `${pair.client_name}::${pair.db_type}`;
                                return (
                                    <div
                                        key={cardKey}
                                        onClick={() => navigate(`/telemetry-client-details/${pair.server_name}?tech=${encodeURIComponent(pair.db_type)}&client=${encodeURIComponent(pair.client_name)}`)}
                                        style={{
                                            background: themeStyles.cardBg,
                                            border: `1px solid ${themeStyles.cardBorder}`,
                                            borderRadius: '16px',
                                            padding: '1.75rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.borderColor = c.text;
                                            e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.borderColor = themeStyles.cardBorder;
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        {/* Tech-colored top bar */}
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${c.from} 0%, ${c.to} 100%)` }}></div>
                                        
                                        {/* Header Row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ background: c.badge, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '7px' }}>
                                                    <Database size={18} style={{ color: c.text }} />
                                                </div>
                                                <div>
                                                    <strong style={{ fontSize: '1.05rem', fontWeight: '800', color: themeStyles.textMain, display: 'block' }}>
                                                        {pair.client_name}
                                                    </strong>
                                                    <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>
                                                        {pair.server_name}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Technology Badge */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: c.badge, border: `1px solid ${c.border}`, padding: '4px 10px', borderRadius: '20px', flexShrink: 0 }}>
                                                <TrendingUp size={10} style={{ color: c.text }} />
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {pair.db_type}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ color: themeStyles.textMuted, fontSize: '0.8rem', lineHeight: '1.5' }}>
                                            {pair.db_type} telemetry tracking active for <strong style={{ color: themeStyles.textMain }}>{pair.client_name}</strong>. Click to explore database size history and table growth analytics.
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: `1px solid ${themeStyles.cardBorder}`, paddingTop: '12px' }}>
                                            <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>View Details & Graphs</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: c.text, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>Drill Down</span>
                                                <span>&rarr;</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ background: themeStyles.cardBg, border: `1px solid ${themeStyles.cardBorder}`, borderRadius: '20px', padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <Database size={48} style={{ color: themeStyles.textMuted, opacity: 0.5 }} />
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: themeStyles.textMain, margin: '0 0 4px 0' }}>No Telemetry Data Found</h3>
                                <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, maxWidth: '460px', margin: 0 }}>
                                    No client-technology telemetry is stored yet. Click "Sync Email Telemetry" to pull and parse size reports from the monitored mailbox.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <footer style={{ textAlign: 'center', padding: '2.5rem', borderTop: themeStyles.headerBorder, color: themeStyles.textMuted, fontSize: '0.8rem', background: isLight ? '#ffffff' : 'rgba(5, 7, 16, 0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                    <CheckCircle style={{ color: '#16a34a' }} size={14} />
                    <span>Telemetry Pipeline Active — Client × Technology Mode</span>
                </div>
                <span>&copy; {new Date().getFullYear()} GeoPITS Core Console.</span>
            </footer>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default TelemetryClients;
