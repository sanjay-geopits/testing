import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import {
    FileSpreadsheet, ArrowLeft, TrendingUp, TrendingDown,
    Calendar, RefreshCw, Search, BarChart3, Layers, Info, Activity, Download
} from 'lucide-react';

/* ── helpers ── */
const fmt = (bytes) => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
};
const fmtPct = (p) => (!p && p !== 0) ? '—' : (p > 0 ? '+' : '') + p.toFixed(2) + '%';
const today  = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const PRESETS = [
    { label: '7D',  days: 6 },
    { label: '14D', days: 13 },
];

export default function TelemetryClientTables() {
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

    const [tables,     setTables]     = useState([]);
    const [sumLoading, setSumLoading] = useState(true);
    const [search,     setSearch]     = useState('');
    const [dbFilter,   setDbFilter]   = useState('');

    /* pivot */
    const [fromDate, setFromDate]       = useState(daysAgo(6));
    const [toDate,   setToDate]         = useState(today());
    const [pivot,    setPivot]          = useState(null);
    const [pivotLoading, setPivotLoading] = useState(false);
    const [pivotSearch, setPivotSearch] = useState('');
    const [pivotDbFilter, setPivotDbFilter] = useState('');
    const [showEverydayChanges, setShowEverydayChanges] = useState(false);

    /* ── theme ── */
    const T = {
        bg:     dark ? 'radial-gradient(circle at 50% 0%,#0c0f1d,#020308)' : 'radial-gradient(circle at 50% 0%,#f1f5f9,#e2e8f0)',
        hBg:    dark ? 'rgba(5,7,16,0.85)' : 'rgba(255,255,255,0.9)',
        border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
        card:   dark ? 'rgba(13,18,36,0.55)' : '#ffffff',
        text:   dark ? '#f8fafc' : '#0f172a',
        muted:  dark ? '#94a3b8' : '#475569',
        tag:    dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
        thead:  dark ? '#080b16' : '#f8fafc',
        accent: '#10b981',
    };

    /* ── load summary ── */
    useEffect(() => {
        setSumLoading(true);
        api.get(`/new-features/telemetry/tables/${clientName}`, { params: { db_type: techFilter } })
            .then(r => setTables(r.data.tables || []))
            .catch(console.error)
            .finally(() => setSumLoading(false));
    }, [clientName, techFilter]);

    /* ── load pivot ── */
    const loadPivot = useCallback(() => {
        setPivotLoading(true);
        api.get(`/new-features/telemetry/range-data/${clientName}`, {
            params: { data_type: 'tables', from_date: fromDate, to_date: toDate, db_type: techFilter }
        })
            .then(r => setPivot(r.data))
            .catch(console.error)
            .finally(() => setPivotLoading(false));
    }, [clientName, fromDate, toDate, techFilter]);

    useEffect(() => { loadPivot(); }, [loadPivot]);

    const applyPreset = (days) => { setFromDate(daysAgo(days)); setToDate(today()); };

    /* ── computed ── */
    const sortedBySize = [...tables].sort((a, b) => (b.latest_size || 0) - (a.latest_size || 0));
    const top10        = sortedBySize.slice(0, 10);
    const maxSize      = top10.length ? top10[0].latest_size || 1 : 1;

    const uniqueDbs = [...new Set(tables.map(t => t.database_name))].sort();

    const filteredSummary = tables.filter(t =>
        (!dbFilter || t.database_name === dbFilter) &&
        (!search || t.table_name.toLowerCase().includes(search.toLowerCase()) || t.database_name.toLowerCase().includes(search.toLowerCase()))
    );

    const pivotDates = pivot?.dates || [];
    
    // Map pivot rows to include computed growth and growth percentage
    const rawPivotRows = (pivot?.rows || [])
        .filter(r =>
            (!pivotDbFilter || r.database_name === pivotDbFilter) &&
            (!pivotSearch || r.table_name?.toLowerCase().includes(pivotSearch.toLowerCase()) || r.database_name?.toLowerCase().includes(pivotSearch.toLowerCase()))
        )
        .map(r => {
            const vals = pivotDates.map(d => r.values[d] ?? null);
            const def = vals.filter(v => v !== null);
            const growth = def.length > 1 ? (def.at(-1) - def[0]) : 0;
            const first = def[0] ?? 0;
            const growthPct = first > 0 ? (growth / first * 100) : 0.0;
            return { ...r, vals, def, growth, growthPct };
        });

    // Sort pivot rows: Positive growth percentage first (descending), then zero, then negative last
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

    /* ── CSV exports ── */
    const exportPivotCSV = () => {
        if (!pivotDates.length) return;
        const header = ['Table', 'Database', ...pivotDates, 'Growth', 'Growth %'];
        const rows = sortedPivotRows.map(r => [
            r.table_name, r.database_name,
            ...r.vals.map(v => v !== null ? fmt(v) : ''),
            r.growth !== 0 ? fmt(Math.abs(r.growth)) : '',
            r.growthPct !== 0 ? r.growthPct.toFixed(2) + '%' : ''
        ]);
        const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${clientName}_table_pivot_${fromDate}_to_${toDate}.csv`; a.click();
    };
    const exportTableSummaryCSV = () => {
        if (!filteredSummary.length) return;
        const header = ['Database', 'Table', 'Today Size', 'Last 7D Avg', 'Avg Growth', 'Avg Growth %'];
        const rows = filteredSummary.map(t => [
            t.database_name, t.table_name,
            fmt(t.latest_size),
            t.avg_size_7d !== null ? fmt(t.avg_size_7d) : '',
            t.avg_growth_bytes !== null && t.avg_growth_bytes !== 0 ? fmt(t.avg_growth_bytes) : 'No change',
            t.avg_growth_pct !== null ? fmtPct(t.avg_growth_pct) : ''
        ]);
        const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${clientName}_table_summary_${new Date().toISOString().slice(0,10)}.csv`; a.click();
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
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#047857)', display: 'grid', placeItems: 'center' }}>
                        <FileSpreadsheet size={20} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                            {clientLabel} — Table Growth
                            {techFilter && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', textTransform: 'uppercase', marginLeft: 10 }}>
                                    {techFilter}
                                </span>
                            )}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: T.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Tablespace Analytics</p>
                    </div>
                </div>
            </header>

            <main style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 1500, width: '100%', margin: '0 auto' }}>

                {sumLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (<>

                    {/* STATS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem' }}>
                        {[
                            { label: 'Total Tables',    val: tables.length,        color: '#10b981' },
                            { label: 'Databases',       val: uniqueDbs.length,     color: '#3b82f6' },
                            { label: 'Largest Table',   val: fmt(top10[0]?.latest_size), color: '#f59e0b' },
                            { label: 'Date Range',      val: `${fromDate} → ${toDate}`, color: T.muted },
                        ].map(s => (
                            <div key={s.label} style={{ background: T.card, border: T.border, borderRadius: 16, padding: '1.4rem 1.5rem' }}>
                                <div style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.label}</div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                            </div>
                        ))}
                    </div>

                    {/* DATE RANGE PICKER */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 16, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                        <Calendar size={18} style={{ color: T.accent }} />
                        <strong style={{ fontSize: '0.85rem' }}>Date Range:</strong>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {PRESETS.map(p => (
                                <button key={p.label} onClick={() => applyPreset(p.days)}
                                    style={{ padding: '5px 13px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: (fromDate === daysAgo(p.days) && toDate === today()) ? '#10b981' : T.tag, color: (fromDate === daysAgo(p.days) && toDate === today()) ? 'white' : T.text, transition: 'all 0.2s' }}>
                                    Past {p.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.8rem', color: T.muted }}>From</span>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '5px 10px', fontSize: '0.82rem', outline: 'none' }} />
                            <span style={{ fontSize: '0.8rem', color: T.muted }}>To</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '5px 10px', fontSize: '0.82rem', outline: 'none' }} />
                            <button onClick={loadPivot} disabled={pivotLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', border: 'none', color: 'white', borderRadius: 8, padding: '6px 16px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                <RefreshCw size={13} style={{ animation: pivotLoading ? 'spin 1s linear infinite' : 'none' }} />
                                Apply
                            </button>
                        </div>
                    </div>

                    {/* PIVOT TABLE */}
                    <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <FileSpreadsheet size={18} style={{ color: T.accent }} />
                                Daily Table Size Matrix — {fromDate} to {toDate}
                            </h2>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                    <Download size={13} /> Export CSV
                                </button>
                                <select value={pivotDbFilter} onChange={e => setPivotDbFilter(e.target.value)}
                                    style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '5px 10px', fontSize: '0.78rem', outline: 'none' }}>
                                    <option value="">All Databases</option>
                                    {uniqueDbs.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.tag, border: T.border, borderRadius: 8, padding: '5px 12px' }}>
                                    <Search size={13} style={{ color: T.muted }} />
                                    <input type="text" placeholder="Search table..." value={pivotSearch} onChange={e => setPivotSearch(e.target.value)}
                                        style={{ background: 'none', border: 'none', color: T.text, fontSize: '0.78rem', outline: 'none', width: 160 }} />
                                </div>
                            </div>
                        </div>

                        {pivotLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            </div>
                        ) : pivotDates.length === 0 ? (
                            <div style={{ padding: '4rem', textAlign: 'center', color: T.muted, fontSize: '0.85rem' }}>
                                <Info size={22} style={{ display: 'block', margin: '0 auto 8px' }} />
                                No records found for the selected date range.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', maxHeight: 650, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr style={{ background: T.thead }}>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.68rem', textTransform: 'uppercase', borderBottom: T.border, position: 'sticky', left: 0, background: T.thead, zIndex: 15, boxShadow: '2px 0 5px rgba(0,0,0,0.05)', minWidth: 260 }}>Table & Database</th>
                                            {pivotDates.map(d => (
                                                <th key={d} style={{ padding: '10px 13px', textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '0.68rem', borderBottom: T.border, minWidth: 90 }}>
                                                    {d.slice(5)}
                                                </th>
                                            ))}
                                            <th style={{ padding: '10px 13px', textAlign: 'right', fontWeight: 700, color: '#f59e0b', fontSize: '0.68rem', borderBottom: T.border, minWidth: 90 }}>Growth</th>
                                            <th style={{ padding: '10px 13px', textAlign: 'right', fontWeight: 700, color: '#3b82f6', fontSize: '0.68rem', borderBottom: T.border, minWidth: 90 }}>Growth %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedPivotRows.map((row, ri) => {
                                            const { vals, def, growth, growthPct } = row;
                                            return (
                                                <tr key={ri} style={{ borderBottom: T.border, transition: 'background 0.15s' }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : '#f8fafc';
                                                        const stickyCell = e.currentTarget.cells[0];
                                                        if (stickyCell) stickyCell.style.background = dark ? '#13192f' : '#f8fafc';
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = 'none';
                                                        const stickyCell = e.currentTarget.cells[0];
                                                        if (stickyCell) stickyCell.style.background = dark ? '#0d1224' : '#fff';
                                                    }}>
                                                    <td style={{ padding: '11px 14px', borderBottom: T.border, position: 'sticky', left: 0, background: dark ? '#0d1224' : '#fff', zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.05)', transition: 'background 0.15s', minWidth: 260 }}>
                                                        <div style={{ fontWeight: 700, color: T.text, fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-all' }}>{row.table_name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 2 }}>{row.database_name}</div>
                                                    </td>
                                                    {vals.map((v, vi) => {
                                                        if (showEverydayChanges) {
                                                            const prevVal = vi > 0 ? vals[vi - 1] : null;
                                                            if (v !== null && prevVal !== null) {
                                                                const dayDiff = v - prevVal;
                                                                const dayPct = prevVal > 0 ? (dayDiff / prevVal * 100) : 0;
                                                                const tc = dayDiff > 0 ? '#10b981' : dayDiff < 0 ? '#ef4444' : T.muted;
                                                                return (
                                                                    <td key={vi} style={{ padding: '11px 13px', textAlign: 'right', fontWeight: 600, color: tc }}>
                                                                        {dayDiff > 0 ? '+' : ''}{fmt(dayDiff)} ({dayDiff > 0 ? '+' : ''}{dayPct.toFixed(2)}%)
                                                                    </td>
                                                                );
                                                            }
                                                            return <td key={vi} style={{ padding: '11px 13px', textAlign: 'right', color: T.muted }}>—</td>;
                                                        }
                                                        return (
                                                            <td key={vi} style={{ padding: '11px 13px', textAlign: 'right', color: v ? T.text : T.muted, fontWeight: v ? 600 : 400 }}>
                                                                {v !== null ? fmt(v) : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '11px 13px', textAlign: 'right', fontWeight: 700, color: growth > 0 ? '#10b981' : growth < 0 ? '#ef4444' : T.muted }}>
                                                        {growth !== 0 ? ((growth > 0 ? '+' : '') + fmt(Math.abs(growth))) : '—'}
                                                    </td>
                                                    <td style={{ padding: '11px 13px', textAlign: 'right', fontWeight: 700, color: growthPct > 0 ? '#10b981' : growthPct < 0 ? '#ef4444' : T.muted }}>
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

                    {/* TOP 10 SECTION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Bar chart */}
                        <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                            <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <BarChart3 size={18} style={{ color: T.accent }} />
                                Top 10 Heaviest Tables
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {top10.map((t, i) => {
                                    const pct = (t.latest_size / maxSize) * 100;
                                    return (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                                    <span style={{ color: T.accent, marginRight: 6 }}>#{i+1}</span>
                                                    {t.table_name}
                                                    <span style={{ color: T.muted, fontSize: '0.7rem', marginLeft: 6 }}>({t.database_name})</span>
                                                </span>
                                                <strong>{fmt(t.latest_size)}</strong>
                                            </div>
                                            <div style={{ height: 9, background: T.tag, borderRadius: 9, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#10b981,#059669)', borderRadius: 9, transition: 'width 0.7s ease' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary table */}
                        <div style={{ background: T.card, border: T.border, borderRadius: 20, padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Layers size={18} style={{ color: T.accent }} />
                                    All Tables &amp; Average Growth
                                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: T.muted }}>({filteredSummary.length})</span>
                                </h2>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <select value={dbFilter} onChange={e => setDbFilter(e.target.value)}
                                        style={{ background: T.tag, border: T.border, color: T.text, borderRadius: 8, padding: '4px 8px', fontSize: '0.75rem', outline: 'none' }}>
                                        <option value="">All DBs</option>
                                        {uniqueDbs.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.tag, border: T.border, borderRadius: 8, padding: '4px 10px' }}>
                                        <Search size={12} style={{ color: T.muted }} />
                                        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                                            style={{ background: 'none', border: 'none', color: T.text, fontSize: '0.75rem', outline: 'none', width: 120 }} />
                                    </div>
                                    <button onClick={exportTableSummaryCSV} disabled={!filteredSummary.length}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                                        <Download size={12} /> Export CSV
                                    </button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: 650, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: T.thead }}>
                                        <tr>
                                            {['DB', 'Table', 'Today Size', 'Last 7D Avg', 'Avg Growth', 'Avg Growth %'].map(h => (
                                                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.68rem', textTransform: 'uppercase', borderBottom: T.border }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSummary.map((t, i) => {
                                            const hasAvg = t.avg_size_7d !== null;
                                            const neg = (t.avg_growth_bytes || 0) < 0, pos = (t.avg_growth_bytes || 0) > 0;
                                            const tc  = neg ? '#ef4444' : pos ? '#10b981' : T.muted;
                                            return (
                                                <tr key={i} style={{ borderBottom: T.border, transition: 'background 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                                    <td style={{ width: '15%', padding: '10px 12px', color: T.muted, textAlign: 'left' }}>{t.database_name}</td>
                                                    <td style={{ width: '35%', padding: '10px 12px', fontWeight: 700, textAlign: 'left', wordBreak: 'break-all', whiteSpace: 'normal' }}>{t.table_name}</td>
                                                    <td style={{ width: '12%', padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>{fmt(t.latest_size)}</td>
                                                    <td style={{ width: '13%', padding: '10px 12px', color: T.muted, textAlign: 'right' }}>{hasAvg ? fmt(t.avg_size_7d) : '—'}</td>
                                                    <td style={{ width: '13%', padding: '10px 12px', color: tc, fontWeight: 600, textAlign: 'right' }}>
                                                        {!hasAvg ? '—' : t.avg_growth_bytes === 0 ? 'No change' : fmt(t.avg_growth_bytes)}
                                                    </td>
                                                    <td style={{ width: '12%', padding: '10px 12px', textAlign: 'right' }}>
                                                        {hasAvg ? (
                                                            <span style={{ background: neg ? 'rgba(239,68,68,0.1)' : pos ? 'rgba(16,185,129,0.1)' : T.tag, color: tc, padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                                                {pos && <TrendingUp size={9} />}{neg && <TrendingDown size={9} />}
                                                                {fmtPct(t.avg_growth_pct)}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </>)}
            </main>

            <footer style={{ textAlign: 'center', padding: '1.5rem', borderTop: T.border, color: T.muted, fontSize: '0.78rem', background: dark ? 'rgba(5,7,16,0.4)' : '#fff' }}>
                © {new Date().getFullYear()} GeoPITS Core Console · {clientLabel}{techFilter ? ` (${techFilter})` : ''} Table Telemetry
            </footer>

            <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
        </div>
    );
}
