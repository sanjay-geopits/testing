import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import {
    ArrowLeft, RefreshCw, Clock, Calendar, Shield, Activity,
    CheckCircle2, AlertTriangle, Info, Terminal, Server
} from 'lucide-react';

export default function TelemetryClientUptime() {
    const { clientName } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme } = useTheme();
    const dark = theme !== 'light';

    // Read tech context from query params
    const searchParams = new URLSearchParams(location.search);
    const techFilter   = searchParams.get('tech') || 'MSSQL';
    const clientLabel  = searchParams.get('client') || clientName;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ latest: [], history: [] });
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUptimeData = (forceRefresh = false) => {
        setLoading(true);
        api.get(`/new-features/telemetry/uptime/${clientName}`, { params: { db_type: techFilter, refresh: forceRefresh } })
            .then(res => {
                setData(res.data || { latest: [], history: [] });
            })
            .catch(err => {
                console.error("Error fetching uptime data:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchUptimeData();
    }, [clientName, techFilter]);

    // Theme values
    const T = {
        bg:      dark ? 'radial-gradient(circle at 50% 0%,#0c0f1d,#020308)' : 'radial-gradient(circle at 50% 0%,#f1f5f9,#e2e8f0)',
        hBg:     dark ? 'rgba(5,7,16,0.85)' : 'rgba(255,255,255,0.9)',
        border:  dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
        card:    dark ? 'rgba(13,18,36,0.55)' : '#ffffff',
        text:    dark ? '#f8fafc' : '#0f172a',
        muted:   dark ? '#94a3b8' : '#475569',
        tag:     dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
        thead:   dark ? '#080b16' : '#f8fafc',
        green:   '#10b981',
        red:     '#ef4444',
        accent:  '#ec4899',
    };

    const formatDate = (isoStr) => {
        if (!isoStr) return 'N/A';
        try {
            const date = new Date(isoStr);
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch {
            return isoStr;
        }
    };

    const formatShortDate = (isoStr) => {
        if (!isoStr) return 'N/A';
        try {
            const date = new Date(isoStr);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return isoStr;
        }
    };

    const filteredHistory = data.history.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
            item.service_name.toLowerCase().includes(query) ||
            item.status.toLowerCase().includes(query) ||
            (item.server_name || '').toLowerCase().includes(query)
        );
    });

    return (
        <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: T.text, fontFamily: 'Inter, sans-serif', transition: 'all 0.3s' }}>
            
            {/* Header */}
            <header style={{ borderBottom: T.border, background: T.hBg, backdropFilter: 'blur(20px)', padding: '1rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => navigate(`/telemetry-client-details/${clientName}?tech=${encodeURIComponent(techFilter)}&client=${encodeURIComponent(clientLabel)}`)} 
                            style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                                {clientLabel} — DB Services Uptime
                            </h1>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)', color: T.accent, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {techFilter}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: T.muted, margin: '2px 0 0 0' }}>
                            Uptime, restart logs and status history for client databases
                        </p>
                    </div>
                </div>

                <button onClick={() => fetchUptimeData(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, borderRadius: 10, border: T.border, background: T.card, color: T.text, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Sync Status
                </button>
            </header>

            {/* Content Body */}
            <main style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                
                {loading && data.latest.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '0.8rem', color: T.muted }}>Reading service status records...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Section 1: Live Status Grid */}
                        <div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.25rem', color: T.text }}>
                                Active Service Status
                            </h2>
                            {data.latest.length === 0 ? (
                                <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '3rem', textAlign: 'center', color: T.muted }}>
                                    <Info size={32} style={{ margin: '0 auto 12px', color: T.accent }} />
                                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No Uptime telemetry logs found for {clientLabel}</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Check if any service status reports have been parsed for this client.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {data.latest.map((svc, idx) => {
                                        const isRunning = svc.status.toLowerCase() === 'running' || svc.status.toLowerCase() === 'online';
                                        return (
                                            <div key={idx} style={{ background: T.card, border: T.border, borderRadius: 20, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: isRunning ? T.green : T.red }} />
                                                
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: T.text, pr: 20 }}>
                                                            {svc.service_name}
                                                        </h3>
                                                        <span style={{ fontSize: '0.7rem', color: T.muted, display: 'block', marginTop: 3 }}>
                                                            Server: {svc.server_name}
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '4px 10px',
                                                        borderRadius: 20,
                                                        background: isRunning ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: isRunning ? T.green : T.red,
                                                        border: `1px solid ${isRunning ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                                                    }}>
                                                        <span style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: '50%',
                                                            background: isRunning ? T.green : T.red,
                                                            display: 'inline-block',
                                                            boxShadow: isRunning ? `0 0 8px ${T.green}` : 'none'
                                                        }} />
                                                        {svc.status}
                                                    </span>
                                                </div>

                                                <div style={{ borderTop: T.border, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: T.muted }}>Last Restart Time</span>
                                                        <span style={{ fontWeight: 600, color: T.text }}>
                                                            {formatDate(svc.last_restart_time)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: T.muted }}>Uptime Status</span>
                                                        <span style={{ fontWeight: 600, color: isRunning ? T.green : T.muted }}>
                                                            {svc.uptime_desc || 'Active'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: T.muted }}>Last Sampled</span>
                                                        <span style={{ fontWeight: 600, color: T.text }}>
                                                            {formatDate(svc.captured_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Historical Logs & Timeline */}
                        <div style={{ background: T.card, border: T.border, borderRadius: 22, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                                <div>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Activity size={18} style={{ color: T.accent }} />
                                        Historical Uptime Log
                                    </h3>
                                    <p style={{ fontSize: '0.75rem', color: T.muted, margin: '2px 0 0 0' }}>
                                        Complete checklist of parsed status report records
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', maxWidth: 360 }}>
                                    <input 
                                        type="text" 
                                        placeholder="Search logs by service or status..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 14px',
                                            fontSize: '0.8rem',
                                            borderRadius: 10,
                                            border: T.border,
                                            background: dark ? 'rgba(0,0,0,0.2)' : '#fff',
                                            color: T.text,
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto', borderRadius: 12, border: T.border }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ background: T.thead, borderBottom: T.border }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Service Name</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Server</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Status</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Last Restart Time</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: T.muted }}>Captured Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredHistory.map((row, i) => {
                                            const isRunning = row.status.toLowerCase() === 'running' || row.status.toLowerCase() === 'online';
                                            return (
                                                <tr key={i} style={{ borderBottom: T.border }}
                                                    onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.service_name}</td>
                                                    <td style={{ padding: '12px 16px', color: T.muted }}>{row.server_name}</td>
                                                    <td style={{ padding: '12px 16px' }}>
                                                        <span style={{
                                                            fontSize: '0.68rem',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: 12,
                                                            background: isRunning ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                                            color: isRunning ? T.green : T.red
                                                        }}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 16px', color: T.text }}>
                                                        {formatDate(row.last_restart_time)}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                                                        {formatShortDate(row.captured_at)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredHistory.length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: T.muted }}>
                                                    No status history logs match the filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
