import React, { useState, useEffect } from 'react';
import { useAuth, api } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Navigate, Link } from 'react-router-dom';
import { Home, Trash2, ShieldCheck, ShieldAlert, LogOut, Sun, Moon } from 'lucide-react';

const AdminDashboard = () => {
    const { user, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('users');
    const [data, setData] = useState({ users: [], summaries: [], leads: [], dbTypes: [], leadActivity: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newLeadEmail, setNewLeadEmail] = useState('');
    const [newLeadTechs, setNewLeadTechs] = useState([]);
    const [assignedRole, setAssignedRole] = useState('user'); // 'user', 'lead', 'admin'
    const [showTechDropdown, setShowTechDropdown] = useState(false);

    // Client variables
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientTech, setNewClientTech] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientServer, setNewClientServer] = useState('');
    const [filterData, setFilterData] = useState({ db_types: [], clients: [], client_server_map: {}, db_server_map: {}, db_client_map: {} });

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
            } else if (activeTab === 'clients') {
                const res = await api.get('/admin/clients');
                setData(d => ({ ...d, clients: res.data.clients || [] }));
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

    const fetchClientFilters = async () => {
        try {
            const res = await api.get('/filters');
            setFilterData({
                db_types: res.data.db_types || [],
                clients: res.data.clients || [],
                client_server_map: res.data.client_server_map || {},
                db_server_map: res.data.db_server_map || {},
                db_client_map: res.data.db_client_map || {}
            });
        } catch (err) {
            console.error("Failed to fetch filters for client assignment dropdowns", err);
        }
    };

    useEffect(() => {
        if (!user?.isAdmin) return;
        fetchData();
        
        if ((activeTab === 'leads' || activeTab === 'clients') && data.dbTypes.length === 0) {
            fetchFilters();
        }
        if (activeTab === 'clients' && filterData.db_types.length === 0) {
            fetchClientFilters();
        }

        // Periodic data refresh every 30 seconds for "realtime" activity monitoring
        const interval = setInterval(() => fetchData(true), 30000);
        return () => clearInterval(interval);
    }, [activeTab, user]);

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

    const assignedClientOptions = React.useMemo(() => {
        if (!newClientTech) return filterData.clients || [];
        return filterData.db_client_map?.[newClientTech] || [];
    }, [newClientTech, filterData]);

    const assignedServerOptions = React.useMemo(() => {
        if (newClientName) return filterData.client_server_map?.[newClientName] || [];
        if (newClientTech) return filterData.db_server_map?.[newClientTech] || [];
        return [...new Set(Object.values(filterData.client_server_map || {}).flat())];
    }, [newClientName, newClientTech, filterData]);

    const handleAddClient = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/clients', {
                client_email: newClientEmail,
                technology: newClientTech,
                client_name: newClientName,
                server_name: newClientServer
            });
            setNewClientEmail('');
            setNewClientTech('');
            setNewClientName('');
            setNewClientServer('');
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleToggleClientStatus = async (client) => {
        try {
            await api.patch(`/admin/clients/${client.id}/status`);
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleDeleteClient = async (client) => {
        if (!window.confirm(`Are you sure you want to delete access for ${client.client_email}?`)) return;
        try {
            await api.delete(`/admin/clients/${client.id}`);
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
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
                    onClick={() => setActiveTab('clients')}
                    style={{
                        padding: '15px 25px',
                        background: activeTab === 'clients' 
                            ? (theme === 'light' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'clients' 
                            ? (theme === 'light' ? 'white' : '#f59e0b') 
                            : 'var(--text-muted)',
                        border: 'none',
                        borderLeft: activeTab === 'clients' ? `4px solid ${theme === 'light' ? 'white' : '#f59e0b'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'clients' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    Client Management
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
                            activeTab === 'clients' ? 'Client Access Control' : 'User Oversight (Activity)'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
                        {activeTab === 'users' ? 'Manage application users and monitor their activity.' :
                            activeTab === 'leads' ? 'Configure technology-specific access and user roles.' : 
                            activeTab === 'clients' ? 'Map client emails to database technologies, clients, and servers.' : 'Monitor users assigned by leads across different technologies.'}
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
                                                    {['MySQL', 'MSSQL', ...data.dbTypes.filter(t => !['MySQL', 'MSSQL'].includes(t))].map(tech => (
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

                        {activeTab === 'clients' && (
                            <div>
                                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--border-light)' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Assign Client Access</h3>
                                    <form onSubmit={handleAddClient} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                                        <input
                                            type="email"
                                            placeholder="Client Email (e.g. client@gmail.com)"
                                            required
                                            value={newClientEmail}
                                            onChange={e => setNewClientEmail(e.target.value)}
                                            style={{ flex: '1 1 200px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                        />
                                        <select
                                            required
                                            value={newClientTech}
                                            onChange={e => {
                                                setNewClientTech(e.target.value);
                                                setNewClientName('');
                                                setNewClientServer('');
                                            }}
                                            style={{ flex: '1 1 150px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer' }}
                                        >
                                            <option value="">Select Technology</option>
                                            {filterData.db_types.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <select
                                            required
                                            value={newClientName}
                                            onChange={e => {
                                                setNewClientName(e.target.value);
                                                setNewClientServer('');
                                            }}
                                            style={{ flex: '1 1 150px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer' }}
                                        >
                                            <option value="">Select Client</option>
                                            {assignedClientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <select
                                            required
                                            value={newClientServer}
                                            onChange={e => setNewClientServer(e.target.value)}
                                            style={{ flex: '1 1 150px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)', cursor: 'pointer' }}
                                        >
                                            <option value="">Select Server</option>
                                            {assignedServerOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button type="submit" style={{ padding: '12px 25px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600' }}>
                                            Assign
                                        </button>
                                    </form>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Client Access Assignments</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(data.clients || []).length} Records Found</span>
                                </div>

                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Client Email</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Technology</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Client Name</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Server Name</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Created At</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(!data.clients || data.clients.length === 0) ? (
                                            <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No client access privileges assigned yet.</td></tr>
                                        ) : (
                                            data.clients.map(client => (
                                                <tr key={client.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '15px', fontWeight: 500 }}>{client.client_email}</td>
                                                    <td style={{ padding: '15px', color: '#f59e0b', fontWeight: 600 }}>{client.technology}</td>
                                                    <td style={{ padding: '15px' }}>{client.client_name}</td>
                                                    <td style={{ padding: '15px' }}>{client.server_name}</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 'bold',
                                                            background: client.status === 'enabled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: client.status === 'enabled' ? '#10b981' : '#ef4444',
                                                            border: client.status === 'enabled' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                                                        }}>
                                                            {client.status?.toUpperCase() || 'ENABLED'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{client.created_at}</td>
                                                    <td style={{ padding: '15px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => handleToggleClientStatus(client)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: client.status === 'enabled' 
                                                                    ? (theme === 'light' ? 'rgba(239, 68, 68, 0.05)' : 'transparent')
                                                                    : (theme === 'light' ? 'rgba(16, 185, 129, 0.05)' : 'transparent'),
                                                                color: client.status === 'enabled' ? '#ef4444' : '#10b981',
                                                                border: `1px solid ${client.status === 'enabled' ? '#ef4444' : '#10b981'}`,
                                                                cursor: 'pointer',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {client.status === 'enabled' ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClient(client)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: '#ef4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                transition: 'all 0.2s'
                                                            }}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;


