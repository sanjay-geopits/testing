import React, { useState, useEffect } from 'react';
import { useAuth, api } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Navigate, Link } from 'react-router-dom';
import { Home, Trash2, ShieldCheck, ShieldAlert, LogOut, Sun, Moon, Clock, RefreshCw } from 'lucide-react';

const AdminDashboard = () => {
    const { user, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('users');
    const [shareHistory, setShareHistory] = useState([]);
    const [data, setData] = useState({ users: [], summaries: [], leads: [], dbTypes: [], leadActivity: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newLeadEmail, setNewLeadEmail] = useState('');
    const [newLeadTechs, setNewLeadTechs] = useState([]);
    const [assignedRole, setAssignedRole] = useState('user'); // 'user', 'lead', 'admin'
    const [showTechDropdown, setShowTechDropdown] = useState(false);

    // Telemetry scheduler status & settings
    const [schedulerStatus, setSchedulerStatus] = useState(null);
    const [inputHour, setInputHour] = useState(14);
    const [inputMinute, setInputMinute] = useState(0);
    const [triggeringSync, setTriggeringSync] = useState(false);

    const isUserActive = (lastActiveStr) => {
        if (!lastActiveStr || lastActiveStr === 'Never') return false;
        try {
            const lastActive = new Date(lastActiveStr.replace(' ', 'T'));
            const now = new Date();
            // Active if within last 5 minutes
            return (now - lastActive) < 5 * 60 * 1000;
        } catch (e) {
            return false;
        }
    };

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await api.get('/admin/users');
                setData(d => ({ ...d, users: res.data.users }));
            } else if (activeTab === 'leads') {
                const res = await api.get('/admin/leads');
                setData(d => ({ ...d, leads: res.data.leads }));
            } else if (activeTab === 'activity') {
                const res = await api.get('/admin/lead-activity');
                setData(d => ({ ...d, leadActivity: res.data.activity }));
            } else if (activeTab === 'shares') {
                const res = await api.get('/new-features/reports/share/history');
                setShareHistory(res.data.history || []);
            } else if (activeTab === 'scheduler') {
                const res = await api.get('/admin/scheduler/status');
                setSchedulerStatus(res.data);
                setInputHour(res.data.trigger_hour);
                setInputMinute(res.data.trigger_minute);
            }
            setError(null);
        } catch (err) {
            console.error("Failed to fetch admin data", err);
            alert(err.response?.data?.detail || "Operation failed");
        }
        if (!silent) setLoading(false);
    };

    const fetchFilters = async () => {
        try {
            const res = await api.get('/filters');
            setData(d => ({ ...d, dbTypes: res.data.db_types || [] }));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!user?.isAdmin) return;
        fetchData();
        
        if (activeTab === 'leads' && data.dbTypes.length === 0) {
            fetchFilters();
        }

        // Periodic data refresh every 30 seconds for "realtime" activity monitoring
        const interval = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(interval);
    }, [activeTab, user]);

    const handleUpdateSchedulerSettings = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/scheduler/settings', {
                trigger_hour: parseInt(inputHour),
                trigger_minute: parseInt(inputMinute)
            });
            alert("Scheduler settings updated successfully!");
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to update scheduler settings");
        }
    };

    const handleTriggerManualSync = async () => {
        if (schedulerStatus?.sync_in_progress) return;
        setTriggeringSync(true);
        try {
            await api.post('/admin/scheduler/trigger');
            alert("Telemetry sync triggered successfully in the background!");
            setTimeout(() => fetchData(true), 1500);
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to trigger sync");
        } finally {
            setTriggeringSync(false);
        }
    };

    const handleAddLead = async (e) => {
        e.preventDefault();
        try {
            // First handle system role if 'admin' is selected
            if (assignedRole === 'admin') {
                try {
                    await api.patch('/admin/users/role', { 
                        email: newLeadEmail, 
                        role: 'admin' 
                    });
                } catch (roleErr) {
                    // If user is not found in the users table yet (hasn't logged in), 
                    // we can't set their role, but we still proceed with lead assignment.
                    console.warn("User role not updated (likely not registered yet):", roleErr);
                    if (roleErr.response && roleErr.response.status === 404) {
                        alert(`Note: ${newLeadEmail} hasn't logged in yet. They will be added to the lead table, but you'll need to grant Admin status again after their first login.`);
                    }
                }
            }

            // Perform the lead assignment
            const isLead = assignedRole === 'lead';
            
            // Post to leads table if techs are selected OR if it's an admin promotion
            // For admin promotion, we always ensure a 'Global' assignment is created in the leads table
            // as a persistent source of truth for the system role.
            if (newLeadTechs.length > 0 || assignedRole === 'admin') {
                const techsToSend = assignedRole === 'admin' ? ['Global'] : newLeadTechs;
                await api.post('/admin/leads', { 
                    email: newLeadEmail, 
                    technologies: techsToSend, 
                    is_lead: assignedRole === 'lead' || assignedRole === 'admin'
                });
            }

            setNewLeadEmail('');
            setNewLeadTechs([]);
            setAssignedRole('user');
            setShowTechDropdown(false);
            fetchData(true); // Silent refresh
        } catch (err) {
            const msg = (err.response && err.response.data && err.response.data.detail);
            alert(typeof msg === 'object' ? JSON.stringify(msg) : (msg || "Failed to add lead"));
        }
    };

    const handleToggleStatus = async (lead) => {
        const id = lead.id;
        const currentStatus = lead.status || 'active';
        const action = currentStatus === 'active' ? 'Revoke' : 'Activate';
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        
        try {
            // If we are revoking/activating an admin assignment, sync the system role
            if (lead.technology === 'Global' || lead.role === 'admin') {
                await api.patch('/admin/users/role', { 
                    email: lead.email, 
                    role: newStatus === 'active' ? 'admin' : 'user' 
                });
            }
            
            await api.patch(`/admin/leads/${id}/status`);
            fetchData(true); // Silent refresh
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleDeleteLead = async (lead) => {
        const isRevokingAdmin = lead.role === 'admin';
        const msg = isRevokingAdmin 
            ? `Are you sure you want to REVOKE ADMIN ACCESS and delete this assignment for ${lead.email}?`
            : "Are you sure you want to PERMANENTLY delete this assignment? This cannot be undone.";
        
        if (!window.confirm(msg)) return;

        try {
            if (isRevokingAdmin) {
                // Also demote the user to 'user' role
                await api.patch('/admin/users/role', { 
                    email: lead.email, 
                    role: 'user' 
                });
            }
            await api.delete(`/admin/leads/${lead.id}`);
            fetchData(true); // Silent refresh
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleToggleAdmin = async (identifier, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const action = newRole === 'admin' ? 'Grant Admin Access' : 'Revoke Admin Access';
        
        if (!window.confirm(`Are you sure you want to ${action} for ${identifier}?`)) return;

        try {
            await api.patch('/admin/users/role', { 
                username: identifier,
                role: newRole 
            });
            fetchData(true); // Silent refresh
        } catch (err) {
            alert(err.response?.data?.detail || "Role update failed");
        }
    };

    if (!user?.isAdmin) {
        return <Navigate to="/" />;
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: 'var(--bg-dark)', color: 'var(--text-main)', margin: '-10px -20px' }}>
            {/* Vertical Sidebar */}
            <div style={{
                width: '280px',
                background: 'var(--bg-card)',
                backdropFilter: 'blur(10px)',
                borderRight: '1px solid var(--border-light)',
                padding: '30px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            }}>
                <div style={{ padding: '0 25px 25px 25px', borderBottom: '1px solid var(--border-light)', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#f59e0b' }}>Admin Panel</h2>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Management Console</p>
                </div>

                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'users' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'users' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'users' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    System Users
                </button>

                <button
                    onClick={() => setActiveTab('leads')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'leads' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'leads' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'leads' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'leads' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    User Management
                </button>

                <button
                    onClick={() => setActiveTab('activity')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'activity' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'activity' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'activity' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'activity' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    Lead Activity
                </button>

                <button
                    onClick={() => setActiveTab('shares')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'shares' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'shares' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'shares' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'shares' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    Sharing Monitoring
                </button>

                <button
                    onClick={() => setActiveTab('scheduler')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'scheduler' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'scheduler' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'scheduler' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'scheduler' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    Scheduler & Ingestion
                </button>

                <div style={{ marginTop: 'auto', padding: '20px 25px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                    <button 
                        onClick={() => theme !== 'light' && toggleTheme()}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: theme === 'light' ? 'var(--accent-glow)' : 'transparent',
                            border: `1px solid ${theme === 'light' ? 'var(--accent-glow)' : 'var(--border-light)'}`,
                            color: theme === 'light' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            fontWeight: theme === 'light' ? '600' : '400'
                        }}
                    >
                        <Sun size={16} /> Light
                    </button>
                    <button 
                        onClick={() => theme !== 'dark' && toggleTheme()}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: theme === 'dark' ? 'var(--accent-glow)' : 'transparent',
                            border: `1px solid ${theme === 'dark' ? 'var(--accent-glow)' : 'var(--border-light)'}`,
                            color: theme === 'dark' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            fontWeight: theme === 'dark' ? '600' : '400'
                        }}
                    >
                        <Moon size={16} /> Dark
                    </button>
                </div>
                    
                    <Link to="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-muted)',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        transition: 'color 0.2s'
                    }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--text-main)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                        <Home size={18} />
                        Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>
                        {activeTab === 'users' ? 'System Users' :
                            activeTab === 'leads' ? 'User Management (Privileges)' :
                            activeTab === 'shares' ? 'Document Sharing History' : 
                            activeTab === 'scheduler' ? 'Telemetry Scheduler & Ingestion' : 'User Oversight (Activity)'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
                        {activeTab === 'users' ? 'Manage application users and monitor their activity.' :
                            activeTab === 'leads' ? 'Configure technology-specific access and user roles.' :
                            activeTab === 'shares' ? 'Audit and track premium document share operations across platforms.' :
                            activeTab === 'scheduler' ? 'Configure daily automated telemetry ingestion schedules or trigger manually.' : 'Monitor users assigned by leads across different technologies.'}
                    </p>
                </div>

                {loading && <div style={{ padding: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '10px' }}><div className="loader"></div> Loading dashboard data...</div>}
                {error && <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '5px', border: '1px solid #ef4444' }}>{error}</div>}

                {!loading && !error && (
                    <div className="glass" style={{ padding: '25px' }}>

                        {activeTab === 'users' && (
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                        <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>User</th>
                                        <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                                        <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Role</th>
                                        <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Last Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.users.map(u => (
                                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    {u.profile_pic ?
                                                        <img src={u.profile_pic} alt="Profile" style={{ width: 35, height: 35, borderRadius: '50%', border: '2px solid var(--border-light)' }} /> :
                                                        <div style={{ width: 35, height: 35, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', color: 'white', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{u.username?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'S'}</div>
                                                    }
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        right: 0,
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        background: isUserActive(u.last_active_at) ? '#10b981' : 'var(--text-muted)',
                                                        border: '2px solid var(--bg-card)',
                                                        boxShadow: isUserActive(u.last_active_at) ? '0 0 10px #10b981' : 'none'
                                                    }} />
                                                </div>
                                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{u.full_name || u.username}</span>
                                            </td>
                                            <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{u.email}</td>
                                            <td style={{ padding: '15px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    background: u.role === 'admin' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-input)',
                                                    color: u.role === 'admin' ? '#f59e0b' : 'var(--text-muted)',
                                                    border: u.role === 'admin' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid var(--border-light)'
                                                }}>
                                                    {u.role?.toUpperCase() || 'USER'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{u.last_active_at || 'Never'}</td>
                                            <td style={{ padding: '15px', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleToggleAdmin(u.username, u.role)}
                                                    title={u.role === 'admin' ? "Remove Admin Access" : "Grant Admin Access"}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: u.role === 'admin' ? '#f59e0b' : 'var(--text-muted)',
                                                        padding: '5px',
                                                        borderRadius: '4px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {u.role === 'admin' ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'leads' && (
                            <div>
                                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--border-light)' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Grant New Privilege</h3>
                                    <form onSubmit={handleAddLead} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <input
                                            type="email"
                                            placeholder="Lead Email (e.g. user@gmail.com)"
                                            required
                                            value={newLeadEmail}
                                            onChange={e => setNewLeadEmail(e.target.value)}
                                            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                        />
                                        <div style={{ position: 'relative', width: '280px', opacity: assignedRole === 'admin' ? 0.6 : 1 }}>
                                            <div
                                                onClick={() => assignedRole !== 'admin' && setShowTechDropdown(!showTechDropdown)}
                                                style={{
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border-light)',
                                                    background: 'var(--bg-input)',
                                                    color: assignedRole === 'admin' ? 'var(--text-muted)' : (newLeadTechs.length > 0 ? 'var(--text-main)' : 'var(--text-muted)'),
                                                    cursor: assignedRole === 'admin' ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.9rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {assignedRole === 'admin' ? "Global Access" : (newLeadTechs.length === 0 ? "Select Technologies" : `${newLeadTechs.length} selected`)}
                                                <span>{showTechDropdown && assignedRole !== 'admin' ? '▲' : '▼'}</span>
                                            </div>

                                            {showTechDropdown && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    right: 0,
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-light)',
                                                    borderRadius: '6px',
                                                    marginTop: '5px',
                                                    zIndex: 100,
                                                    boxShadow: 'var(--shadow-lg)',
                                                    maxHeight: '200px',
                                                    overflowY: 'auto'
                                                }}>
                                                    {['MySQL', 'MSSQL', 'postgres', ...data.dbTypes.filter(t => !['MySQL', 'MSSQL', 'postgres'].includes(t))].map(tech => (
                                                        <label key={tech} style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '10px 12px',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                            color: 'var(--text-main)'
                                                        }}
                                                            onMouseEnter={(e) => e.target.style.background = 'var(--bg-input)'}
                                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={newLeadTechs.includes(tech)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setNewLeadTechs([...newLeadTechs, tech]);
                                                                    else setNewLeadTechs(newLeadTechs.filter(t => t !== tech));
                                                                }}
                                                            />
                                                            {tech}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <select
                                            value={assignedRole}
                                            onChange={e => setAssignedRole(e.target.value)}
                                            style={{ 
                                                padding: '12px', 
                                                borderRadius: '6px', 
                                                border: '1px solid var(--border-light)', 
                                                background: 'var(--bg-input)', 
                                                color: 'var(--text-main)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="user">Regular User</option>
                                            <option value="lead">Technology Lead</option>
                                            <option value="admin">System Admin</option>
                                        </select>
                                        <button type="submit" style={{ padding: '12px 25px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600' }}>
                                            Assign Privilege
                                        </button>
                                    </form>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Active Assignments</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{data.leads.length} Records Found</span>
                                </div>

                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Technology</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Added On</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.leads.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No privileges assigned yet.</td></tr>
                                        ) : (
                                            data.leads.map(lead => (
                                                <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '15px', fontWeight: 500 }}>{lead.email}</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>{lead.technology}</span>
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                background: lead.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : (lead.is_lead ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.1)'),
                                                                color: lead.role === 'admin' ? '#ef4444' : (lead.is_lead ? '#f59e0b' : '#94a3b8'),
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                border: `1px solid ${lead.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : (lead.is_lead ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)')}`,
                                                                fontWeight: 'bold',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {lead.role === 'admin' ? 'Admin' : (lead.is_lead ? 'Lead' : 'User')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold',
                                                            background: lead.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: lead.status === 'active' ? 'var(--color-success)' : 'var(--color-error)',
                                                            border: lead.status === 'active' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                                        }}>
                                                            {lead.status?.toUpperCase() || 'ACTIVE'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{lead.created_at}</td>
                                                    <td style={{ padding: '15px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => handleToggleStatus(lead)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: lead.status === 'active' 
                                                                    ? (theme === 'light' ? 'rgba(239, 68, 68, 0.05)' : 'transparent')
                                                                    : (theme === 'light' ? 'rgba(16, 185, 129, 0.05)' : 'transparent'),
                                                                color: lead.status === 'active' ? 'var(--color-error)' : 'var(--color-success)',
                                                                border: `1px solid ${lead.status === 'active' ? 'var(--color-error)' : 'var(--color-success)'}`,
                                                                cursor: 'pointer',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => e.target.style.background = lead.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}
                                                            onMouseOut={(e) => e.target.style.background = lead.status === 'active' 
                                                                ? (theme === 'light' ? 'rgba(239, 68, 68, 0.05)' : 'transparent')
                                                                : (theme === 'light' ? 'rgba(16, 185, 129, 0.05)' : 'transparent')}
                                                        >
                                                            {lead.status === 'active' ? 'Revoke Access' : 'Reactivate'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteLead(lead)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: 'var(--color-error)',
                                                                color: 'white',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s',
                                                                boxShadow: theme === 'light' ? '0 2px 8px rgba(239, 68, 68, 0.2)' : 'none'
                                                            }}
                                                            onMouseOver={(e) => e.target.style.filter = 'brightness(0.9)'}
                                                            onMouseOut={(e) => e.target.style.filter = 'none'}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Lead-Assigned Users</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{data.leadActivity.length} Records Found</span>
                                </div>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned User</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Technology</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Overseeing Lead(s)</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Activity Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.leadActivity.length === 0 ? (
                                            <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No lead-assigned users found.</td></tr>
                                        ) : (
                                            data.leadActivity.map(act => (
                                                <tr key={act.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {act.profile_pic ?
                                                                <img src={act.profile_pic} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} /> :
                                                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', color: 'white', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                                                    {act.username && act.username[0] ? act.username[0].toUpperCase() : (act.user_email && act.user_email[0] ? act.user_email[0].toUpperCase() : 'S')}
                                                                </div>
                                                            }
                                                            <div>
                                                                <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{act.user_name || act.username || (act.user_email ? act.user_email.split('@')[0] : 'User')}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{act.user_email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                                                            {act.technology}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                                        {act.lead_emails || 'No active lead!'}
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '10px', height: '10px', borderRadius: '50%',
                                                                background: isUserActive(act.last_active_at) ? '#10b981' : 'var(--text-muted)',
                                                                boxShadow: isUserActive(act.last_active_at) ? '0 0 10px #10b981' : 'none'
                                                            }} />
                                                            <span style={{ color: isUserActive(act.last_active_at) ? '#10b981' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                                {isUserActive(act.last_active_at) ? 'Online' : (act.last_active_at === 'Never' ? 'Pending Register' : `Last: ${act.last_active_at}`)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'shares' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Report Document Share Auditing</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{shareHistory.length} share events logged</span>
                                </div>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Document Title</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Shared By</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Platform</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Recipient / Details</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shareHistory.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No document sharing events logged yet.</td></tr>
                                        ) : (
                                            shareHistory.map(log => (
                                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '15px', fontWeight: 600, color: 'var(--text-main)' }}>{log.report_title}</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{log.shared_by}</span>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: '700',
                                                            background: log.share_platform === 'email' ? 'rgba(59, 130, 246, 0.1)' 
                                                                        : log.share_platform === 'whatsapp' ? 'rgba(16, 185, 129, 0.1)' 
                                                                        : log.share_platform === 'teams' ? 'rgba(99, 102, 241, 0.1)' 
                                                                        : 'rgba(245, 158, 11, 0.1)',
                                                            color: log.share_platform === 'email' ? '#3b82f6' 
                                                                    : log.share_platform === 'whatsapp' ? '#10b981' 
                                                                    : log.share_platform === 'teams' ? '#6366f1' 
                                                                    : '#f59e0b',
                                                            border: log.share_platform === 'email' ? '1px solid rgba(59, 130, 246, 0.2)' 
                                                                    : log.share_platform === 'whatsapp' ? '1px solid rgba(16, 185, 129, 0.2)' 
                                                                    : log.share_platform === 'teams' ? '1px solid rgba(99, 102, 241, 0.2)' 
                                                                    : '1px solid rgba(245, 158, 11, 0.2)',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {log.share_platform}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>{log.recipient || 'N/A (OS Native)'}</td>
                                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'scheduler' && schedulerStatus && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                <style dangerouslySetInnerHTML={{__html: `
                                    @keyframes spin-sync {
                                        from { transform: rotate(0deg); }
                                        to { transform: rotate(360deg); }
                                    }
                                    .spin-sync-icon {
                                        animation: spin-sync 1.5s linear infinite;
                                    }
                                `}} />
                                
                                <div style={{ 
                                    background: 'var(--bg-input)', 
                                    padding: '25px', 
                                    borderRadius: '12px', 
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={20} /> Scheduler Status
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <div>Daemon Status: <strong style={{ color: schedulerStatus.sync_in_progress ? '#f59e0b' : '#10b981' }}>{schedulerStatus.status}</strong></div>
                                            <div>Next Scheduled Run: <strong>{String(schedulerStatus.trigger_hour).padStart(2, '0')}:{String(schedulerStatus.trigger_minute).padStart(2, '0')} IST Daily</strong></div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                                        <button
                                            onClick={handleTriggerManualSync}
                                            disabled={schedulerStatus.sync_in_progress || triggeringSync}
                                            style={{
                                                padding: '12px 24px',
                                                background: schedulerStatus.sync_in_progress || triggeringSync ? 'var(--border-light)' : '#f59e0b',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: schedulerStatus.sync_in_progress || triggeringSync ? 'not-allowed' : 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                boxShadow: '0 4px 12px rgba(245,158,11,0.2)',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'translateY(-1px)')}
                                            onMouseOut={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'translateY(0)')}
                                        >
                                            <RefreshCw size={16} className={schedulerStatus.sync_in_progress || triggeringSync ? "spin-sync-icon" : ""} />
                                            {schedulerStatus.sync_in_progress ? 'Syncing...' : 'Sync Now'}
                                        </button>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trigger manual database telemetry mail sync</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                                    <div style={{ background: 'var(--bg-input)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem' }}>Ingestion Trigger Settings</h3>
                                        <form onSubmit={handleUpdateSchedulerSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ display: 'flex', gap: '15px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Hour (24-hour format)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="23"
                                                        required
                                                        value={inputHour}
                                                        onChange={e => setInputHour(e.target.value)}
                                                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Minute</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="59"
                                                        required
                                                        value={inputMinute}
                                                        onChange={e => setInputMinute(e.target.value)}
                                                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                                                    />
                                                </div>
                                            </div>
                                            <button type="submit" style={{ padding: '12px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600', transition: 'all 0.2s' }}>
                                                Save Settings
                                            </button>
                                        </form>
                                    </div>

                                    <div style={{ background: 'var(--bg-input)', padding: '25px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Last Run Report</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Last Sync Time</span>
                                                <span style={{ fontWeight: 600 }}>{schedulerStatus.last_sync_time}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Last Sync Status</span>
                                                <span style={{ 
                                                    fontWeight: 600, 
                                                    color: schedulerStatus.last_sync_status.startsWith('Success') ? '#10b981' : (schedulerStatus.last_sync_status === 'N/A' ? 'var(--text-muted)' : '#ef4444') 
                                                }}>{schedulerStatus.last_sync_status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;

