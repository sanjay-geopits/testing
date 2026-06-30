import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import GeopitsLogo from '../components/GeopitsLogo';
import { marked } from 'marked';
import { 
    ArrowLeft, 
    Activity, 
    Database, 
    FileText, 
    Ticket, 
    Terminal, 
    Cpu, 
    HardDrive, 
    AlertOctagon, 
    Clock, 
    Grid,
    CheckCircle,
    Sun,
    Moon,
    Download
} from 'lucide-react';

marked.setOptions({
  breaks: true,
  gfm: true
});

export default function OverallSummaryHub() {
    const { user, logoUrl } = useAuth();
    const { isLight, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    // Data lists
    const [clientsList, setClientsList] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedTech, setSelectedTech] = useState('');
    const [summaryData, setSummaryData] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // Page styling
    const themeStyles = {
        background: isLight 
            ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)' 
            : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        headerBg: isLight ? '#ffffff' : '#0c0f1d',
        headerBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.05)',
        cardBg: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.4)',
        cardBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#0f172a' : '#f8fafc',
        textMuted: isLight ? '#475569' : '#94a3b8',
        inputBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)'
    };

    const fetchOnlineUsers = () => {
        api.get('/new-features/admin/online-users')
            .then(res => {
                setOnlineUsers(res.data.online_users || []);
            })
            .catch(err => console.error("Error fetching online users:", err));
    };

    // Load clients list
    useEffect(() => {
        api.get('/new-features/admin/clients')
            .then(res => {
                setClientsList(res.data.clients || []);
            })
            .catch(err => console.error("Error fetching db clients:", err));
        fetchOnlineUsers();
    }, []);

    // Select initial client when redirected from Home page
    useEffect(() => {
        if (clientsList.length > 0 && location.state?.initialClient) {
            const clientName = location.state.initialClient;
            setSelectedClient(clientName);
            const techs = [...new Set(clientsList.filter(c => c.client_name === clientName).map(c => c.db_type))];
            const firstTech = techs[0] || '';
            setSelectedTech(firstTech);
            if (firstTech) {
                fetchSummaryData(clientName, firstTech);
            }
        }
    }, [clientsList, location.state]);

    const handleToggleOwnPresence = async () => {
        if (!user || !user.username) return;
        const myOnlineEntry = onlineUsers.find(item => item.username.toLowerCase() === user.username.toLowerCase());
        try {
            if (myOnlineEntry) {
                await api.delete(`/new-features/admin/online-users/${myOnlineEntry.id}`);
            } else {
                await api.post('/new-features/admin/online-users', {
                    username: user.username,
                    units: 'All'
                });
            }
            fetchOnlineUsers();
        } catch (err) {
            console.error("Failed to toggle presence:", err);
        }
    };

    // Fetch details when client + tech is selected
    const downloadReport = () => {
        if (!summaryData || !selectedClient) return;
        const lines = [];
        
        // 1. Report Header
        lines.push(`"GeoMon Real-time Diagnostic & Telemetry Report"`);
        lines.push(`"Client","${selectedClient}"`);
        lines.push(`"Technology","${selectedTech}"`);
        lines.push(`"Generated At","${new Date().toLocaleString('en-IN')}"`);
        lines.push('');

        // 2. Database Uptime Node Status
        lines.push('"-- DATABASE UPTIME NODE STATUS --"');
        lines.push('"Service Name","Status","Uptime Description","Last Restart Time","Last Checked"');
        if (Array.isArray(summaryData.uptime)) {
            summaryData.uptime.forEach(node => {
                lines.push(`"${node.service_name || ''}","${node.status || ''}","${node.uptime_desc || ''}","${node.last_restart_time || ''}","${node.captured_at || ''}"`);
            });
        } else if (summaryData.uptime) {
            const node = summaryData.uptime;
            lines.push(`"Database Service","${node.status || ''}","${node.uptime_desc || ''}","${node.last_restart_time || ''}","${node.captured_at || ''}"`);
        } else {
            lines.push('"No Uptime Telemetry Data Available"');
        }
        lines.push('');

        // 3. Database Size History (Complete)
        lines.push('"-- COMPLETE DATABASE SIZE HISTORY --"');
        lines.push('"Server Name","Database Name","Size (MB)","Captured Date","DB Type"');
        const dbSizesList = summaryData.db_sizes_all || summaryData.db_sizes;
        if (dbSizesList?.length) {
            dbSizesList.forEach(d => {
                const mb = (d.total_size_bytes / (1024*1024)).toFixed(2);
                lines.push(`"${d.server_name || ''}","${d.database_name || ''}","${mb} MB","${d.captured_date || ''}","${d.db_type || ''}"`);
            });
        } else {
            lines.push('"No Database Size History Available"');
        }
        lines.push('');

        // 4. Table Size History (Complete)
        lines.push('"-- COMPLETE TABLE SIZE HISTORY --"');
        lines.push('"Server Name","Database Name","Table Name","Size (KB)","Captured Date","DB Type"');
        const tblSizesList = summaryData.table_sizes_all || summaryData.table_sizes;
        if (tblSizesList?.length) {
            tblSizesList.forEach(t => {
                const kb = (t.size_bytes / 1024).toFixed(1);
                lines.push(`"${t.server_name || ''}","${t.database_name || ''}","${t.table_name || ''}","${kb} KB","${t.captured_date || ''}","${t.db_type || ''}"`);
            });
        } else {
            lines.push('"No Table Size History Available"');
        }
        lines.push('');

        // 5. Support Tickets
        lines.push('"-- SUPPORT ESCALATION INCIDENTS --"');
        lines.push('"Ticket ID","Ticket Name","Category","Status","Priority","Agent","Created At"');
        if (summaryData.tickets?.length) {
            summaryData.tickets.forEach(t => {
                lines.push(`"${t.id}","${t.ticket_name || ''}","${t.category || ''}","${t.status || ''}","${t.priority || ''}","${t.agent || ''}","${t.created_at || ''}"`);
            });
        } else {
            lines.push('"No Support Incidents Found"');
        }
        lines.push('');

        // 6. Diagnostic Reports Archives
        lines.push('"-- EXECUTIVE DIAGNOSTIC REPORTS ARCHIVES --"');
        lines.push('"Report ID","Report Name","File Path","Status","Created At"');
        if (summaryData.reports?.length) {
            summaryData.reports.forEach(r => {
                lines.push(`"${r.id}","${r.report_name || ''}","${r.file_path || ''}","${r.status || ''}","${r.created_at || ''}"`);
            });
        } else {
            lines.push('"No Archived Reports Available"');
        }
        lines.push('');

        // 7. Recent Diagnostic Event Logs (Realtime Logs)
        lines.push('"-- REAL-TIME DIAGNOSTIC EVENT LOGS --"');
        lines.push('"Log ID","Log Message","Severity","Time (IST)","Status","Owner"');
        if (summaryData.realtime_logs?.length) {
            summaryData.realtime_logs.forEach(l => {
                lines.push(`"${l.id}","${(l.log_message || '').replace(/"/g, '""')}","${l.severity || ''}","${l.log_time_ist || ''}","${l.status || ''}","${l.owner || ''}"`);
            });
        } else {
            lines.push('"No Diagnostic Event Logs Found"');
        }
        lines.push('');

        // 8. CPU Usage History
        lines.push('"-- CPU USAGE TELEMETRY HISTORY --"');
        lines.push('"Severity","Usage Value","Timestamp"');
        if (summaryData.cpu_history?.length) {
            summaryData.cpu_history.forEach(c => {
                lines.push(`"${c.severity || ''}","${c.log_message || ''}","${c.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No CPU Telemetry Logs Available"');
        }
        lines.push('');

        // 9. Memory Usage History
        lines.push('"-- MEMORY USAGE TELEMETRY HISTORY --"');
        lines.push('"Severity","Usage Value","Timestamp"');
        if (summaryData.memory_history?.length) {
            summaryData.memory_history.forEach(m => {
                lines.push(`"${m.severity || ''}","${m.log_message || ''}","${m.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No Memory Telemetry Logs Available"');
        }
        lines.push('');

        // 10. Disk Usage History
        lines.push('"-- DISK USAGE TELEMETRY HISTORY --"');
        lines.push('"Severity","Usage Value","Timestamp"');
        if (summaryData.disk_history?.length) {
            summaryData.disk_history.forEach(d => {
                lines.push(`"${d.severity || ''}","${d.log_message || ''}","${d.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No Disk Telemetry Logs Available"');
        }
        lines.push('');

        // 11. Disk I/O logs
        lines.push('"-- DISK I/O TELEMETRY LOGS --"');
        lines.push('"Severity","IO Value","Timestamp"');
        if (summaryData.io_history?.length) {
            summaryData.io_history.forEach(io => {
                lines.push(`"${io.severity || ''}","${io.log_message || ''}","${io.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No Disk I/O Logs Available"');
        }
        lines.push('');

        // 12. Critical Error Logs
        lines.push('"-- CRITICAL ERROR & FAILURE LOGS --"');
        lines.push('"Log ID","Log Message","Severity","Timestamp"');
        if (summaryData.error_logs?.length) {
            summaryData.error_logs.forEach(l => {
                lines.push(`"${l.id}","${(l.log_message || '').replace(/"/g, '""')}","${l.severity || ''}","${l.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No Critical Error Logs Found"');
        }
        lines.push('');

        // 13. Slow Query Logs
        lines.push('"-- SLOW QUERY ANALYSIS LOGS --"');
        lines.push('"Log ID","Log Message","Severity","Timestamp"');
        if (summaryData.slow_query_logs?.length) {
            summaryData.slow_query_logs.forEach(l => {
                lines.push(`"${l.id}","${(l.log_message || '').replace(/"/g, '""')}","${l.severity || ''}","${l.log_time_ist || ''}"`);
            });
        } else {
            lines.push('"No Slow Query Logs Found"');
        }
        lines.push('');

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedClient.replace(/\s+/g, '_')}_${selectedTech.replace(/\s+/g, '_')}_comprehensive_realtime_report_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const fetchSummaryData = async (clientName, tech, forceRefresh = false) => {
        setLoadingSummary(true);
        try {
            const url = `/new-features/homepage/overall-summary/${encodeURIComponent(clientName)}/${encodeURIComponent(tech)}${forceRefresh ? '?refresh=true' : ''}`;
            const res = await api.get(url);
            setSummaryData(res.data);
        } catch (err) {
            console.error("Error fetching summary data:", err);
            setSummaryData(null);
        } finally {
            setLoadingSummary(false);
        }
    };

    const handleClientSelect = (clientName) => {
        if (selectedClient === clientName) {
            setSelectedClient(null);
            setSelectedTech('');
            setSummaryData(null);
        } else {
            setSelectedClient(clientName);
            const techs = [...new Set(clientsList.filter(c => c.client_name === clientName).map(c => c.db_type))];
            const firstTech = techs[0] || '';
            setSelectedTech(firstTech);
            if (firstTech) {
                fetchSummaryData(clientName, firstTech);
            }
        }
    };

    const handleTechSelect = (tech) => {
        setSelectedTech(tech);
        fetchSummaryData(selectedClient, tech);
    };

    const uniqueClientNames = [...new Set(clientsList.map(c => c.client_name))].filter(name =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ 
            background: themeStyles.background, 
            minHeight: '100vh', 
            color: themeStyles.textMain,
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            transition: 'background 0.3s ease, color 0.3s ease'
        }}>
            {/* Header */}
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
                    <img src={logoUrl || "/static/applogo.svg"} alt="GeoMon" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0, color: themeStyles.textMain }}>
                            GeoMon <span style={{ fontWeight: '400', fontSize: '0.9rem', color: '#2563eb' }}>Summary Hub</span>
                        </h1>
                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                            Unified Diagnostic & Multi-Tenant Telemetry
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                            color: themeStyles.textMain,
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={16} /> Home
                    </button>

                    <button 
                        onClick={toggleTheme}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: themeStyles.textMain,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {isLight ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '2.5rem', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
                
                {/* Clients Grid */}
                {!selectedClient && (
                    <div>
                        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Client Environments Grid</h2>
                                <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, marginTop: '4px' }}>
                                    Select any active corporate client node to load isolated diagnostics and synthesized AI summary analytics.
                                </p>
                            </div>
                            <div>
                                <input 
                                    type="text"
                                    placeholder="🔍 Search client environments..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: themeStyles.inputBorder,
                                        background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                                        color: themeStyles.textMain,
                                        fontSize: '0.85rem',
                                        width: '260px',
                                        outline: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '20px', 
                            marginBottom: '32px' 
                        }}>
                            {uniqueClientNames.map((clientName) => {
                                const isSelected = selectedClient === clientName;
                                const clientTechs = [...new Set(clientsList.filter(c => c.client_name === clientName).map(c => c.db_type))];
                                
                                return (
                                    <div 
                                        key={clientName}
                                        onClick={() => handleClientSelect(clientName)}
                                        style={{
                                            background: themeStyles.cardBg,
                                            border: isSelected ? '2px solid #2563eb' : themeStyles.cardBorder,
                                            borderRadius: '12px',
                                            padding: '20px',
                                            cursor: 'pointer',
                                            boxShadow: isSelected ? '0 0 15px rgba(37,99,235,0.15)' : 'none',
                                            transition: 'all 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#2563eb';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ 
                                                background: isLight ? '#eff6ff' : 'rgba(37,99,235,0.1)', 
                                                color: '#2563eb', 
                                                fontSize: '0.68rem', 
                                                fontWeight: '700', 
                                                padding: '4px 8px', 
                                                borderRadius: '4px' 
                                            }}>
                                                CLIENT NODE
                                            </span>
                                        </div>

                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '12px', marginBottom: '8px' }}>
                                            {clientName}
                                        </h3>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                                            {clientTechs.map(tech => (
                                                <span 
                                                    key={tech} 
                                                    style={{ 
                                                        fontSize: '0.7rem', 
                                                        background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)', 
                                                        padding: '3px 8px', 
                                                        borderRadius: '4px',
                                                        border: themeStyles.cardBorder
                                                    }}
                                                >
                                                    {tech}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Selected Client Workspace */}
                {selectedClient && (
                    <div style={{ 
                        background: themeStyles.cardBg, 
                        border: themeStyles.cardBorder, 
                        borderRadius: '16px',
                        padding: '24px',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                            paddingBottom: '16px',
                            marginBottom: '20px'
                        }}>
                            <div>
                                <button 
                                    onClick={() => {
                                        setSelectedClient(null);
                                        setSummaryData(null);
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#2563eb',
                                        fontSize: '0.82rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '10px',
                                        padding: 0
                                    }}
                                >
                                    <ArrowLeft size={14} /> Back to Client Grid
                                </button>
                                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>
                                    Diagnostic Console: {selectedClient}
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: themeStyles.textMuted, margin: '4px 0 0 0' }}>
                                    Isolated telemetry workspace. Switching technology automatically scopes all database matrices below.
                                </p>
                            </div>

                            {/* Tech Selector Tab & Refresh */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[...new Set(clientsList.filter(c => c.client_name === selectedClient).map(c => c.db_type))].map((tech) => (
                                        <button
                                            key={tech}
                                            onClick={() => handleTechSelect(tech)}
                                            style={{
                                                padding: '6px 14px',
                                                background: selectedTech === tech ? '#2563eb' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'),
                                                color: selectedTech === tech ? '#ffffff' : themeStyles.textMain,
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {tech}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => fetchSummaryData(selectedClient, selectedTech, true)}
                                    style={{
                                        padding: '6px 12px',
                                        background: 'transparent',
                                        border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)'}`,
                                        color: themeStyles.textMain,
                                        borderRadius: '6px',
                                        fontSize: '0.78rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)'}
                                >
                                    <Activity size={14} className={loadingSummary ? "animate-spin" : ""} /> Refresh
                                </button>
                                <button
                                    onClick={downloadReport}
                                    disabled={!summaryData}
                                    style={{
                                        padding: '6px 12px',
                                        background: summaryData ? 'rgba(16,185,129,0.1)' : 'transparent',
                                        border: `1px solid ${summaryData ? 'rgba(16,185,129,0.35)' : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)')}`,
                                        color: summaryData ? '#10b981' : themeStyles.textMuted,
                                        borderRadius: '6px',
                                        fontSize: '0.78rem',
                                        fontWeight: '700',
                                        cursor: summaryData ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Download size={14} /> Download Report
                                </button>
                            </div>
                        </div>

                        {loadingSummary ? (
                            <div style={{ padding: '40px 0', textAlign: 'center', color: themeStyles.textMuted }}>
                                <Activity className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#2563eb' }} size={32} />
                                Loading telemetry payload...
                            </div>
                        ) : summaryData ? (
                            <div>
                                {/* Sub-navigation tabs */}
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '10px', 
                                    overflowX: 'auto', 
                                    paddingBottom: '8px', 
                                    marginBottom: '24px', 
                                    borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}` 
                                }}>
                                    {[
                                        { id: 'overview', label: 'AI Health Summary', icon: <CheckCircle size={15} /> },
                                        { id: 'logs', label: 'Realtime Log Stream', icon: <Terminal size={15} /> },
                                        { id: 'cpu_mem', label: 'CPU & Memory', icon: <Cpu size={15} /> },
                                        { id: 'disk_io', label: 'Disk IO & Storage', icon: <HardDrive size={15} /> },
                                        { id: 'db_table', label: 'DB & Table Audits', icon: <Database size={15} /> },
                                        { id: 'reports', label: 'Diagnostic Reports', icon: <FileText size={15} /> },
                                        { id: 'tickets', label: 'Support Tickets', icon: <Ticket size={15} /> },
                                        { id: 'errors', label: 'System Errors', icon: <AlertOctagon size={15} /> },
                                        { id: 'slow_queries', label: 'Slow Query Logs', icon: <Clock size={15} /> }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            style={{
                                                padding: '8px 16px',
                                                background: activeTab === tab.id ? (isLight ? '#eff6ff' : 'rgba(37,99,235,0.08)') : 'none',
                                                color: activeTab === tab.id ? '#2563eb' : themeStyles.textMuted,
                                                border: 'none',
                                                borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                                                fontSize: '0.8rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Active Tab Contents */}
                                <div style={{ minHeight: '300px' }}>
                                    
                                    {/* 1. OVERVIEW */}
                                    {activeTab === 'overview' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                                            <div style={{ 
                                                background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                                border: themeStyles.cardBorder,
                                                borderRadius: '12px',
                                                padding: '24px'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }}></span>
                                                        GeoBot Diagnostics Report
                                                    </h4>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(summaryData.summary || '');
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }}
                                                        style={{
                                                            padding: '4px 10px',
                                                            background: 'transparent',
                                                            border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
                                                            borderRadius: '6px',
                                                            color: themeStyles.textMain,
                                                            fontSize: '0.75rem',
                                                            fontWeight: '700',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        {copied ? 'Copied! ✓' : 'Copy Report'}
                                                    </button>
                                                </div>
                                                <div 
                                                    style={{ 
                                                        lineHeight: '1.6', 
                                                        fontSize: '0.88rem', 
                                                        color: themeStyles.textMain 
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: marked.parse(summaryData.summary || '') }} 
                                                />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                <div style={{ 
                                                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
                                                    border: themeStyles.cardBorder, 
                                                    borderRadius: '12px', 
                                                    padding: '20px' 
                                                }}>
                                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uptime Status</h5>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {Array.isArray(summaryData.uptime) && summaryData.uptime.length > 0 ? (
                                                            summaryData.uptime.map((node, idx) => {
                                                                const isOnline = (node.status || '').toUpperCase() === 'ONLINE' || (node.status || '').toUpperCase() === 'RUNNING';
                                                                return (
                                                                    <div key={idx} style={{ 
                                                                        paddingBottom: idx < summaryData.uptime.length - 1 ? '12px' : '0', 
                                                                        borderBottom: idx < summaryData.uptime.length - 1 ? `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` : 'none' 
                                                                    }}>
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: themeStyles.textMain, marginBottom: '4px' }}>
                                                                            {node.service_name || 'Database Node'}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{
                                                                                padding: '2px 6px',
                                                                                borderRadius: '4px',
                                                                                fontSize: '0.65rem',
                                                                                fontWeight: '800',
                                                                                background: isOnline ? '#10b981' : '#ef4444',
                                                                                color: '#ffffff',
                                                                                textTransform: 'uppercase'
                                                                            }}>
                                                                                {node.status || 'Unknown'}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: themeStyles.textMain }}>{node.uptime_desc || 'No uptime telemetry logs'}</span>
                                                                        </div>
                                                                        <div style={{ fontSize: '0.68rem', color: themeStyles.textMuted, marginTop: '2px' }}>
                                                                            Last checked: {node.captured_at ? new Date(node.captured_at).toLocaleString() : 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                                    <span style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: '800',
                                                                        background: summaryData.uptime?.status === 'Online' ? '#10b981' : '#f59e0b',
                                                                        color: '#ffffff'
                                                                    }}>
                                                                        {summaryData.uptime?.status || 'Unknown'}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{summaryData.uptime?.uptime_desc || 'No uptime telemetry logs'}</span>
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: themeStyles.textMuted }}>
                                                                    Last checked: {summaryData.uptime?.captured_at ? new Date(summaryData.uptime.captured_at).toLocaleString() : 'N/A'}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ 
                                                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
                                                    border: themeStyles.cardBorder, 
                                                    borderRadius: '12px', 
                                                    padding: '20px' 
                                                }}>
                                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: themeStyles.textMuted, textTransform: 'uppercase' }}>Quick Metrics (24h)</h5>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                                                                <span>CPU Usage</span>
                                                                <span style={{ fontWeight: '700' }}>{summaryData.server_report?.avg_cpu || 'N/A'}%</span>
                                                            </div>
                                                            <div style={{ height: '6px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', background: '#2563eb', width: `${summaryData.server_report?.avg_cpu || 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                                                                <span>Memory Usage</span>
                                                                <span style={{ fontWeight: '700' }}>{summaryData.server_report?.avg_mem || 'N/A'}%</span>
                                                            </div>
                                                            <div style={{ height: '6px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', background: '#7c3aed', width: `${summaryData.server_report?.avg_mem || 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                                                                <span>Disk Capacity</span>
                                                                <span style={{ fontWeight: '700' }}>{summaryData.server_report?.avg_disk || 'N/A'}%</span>
                                                            </div>
                                                            <div style={{ height: '6px', background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', background: '#10b981', width: `${summaryData.server_report?.avg_disk || 0}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Duty Presence Registry */}
                                                <div style={{ 
                                                    background: themeStyles.cardBg, 
                                                    border: themeStyles.cardBorder, 
                                                    borderRadius: '12px', 
                                                    padding: '20px' 
                                                }}>
                                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duty Presence</h5>
                                                    
                                                    {user && (
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            gap: '8px', 
                                                            paddingBottom: '12px', 
                                                            marginBottom: '12px', 
                                                            borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` 
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ 
                                                                        width: '10px', 
                                                                        height: '10px', 
                                                                        borderRadius: '50%', 
                                                                        background: onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? '#10b981' : '#64748b',
                                                                        boxShadow: onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? '0 0 8px #10b981' : 'none'
                                                                    }}></div>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: themeStyles.textMain }}>
                                                                        {user.username} (You)
                                                                    </span>
                                                                </div>
                                                                <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>
                                                                    {onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? 'Online' : 'Offline'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={handleToggleOwnPresence}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '8px 12px',
                                                                    background: onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? '#ef4444' : '#10b981',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '700',
                                                                    cursor: 'pointer',
                                                                    transition: 'background 0.2s',
                                                                    boxShadow: onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? '0 2px 4px rgba(239,68,68,0.2)' : '0 2px 4px rgba(16,185,129,0.2)'
                                                                }}
                                                            >
                                                                {onlineUsers.some(item => item.username.toLowerCase() === user.username.toLowerCase()) ? 'Go Offline' : 'Go Online'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase' }}>Active Specialists</span>
                                                        {onlineUsers.length === 0 ? (
                                                            <div style={{ fontSize: '0.75rem', color: themeStyles.textMuted, fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                                                                No active duty specialists.
                                                            </div>
                                                        ) : (
                                                            onlineUsers.map(item => (
                                                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', border: themeStyles.cardBorder, borderRadius: '6px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                                                                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: themeStyles.textMain }}>{item.username}</span>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.65rem', color: themeStyles.textMuted }}>Scope: {item.units}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. REALTIME LOG STREAM */}
                                    {activeTab === 'logs' && (
                                        <div style={{ 
                                            background: '#070a13', 
                                            color: '#10b981', 
                                            borderRadius: '12px', 
                                            padding: '20px', 
                                            fontFamily: 'Courier New, monospace', 
                                            fontSize: '0.8rem',
                                            maxHeight: '400px',
                                            overflowY: 'auto'
                                        }}>
                                            <div style={{ borderBottom: '1px solid rgba(16,185,129,0.2)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                                <span>SYSTEM REPLICA LOG CONSOLE</span>
                                                <span style={{ color: '#10b981' }}>● ONLINE</span>
                                            </div>
                                            {(!summaryData.realtime_logs || summaryData.realtime_logs.length === 0) ? (
                                                <div style={{ color: '#64748b', fontStyle: 'italic' }}>No real-time logs currently streaming.</div>
                                            ) : (
                                                summaryData.realtime_logs.map(log => (
                                                    <div key={log.id} style={{ marginBottom: '6px' }}>
                                                        <span style={{ color: '#64748b' }}>[{log.log_time_ist ? new Date(log.log_time_ist).toLocaleTimeString() : 'Recent'}]</span>{' '}
                                                        <span style={{ 
                                                            color: log.severity?.toLowerCase() === 'critical' || log.severity?.toLowerCase() === 'error' ? '#ef4444' : 
                                                                   log.severity?.toLowerCase() === 'warning' ? '#f59e0b' : '#10b981'
                                                        }}>
                                                            {log.severity?.toUpperCase()}
                                                        </span>:{' '}
                                                        <span style={{ color: '#f8fafc' }}>{log.log_message}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* 3. CPU & MEMORY TELEMETRY */}
                                    {activeTab === 'cpu_mem' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            {/* CPU History */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>CPU History Metrics</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {summaryData.cpu_history && summaryData.cpu_history.length > 0 ? (
                                                        summaryData.cpu_history.map((h, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                <span style={{ color: themeStyles.textMuted }}>{new Date(h.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '700' }}>{h.log_message}</span>
                                                            </div>
                                                        ))
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No CPU logs available</div>}
                                                </div>
                                            </div>

                                            {/* Memory History */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Memory Utilization logs</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {summaryData.memory_history && summaryData.memory_history.length > 0 ? (
                                                        summaryData.memory_history.map((h, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                <span style={{ color: themeStyles.textMuted }}>{new Date(h.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '700' }}>{h.log_message}</span>
                                                            </div>
                                                        ))
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No Memory logs available</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. DISK IO & STORAGE */}
                                    {activeTab === 'disk_io' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            {/* Disk Capacity */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Disk Space Telemetry</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {summaryData.disk_history && summaryData.disk_history.length > 0 ? (
                                                        summaryData.disk_history.map((h, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                <span style={{ color: themeStyles.textMuted }}>{new Date(h.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '700' }}>{h.log_message}</span>
                                                            </div>
                                                        ))
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No Disk usage logs available</div>}
                                                </div>
                                            </div>

                                            {/* Disk IO */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Disk I/O logs</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {summaryData.io_history && summaryData.io_history.length > 0 ? (
                                                        summaryData.io_history.map((h, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                <span style={{ color: themeStyles.textMuted }}>{new Date(h.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '700' }}>{h.log_message}</span>
                                                            </div>
                                                        ))
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No I/O logs available</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 5. DB & TABLE GROWTH */}
                                    {activeTab === 'db_table' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            {/* DB Size Growth */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Daily Database Size Changes</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {summaryData.db_sizes && summaryData.db_sizes.length > 0 ? (
                                                        summaryData.db_sizes.map((h, i) => {
                                                            const changeMb = h.change_bytes ? (h.change_bytes / (1024*1024)).toFixed(2) : '0.00';
                                                            const changeSign = h.change_bytes > 0 ? '+' : '';
                                                            const changeColor = h.change_bytes > 0 ? '#ef4444' : '#10b981';
                                                            return (
                                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '8px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                    <span>
                                                                        <span style={{ fontWeight: '600', color: themeStyles.textMain }}>{h.database_name}</span>
                                                                        <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted, marginLeft: '8px' }}>({new Date(h.captured_date).toLocaleDateString()})</span>
                                                                    </span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontWeight: '700', color: themeStyles.textMain }}>{(h.total_size_bytes / (1024*1024)).toFixed(2)} MB</span>
                                                                        <span style={{ color: changeColor, fontSize: '0.72rem', fontWeight: '800', background: h.change_bytes > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            {changeSign}{changeMb} MB
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No database size changes detected today</div>}
                                                </div>
                                            </div>

                                            {/* Table Size Growth */}
                                            <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Daily Table Size Audit Changes</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                                                    {summaryData.table_sizes && summaryData.table_sizes.length > 0 ? (
                                                        summaryData.table_sizes.map((h, i) => {
                                                            const changeKb = h.change_bytes ? (h.change_bytes / 1024).toFixed(1) : '0.0';
                                                            const changeSign = h.change_bytes > 0 ? '+' : '';
                                                            const changeColor = h.change_bytes > 0 ? '#ef4444' : '#10b981';
                                                            return (
                                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', padding: '8px 0', borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)'}` }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: '600', color: themeStyles.textMain }}>{h.table_name} <span style={{ color: themeStyles.textMuted, fontSize: '0.7rem', fontWeight: '400' }}>({h.database_name})</span></span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontWeight: '700', color: themeStyles.textMain }}>{(h.size_bytes / 1024).toFixed(1)} KB</span>
                                                                            <span style={{ color: changeColor, fontSize: '0.72rem', fontWeight: '800', background: h.change_bytes > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                {changeSign}{changeKb} KB
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted, marginTop: '2px' }}>{new Date(h.captured_date).toLocaleDateString()}</span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No table size changes audited today</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 6. REPORTS */}
                                    {activeTab === 'reports' && (
                                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Executive Diagnostic Reports Archives</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {summaryData.reports && summaryData.reports.length > 0 ? (
                                                    summaryData.reports.map((rep) => (
                                                        <div key={rep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.02)', border: themeStyles.cardBorder, borderRadius: '8px' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '700' }}>{rep.report_name}</div>
                                                                <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>Created: {new Date(rep.created_at).toLocaleString()}</div>
                                                            </div>
                                                            <span style={{ 
                                                                fontSize: '0.7rem', 
                                                                background: '#10b981', 
                                                                color: '#ffffff', 
                                                                padding: '3px 8px', 
                                                                borderRadius: '4px',
                                                                textTransform: 'uppercase',
                                                                fontWeight: '800'
                                                            }}>{rep.status}</span>
                                                        </div>
                                                    ))
                                                ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No custom reports archived for this client node</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* 7. HELPDESK TICKETS */}
                                    {activeTab === 'tickets' && (
                                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800' }}>Support & Escalation Incidents</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {summaryData.tickets && summaryData.tickets.length > 0 ? (
                                                    summaryData.tickets.map((t) => (
                                                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '10px 12px', background: isLight ? '#ffffff' : 'rgba(255,255,255,0.02)', border: themeStyles.cardBorder, borderRadius: '8px' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '700' }}>{t.ticket_name} <span style={{ color: '#2563eb', fontSize: '0.72rem' }}>({t.category || 'Support'})</span></div>
                                                                <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>Agent Assigned: {t.agent || 'Unassigned'} | Created: {new Date(t.created_at).toLocaleDateString()}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                                <span style={{ 
                                                                    fontSize: '0.7rem', 
                                                                    background: t.priority?.toLowerCase() === 'high' || t.priority?.toLowerCase() === 'critical' ? '#ef4444' : '#64748b', 
                                                                    color: '#ffffff', 
                                                                    padding: '3px 8px', 
                                                                    borderRadius: '4px',
                                                                    fontWeight: '800'
                                                                }}>{t.priority?.toUpperCase()}</span>
                                                                <span style={{ 
                                                                    fontSize: '0.7rem', 
                                                                    background: t.status?.toLowerCase() === 'open' ? '#3b82f6' : '#10b981', 
                                                                    color: '#ffffff', 
                                                                    padding: '3px 8px', 
                                                                    borderRadius: '4px',
                                                                    fontWeight: '800'
                                                                }}>{t.status?.toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : <div style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>No helpdesk tickets recorded for this company</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* 8. SYSTEM ERRORS */}
                                    {activeTab === 'errors' && (
                                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800', color: '#ef4444' }}>Critical Database System Errors</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                                                {summaryData.error_logs && summaryData.error_logs.length > 0 ? (
                                                    summaryData.error_logs.map((log) => (
                                                        <div key={log.id} style={{ fontSize: '0.78rem', padding: '10px 12px', background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.05)', borderLeft: '3px solid #ef4444', borderRadius: '4px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: themeStyles.textMuted, fontSize: '0.7rem' }}>
                                                                <span>{new Date(log.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '800', color: '#ef4444' }}>{log.severity?.toUpperCase()}</span>
                                                            </div>
                                                            <div style={{ color: themeStyles.textMain, fontFamily: 'Courier New, monospace' }}>{log.log_message}</div>
                                                        </div>
                                                    ))
                                                ) : <div style={{ fontSize: '0.8rem', color: '#10b981', fontStyle: 'italic' }}>🟢 Clean slate: No system error logs found in current check cycle.</div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* 9. SLOW QUERIES */}
                                    {activeTab === 'slow_queries' && (
                                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '12px', border: themeStyles.cardBorder }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: '800', color: '#f59e0b' }}>Slow Query Diagnostic Logs</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                                                {summaryData.slow_query_logs && summaryData.slow_query_logs.length > 0 ? (
                                                    summaryData.slow_query_logs.map((log) => (
                                                        <div key={log.id} style={{ fontSize: '0.78rem', padding: '10px 12px', background: isLight ? '#fffbeb' : 'rgba(245,158,11,0.05)', borderLeft: '3px solid #f59e0b', borderRadius: '4px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: themeStyles.textMuted, fontSize: '0.7rem' }}>
                                                                <span>{new Date(log.log_time_ist).toLocaleString()}</span>
                                                                <span style={{ fontWeight: '800', color: '#f59e0b' }}>WARNING</span>
                                                            </div>
                                                            <div style={{ color: themeStyles.textMain, fontFamily: 'Courier New, monospace' }}>{log.log_message}</div>
                                                        </div>
                                                    ))
                                                ) : <div style={{ fontSize: '0.8rem', color: '#10b981', fontStyle: 'italic' }}>🟢 Optimal Performance: No slow query logs recorded.</div>}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '40px 0', textAlign: 'center', color: themeStyles.textMuted }}>
                                No telemetry data loaded. Switch tech tabs or refresh.
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
