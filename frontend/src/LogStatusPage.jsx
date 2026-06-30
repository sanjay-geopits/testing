import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth, api } from './AuthContext';
import { useTheme } from './ThemeContext';
import { ArrowLeft, Filter, RotateCcw, Sun, Moon, ShieldCheck, Eye, X, FileText } from 'lucide-react';

const stdStyle = { background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-light)', borderRadius: '4px', padding: '4px 6px', fontSize: '0.8rem', minWidth: '100px', cursor: 'pointer' };

const LogStatusPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [logs, setLogs] = useState([]);
    const [isFetching, setIsFetching] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [editingIdx, setEditingIdx] = useState(null);
    const [editMeta, setEditMeta] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewerLog, setViewerLog] = useState(null);


    const terminalStatuses = ['Resolved', 'Ignored', 'No action Required'];

    // Block client users from accessing the Log Status Archive page
    if (user?.isClientUser) {
        return <Navigate to="/" replace />;
    }

    const fetchLogs = async (statuses, searchVal = '') => {
        if (!statuses || statuses.length === 0) {
            setLogs([]);
            return;
        }
        setIsFetching(true);
        setErrorMsg('');
        try {
            const params = new URLSearchParams();
            statuses.forEach(st => params.append('log_status', st));
            params.append('limit', 200);
            params.append('offset', 0);

            const q = searchVal.trim();
            if (q) {
                if (/^\d+$/.test(q)) {
                    params.append('log_id', q);
                } else {
                    params.append('owner', q);
                }
            }

            const res = await api.get(`/logs?${params.toString()}`);
            setLogs(res.data.logs || []);
        } catch (err) {
            setErrorMsg('Failed to fetch logs.');
            console.error(err);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (selectedStatuses.length === 0) {
            setLogs([]);
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            fetchLogs(selectedStatuses, searchQuery);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [selectedStatuses, searchQuery]);

    const toggleStatus = (status) => {
        let newSel;
        if (selectedStatuses.includes(status)) {
            newSel = selectedStatuses.filter(s => s !== status);
        } else {
            newSel = [...selectedStatuses, status];
        }
        setSelectedStatuses(newSel);
    };


    const startEdit = (idx) => {
        const log = logs[idx];
        setEditingIdx(idx);
        setEditMeta({
            status: log.status || '',
            owner: log.owner || '',
            client_visibility: log.client_visibility || '',
            ticket_status: log.ticket_status || '',
            next_action: log.next_action || ''
        });
    };

    const cancelEdit = () => {
        setEditingIdx(null);
        setEditMeta({});
    };

    const handleSave = async (idx) => {
        const log = logs[idx];
        setIsSaving(true);
        try {
            await api.patch('/logs/metadata', {
                client_name: log.client_name,
                server_name: log.server_name,
                log_message: log.log_message,
                log_hash: log.log_hash,
                ...editMeta
            });
            // Update in place
            setLogs(prev => {
                const newLogs = [...prev];
                newLogs[idx] = { ...newLogs[idx], ...editMeta };
                return newLogs;
            });
            setEditingIdx(null);
            setEditMeta({});
        } catch (err) {
            console.error('Failed to save', err);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (idx) => {
        const log = logs[idx];
        const confirmRemove = window.confirm("Are you sure you want to remove this log from archive and move it back to the Log Panel?");
        if (!confirmRemove) return;
        
        setIsSaving(true);
        try {
            const revertMeta = {
                status: 'Open',
                owner: log.owner || user?.username || 'None',
                client_visibility: 'None',
                ticket_status: 'None',
                next_action: log.next_action || '',
                severity: log.severity || 'Unknown'
            };

            await api.patch('/logs/metadata', {
                client_name: log.client_name,
                server_name: log.server_name,
                log_message: log.log_message,
                log_hash: log.log_hash,
                ...revertMeta
            });

            // Remove from local list
            setLogs(prev => prev.filter((_, i) => i !== idx));
            alert("Log moved back to Monitoring Panel");
        } catch (err) {
            console.error('Failed to remove from archive', err);
            alert('Failed to remove log from archive');
        } finally {
            setIsSaving(false);
        }
    };

    const readOnlyCell = (value, fallback = '--') => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{value || fallback}</span>
    );

    const statusBadge = (status) => {
        const bg = status === 'Resolved' ? 'rgba(16, 185, 129, 0.15)' : status === 'Ignored' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(100, 116, 139, 0.15)';
        const color = status === 'Resolved' ? '#10b981' : status === 'Ignored' ? '#eab308' : '#64748b';
        return (
            <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', background: bg, color, border: `1px solid ${color}30` }}>
                {status}
            </span>
        );
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="header">
                <div className="title" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <ArrowLeft size={22} style={{ marginRight: '8px' }} />
                    Log Status Archive
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>

            <div className="container">
                <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Filter by Status</h3>
                            {isFetching && (
                                <div style={{ color: 'var(--color-primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', animation: 'fadeInDown 0.3s' }}>
                                    <div className="loader" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                                    Fetching logs...
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {terminalStatuses.map(st => (
                                <button
                                    key={st}
                                    onClick={() => toggleStatus(st)}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '8px',
                                        border: selectedStatuses.includes(st) ? '2px solid var(--color-primary)' : '2px solid var(--border-light)',
                                        background: selectedStatuses.includes(st) ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                                        color: 'var(--text-main)',
                                        fontWeight: selectedStatuses.includes(st) ? '700' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {selectedStatuses.includes(st) ? '✓ ' : ''}{st}
                                </button>
                            ))}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginTop: '5px' }}>
                            <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    placeholder="Search by Log ID or Owner..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                                    onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-input)',
                                        color: 'var(--text-main)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: '8px',
                                        padding: '10px 16px 10px 38px',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                />
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
                            </div>

                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        background: 'transparent', border: 'none', color: 'var(--color-primary)',
                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold'
                                    }}
                                >
                                    Clear Search
                                </button>
                            )}

                            {selectedStatuses.length > 0 && (
                                <button
                                    onClick={() => { setSelectedStatuses([]); setLogs([]); setSearchQuery(''); }}
                                    style={{
                                        background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)',
                                        padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    <RotateCcw size={14} /> Reset Filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>


                {/* Results */}
                <div className="table-container glass" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '1rem' }}>ID</th>
                                <th style={{ padding: '1rem' }}>Time (IST)</th>
                                <th style={{ padding: '1rem' }}>Client</th>
                                <th style={{ padding: '1rem' }}>Server</th>
                                <th style={{ padding: '1rem' }}>Type</th>
                                <th style={{ padding: '1rem' }}>Occurrences</th>
                                <th style={{ padding: '1rem', minWidth: '300px' }}>Message</th>
                                <th style={{ padding: '1rem' }}>Severity</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Owner</th>
                                <th style={{ padding: '1rem' }}>Saved At</th>
                                <th style={{ padding: '1rem' }}>Client Visibility</th>
                                <th style={{ padding: '1rem' }}>Ticket</th>
                                <th style={{ padding: '1rem' }}>Next Action</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isFetching ? (
                                <tr><td colSpan="15" style={{ textAlign: 'center', padding: '2rem' }}><div className="loader"></div> Fetching...</td></tr>
                            ) : errorMsg ? (
                                <tr><td colSpan="15" style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{errorMsg}</td></tr>
                            ) : selectedStatuses.length === 0 ? (
                                <tr><td colSpan="15" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Select a status filter above to view archived logs</div>
                                    <div style={{ fontSize: '0.85rem' }}>Logs marked as Resolved, Ignored, or No action Required will appear here</div>
                                </td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="15" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '1.1rem' }}>No logs found with status: {selectedStatuses.join(', ')}</div>
                                </td></tr>
                            ) : logs.filter(log => {
                                if (!searchQuery) return true;
                                const q = searchQuery.toLowerCase().trim();
                                const idMatch = log.id ? String(log.id).toLowerCase().includes(q) : false;
                                const ownerMatch = log.owner ? log.owner.toLowerCase().includes(q) : false;
                                return idMatch || ownerMatch;
                            }).length === 0 ? (
                                <tr><td colSpan="15" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '1.1rem' }}>No logs matched search: "{searchQuery}"</div>
                                </td></tr>
                            ) : (
                                logs.filter(log => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase().trim();
                                    const idMatch = log.id ? String(log.id).toLowerCase().includes(q) : false;
                                    const ownerMatch = log.owner ? log.owner.toLowerCase().includes(q) : false;
                                    return idMatch || ownerMatch;
                                }).map((log) => {
                                    const idx = logs.findIndex(l => l.log_hash === log.log_hash);
                                    const isEditing = editingIdx === idx;
                                    const isTerminal = terminalStatuses.includes(editMeta.status);
                                    const isSaveReady = isTerminal ? (editMeta.status && editMeta.owner) : Boolean(editMeta.status && editMeta.owner && editMeta.client_visibility && editMeta.ticket_status);
                                    const canSave = isSaveReady;
                                    return (
                                        <tr key={idx} className="log-row">

                                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{log.id}</td>
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{log.log_time_ist ? log.log_time_ist.replace('T', ' ').split('.')[0] : '-'}</td>
                                            <td style={{ padding: '1rem' }}>{log.client_name || '-'}</td>
                                            <td style={{ padding: '1rem' }}>{log.server_name || '-'}</td>
                                            <td style={{ padding: '1rem' }}>{log.log_type || '-'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>{log.occurrence_count || 1}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                                                    <div style={{ flex: 1, maxHeight: '4em', overflow: 'hidden', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'normal', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                                        {log.log_message}
                                                    </div>
                                                    <button
                                                        className="btn-icon-subtle"
                                                        onClick={(e) => { e.stopPropagation(); setViewerLog(log); }}
                                                        title="View Full Log"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {log.severity ? (
                                                    <span style={{
                                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                                                        color: log.severity === 'Medium' ? '#000' : '#fff',
                                                        background: log.severity === 'Critical' ? '#ef4444' : (log.severity === 'High' ? '#f97316' : (log.severity === 'Medium' ? '#eab308' : (log.severity === 'Low' ? '#3b82f6' : '#64748b')))
                                                    }}>
                                                        {log.severity}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            {/* Status */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <select value={editMeta.status} onChange={e => setEditMeta({ ...editMeta, status: e.target.value })} style={stdStyle}>
                                                        <option value="">-- None --</option>
                                                        {['Open', 'Under Review', 'Action Needed from Client', 'Action Needed from DBA', 'Monitoring', 'Resolved', 'Ignored', 'No action Required'].map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : statusBadge(log.status)}
                                            </td>
                                            {/* Owner */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <select value={editMeta.owner} onChange={e => setEditMeta({ ...editMeta, owner: e.target.value })} style={stdStyle}>
                                                        <option value="">PLEASE KINDLY ASSIGN USER</option>
                                                        {user?.username && <option value={user.username}>{user.username}</option>}
                                                        {log.owner && log.owner !== user?.username && log.owner !== '' && <option value={log.owner}>{log.owner}</option>}
                                                    </select>
                                                ) : readOnlyCell(log.owner, 'Unassigned')}
                                            </td>
                                            {/* Saved At */}
                                            <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {log.status_updated_at ? new Date(log.status_updated_at).toLocaleString() : '--'}
                                            </td>
                                            {/* Client Visibility */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <select value={editMeta.client_visibility} onChange={e => setEditMeta({ ...editMeta, client_visibility: e.target.value })} style={stdStyle}>
                                                        {['None', 'Internal only', 'Shared with client'].map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : readOnlyCell(log.client_visibility)}
                                            </td>
                                            {/* Ticket */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <select value={editMeta.ticket_status} onChange={e => setEditMeta({ ...editMeta, ticket_status: e.target.value })} style={stdStyle}>
                                                        {['None', 'Created', 'In progress', 'Not required'].map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : readOnlyCell(log.ticket_status)}
                                            </td>
                                            {/* Next Action */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <input type="text" value={editMeta.next_action} onChange={e => setEditMeta({ ...editMeta, next_action: e.target.value })} style={{ ...stdStyle, minWidth: '120px' }} placeholder="Next step..." />
                                                ) : readOnlyCell(log.next_action, 'No action')}
                                            </td>
                                            {/* Actions */}
                                            <td style={{ padding: '1rem' }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => handleSave(idx)}
                                                            disabled={isSaving || !canSave}
                                                            title={!canSave ? "Fill all tracking fields to Save" : "Save changes"}
                                                            style={{
                                                                padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold',
                                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                                color: 'white', border: 'none', borderRadius: '6px', 
                                                                cursor: canSave ? (isSaving ? 'wait' : 'pointer') : 'not-allowed',
                                                                opacity: canSave ? (isSaving ? 0.5 : 1) : 0.5, display: 'flex', alignItems: 'center', gap: '4px',
                                                                boxShadow: canSave ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 'none'
                                                            }}
                                                        >
                                                            <ShieldCheck size={14} /> Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingIdx(idx)}
                                                            title="Edit tracking info"
                                                            style={{
                                                                padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold',
                                                                background: theme === 'dark' ? '#374151' : '#f3f4f6', 
                                                                color: 'var(--text-main)', border: '1px solid var(--border-light)',
                                                                borderRadius: '6px', cursor: 'pointer'
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        {(log.owner === user?.username || user?.isAdmin) && (
                                                            <button
                                                                onClick={() => handleRemove(idx)}
                                                                title="Remove from archive and move back to panel"
                                                                style={{
                                                                    padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold',
                                                                    background: 'rgba(239, 68, 68, 0.1)', 
                                                                    color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                    borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                                                }}
                                                            >
                                                                <RotateCcw size={14} /> Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    (log.owner === user?.username || user?.isAdmin) && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                handleRemove(idx);
                                                            }}
                                                            disabled={isSaving}
                                                            title="Remove assignment and return to panel"
                                                            style={{
                                                                padding: '6px 12px', fontSize: '0.85rem', fontWeight: 'bold',
                                                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                                color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                                boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4), 0 2px 4px -1px rgba(239, 68, 68, 0.2)',
                                                                transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '4px'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                                            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                                                        >
                                                            🗑️ Remove
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Log Viewer Modal */}
            {viewerLog && (
                <div className="modal-backdrop" style={{ zIndex: 9999 }}>
                    <div className="glass modal-content" style={{ width: '80vw', maxWidth: '1000px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        <div className="ai-overlay-header" style={{ padding: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FileText size={22} color="var(--accent-glow)" />
                                <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>Full Log Event</h3>
                            </div>
                            <button onClick={() => setViewerLog(null)} className="btn-close" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={20} /></button>
                        </div>
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '25px',
                            marginTop: '20px',
                            fontFamily: "'Fira Code', 'Courier New', monospace",
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            color: '#e2e8f0',
                            background: 'rgba(0, 0, 0, 0.4)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                        }}>
                            {viewerLog.log_message}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogStatusPage;
