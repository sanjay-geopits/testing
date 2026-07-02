import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import GeopitsLogo from '../components/GeopitsLogo';
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true
});
import { 
    Activity, 
    FileText, 
    Ticket, 
    Sliders, 
    LogOut, 
    Terminal, 
    Cpu, 
    Database, 
    Layers, 
    CheckCircle,
    ArrowRight,
    ShieldAlert,
    Sun,
    Moon,
    Globe,
    Mail,
    ExternalLink,
    Star,
    MessageSquare,
    Bell,
    Clock,
    TrendingUp,
    AlertTriangle,
    Users,
    Zap,
    Shield,
    RefreshCw,
    ChevronRight,
    BarChart2,
    Server,
    X,
    CheckCheck,
    Trash2,
    Upload,
    UserCheck,
    AlertOctagon
} from 'lucide-react';

const Home = () => {
    const { user, logout, logoUrl } = useAuth();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';
    
    // Live clock state
    const [liveTime, setLiveTime] = useState(new Date());
    const [sessionStart] = useState(new Date());
    const [sessionDuration, setSessionDuration] = useState('0m 0s');
    const [tickerOffset, setTickerOffset] = useState(0);
    const tickerRef = useRef(null);
    const [activityFeed, setActivityFeed] = useState([]);
    const [systemStatus, setSystemStatus] = useState('Operational');

    // Custom System Telemetry Mock Stats for enterprise look
    const [telemetry, setTelemetry] = useState({
        systemLoad: '0.85%',
        dbConnections: '18 Active',
        uptime: '99.98%',
        pendingTickets: 0
    });
    const [totalReports, setTotalReports] = useState(0);
    const [clientsList, setClientsList] = useState([]);

    // Feedback form states
    const [feedbackText, setFeedbackText] = useState('');
    const [rating, setRating] = useState(5);
    const [feedbackSuccess, setFeedbackSuccess] = useState('');
    const [feedbackError, setFeedbackError] = useState('');
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        setFeedbackSuccess('');
        setFeedbackError('');
        if (!feedbackText.trim()) return;

        try {
            await api.post('/new-features/feedback', {
                feedback_text: feedbackText,
                rating
            });
            setFeedbackSuccess("Thank you! Your feedback has been securely logged with the administration team.");
            setFeedbackText('');
            setRating(5);
            setTimeout(() => setFeedbackSuccess(''), 5000);
        } catch (err) {
            setFeedbackError(err.response?.data?.detail || "Failed to log feedback. Please try again.");
            setTimeout(() => setFeedbackError(''), 5000);
        }
    };

    // Notification tray states
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);

    // ── Relative timestamp helper ──
    const getTimeAgo = (isoStr) => {
        const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    // ── Smart notification metadata (icon, color, category) ──
    const getNotifMeta = (message = '') => {
        const m = message.toLowerCase();
        if (m.includes('report') || m.includes('sla') || m.includes('diagnostic'))
            return { icon: <FileText size={14} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', category: 'Report' };
        if (m.includes('ticket') || m.includes('incident') || m.includes('issue'))
            return { icon: <Ticket size={14} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', category: 'Ticket' };
        if (m.includes('upload') || m.includes('added') || m.includes('new'))
            return { icon: <Upload size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', category: 'Upload' };
        if (m.includes('delete') || m.includes('removed') || m.includes('cleared'))
            return { icon: <Trash2 size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', category: 'Deleted' };
        if (m.includes('assign') || m.includes('owner') || m.includes('agent'))
            return { icon: <UserCheck size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.12)', category: 'Assignment' };
        if (m.includes('log') || m.includes('error') || m.includes('critical') || m.includes('alert'))
            return { icon: <AlertOctagon size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', category: 'Alert' };
        if (m.includes('privilege') || m.includes('access') || m.includes('permission') || m.includes('admin'))
            return { icon: <Shield size={14} />, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', category: 'Access' };
        if (m.includes('client') || m.includes('user') || m.includes('register'))
            return { icon: <Users size={14} />, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', category: 'User' };
        return { icon: <Bell size={14} />, color: '#64748b', bg: 'rgba(100,116,139,0.10)', category: 'System' };
    };

    // ── Mark single notification as read ──
    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        api.post(`/new-features/notifications/read/${id}`).catch(() => {});
    };

    // ── Mark all as read ──
    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        api.post('/new-features/notifications/read-all').catch(() => {});
    };

    // ── Clear all notifications ──
    const clearAllNotifications = () => {
        setNotifications([]);
        api.delete('/new-features/notifications/clear').catch(() => {});
    };

    // ── Refresh notifications manually ──
    const refreshNotifications = () => {
        setNotifLoading(true);
        api.get('/new-features/notifications')
            .then(res => {
                const notifs = res.data.notifications || [];
                setNotifications(notifs);
                const feed = notifs.slice(0, 6).map(n => ({
                    id: n.id || Math.random(),
                    type: n.type || 'info',
                    message: n.message || 'System event',
                    time: n.created_at || new Date().toISOString()
                }));
                if (feed.length > 0) setActivityFeed(feed);
            })
            .catch(() => {})
            .finally(() => setNotifLoading(false));
    };

    // Live clock + session timer
    useEffect(() => {
        const clockInterval = setInterval(() => {
            const now = new Date();
            setLiveTime(now);
            const elapsed = Math.floor((now - sessionStart) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            setSessionDuration(`${mins}m ${secs}s`);
        }, 1000);
        return () => clearInterval(clockInterval);
    }, [sessionStart]);

    // Ticker animation
    useEffect(() => {
        let frame;
        let pos = 0;
        const animate = () => {
            pos -= 0.5;
            if (tickerRef.current) {
                const width = tickerRef.current.scrollWidth / 2;
                if (Math.abs(pos) >= width) pos = 0;
                tickerRef.current.style.transform = `translateX(${pos}px)`;
            }
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {

        // Dynamic fetch of pending tickets count to show true system cohesion
        api.get('/new-features/tickets')
            .then(res => {
                const count = res.data.tickets?.filter(t => t.status?.toLowerCase() === 'open').length || 0;
                setTelemetry(prev => ({ ...prev, pendingTickets: count }));
            })
            .catch(err => console.error("Telemetry tick error:", err));

        // Dynamic fetch of total database reports files count
        api.get('/new-features/reports/counts')
            .then(res => {
                const countsMap = res.data || {};
                const total = Object.values(countsMap).reduce((sum, val) => sum + Number(val), 0);
                setTotalReports(total);
            })
            .catch(err => console.error("Telemetry reports count error:", err));

        // Fetch registered DB clients list for live server grid matrix
        api.get('/new-features/admin/clients')
            .then(res => {
                setClientsList(res.data.clients || []);
            })
            .catch(err => console.error("Error fetching db server grid clients:", err));

        const fetchNotifications = () => {
            api.get('/new-features/notifications')
                .then(res => {
                    const notifs = res.data.notifications || [];
                    setNotifications(notifs);
                    // Build activity feed from notifications
                    const feed = notifs.slice(0, 6).map(n => ({
                        id: n.id || Math.random(),
                        type: n.type || 'info',
                        message: n.message || n.title || 'System event',
                        time: n.created_at || new Date().toISOString()
                    }));
                    if (feed.length > 0) setActivityFeed(feed);
                })
                .catch(err => console.error("Error fetching notifications:", err));
        };
        
        fetchNotifications();
        // Refresh telemetry every 60s for live dashboard feel
        const notifInterval = setInterval(fetchNotifications, 15000);
        const telemetryInterval = setInterval(() => {
            api.get('/new-features/tickets')
                .then(res => {
                    const count = res.data.tickets?.filter(t => t.status?.toLowerCase() === 'open').length || 0;
                    setTelemetry(prev => ({ ...prev, pendingTickets: count }));
                })
                .catch(() => {});
        }, 60000);

        const handleOutsideClick = (e) => {
            if (!e.target.closest('.notification-container')) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);

        return () => {
            clearInterval(notifInterval);
            clearInterval(telemetryInterval);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    let menuItems = [
        {
            title: "Overall Summary Hub",
            subtitle: "SYSTEM TOPOLOGY & TELEMETRY",
            description: "Real-time, AI-driven hourly telemetry, database uptime history, and log streams for registered clients.",
            icon: <Activity style={{ color: '#ef4444' }} size={28} />,
            path: "/overall-summary",
            badge: "Operational Center",
            colorClass: "red-glow",
            metrics: "Realtime Analytics"
        },
        {
            title: "Real-time Log Intelligence",
            subtitle: "LOG MONITORING",
            description: "Advanced log query filters, live server severity mapping, database query logs anomaly engine, and instant AI automated diagnostic reports.",
            icon: <Activity style={{ color: '#2563eb' }} size={28} />,
            path: "/dashboard",
            badge: "Live Telemetry",
            colorClass: "blue-glow",
            metrics: "1,420 pings/sec"
        },
        {
            title: "Client Reports Hub",
            subtitle: "REPORTS & DOCUMENT ARCHIVES",
            description: "Publish, track, and download monthly administrative corporate audit files, database status reviews, and storage health assessments.",
            icon: <FileText style={{ color: '#16a34a' }} size={28} />,
            path: "/reports",
            badge: "Enterprise Vault",
            colorClass: "green-glow",
            metrics: `${totalReports} Client archives`
        },
        {
            title: "Helpdesk Incidents Portal",
            subtitle: "TICKET WORKSPACE",
            description: "Unified corporate helpdesk workflow. Log replica database warning tickets, view priority ratios, and track incident resolution pipelines.",
            icon: <Ticket style={{ color: '#7c3aed' }} size={28} />,
            path: "/tickets",
            badge: "Incident SLA",
            colorClass: "purple-glow",
            metrics: `${telemetry.pendingTickets} Unresolved alerts`
        },
        {
            title: "Server Details",
            subtitle: "DATABASE & TABLE GROWTH TELEMETRY",
            description: "Automated daily storage audits, database space growth charts, historical trends, and last week growth comparisons.",
            icon: <Database style={{ color: '#0ea5e9' }} size={28} />,
            path: "/telemetry-clients",
            badge: "Storage Growth",
            colorClass: "blue-glow",
            metrics: "Telemetry Active"
        },
        {
            title: "Observability Analytics Dashboard",
            subtitle: "ENTERPRISE METRICS & TRENDS",
            description: "Deep analytics on system MTTR (Mean Time to Resolution), log lifecycle pipeline, deduplication patterns, and workflow bottlenecks.",
            icon: <Sliders style={{ color: '#00f2ff' }} size={28} />,
            path: "/observability",
            badge: "Deep Analytics",
            colorClass: "cyan-glow",
            metrics: "MTTR & Trend Charts"
        },
    ];

    if (user?.role === 'admin' || user?.isAdmin) {
        menuItems.push({
            title: "Administrative Control Center",
            subtitle: "MANAGEMENT CONSOLE",
            description: "Manage global ticket attributes, add support agents, register company clients, update dynamic logos, and configure core system settings.",
            icon: <Sliders style={{ color: '#ea580c' }} size={28} />,
            path: "/admin",
            badge: "Admin Sovereignty",
            colorClass: "orange-glow",
            metrics: "System Config Enabled"
        });
        menuItems.push({
            title: "Admin Setup & Telemetry Console",
            subtitle: "AUTHORIZED OPERATIONS",
            description: "Register client database nodes, assign engineering permission matrices for database environments, and track user page visit logs.",
            icon: <Layers style={{ color: '#0284c7' }} size={28} />,
            path: "/admin/setup",
            badge: "Telemetry Console",
            colorClass: "blue-glow",
            metrics: "Node Provisioning Enabled"
        });
    }

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

    const formatTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const formatDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    const tickerItems = [
        `● SYSTEM STATUS: ${systemStatus}`,
        `● OPEN TICKETS: ${telemetry.pendingTickets}`,
        `● DB UPTIME: ${telemetry.uptime}`,
        `● ACTIVE CONNECTIONS: ${telemetry.dbConnections}`,
        `● REPORT ARCHIVES: ${totalReports}`,
        `● REGISTERED CLIENTS: ${clientsList.length}`,
        `● SESSION: ${sessionDuration}`,
        `● OPERATOR: ${user?.username?.toUpperCase() || 'N/A'}`,
        `● SECURITY LEVEL: HIGH`,
        `● ENVIRONMENT: PRODUCTION`,
    ];

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
                    <img src={logoUrl || "/static/applogo.svg"} alt="GeoMon" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0, color: themeStyles.textMain }}>
                            GeoMon <span style={{ fontWeight: '400', fontSize: '0.9rem', color: '#2563eb' }}>Portal</span>
                        </h1>
                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Enterprise Security & Incident Center</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Live Clock */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
                        border: themeStyles.inputBorder,
                        borderRadius: '10px',
                        padding: '6px 14px',
                        lineHeight: 1.3,
                        minWidth: '110px'
                    }}>
                        <span style={{ fontSize: '1rem', fontWeight: '800', letterSpacing: '1px', color: themeStyles.textMain, fontVariantNumeric: 'tabular-nums' }}>
                            {liveTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: themeStyles.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {liveTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                    </div>

                    {/* ── Notification Bell ── */}
                    <div className="notification-container" style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) refreshNotifications(); }}
                            style={{
                                position: 'relative',
                                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
                                border: notifications.some(n => !n.is_read) ? '1px solid rgba(239,68,68,0.4)' : themeStyles.inputBorder,
                                borderRadius: '10px',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                color: themeStyles.textMain,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'border-color 0.2s'
                            }}
                        >
                            <Bell size={18} style={{ color: notifications.some(n => !n.is_read) ? '#ef4444' : themeStyles.textMain }} />
                            {notifications.filter(n => !n.is_read).length > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    minWidth: '18px', height: '18px',
                                    background: '#ef4444', borderRadius: '20px',
                                    fontSize: '0.6rem', fontWeight: '800',
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', padding: '0 4px',
                                    border: `2px solid ${themeStyles.headerBg}`,
                                    animation: 'pulse-badge 2s infinite'
                                }}>
                                    {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                                width: '420px', maxHeight: '560px',
                                background: isLight ? '#ffffff' : '#0d1224',
                                border: themeStyles.cardBorder,
                                borderRadius: '18px',
                                boxShadow: isLight ? '0 20px 60px rgba(0,0,0,0.15)' : '0 20px 80px rgba(0,0,0,0.6)',
                                zIndex: 2000,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>

                                {/* ── Panel Header ── */}
                                <div style={{
                                    padding: '16px 18px 12px',
                                    borderBottom: themeStyles.cardBorder,
                                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.025)',
                                    flexShrink: 0
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Bell size={15} style={{ color: '#3b82f6' }} />
                                                <span style={{ fontWeight: '800', fontSize: '0.95rem', color: themeStyles.textMain }}>Notifications</span>
                                                {notifications.filter(n => !n.is_read).length > 0 && (
                                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: '800', padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.3px' }}>
                                                        {notifications.filter(n => !n.is_read).length} new
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: themeStyles.textMuted, marginTop: 3 }}>
                                                Scoped to <strong style={{ color: themeStyles.textMain }}>{user?.username || 'you'}</strong>
                                                {' · '}
                                                <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-badge 2s infinite' }} />
                                                    Live
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {/* Refresh */}
                                            <button onClick={refreshNotifications} title="Refresh"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyles.textMuted, padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                                                <RefreshCw size={13} style={{ animation: notifLoading ? 'spin 1s linear infinite' : 'none' }} />
                                            </button>
                                            {/* Close */}
                                            <button onClick={() => setShowNotifications(false)} title="Close"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyles.textMuted, padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action row */}
                                    {notifications.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                            <button onClick={markAllRead}
                                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', fontWeight: '700', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                                                <CheckCheck size={11} /> Mark all read
                                            </button>
                                            <button onClick={clearAllNotifications}
                                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', fontWeight: '700', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                                                <Trash2 size={11} /> Clear all
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ── Notification List ── */}
                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                    {notifLoading ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: themeStyles.textMuted, fontSize: '0.82rem' }}>
                                            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
                                            Loading notifications...
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div style={{ padding: '3rem 2rem', textAlign: 'center', color: themeStyles.textMuted }}>
                                            <CheckCircle size={36} style={{ color: '#10b981', margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                                            <div style={{ fontWeight: '700', fontSize: '0.88rem', color: themeStyles.textMain, marginBottom: 4 }}>All caught up!</div>
                                            <div style={{ fontSize: '0.75rem' }}>No notifications for {user?.username || 'you'} right now.</div>
                                        </div>
                                    ) : (
                                        notifications.map((notif, i) => {
                                            const meta = getNotifMeta(notif.message);
                                            const isUnread = !notif.is_read;
                                            return (
                                                <div key={notif.id}
                                                    onClick={() => markAsRead(notif.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                                        padding: '14px 18px',
                                                        borderBottom: i < notifications.length - 1 ? themeStyles.cardBorder : 'none',
                                                        background: isUnread
                                                            ? (isLight ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.06)')
                                                            : 'transparent',
                                                        cursor: isUnread ? 'pointer' : 'default',
                                                        transition: 'background 0.15s',
                                                        position: 'relative'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = isUnread
                                                        ? (isLight ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.06)')
                                                        : 'transparent'
                                                    }
                                                >
                                                    {/* Unread dot */}
                                                    {isUnread && (
                                                        <span style={{
                                                            position: 'absolute', top: '18px', left: '6px',
                                                            width: '5px', height: '5px',
                                                            borderRadius: '50%', background: '#3b82f6', flexShrink: 0
                                                        }} />
                                                    )}

                                                    {/* Category Icon */}
                                                    <div style={{
                                                        width: 34, height: 34, borderRadius: 10,
                                                        background: meta.bg,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: meta.color, flexShrink: 0
                                                    }}>
                                                        {meta.icon}
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                                                            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.5px', background: meta.bg, padding: '1px 7px', borderRadius: '20px', flexShrink: 0 }}>
                                                                {meta.category}
                                                            </span>
                                                            <span style={{ fontSize: '0.65rem', color: themeStyles.textMuted, flexShrink: 0 }}>
                                                                {getTimeAgo(notif.created_at)}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '0.82rem', color: isUnread ? themeStyles.textMain : themeStyles.textMuted, lineHeight: '1.5', fontWeight: isUnread ? '500' : '400', wordBreak: 'break-word' }}>
                                                            {notif.message}
                                                        </p>
                                                        {isUnread && (
                                                            <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: '700', marginTop: 4, display: 'inline-block' }}>Click to mark as read</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* ── Panel Footer ── */}
                                {notifications.length > 0 && (
                                    <div style={{
                                        padding: '10px 18px',
                                        borderTop: themeStyles.cardBorder,
                                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)',
                                        fontSize: '0.7rem', color: themeStyles.textMuted,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        flexShrink: 0
                                    }}>
                                        <span>{notifications.length} total · {notifications.filter(n => !n.is_read).length} unread</span>
                                        <span style={{ color: themeStyles.textMuted, fontStyle: 'italic' }}>Auto-refreshes every 15s</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Light/Dark Toggle switch */}
                    <button 
                        onClick={toggleTheme}
                        style={{ 
                            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                            border: themeStyles.inputBorder,
                            padding: '8px 14px', 
                            borderRadius: '8px', 
                            color: themeStyles.textMain, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        {isLight ? (
                            <>
                                <Moon size={15} style={{ color: '#64748b' }} />
                                <span>Dark Mode</span>
                            </>
                        ) : (
                            <>
                                <Sun size={15} style={{ color: '#fbbf24' }} />
                                <span>Light Mode</span>
                            </>
                        )}
                    </button>

                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
                        border: themeStyles.inputBorder,
                        padding: '6px 16px',
                        borderRadius: '30px'
                    }}>
                        {user?.profilePic ? (
                            <img src={user.profilePic} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid #38bdf8' }} />
                        ) : (
                            <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', 
                                color: '#fff', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '0.75rem'
                            }}>
                                {user?.username?.substring(0, 2).toUpperCase() || "OP"}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: themeStyles.textMain }}>{user?.username || "Operator"}</span>
                            <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {user?.role || "Specialist"}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={logout}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '700',
                            fontSize: '0.85rem'
                        }}
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </header>

            {/* MAIN CORE BODY */}
            <main style={{ flex: 1, padding: '3.5rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>

                {/* 1. CORE UTILITY GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                    {menuItems.map((item, idx) => (
                        <div 
                            key={idx}
                            onClick={() => {
                                if (item.isExternal) {
                                    window.open(item.path, '_blank');
                                } else if (item.isModal) {
                                    item.onClick();
                                } else {
                                    navigate(item.path);
                                }
                            }}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '2.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <span style={{ 
                                    fontSize: '0.68rem', 
                                    fontWeight: '700', 
                                    padding: '3px 10px', 
                                    borderRadius: '12px', 
                                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)',
                                    border: themeStyles.inputBorder,
                                    color: themeStyles.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {item.badge}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted, fontWeight: '500' }}>
                                    {item.metrics}
                                </span>
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1.5rem', 
                                background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.02)', 
                                border: themeStyles.inputBorder,
                                width: 'fit-content', 
                                padding: '14px', 
                                borderRadius: '14px' 
                            }}>
                                {item.icon}
                            </div>

                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                {item.subtitle}
                            </span>
                            <h3 style={{ fontSize: '1.35rem', fontWeight: '700', marginBottom: '1rem', color: themeStyles.textMain, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {item.title}
                                {item.path === '/tickets' && notifications.some(n => 
                                    !n.is_read && 
                                    n.message && 
                                    (n.message.toLowerCase().includes('ticket') || 
                                     n.message.toLowerCase().includes('reply') || 
                                     n.message.toLowerCase().includes('comment') || 
                                     n.message.toLowerCase().includes('replied'))
                                ) && (
                                    <span style={{
                                        display: 'inline-block',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#8b5cf6',
                                        boxShadow: '0 0 10px #8b5cf6',
                                        animation: 'pulse-purple 1.5s infinite ease-in-out'
                                    }} />
                                )}
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.88rem', lineHeight: '1.6', flex: 1 }}>
                                {item.description}
                            </p>
                            
                            <div style={{ 
                                marginTop: '2rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontWeight: '600', 
                                fontSize: '0.85rem', 
                                color: '#2563eb' 
                            }}>
                                <span>Access Module</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* 4. ENTERPRISE SERVICE PORTALS GRID */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                    <div>
                        <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Ecosystem Integration</span>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', margin: '4px 0 0 0', color: themeStyles.textMain }}>Enterprise Services Portal</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                        {/* GeoOps Card */}
                        <div 
                            onClick={() => window.open('https://production-geo-ops.netlify.app/dbserver', '_blank')}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '1.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ 
                                    fontSize: '0.62rem', 
                                    fontWeight: '700', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    background: 'rgba(14, 165, 233, 0.1)',
                                    color: '#0ea5e9',
                                    border: '1px solid rgba(14, 165, 233, 0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    External App
                                </span>
                                <ExternalLink size={12} style={{ color: themeStyles.textMuted }} />
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1rem', 
                                background: 'rgba(14, 165, 233, 0.08)',
                                border: '1px solid rgba(14, 165, 233, 0.15)',
                                width: 'fit-content', 
                                padding: '10px', 
                                borderRadius: '10px' 
                            }}>
                                <Globe style={{ color: '#0ea5e9' }} size={20} />
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                OPERATIONS DESK
                            </span>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.5rem', color: themeStyles.textMain }}>
                                GeoOps Portal
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.8rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                                Live database clusters, replication management consoles, failover scripts, and real-time schema analytics dashboards.
                            </p>
                            
                            <div style={{ 
                                marginTop: '1.25rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontWeight: '600', 
                                fontSize: '0.8rem', 
                                color: '#0ea5e9' 
                            }}>
                                <span>Access GeoOps</span>
                                <ArrowRight size={12} />
                            </div>
                        </div>

                        {/* Keka HR Card */}
                        <div 
                            onClick={() => window.open('https://geopits.keka.com/#/home', '_blank')}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '1.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ 
                                    fontSize: '0.62rem', 
                                    fontWeight: '700', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    background: 'rgba(168, 85, 247, 0.1)',
                                    color: '#a855f7',
                                    border: '1px solid rgba(168, 85, 247, 0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Geopits HRMS
                                </span>
                                <ExternalLink size={12} style={{ color: themeStyles.textMuted }} />
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1rem', 
                                background: 'rgba(168, 85, 247, 0.08)',
                                border: '1px solid rgba(168, 85, 247, 0.15)',
                                width: 'fit-content', 
                                padding: '10px', 
                                borderRadius: '10px' 
                            }}>
                                <Layers style={{ color: '#a855f7' }} size={20} />
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                HR & RESOURCES
                            </span>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.5rem', color: themeStyles.textMain }}>
                                Keka Portal
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.8rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                                Complete employee registry directory, shifts and leaves tracker, appraisal pipelines, and central payroll systems.
                            </p>
                            
                            <div style={{ 
                                marginTop: '1.25rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontWeight: '600', 
                                fontSize: '0.8rem', 
                                color: '#a855f7' 
                            }}>
                                <span>Access Keka</span>
                                <ArrowRight size={12} />
                            </div>
                        </div>

                        {/* Outlook Webmail Card */}
                        <div 
                            onClick={() => window.open(`https://outlook.office.com/mail/?login_hint=${encodeURIComponent(user?.email || '')}`, '_blank')}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '1.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ 
                                    fontSize: '0.62rem', 
                                    fontWeight: '700', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    background: 'rgba(37, 99, 235, 0.1)',
                                    color: '#2563eb',
                                    border: '1px solid rgba(37, 99, 235, 0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Microsoft 365
                                </span>
                                <ExternalLink size={12} style={{ color: themeStyles.textMuted }} />
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1rem', 
                                background: 'rgba(37, 99, 235, 0.08)',
                                border: '1px solid rgba(37, 99, 235, 0.15)',
                                width: 'fit-content', 
                                padding: '10px', 
                                borderRadius: '10px' 
                            }}>
                                <Mail style={{ color: '#2563eb' }} size={20} />
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                CORPORATE WEBMAIL
                            </span>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.5rem', color: themeStyles.textMain }}>
                                Outlook Mailbox
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.8rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                                Seamless corporate Outlook mailbox. Automatically logged in using Microsoft Sign-in credentials for {user?.email || 'authenticated specialist'}.
                            </p>
                            
                            <div style={{ 
                                marginTop: '1.25rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontWeight: '600', 
                                fontSize: '0.8rem', 
                                color: '#2563eb' 
                            }}>
                                <span>Access Outlook</span>
                                <ArrowRight size={12} />
                            </div>
                        </div>

                        {/* Microsoft Teams Workspace Card */}
                        <div 
                            onClick={() => window.open('https://teams.cloud.microsoft/', '_blank')}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '1.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(92, 107, 192, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ 
                                    fontSize: '0.62rem', 
                                    fontWeight: '700', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px', 
                                    background: 'rgba(92, 107, 192, 0.1)',
                                    color: '#5c6bc0',
                                    border: '1px solid rgba(92, 107, 192, 0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Collaboration
                                </span>
                                <ExternalLink size={12} style={{ color: themeStyles.textMuted }} />
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1rem', 
                                background: 'rgba(92, 107, 192, 0.08)',
                                border: '1px solid rgba(92, 107, 192, 0.15)',
                                width: 'fit-content', 
                                padding: '10px', 
                                borderRadius: '10px' 
                            }}>
                                <Globe style={{ color: '#5c6bc0' }} size={20} />
                            </div>

                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                COLLABORATION SUITE
                            </span>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.5rem', color: themeStyles.textMain }}>
                                Microsoft Teams Workspace
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.8rem', lineHeight: '1.5', flex: 1, margin: 0 }}>
                                Corporate Microsoft Teams workspace integration. Chat with specialized DBA support, join sync meetings, and coordinate alert resolutions.
                            </p>
                            
                            <div style={{ 
                                marginTop: '1.25rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontWeight: '600', 
                                fontSize: '0.8rem', 
                                color: '#5c6bc0' 
                            }}>
                                <span>Access Teams</span>
                                <ArrowRight size={12} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. DIRECT FEEDBACK SECTION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
                    <div>
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Direct Contact</span>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', margin: '4px 0 0 0', color: themeStyles.textMain }}>DIRECT FEEDBACK</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                        <div 
                            onClick={() => setShowFeedbackModal(true)}
                            style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '20px', 
                                padding: '2.5rem', 
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                e.currentTarget.style.boxShadow = isLight ? '0 10px 30px rgba(0,0,0,0.05)' : '0 10px 40px rgba(0,0,0,0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                e.currentTarget.style.boxShadow = isLight ? '0 4px 20px rgba(0,0,0,0.02)' : 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <span style={{ 
                                    fontSize: '0.68rem', 
                                    fontWeight: '700', 
                                    padding: '3px 10px', 
                                    borderRadius: '12px', 
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Direct Contact
                                </span>
                                <ExternalLink size={14} style={{ color: themeStyles.textMuted }} />
                            </div>
                            
                            <div style={{ 
                                marginBottom: '1.25rem', 
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                width: 'fit-content', 
                                padding: '12px', 
                                borderRadius: '12px' 
                            }}>
                                <MessageSquare style={{ color: '#10b981' }} size={24} />
                            </div>

                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                                DIRECT FEEDBACK
                            </span>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem', color: themeStyles.textMain }}>
                                Direct Feedback Form
                            </h3>
                            <p style={{ color: themeStyles.textMuted, fontSize: '0.85rem', lineHeight: '1.6', flex: 1, margin: 0 }}>
                                Submit suggestions, system anomalies, or operational feedback directly to the database administrator command center.
                            </p>
                            
                            <div style={{ 
                                marginTop: '1.5rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontWeight: '600', 
                                fontSize: '0.82rem', 
                                color: '#10b981' 
                            }}>
                                <span>Open Feedback Form</span>
                                <ArrowRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* HIGH-END FEEDBACK SURVEY DIALOG MODAL Overlay */}
            {showFeedbackModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '2rem'
                }}>
                    <div style={{
                        background: themeStyles.cardBg,
                        border: themeStyles.cardBorder,
                        borderRadius: '24px',
                        padding: '2.5rem',
                        maxWidth: '520px',
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px' }}>
                                    <MessageSquare style={{ color: '#10b981' }} size={24} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: themeStyles.textMain }}>Submit System Feedback</h3>
                            </div>
                            <button 
                                onClick={() => setShowFeedbackModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: themeStyles.textMuted,
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    lineHeight: 1
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <p style={{ color: themeStyles.textMuted, fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                            We appreciate your feedback! Share your experience, feature requests, or report system anomalies.
                        </p>

                        <form onSubmit={(e) => {
                            handleFeedbackSubmit(e).then(() => {
                                // Close modal after successful submission
                                setTimeout(() => setShowFeedbackModal(false), 2000);
                            });
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {feedbackSuccess && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', fontSize: '0.85rem' }}>
                                    <CheckCircle size={16} />
                                    <span>{feedbackSuccess}</span>
                                </div>
                            )}
                            {feedbackError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
                                    <ShieldAlert size={16} />
                                    <span>{feedbackError}</span>
                                </div>
                            )}



                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMain }}>Overall Rating</label>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                transition: 'transform 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Star
                                                size={24}
                                                style={{
                                                    fill: star <= rating ? '#ffaa00' : 'none',
                                                    color: star <= rating ? '#ffaa00' : themeStyles.textMuted
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMain }}>Feedback Comments / Suggestions</label>
                                <textarea
                                    className="login-input"
                                    placeholder="Tell us what you like or how we can improve Geopits..."
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    rows={4}
                                    required
                                    style={{ 
                                        margin: 0, 
                                        padding: '12px', 
                                        height: 'auto', 
                                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
                                        color: themeStyles.textMain, 
                                        border: themeStyles.inputBorder,
                                        borderRadius: '12px',
                                        resize: 'none' 
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                                <button 
                                    type="button"
                                    onClick={() => setShowFeedbackModal(false)}
                                    className="action-button secondary"
                                    style={{ flex: 1, padding: '12px', borderRadius: '12px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="action-button primary" 
                                    style={{ 
                                        flex: 1,
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '8px', 
                                        padding: '12px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: '600'
                                    }}
                                >
                                    <MessageSquare size={16} />
                                    <span>Submit Feedback</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
                    <span>Geopits Enterprise Service Active</span>
                </div>
                <span>&copy; {new Date().getFullYear()} Geopits Security Core. Prepared By SANJAY G. All database log streams are encrypted.</span>
            </footer>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                @keyframes pulse-badge {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
                    50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
                }
                @keyframes pulse-purple {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.6); }
                    50% { box-shadow: 0 0 0 5px rgba(139,92,246,0); }
                }
            `}</style>
        </div>
    );
};

export default Home;
