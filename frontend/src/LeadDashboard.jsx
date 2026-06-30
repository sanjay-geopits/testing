import React, { useState, useEffect } from 'react';
import { useAuth, api } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Navigate, Link } from 'react-router-dom';
import { Home, Users, Monitor, ShieldCheck, ShieldAlert, LogOut, Sun, Moon, Power, Terminal, Activity, Trash2 } from 'lucide-react';

const LeadDashboard = () => {
    const { user, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('users');
    const [data, setData] = useState({ users: [], myTechs: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserTech, setNewUserTech] = useState('');

    const isUserActive = (lastActiveStr) => {
        if (!lastActiveStr || lastActiveStr === 'Never') return false;
        try {
            const lastActive = new Date(lastActiveStr.replace(' ', 'T'));
            const now = new Date();
            // Active if seen in last 5 minutes
            return (now - lastActive) < 5 * 60 * 1000;
        } catch (e) {
            return false;
        }
    };

    const formatLastActive = (dateStr) => {
        if (!dateStr || dateStr === 'Never') return 'Never';
        try {
            const lastActive = new Date(dateStr.replace(' ', 'T'));
            const now = new Date();
            const diffMs = now - lastActive;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${Math.floor(diffHours / 24)}d ago`;
        } catch (e) { return dateStr; }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const resUsers = await api.get('/lead/users');
            const resTechs = await api.get('/lead/technologies');
            
            setData({ 
                users: resUsers.data.users || [], 
                myTechs: resTechs.data.technologies || [] 
            });
            
            if (resTechs.data.technologies?.length > 0 && !newUserTech) {
                setNewUserTech(resTechs.data.technologies[0]);
            }
            
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to load lead dashboard");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!user) return;
        fetchData();
        const interval = setInterval(fetchData, 30000); // UI sync every 30s
        return () => clearInterval(interval);
    }, [user]);

    const handleToggleStatus = async (assignmentId) => {
        try {
            await api.patch(`/lead/users/${assignmentId}/status`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to toggle status");
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUserTech) {
            alert("No technology selected or available.");
            return;
        }
        try {
            await api.post('/lead/users', { email: newUserEmail, technology: newUserTech });
            setNewUserEmail('');
            setError(null);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to assign user");
        }
    };

    const handleDeleteAssignment = async (id) => {
        if (!window.confirm("Are you sure you want to remove this user assignment?")) return;
        try {
            await api.delete(`/lead/users/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to delete assignment");
        }
    };

    if (!user) return <Navigate to="/login" />;
    
    if (!loading && data.myTechs.length === 0 && !error) {
        return (
            <div style={{ padding: '100px 50px', textAlign: 'center', color: 'var(--text-main)' }}>
                <ShieldCheck size={64} style={{ color: 'var(--text-muted)', marginBottom: '20px' }} />
                <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 30px auto' }}>You have not been assigned lead privileges for any technology. Please contact an administrator to get access.</p>
                <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', fontWeight: 'bold' }}>
                    <Home size={18} /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: 'var(--bg-dark)', color: 'var(--text-main)', margin: '-10px -20px' }}>
            {/* Sidebar */}
            <div style={{ width: '280px', background: 'var(--bg-card)', backdropFilter: 'blur(10px)', borderRight: '1px solid var(--border-light)', padding: '30px 0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ padding: '0 25px 25px 25px', borderBottom: '1px solid var(--border-light)', marginBottom: '15px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#10b981' }}>Lead Panel</h2>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Management Console</p>
                </div>

                <button
                    onClick={() => setActiveTab('users')}
                    style={{ 
                        padding: '15px 25px',
                        background: activeTab === 'users' 
                            ? (theme === 'light' ? '#10b981' : 'rgba(16, 185, 129, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'users' 
                            ? (theme === 'light' ? 'white' : '#10b981') 
                            : 'var(--text-muted)', 
                        border: 'none',
                        borderLeft: activeTab === 'users' ? `4px solid ${theme === 'light' ? 'white' : '#10b981'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={18} />
                        Technology Users
                    </div>
                </button>

                <button
                    onClick={() => setActiveTab('status')}
                    style={{ 
                        padding: '15px 25px',
                        background: activeTab === 'status' 
                            ? (theme === 'light' ? '#10b981' : 'rgba(16, 185, 129, 0.1)') 
                            : 'transparent',
                        color: activeTab === 'status' 
                            ? (theme === 'light' ? 'white' : '#10b981') 
                            : 'var(--text-muted)', 
                        border: 'none',
                        borderLeft: activeTab === 'status' ? `4px solid ${theme === 'light' ? 'white' : '#10b981'}` : '4px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'status' ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Monitor size={18} />
                        User Activity
                    </div>
                </button>

                <div style={{ marginTop: 'auto', padding: '20px 25px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}>
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

            {/* Content Container */}
            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>
                        {activeTab === 'users' ? 'User Management' : 'Activity Monitoring'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
                        {activeTab === 'users' ? 'Assign users to the technologies you manage.' : 'Monitor the online status and last activity of your assigned users.'}
                    </p>
                </div>

                {error && <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '5px', marginBottom: '20px' }}>{error}</div>}

                {(data.myTechs.length > 0 || !loading) && (
                    <div className="glass" style={{ padding: '25px' }}>
                        {activeTab === 'users' && (
                            <div>
                                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--border-light)' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Assign User to Technology</h3>
                                    <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '15px', marginBottom: error ? '15px' : '0' }}>
                                        <input
                                            type="email"
                                            placeholder="User Email (e.g. associate@geopits.com)"
                                            required
                                            value={newUserEmail}
                                            onChange={e => {
                                                setNewUserEmail(e.target.value);
                                                if (error) setError(null);
                                            }}
                                            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                        />
                                        <select 
                                            value={newUserTech}
                                            onChange={e => setNewUserTech(e.target.value)}
                                            style={{ width: '220px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                        >
                                            {data.myTechs.map(tech => <option key={tech} value={tech}>{tech}</option>)}
                                        </select>
                                        <button type="submit" style={{ padding: '12px 25px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600', transition: 'opacity 0.2s' }}
                                            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                                        >
                                            Assign
                                        </button>
                                    </form>
                                    {error && (
                                        <div style={{ 
                                            marginTop: '15px', 
                                            padding: '12px', 
                                            background: 'rgba(239, 68, 68, 0.1)', 
                                            color: '#ef4444', 
                                            borderRadius: '6px', 
                                            border: '1px solid #ef4444',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <span>⚠️</span> {error}
                                        </div>
                                    )}
                                </div>

                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-main)' }}>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>User / Activity</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Technology</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned On</th>
                                            <th style={{ padding: '15px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.users.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No users assigned yet under your lead.</td></tr>
                                        ) : (
                                            data.users.map(u => (
                                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s', opacity: u.status === 'active' ? 1 : 0.7 }}>
                                                    <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            {u.profile_pic ? 
                                                                <img src={u.profile_pic} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${isUserActive(u.last_active_at) ? '#10b981' : 'var(--border-light)'}` }} /> :
                                                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: 'white', border: `2px solid ${isUserActive(u.last_active_at) ? '#10b981' : 'transparent'}` }}>
                                                                    {u.username?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'S'}
                                                                </div>
                                                            }
                                                            <div style={{ 
                                                                position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', 
                                                                background: isUserActive(u.last_active_at) ? '#10b981' : '#6b7280', border: '2px solid var(--bg-card)' 
                                                            }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {u.full_name || u.username || 'User'}
                                                                {isUserActive(u.last_active_at) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span>{u.email}</span>
                                                                <span style={{ fontSize: '0.7rem' }}>•</span>
                                                                <span style={{ color: isUserActive(u.last_active_at) ? '#10b981' : 'var(--text-muted)' }}>
                                                                    {isUserActive(u.last_active_at) ? 'Online' : `Seen ${formatLastActive(u.last_active_at)}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{u.technology}</span>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px', 
                                                            padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                                                            background: u.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: u.status === 'active' ? '#10b981' : '#ef4444',
                                                            border: `1px solid ${u.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                                        }}>
                                                            {u.status === 'active' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                                                            {u.status === 'active' ? 'Active' : 'Revoked'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.created_at}</td>
                                                    <td style={{ padding: '15px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button 
                                                                onClick={() => handleToggleStatus(u.id)}
                                                                title={u.status === 'active' ? 'Revoke Access' : 'Grant Access'}
                                                                style={{ 
                                                                    padding: '8px 12px', 
                                                                    background: u.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                                                    color: u.status === 'active' ? '#ef4444' : '#10b981', 
                                                                    border: `1px solid ${u.status === 'active' ? '#ef4444' : '#10b981'}`, 
                                                                    cursor: 'pointer', 
                                                                    borderRadius: '6px', 
                                                                    fontSize: '0.8rem', 
                                                                    fontWeight: '600', 
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    transition: 'all 0.2s' 
                                                                }}
                                                                onMouseEnter={(e) => { e.target.style.background = u.status === 'active' ? '#ef4444' : '#10b981'; e.target.style.color = 'white'; }}
                                                                onMouseLeave={(e) => { e.target.style.background = u.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'; e.target.style.color = u.status === 'active' ? '#ef4444' : '#10b981'; }}
                                                            >
                                                                {u.status === 'active' ? <Power size={14} /> : <ShieldCheck size={14} />}
                                                                {u.status === 'active' ? 'Revoke' : 'Grant'}
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => handleDeleteAssignment(u.id)}
                                                                title="Delete Assignment"
                                                                style={{ 
                                                                    padding: '8px', 
                                                                    background: 'transparent', 
                                                                    color: 'var(--text-muted)', 
                                                                    border: '1px solid var(--border-light)', 
                                                                    cursor: 'pointer', 
                                                                    borderRadius: '6px', 
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s' 
                                                                }}
                                                                onMouseEnter={(e) => { e.target.style.color = '#ef4444'; e.target.style.borderColor = '#ef4444'; }}
                                                                onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; e.target.style.borderColor = 'var(--border-light)'; }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'status' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                {data.users.map(u => {
                                    const active = isUserActive(u.last_active_at);
                                    return (
                                        <div key={u.id} style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', transition: 'transform 0.2s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                                                <div style={{ position: 'relative' }}>
                                                    {u.profile_pic ? 
                                                        <img src={u.profile_pic} alt="" style={{ width: 50, height: 50, borderRadius: '50%', border: '2px solid var(--border-light)' }} /> :
                                                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                                            {u.username?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'S'}
                                                        </div>
                                                    }
                                                    <div style={{ 
                                                        position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', 
                                                        background: active ? '#10b981' : 'var(--text-muted)', border: '2px solid var(--bg-card)',
                                                        boxShadow: active ? '0 0 10px #10b981' : 'none'
                                                    }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                                        {u.full_name || u.username || (u.email ? u.email.split('@')[0] : 'User')}
                                                        {!(u.full_name || u.username) && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'normal' }}>Pending Register</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border-light)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Technology:</span>
                                                    <span style={{ color: '#10b981', fontWeight: 600 }}>{u.technology}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Last Active:</span>
                                                    <span style={{ color: active ? '#10b981' : 'var(--text-muted)' }}>{u.last_active_at || 'Never'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {data.users.length === 0 && <div style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>No users found for activity monitoring.</div>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadDashboard;
