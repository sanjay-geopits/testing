import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { marked } from 'marked';
import {
    Database, ArrowLeft, TrendingUp, TrendingDown, Layers, Server,
    FileSpreadsheet, Activity, Clock, Cpu, HardDrive,
    Wifi, BarChart2, Zap, Calendar, ChevronDown, ChevronUp,
    CheckCircle, AlertCircle, RefreshCw, X, Sparkles, Loader, FileText
} from 'lucide-react';

// ── Colour / accent palette per grid ──────────────────────────────────────────
const GRID_CONFIGS = [
    {
        key:    'databases',
        label:  'Database Growth',
        sub:    'Capacity Tracking Console',
        desc:   'Inspect structural database cluster trends, historical growth charts, custom time-range filtering and real-time storage metrics.',
        icon:   Database,
        color:  '#3b82f6',
        grad:   'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        bg:     'rgba(59,130,246,0.10)',
        route:  (c) => `/telemetry-client-databases/${c}`,
        live:   true,
    },
    {
        key:    'tables',
        label:  'Table Growth',
        sub:    'Tablespace Analytics Console',
        desc:   'Track detailed tablespace metrics. Top-10 heavy tables, deep-dive growth logs and specific table-level historical trends.',
        icon:   FileSpreadsheet,
        color:  '#10b981',
        grad:   'linear-gradient(135deg, #10b981 0%, #047857 100%)',
        bg:     'rgba(16,185,129,0.10)',
        route:  (c) => `/telemetry-client-tables/${c}`,
        live:   true,
    },
    {
        key:    'cpu',
        label:  'CPU Utilization',
        sub:    'Processor Analytics',
        desc:   'Monitor real-time and historical CPU processor core load levels, execution threads, and queue length telemetry.',
        icon:   Cpu,
        color:  '#f59e0b',
        grad:   'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        bg:     'rgba(245,158,11,0.10)',
        route:  null,
        live:   false,
    },
    {
        key:    'memory',
        label:  'Memory Consumption',
        sub:    'Memory Usage Stats',
        desc:   'Track RAM capacity utilization, pages cache paging operations, and swap memory execution buffer saturation.',
        icon:   Activity,
        color:  '#8b5cf6',
        grad:   'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
        bg:     'rgba(139,92,246,0.10)',
        route:  null,
        live:   false,
    },
    {
        key:    'disk',
        label:  'Disk Storage',
        sub:    'Drive Storage Analytics',
        desc:   'Track filesystem free storage limits, logical volume mounts, read/write byte rates and drive health states.',
        icon:   HardDrive,
        color:  '#ef4444',
        grad:   'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        bg:     'rgba(239,68,68,0.10)',
        route:  null,
        live:   false,
    },
    {
        key:    'iops',
        label:  'Read & Write IOPS',
        sub:    'Disk I/O Throughput',
        desc:   'Analyze drive I/O operations rate (reads and writes), sector block read operations, and device request wait times.',
        icon:   Zap,
        color:  '#06b6d4',
        grad:   'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        bg:     'rgba(6,182,212,0.10)',
        route:  null,
        live:   false,
    },
    {
        key:    'status',
        label:  'DB Uptime',
        sub:    'Active Service Monitor',
        desc:   'Check availability status of client database services, historical heartbeats, uptime duration and service state changes.',
        icon:   Wifi,
        color:  '#ec4899',
        grad:   'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        bg:     'rgba(236,72,153,0.10)',
        route:  (c) => `/telemetry-client-uptime/${c}`,
        live:   true,
    }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ── Component ─────────────────────────────────────────────────────────────────
const TelemetryClientDetails = () => {
    const { clientName } = useParams();
    const navigate       = useNavigate();
    const location       = useLocation();
    const { theme }      = useTheme();
    const isLight        = theme === 'light';

    // Read technology context from URL query params (?tech=MSSQL&client=Shemaroo)
    const searchParams  = new URLSearchParams(location.search);
    const techFilter    = searchParams.get('tech') || '';   // e.g. 'MSSQL'
    const clientLabel   = searchParams.get('client') || clientName; // display name

    const [dbCount,       setDbCount]       = useState(0);
    const [tableCount,    setTableCount]    = useState(0);
    const [isLoading,     setIsLoading]     = useState(true);
    const [uptimeStatus,  setUptimeStatus]  = useState('0/0 Services Running');

    // Last-week tabular data
    const [weekData,      setWeekData]      = useState(null);
    const [weekLoading,   setWeekLoading]   = useState(false);
    const [showWeek,      setShowWeek]      = useState(false);
    const [weekTab,       setWeekTab]       = useState('databases');   // 'databases' | 'tables'

    // Visual summary popup & AI Diagnostics
    const [showSummaryModal, setShowSummaryModal]   = useState(false);
    const [summaryLoading,   setSummaryLoading]     = useState(false);
    const [summaryData,      setSummaryData]        = useState(null);
    const [activeSummaryTab, setActiveSummaryTab]   = useState('capacity'); // 'capacity' | 'logs' | 'ai'
    const [aiLoading,        setAiLoading]          = useState(false);
    const [aiReport,         setAiReport]           = useState('');

    const hasServerMetrics = !!(
        summaryData &&
        summaryData.metrics &&
        (
            (summaryData.metrics.cpu && summaryData.metrics.cpu.length > 0) ||
            (summaryData.metrics.memory && summaryData.metrics.memory.length > 0) ||
            (summaryData.metrics.disk && summaryData.metrics.disk.length > 0) ||
            (summaryData.metrics.io && summaryData.metrics.io.length > 0)
        )
    );

    useEffect(() => {
        setIsLoading(true);
        Promise.all([
            api.get(`/new-features/telemetry/databases/${clientName}`, { params: { db_type: techFilter } }),
            api.get(`/new-features/telemetry/tables/${clientName}`, { params: { db_type: techFilter } }),
            api.get(`/new-features/telemetry/summary/${clientName}`, { params: { db_type: techFilter } }),
            api.get(`/new-features/telemetry/uptime/${clientName}`, { params: { db_type: techFilter } }).catch(() => ({ data: { latest: [] } }))
        ]).then(([dbRes, tableRes, summaryRes, uptimeRes]) => {
            setDbCount((dbRes.data.databases  || []).length);
            setTableCount((tableRes.data.tables || []).length);
            setSummaryData(summaryRes.data);
            
            const latestSvc = uptimeRes?.data?.latest || [];
            if (latestSvc.length > 0) {
                const runningCount = latestSvc.filter(s => s.status.toLowerCase() === 'running' || s.status.toLowerCase() === 'online').length;
                setUptimeStatus(`${runningCount}/${latestSvc.length} Services Running`);
            } else {
                setUptimeStatus('N/A (No Services)');
            }
        }).catch(console.error)
          .finally(() => setIsLoading(false));
    }, [clientName, techFilter]);

    const loadWeekData = () => {
        if (weekData) { setShowWeek(v => !v); return; }
        setWeekLoading(true);
        api.get(`/new-features/telemetry/last-week/${clientName}`, { params: { db_type: techFilter } })
            .then(res => {
                setWeekData(res.data);
                setShowWeek(true);
            })
            .catch(console.error)
            .finally(() => setWeekLoading(false));
    };

    const handleGridClick = (cfg) => {
        if (!cfg.live) return;
        if (cfg.route) {
            const path = cfg.route(clientName);
            const separator = path.includes('?') ? '&' : '?';
            const qs = techFilter ? `${separator}tech=${encodeURIComponent(techFilter)}&client=${encodeURIComponent(clientLabel)}` : '';
            navigate(path + qs);
        } else {
            setShowSummaryModal(true);
            setActiveSummaryTab('logs');
            if (!summaryData) {
                setSummaryLoading(true);
                api.get(`/new-features/telemetry/summary/${clientName}`, { params: { db_type: techFilter } })
                    .then(res => {
                        setSummaryData(res.data);
                        generateAiDiagnostic(res.data);
                    })
                    .catch(err => console.error(err))
                    .finally(() => setSummaryLoading(false));
            }
        }
    };

    const loadSummaryData = () => {
        setShowSummaryModal(true);
        setSummaryLoading(true);
        setActiveSummaryTab('ai'); // Default to AI Expert Diagnostics Report automatically
        api.get(`/new-features/telemetry/summary/${clientName}`, { params: { db_type: techFilter } })
            .then(res => {
                setSummaryData(res.data);
                // Automatically generate AI Diagnostic summary immediately
                generateAiDiagnostic(res.data);
            })
            .catch(err => {
                console.error("Error loading summary:", err);
                alert("Failed to load client summary metrics.");
            })
            .finally(() => setSummaryLoading(false));
    };

    const generateAiDiagnostic = (overrideData = null) => {
        const dataToUse = overrideData || summaryData;
        if (!dataToUse) return;
        setAiLoading(true);
        setAiReport('');

        const formattedLogs = [];
        
        // Add capacity text
        formattedLogs.push(`Client Name: ${clientName}`);
        formattedLogs.push(`Databases Growth Analysis:`);
        (dataToUse.databases || []).slice(0, 10).forEach(db => {
            formattedLogs.push(`- Database: ${db.name}, Size: ${formatBytes(db.latest_size)}, Today's Growth: ${formatBytes(db.growth)} (${db.growth_pct}%) | 7D Growth: ${formatBytes(db.growth_7d)} (${db.growth_7d_pct}%)`);
        });
        
        formattedLogs.push(`Top Growing Tables Analysis:`);
        (dataToUse.top_growing_tables || []).forEach(tb => {
            formattedLogs.push(`- Table: ${tb.table_name} (${tb.database_name}), Size: ${formatBytes(tb.latest_size)}, Today's Growth: ${formatBytes(tb.growth)} (${tb.growth_pct}%) | 7D Growth: ${formatBytes(tb.growth_7d)} (${tb.growth_7d_pct}%)`);
        });

        formattedLogs.push(`[Instruction] Focus EXCLUSIVELY on database capacity and tablespace growth patterns.`);

        api.post('/summarize', {
            logs: formattedLogs,
            filters: {
                start: 'Past 7 Days',
                end: 'Now',
                client: clientName
            }
        })
            .then(res => {
                setAiReport(res.data?.summary || 'No summary returned by the AI log diagnostics engine.');
            })
            .catch(err => {
                console.error("AI summarization error:", err);
                setAiReport('Failed to generate AI Diagnostic summary report: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setAiLoading(false));
    };

    // ── Theme tokens ─────────────────────────────────────────────────────────
    const T = {
        bg:          isLight ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)'
                             : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        hBg:         isLight ? 'rgba(255,255,255,0.9)'  : 'rgba(5,7,16,0.8)',
        hBorder:     isLight ? '1px solid #cbd5e1'      : '1px solid rgba(255,255,255,0.05)',
        card:        isLight ? '#ffffff'                 : 'rgba(13,18,36,0.45)',
        cardBorder:  isLight ? '1px solid #e2e8f0'      : '1px solid rgba(255,255,255,0.06)',
        text:        isLight ? '#0f172a'                 : '#f8fafc',
        muted:       isLight ? '#475569'                 : '#94a3b8',
        tag:         isLight ? '#f1f5f9'                 : 'rgba(255,255,255,0.04)',
        tableBg:     isLight ? '#f8fafc'                 : 'rgba(255,255,255,0.02)',
    };

    return (
        <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: T.text, fontFamily: 'Inter, sans-serif', transition: 'all 0.3s' }}>

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <header style={{ borderBottom: T.hBorder, background: T.hBg, backdropFilter: 'blur(20px)', padding: '1rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => navigate('/telemetry-clients')} style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Server style={{ color: 'white' }} size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px', margin: 0, color: T.text }}>
                                {clientLabel} Control Matrix
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <p style={{ fontSize: '0.72rem', color: T.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Drill-down telemetry consoles</p>
                                {techFilter && (
                                    <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {techFilter}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Visual Diagnostics summary button */}
                    <button
                        onClick={loadSummaryData}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#a855f7,#6366f1)', border: 'none', borderRadius: 10, color: 'white', padding: '9px 18px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.25)', transition: 'transform 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <Sparkles size={14} />
                        Daily Growth Summary
                    </button>

                    {/* Last-week toggle button */}
                    <button
                        onClick={loadWeekData}
                        disabled={weekLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: showWeek ? '#2563eb' : 'linear-gradient(135deg,#0ea5e9,#2563eb)', border: 'none', borderRadius: 10, color: 'white', padding: '9px 18px', fontSize: '0.8rem', fontWeight: 700, cursor: weekLoading ? 'wait' : 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                        {weekLoading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={14} />}
                        {weekLoading ? 'Loading...' : showWeek ? 'Hide Last 7 Days' : 'View Last 7 Days'}
                        {!weekLoading && (showWeek ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </button>
                </div>
            </header>

            {/* ── MAIN ───────────────────────────────────────────────────── */}
            <main style={{ flex: 1, padding: '3.5rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: 1440, width: '100%', margin: '0 auto' }}>

                {/* ── HERO TEXT ─────────────────────────────────────────── */}
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px', margin: '0 0 8px 0', background: 'linear-gradient(90deg,#3b82f6,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Monitoring Consoles
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: T.muted, margin: 0 }}>
                        Select a console below to analyse growth telemetry, performance metrics and availability status for <strong style={{ color: T.text }}>{clientLabel}</strong>
                        {techFilter && <span style={{ color: '#8b5cf6', fontWeight: 700 }}> ({techFilter})</span>}.
                    </p>
                </div>

                {/* ── LAST WEEK PANEL ───────────────────────────────────── */}
                {showWeek && weekData && (
                    <div style={{ background: T.card, border: T.cardBorder, borderRadius: 20, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.04)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <BarChart2 size={20} style={{ color: '#3b82f6' }} />
                                Last 7 Days — Tabular View
                            </h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {['databases','tables'].map(tab => (
                                    <button key={tab} onClick={() => setWeekTab(tab)} style={{ padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: weekTab === tab ? '#3b82f6' : T.tag, color: weekTab === tab ? 'white' : T.text, transition: 'all 0.2s' }}>
                                        {tab === 'databases' ? `Databases (${weekData.databases_last_week.length})` : `Tables (${weekData.tables_last_week.length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', borderRadius: 12, border: T.cardBorder }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: T.tableBg }}>
                                        {weekTab === 'databases' ? (
                                            <>
                                                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Database</th>
                                                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Date</th>
                                                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Size</th>
                                            </>
                                        ) : (
                                            <>
                                                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Database</th>
                                                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Table</th>
                                                <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Date</th>
                                                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 700, color: T.muted, fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: T.hBorder }}>Size</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {weekTab === 'databases'
                                        ? weekData.databases_last_week.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: T.hBorder }}
                                                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.database_name}</td>
                                                <td style={{ padding: '12px 16px', color: T.muted }}>{r.captured_date}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{formatBytes(r.size_bytes)}</td>
                                            </tr>
                                        ))
                                        : weekData.tables_last_week.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: T.hBorder }}
                                                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                                <td style={{ padding: '12px 16px', color: T.muted }}>{r.database_name}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.table_name}</td>
                                                <td style={{ padding: '12px 16px', color: T.muted }}>{r.captured_date}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatBytes(r.size_bytes)}</td>
                                            </tr>
                                        ))
                                    }
                                    {(weekTab === 'databases' ? weekData.databases_last_week : weekData.tables_last_week).length === 0 && (
                                        <tr>
                                            <td colSpan={weekTab === 'databases' ? 3 : 4} style={{ padding: '2.5rem', textAlign: 'center', color: T.muted }}>
                                                No records found for the last 7 days.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── CONSOLE GRID ──────────────────────────────────────── */}
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.75rem' }}>
                        {GRID_CONFIGS.map(cfg => {
                            const Icon     = cfg.icon;
                            const isLive   = cfg.live;
                            const count    = !isLive                 ? 'Coming Soon'
                                           : cfg.key === 'databases' ? `${dbCount} Databases`
                                           : cfg.key === 'tables'    ? `${tableCount} Tables`
                                           : cfg.key === 'status'    ? uptimeStatus
                                           : cfg.badge || 'Active';
                            return (
                                <div
                                    key={cfg.key}
                                    onClick={() => handleGridClick(cfg)}
                                    style={{
                                        background: T.card,
                                        border: T.cardBorder,
                                        borderRadius: 22,
                                        padding: '2rem',
                                        cursor: isLive ? 'pointer' : 'default',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 20,
                                        transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        opacity: isLive ? 1 : 0.72,
                                        boxShadow: isLight ? '0 6px 20px rgba(0,0,0,0.02)' : 'none'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isLive) return;
                                        e.currentTarget.style.transform   = 'translateY(-5px)';
                                        e.currentTarget.style.borderColor = cfg.color;
                                        e.currentTarget.style.boxShadow   = isLight ? `0 16px 40px rgba(0,0,0,0.07)` : `0 16px 48px rgba(0,0,0,0.4)`;
                                    }}
                                    onMouseLeave={e => {
                                        if (!isLive) return;
                                        e.currentTarget.style.transform   = 'translateY(0)';
                                        e.currentTarget.style.borderColor = '';
                                        e.currentTarget.style.boxShadow   = isLight ? '0 6px 20px rgba(0,0,0,0.02)' : 'none';
                                    }}
                                >
                                    {/* Top accent bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: cfg.grad }} />

                                    {/* Icon row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ background: cfg.bg, padding: 14, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={28} style={{ color: cfg.color }} />
                                        </div>
                                        <span style={{ fontSize: '0.7rem', background: cfg.bg, color: cfg.color, padding: '5px 13px', borderRadius: 30, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {count}
                                        </span>
                                    </div>

                                    {/* Text */}
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: T.text, margin: '0 0 8px 0' }}>{cfg.label}</h3>
                                        <p  style={{ fontSize: '0.83rem', color: T.muted, margin: 0, lineHeight: 1.65 }}>{cfg.desc}</p>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: T.hBorder, paddingTop: 16, marginTop: 4 }}>
                                        <span style={{ fontSize: '0.75rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {isLive
                                                ? <><CheckCircle size={13} style={{ color: '#16a34a' }} />{cfg.sub}</>
                                                : <><AlertCircle size={13} style={{ color: '#f59e0b' }} />Coming Soon</>
                                            }
                                        </span>
                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: isLive ? cfg.color : T.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {isLive ? <><span>Enter</span><span>→</span></> : <span style={{ fontSize: '0.7rem' }}>Coming Soon</span>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ── DIAGNOSTICS & AI SUMMARY MODAL ───────────────────────── */}
            {showSummaryModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: 20 }}>
                    <div style={{ background: T.card, border: T.cardBorder, width: '100%', maxWidth: '1000px', height: '85vh', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', animation: 'fadeIn 0.25s ease-out' }}>
                        {/* Modal Header */}
                        <div style={{ padding: '1.5rem 2rem', borderBottom: T.hBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Sparkles style={{ color: 'white' }} size={18} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: T.text }}>{clientName} Daily Growth Summary</h2>
                                    <p style={{ fontSize: '0.72rem', color: T.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily capacity change status</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSummaryModal(false)} style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', color: T.text, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Tabs Bar */}
                        <div style={{ display: 'flex', borderBottom: T.hBorder, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.01)', padding: '0 2rem' }}>
                            {[
                                { id: 'capacity', label: 'Capacity & Tables Growth', icon: Database },
                                { id: 'ai', label: 'Expert Diagnostics Report', icon: Sparkles }
                            ].map(tab => {
                                const IconObj = tab.icon;
                                const isActive = activeSummaryTab === tab.id;
                                return (
                                    <button key={tab.id} onClick={() => setActiveSummaryTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 1.5rem', background: 'none', border: 'none', borderBottom: isActive ? '3px solid #6366f1' : '3px solid transparent', color: isActive ? '#6366f1' : T.muted, fontWeight: isActive ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <IconObj size={14} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Body Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            {summaryLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                                    <Loader size={32} style={{ color: '#6366f1', animation: 'spin 1.5s linear infinite' }} />
                                    <p style={{ fontSize: '0.85rem', color: T.muted }}>Gathering client capacity data, database metrics, and server telemetry...</p>
                                </div>
                            ) : !summaryData ? (
                                <div style={{ textAlign: 'center', padding: '3rem 0', color: T.muted }}>No client metrics data found.</div>
                            ) : (
                                <>
                                    {/* ── TAB 1: CAPACITY & TABLES ────────────────────────────── */}
                                    {activeSummaryTab === 'capacity' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                            <div>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: T.text, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Database size={16} style={{ color: '#3b82f6' }} /> Database Capacity Growth
                                                </h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                                    {(summaryData.databases || []).map((db, idx) => (
                                                        <div key={idx} style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', border: T.cardBorder, borderRadius: 16, padding: '1.25rem', position: 'relative' }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, color: T.text }}>{db.name}</div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                 <div>
                                                                    <div style={{ fontSize: '0.7rem', color: T.muted }}>Current Size</div>
                                                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#3b82f6' }}>{formatBytes(db.latest_size)}</div>
                                                                 </div>
                                                                 <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontSize: '0.7rem', color: T.muted }}>Today's Growth</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: '0.85rem', fontWeight: 700, color: db.growth > 0 ? '#ef4444' : db.growth < 0 ? '#10b981' : T.muted, marginBottom: 4 }}>
                                                                        {db.growth > 0 ? <TrendingUp size={12} /> : db.growth < 0 ? <TrendingDown size={12} /> : null}
                                                                        {formatBytes(db.growth)} ({db.growth_pct}%)
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', color: T.muted }}>7D Growth</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: db.growth_7d > 0 ? '#f43f5e' : db.growth_7d < 0 ? '#10b981' : T.muted }}>
                                                                        {db.growth_7d > 0 ? '+' : ''}{formatBytes(db.growth_7d)} ({db.growth_7d_pct}%)
                                                                    </div>
                                                                 </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(summaryData.databases || []).length === 0 && (
                                                        <div style={{ gridColumn: '1/-1', color: T.muted, textAlign: 'center', padding: '1rem' }}>No database metrics captured.</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: T.text, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FileSpreadsheet size={16} style={{ color: '#10b981' }} /> Top 10 Growing Tables
                                                </h3>
                                                <div style={{ overflowX: 'auto', borderRadius: 16, border: T.cardBorder }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                        <thead>
                                                            <tr style={{ background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)' }}>
                                                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Database</th>
                                                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: T.muted }}>Table</th>
                                                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: T.muted }}>Latest Size</th>
                                                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: T.muted }}>Today's Growth</th>
                                                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: T.muted }}>7D Growth</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(summaryData.top_growing_tables || []).map((tb, idx) => (
                                                                <tr key={idx} style={{ borderBottom: T.hBorder }}>
                                                                    <td style={{ padding: '12px 16px', color: T.muted }}>{tb.database_name}</td>
                                                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{tb.table_name}</td>
                                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatBytes(tb.latest_size)}</td>
                                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tb.growth > 0 ? '#ef4444' : tb.growth < 0 ? '#10b981' : T.muted }}>
                                                                        {tb.growth > 0 ? '+' : ''}{formatBytes(tb.growth)} ({tb.growth_pct}%)
                                                                    </td>
                                                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tb.growth_7d > 0 ? '#f43f5e' : tb.growth_7d < 0 ? '#10b981' : T.muted }}>
                                                                        {tb.growth_7d > 0 ? '+' : ''}{formatBytes(tb.growth_7d)} ({tb.growth_7d_pct}%)
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {(summaryData.top_growing_tables || []).length === 0 && (
                                                                <tr>
                                                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: T.muted }}>No table growth telemetry captured.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── TAB 3: AI DIAGNOSTICS REPORT GENERATOR ─────────────── */}
                                    {activeSummaryTab === 'ai' && (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            {!aiReport && !aiLoading ? (
                                                <div style={{ margin: 'auto', maxWidth: 600, textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                                    <div style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', padding: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Sparkles style={{ color: 'white' }} size={40} />
                                                    </div>
                                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: T.text }}>Generate Expert Growth Diagnostics</h3>
                                                    <p style={{ fontSize: '0.83rem', color: T.muted, lineHeight: 1.6 }}>
                                                        {"Our expert growth diagnostics engine will analyze the complete capacity history and top growing tables for " + clientName + " to construct a comprehensive capacity health assessment, flag rapid storage growth trends, and provide actionable tuning recommendations."}
                                                    </p>
                                                    <button onClick={generateAiDiagnostic} style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', border: 'none', borderRadius: 12, color: 'white', padding: '12px 28px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                                        <Sparkles size={16} />
                                                        Trigger Diagnostics Analysis
                                                    </button>
                                                </div>
                                            ) : aiLoading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, margin: 'auto' }}>
                                                    <Loader size={36} style={{ color: '#a855f7', animation: 'spin 1.5s linear infinite' }} />
                                                    <p style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 600 }}>Analyzing structural capacity history, performance logs, and drafting expert tuning guidelines...</p>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.8rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <CheckCircle size={14} style={{ color: '#16a34a' }} />
                                                            Diagnostics Analysis Complete
                                                        </span>
                                                        <button onClick={generateAiDiagnostic} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <RefreshCw size={12} /> Re-generate Analysis
                                                        </button>
                                                    </div>
                                                    <div className="markdown-body" style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', border: T.cardBorder, borderRadius: 16, padding: '2rem', fontSize: '0.88rem', lineHeight: 1.7, color: T.text, overflowY: 'auto' }}
                                                         dangerouslySetInnerHTML={{ __html: marked(aiReport) }} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '1rem 2rem', borderTop: T.hBorder, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowSummaryModal(false)} style={{ padding: '8px 20px', borderRadius: 10, border: T.cardBorder, background: isLight ? '#ffffff' : 'rgba(255,255,255,0.04)', color: T.text, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'}>
                                Close Diagnostics Window
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer style={{ textAlign: 'center', padding: '2rem 2.5rem', borderTop: T.hBorder, color: T.muted, fontSize: '0.8rem', background: isLight ? '#ffffff' : 'rgba(5,7,16,0.4)', marginTop: 'auto' }}>
                <span>© {new Date().getFullYear()} GeoPITS Core Console · {clientLabel}{techFilter ? ` (${techFilter})` : ''} Telemetry Platform Active</span>
            </footer>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default TelemetryClientDetails;
