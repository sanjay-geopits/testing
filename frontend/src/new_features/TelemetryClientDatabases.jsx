import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import {
    Database, ArrowLeft, TrendingUp, TrendingDown,
    Calendar, RefreshCw, Search, LineChart, Activity, Info, Download
} from 'lucide-react';

/* ── helpers ── */
const fmt = (bytes) => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
};
const fmtPct = (p) => {
    if (!p && p !== 0) return '—';
    return (p > 0 ? '+' : '') + p.toFixed(2) + '%';
};
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
};

/* ── quick-range presets ── */
const PRESETS = [
    { label: '7D',  days: 6 },
    { label: '14D', days: 13 },
];

export default function TelemetryClientDatabases() {
    const { clientName } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme } = useTheme();
    const dark = theme !== 'light';

    // Read technology context from URL query params
    const searchParams = new URLSearchParams(location.search);
    const techFilter   = searchParams.get('tech') || '';
    const clientLabel  = searchParams.get('client') || clientName;
    const techQS       = techFilter ? `?tech=${encodeURIComponent(techFilter)}&client=${encodeURIComponent(clientLabel)}` : '';

    /* summary list (latest size + 7d growth per DB) */
    const [summary, setSummary]       = useState([]);
    const [sumLoading, setSumLoading] = useState(true);

    /* pivot / range table */
    const [fromDate, setFromDate]     = useState(daysAgo(6));
    const [toDate,   setToDate]       = useState(today());
    const [pivot,    setPivot]        = useState(null);
    const [pivotLoading, setPivotLoading] = useState(false);
    const [search,   setSearch]       = useState('');
    const [showEverydayChanges, setShowEverydayChanges] = useState(false);

    /* chart */
    const [selDb,    setSelDb]        = useState('');
    const [chart,    setChart]        = useState([]);
    const [chartLoading, setChartLoading] = useState(false);

    /* ── theme tokens ── */
    const T = {
        bg:      dark ? 'radial-gradient(circle at 50% 0%,#0c0f1d,#020308)' : 'radial-gradient(circle at 50% 0%,#f1f5f9,#e2e8f0)',
        hBg:     dark ? 'rgba(5,7,16,0.85)'     : 'rgba(255,255,255,0.9)',
        border:  dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
        card:    dark ? 'rgba(13,18,36,0.55)'   : '#ffffff',
        text:    dark ? '#f8fafc'  : '#0f172a',
        muted:   dark ? '#94a3b8' : '#475569',
        tag:     dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
        thead:   dark ? '#080b16' : '#f8fafc',
        accent:  '#3b82f6',
    };

    /* ── load summary ── */
    useEffect(() => {
        setSumLoading(true);
        api.get(`/new-features/telemetry/databases/${clientName}`, { params: { db_type: techFilter } })
            .then(r => {
                const dbs = r.data.databases || [];
                setSummary(dbs);
                if (dbs.length) setSelDb(dbs[0].database_name);
            })
            .catch(console.error)
            .finally(() => setSumLoading(false));
    }, [clientName, techFilter]);

    /* ── load pivot ── */
    const loadPivot = useCallback(() => {
        setPivotLoading(true);
        api.get(`/new-features/telemetry/range-data/${clientName}`, {
            params: { data_type: 'databases', from_date: fromDate, to_date: toDate, db_type: techFilter }
        })
            .then(r => setPivot(r.data))
            .catch(console.error)
            .finally(() => setPivotLoading(false));
    }, [clientName, fromDate, toDate, techFilter]);

    useEffect(() => { loadPivot(); }, [loadPivot]);

    /* ── load chart ── */
    useEffect(() => {
        if (!selDb) return;
        setChartLoading(true);
        api.get(`/new-features/telemetry/database-detail-chart`, {
            params: { client_name: clientName, database_name: selDb, db_type: techFilter }
        })
            .then(r => {
                const raw = (r.data.chart_data || []).sort((a, b) => new Date(a.date) - new Date(b.date));
                const cut = new Date(fromDate);
                setChart(raw.filter(d => new Date(d.date) >= cut));
            })
            .catch(console.error)
            .finally(() => setChartLoading(false));
    }, [selDb, fromDate, clientName, techFilter]);

    const applyPreset = (days) => { setFromDate(daysAgo(days)); setToDate(today()); };

    /* ── SVG chart ── */
    const renderChart = (data) => {
        if (!data || !data.length) return (
            <div style={{ padding: '4rem', textAlign: 'center', color: T.muted, fontSize: '0.85rem' }}>
                <Info size={22} style={{ display: 'block', margin: '0 auto 8px' }} />
                No data for the selected range.
            </div>
        );
        const W = 820, H = 280, P = 52;
        const sizes = data.map(d => +d.size_bytes);
        const mn = Math.min(...sizes), mx = Math.max(...sizes), rng = mx - mn || 1;
        const pts = data.map((d, i) => ({
            x: P + (i / (data.length - 1 || 1)) * (W - 2 * P),
            y: H - P - ((+d.size_bytes - mn) / rng) * (H - 2 * P),
            date: d.date, size: +d.size_bytes
        }));
        const path = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
        const area = pts.length > 1 ? `${path} L${pts.at(-1).x} ${H - P} L${pts[0].x} ${H - P} Z` : '';
        return (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', minWidth: 600 }}>
                <defs>
                    <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity=".45" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[P, H / 2, H - P].map(y => (
                    <line key={y} x1={P} y1={y} x2={W - P} y2={y}
                        stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}
                        strokeDasharray={y === H - P ? '0' : '4,4'} />
                ))}
                {area && <path d={area} fill="url(#dbGrad)" />}
                {path && <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                ))}
            </svg>
        );
    };

    /* ── pivot table filtered rows ── */
    const pivotDates = pivot?.dates || [];
    const rawPivotRows = (pivot?.rows || [])
        .filter(r => !search || r.database_name.toLowerCase().includes(search.toLowerCase()))
        .map(r => {
            const vals = pivotDates.map(d => r.values[d] ?? null);
            const def = vals.filter(v => v !== null);
            const growth = def.length > 1 ? (def.at(-1) - def[0]) : 0;
            const first = def[0] ?? 0;
            const growthPct = first > 0 ? (growth / first * 100) : 0.0;
            return { ...r, vals, def, growth, growthPct };
        });

    const sortedPivotRows = [...rawPivotRows].sort((a, b) => {
        const aVal = a.growthPct;
        const bVal = b.growthPct;
        
        const aGroup = aVal > 0 ? 1 : (aVal === 0 ? 0 : -1);
        const bGroup = bVal > 0 ? 1 : (bVal === 0 ? 0 : -1);
        
        if (aGroup !== bGroup) {
            return bGroup - aGroup;
        }
        return bVal - aVal;
    });

    /* ── summary totals ── */
    const totalSize   = summary.reduce((a, r) => a + (r.latest_size  || 0), 0);
    const totalGrowth = summary.reduce((a, r) => a + (r.growth_bytes || 0), 0);

    /* ── CSV exports ── */
    const exportPivotCSV = () => {
        if (!pivotDates.length) return;
        const header = ['Database', ...pivotDates, 'Growth', 'Growth %'];
        const rows = sortedPivotRows.map(r => [
            r.database_name,
            ...r.vals.map(v => v !== null ? fmt(v) : ''),
            r.growth !== 0 ? fmt(Math.abs(r.growth)) : '',
            r.growthPct !== 0 ? r.growthPct.toFixed(2) + '%' : ''
        ]);
        const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${clientName}_db_pivot_${fromDate}_to_${toDate}.csv`; a.click();
    };
    const exportSummaryCSV = () => {
        if (!summary.length) return;
        const header = ['Database', 'Latest Date', 'Today Size', 'Last 7D Avg', 'Avg Growth', 'Avg Growth %'];
        const rows = summary.map(db => [
            db.database_name, db.latest_date?.slice(0,10) || '',
            fmt(db.latest_size), db.avg_size_7d !== null ? fmt(db.avg_size_7d) : '',
            db.avg_growth_bytes !== null && db.avg_growth_bytes !== 0 ? fmt(db.avg_growth_bytes) : 'No change',
            db.avg_growth_pct !== null ? fmtPct(db.avg_growth_pct) : ''
        ]);
        const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${clientName}_db_summary_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    };

    return (
        <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: T.text, fontFamily: 'Inter,sans-serif' }}>

            {/* HEADER */}
            <header style={{ background: T.hBg, borderBottom: T.border, backdropFilter: 'blur(20px)', padding: '1rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => navigate(`/telemetry-client-details/${clientName}${techQS}`)}
                        style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: 8, borderRadius: 8 }}
                        onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'grid', placeItems: 'center' }}>
                        <Database size={20} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                            {clientLabel} — Database Growth
                            {techFilter && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', textTransform: 'uppercase', marginLeft: 10 }}>
                                    {techFilter}
                                </span>
                            )}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: T.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Capacity Telemetry</p>
                    </div>
                </div>
            </header>

            <main style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 1500, width: '100%', margin: '0 auto' }}>

                {sumLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (<>

                    {/* ── STATS ROW ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem' }}>
                        {[
                            { label: 'Total Databases',  val: summary.length, color: '#3b82f6' },
                            { label: 'Combined Size',    val: fmt(totalSize), color: '#06b6d4' },
                            { label: 'Net Growth (Range)', val: fmt(totalGrowth), color: totalGrowth >= 0 ? '#10b981' : '#ef4444' },
                            { label: 'Date Range',       val: `${fromDate} → ${toDate}`, color: T.muted },
                        ].map(s => (
                            <div key={s.label} style={{ background: T.card, border: T.border, borderRadius: 16, padding: '1.4rem 1.5rem' }}>
                                <div style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.label}</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── DATE RANGE PICKER ── */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 16, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                        <Calendar size={18} style={{ color: T.accent }} />
                        <strong style={{ fontSize: '0.85rem' }}>Date Range:</strong>

                        {/* Presets */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {PRESETS.map(p => (
                                <button key={p.label} onClick={() => applyPreset(p.days)}
                                    style={{ padding: '5px 13px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: (fromDate === daysAgo(p.days) && toDate === today()) ? '#3b82f6' : T.tag, color: (fromDate === daysAgo(p.days) && toDate === today()) ? 'white' : T.text, transition: 'all 0.2s' }}>
                                    Past {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom pickers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.8rem', color: T.muted }}>From</span>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '5px 10px', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }} />
                            <span style={{ fontSize: '0.8rem', color: T.muted }}>To</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '5px 10px', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }} />
                            <button onClick={loadPivot} disabled={pivotLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#3b82f6', border: 'none', color: 'white', borderRadius: 8, padding: '6px 16px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                <RefreshCw size={13} style={{ animation: pivotLoading ? 'spin 1s linear infinite' : 'none' }} />
                                Apply
                            </button>
                        </div>
                    </div>

                    {/* ── PIVOT TABLE ── */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Database size={18} style={{ color: T.accent }} />
                                Daily Size Matrix — {fromDate} to {toDate}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    onClick={() => setShowEverydayChanges(!showEverydayChanges)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        background: showEverydayChanges ? T.accent : T.tag,
                                        border: T.border,
                                        color: showEverydayChanges ? 'white' : T.text,
                                        borderRadius: 8,
                                        padding: '5px 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Activity size={13} />
                                    {showEverydayChanges ? "Showing Everyday Changes" : "Show Everyday Changes"}
                                </button>
                                <button onClick={exportPivotCSV} disabled={!pivotDates.length}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                    <Download size={13} /> Export CSV
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.tag, border: T.border, borderRadius: 8, padding: '5px 12px' }}>
                                    <Search size={13} style={{ color: T.muted }} />
                                    <input type="text" placeholder="Filter databases..." value={search} onChange={e => setSearch(e.target.value)}
                                        style={{ background: 'none', border: 'none', color: T.text, fontSize: '0.8rem', outline: 'none', width: 180 }} />
                                </div>
                            </div>
                        </div>

                        {pivotLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            </div>
                        ) : pivotDates.length === 0 ? (
                            <div style={{ padding: '4rem', textAlign: 'center', color: T.muted, fontSize: '0.85rem' }}>
                                No records found for the selected date range.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr style={{ background: T.thead }}>
                                            <th style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: T.border, position: 'sticky', left: 0, background: T.thead, zIndex: 15, boxShadow: '2px 0 5px rgba(0,0,0,0.05)', minWidth: 200 }}>
                                                Database
                                            </th>
                                            {pivotDates.map(d => (
                                                <th key={d} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: T.accent, fontSize: '0.7rem', borderBottom: T.border, minWidth: 100 }}>
                                                    {d.slice(5)}
                                                </th>
                                            ))}
                                            <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#f59e0b', fontSize: '0.7rem', borderBottom: T.border, minWidth: 100 }}>
                                                Growth
                                            </th>
                                            <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#3b82f6', fontSize: '0.7rem', borderBottom: T.border, minWidth: 100 }}>
                                                Growth %
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedPivotRows.map((row, ri) => {
                                            const { vals, def, growth, growthPct } = row;
                                            const isSelected = selDb === row.database_name;
                                            return (
                                                <tr key={ri}
                                                    style={{ borderBottom: T.border, background: isSelected ? (dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)') : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                    onClick={() => setSelDb(row.database_name)}
                                                    onMouseEnter={e => {
                                                        if (!isSelected) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : '#f8fafc';
                                                        const stickyCell = e.currentTarget.cells[0];
                                                        if (stickyCell) stickyCell.style.background = isSelected ? (dark ? '#182449' : '#eef2ff') : (dark ? '#13192f' : '#f8fafc');
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isSelected) e.currentTarget.style.background = 'none';
                                                        const stickyCell = e.currentTarget.cells[0];
                                                        if (stickyCell) stickyCell.style.background = isSelected ? (dark ? '#141d3c' : '#f0f4ff') : (dark ? '#0d1224' : '#fff');
                                                    }}>
                                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: T.text, position: 'sticky', left: 0, background: isSelected ? (dark ? '#141d3c' : '#f0f4ff') : (dark ? '#0d1224' : '#fff'), zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.05)', transition: 'background 0.15s', minWidth: 200 }}>
                                                        {row.database_name}
                                                    </td>
                                                    {vals.map((v, vi) => {
                                                        if (showEverydayChanges) {
                                                            const prevVal = vi > 0 ? vals[vi - 1] : null;
                                                            if (v !== null && prevVal !== null) {
                                                                const dayDiff = v - prevVal;
                                                                const dayPct = prevVal > 0 ? (dayDiff / prevVal * 100) : 0;
                                                                const tc = dayDiff > 0 ? '#10b981' : dayDiff < 0 ? '#ef4444' : T.muted;
                                                                return (
                                                                    <td key={vi} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: tc }}>
                                                                        {dayDiff > 0 ? '+' : ''}{fmt(dayDiff)} ({dayDiff > 0 ? '+' : ''}{dayPct.toFixed(2)}%)
                                                                    </td>
                                                                );
                                                            }
                                                            return <td key={vi} style={{ padding: '12px 14px', textAlign: 'right', color: T.muted }}>—</td>;
                                                        }
                                                        return (
                                                            <td key={vi} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: v ? 600 : 400, color: v ? T.text : T.muted }}>
                                                                {v !== null ? fmt(v) : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: growth > 0 ? '#10b981' : growth < 0 ? '#ef4444' : T.muted }}>
                                                        {growth !== 0 ? ((growth > 0 ? '+' : '') + fmt(Math.abs(growth))) : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: growthPct > 0 ? '#10b981' : growthPct < 0 ? '#ef4444' : T.muted }}>
                                                        {growthPct !== 0 ? ((growthPct > 0 ? '+' : '') + growthPct.toFixed(2) + '%') : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── SUMMARY TABLE ── */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Activity size={18} style={{ color: T.accent }} />
                            Database Summary &amp; Average Growth
                            <div style={{ marginLeft: 'auto', display: 'flex' }}>
                                <button onClick={exportSummaryCSV} disabled={!summary.length}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                    <Download size={13} /> Export CSV
                                </button>
                            </div>
                        </h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: T.thead }}>
                                        {[
                                            { label: 'Database',     w: '20%', align: 'left' },
                                            { label: 'Latest Date',  w: '12%', align: 'left' },
                                            { label: 'Today Size',   w: '14%', align: 'right' },
                                            { label: 'Last 7D Avg',  w: '14%', align: 'right' },
                                            { label: 'Avg Growth',   w: '14%', align: 'right' },
                                            { label: 'Avg Growth %', w: '14%', align: 'right' },
                                            { label: 'Chart',        w: '12%', align: 'right' }
                                        ].map(h => (
                                            <th key={h.label} style={{ width: h.w, padding: '11px 16px', textAlign: h.align, fontWeight: 700, color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: T.border }}>{h.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.map(db => {
                                        const hasAvg = db.avg_size_7d !== null;
                                        const neg = (db.avg_growth_bytes || 0) < 0, pos = (db.avg_growth_bytes || 0) > 0;
                                        const tc  = neg ? '#ef4444' : pos ? '#10b981' : T.muted;
                                        const sel = selDb === db.database_name;
                                        return (
                                            <tr key={db.database_name} onClick={() => setSelDb(db.database_name)}
                                                style={{ borderBottom: T.border, cursor: 'pointer', background: sel ? (dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)') : 'none', transition: 'background 0.15s' }}
                                                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : '#f8fafc'; }}
                                                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'none'; }}>
                                                <td style={{ width: '20%', padding: '14px 16px', fontWeight: 700, textAlign: 'left' }}>{db.database_name}</td>
                                                <td style={{ width: '12%', padding: '14px 16px', color: T.muted, textAlign: 'left' }}>{db.latest_date?.slice(0, 10) || '—'}</td>
                                                <td style={{ width: '14%', padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>{fmt(db.latest_size)}</td>
                                                <td style={{ width: '14%', padding: '14px 16px', color: T.muted, textAlign: 'right' }}>{hasAvg ? fmt(db.avg_size_7d) : '—'}</td>
                                                <td style={{ width: '14%', padding: '14px 16px', color: tc, fontWeight: 600, textAlign: 'right' }}>
                                                    {!hasAvg ? '—' : db.avg_growth_bytes === 0 ? 'No change' : fmt(db.avg_growth_bytes)}
                                                </td>
                                                <td style={{ width: '14%', padding: '14px 16px', textAlign: 'right' }}>
                                                    {hasAvg ? (
                                                        <span style={{ background: neg ? 'rgba(239,68,68,0.1)' : pos ? 'rgba(16,185,129,0.1)' : T.tag, color: tc, padding: '3px 9px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                                            {pos && <TrendingUp size={10} />}{neg && <TrendingDown size={10} />}
                                                            {fmtPct(db.avg_growth_pct)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ width: '12%', padding: '14px 16px', textAlign: 'right' }}>
                                                    <button style={{ background: sel ? '#3b82f6' : 'none', border: sel ? 'none' : T.border, color: sel ? 'white' : T.text, borderRadius: 6, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                                                        {sel ? '▶ Viewing' : 'Select'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── CHART ── */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <LineChart size={18} style={{ color: T.accent }} />
                                Growth Trend: <span style={{ color: T.accent, marginLeft: 6 }}>{selDb}</span>
                            </h2>
                            <span style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.1)', color: T.accent, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                                {fromDate} → {toDate}
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto', paddingTop: 8 }}>
                            {chartLoading
                                ? <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
                                : renderChart(chart)
                            }
                        </div>
                    </div>

                </>)}
            </main>

            <footer style={{ textAlign: 'center', padding: '1.5rem', borderTop: T.border, color: T.muted, fontSize: '0.78rem', background: dark ? 'rgba(5,7,16,0.4)' : '#fff' }}>
                © {new Date().getFullYear()} GeoPITS Core Console · {clientLabel}{techFilter ? ` (${techFilter})` : ''} Database Telemetry
            </footer>

            <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
        </div>
    );
}
