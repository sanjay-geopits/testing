import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, api } from './AuthContext';
import {
    Search, LogOut, Sun, Moon, RefreshCw, Sparkles, Share2, Shield, ShieldCheck, X, Loader, Download, MessageSquare, FileText, Eye, History, Save, MoreVertical, ExternalLink, ChevronLeft, ChevronRight
} from 'lucide-react';
import { marked } from 'marked';
import { ThemeContext } from './ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import GeopitsLogo from './components/GeopitsLogo';

const getSeverityLevel = (severityObj, msg) => {
    if (severityObj && typeof severityObj === 'string') {
        const s = severityObj.toLowerCase();
        if (s === 'critical') return 'critical';
        if (s === 'high') return 'high';
        if (s === 'medium') return 'medium';
        if (s === 'low') return 'low';
        return 'unknown';
    }
    const m = msg?.toLowerCase() || '';
    if (m.includes('crit') || m.includes('fatal')) return 'critical';
    if (m.includes('error') || m.includes('fail')) return 'high';
    if (m.includes('warn')) return 'medium';
    return 'unknown';
};

const getISTDateString = (offsetMs) => {
    try {
        const targetUTC = new Date(Date.now() - offsetMs);
        // Shift by +05:30 (19800000 ms) for Indian Standard Time
        const istTime = new Date(targetUTC.getTime() + 19800000);
        return istTime.toISOString().replace('T', ' ').substring(0, 19);
    } catch (err) {
        console.error('Date error fallback', err);
        return new Date(Date.now() - offsetMs).toISOString().replace('T', ' ').substring(0, 19);
    }
};

const Dashboard = () => {
    const { user, token, logout } = useAuth();
    const { isDarkMode, toggleTheme } = React.useContext(ThemeContext);
    const navigate = useNavigate();
    const [logo, setLogo] = useState('/static/logo.png');

    useEffect(() => {
        fetch('/api/new-features/settings/logo')
            .then(res => res.json())
            .then(data => {
                if (data.logo) {
                    setLogo(data.logo);
                }
            })
            .catch(err => console.error("Error loading logo:", err));
    }, []);

    const authHeader = () => token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    // Core Data
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [menuOpenFor, setMenuOpenFor] = useState(null); // Which log has the 3-dot menu open
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [sharingLog, setSharingLog] = useState(null);
    const [shareTarget, setShareTarget] = useState(''); // 'whats-app', 'teams', 'word'
    const [sharePurpose, setSharePurpose] = useState('');
    const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

    // Pagination
    const [offset, setOffset] = useState(0);
    const PAGE_SIZE = 100;

    // Debugging Lead role
    useEffect(() => {
        if (user) {
            console.log("DEBUG_USER_SESSION:", {
                username: user.username,
                role: user.role,
                isAdmin: user.isAdmin,
                email: user.email
            });
        }
    }, [user]);
    const [aiSummary, setAiSummary] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const [aiReport, setAiReport] = useState(null);
    const [viewerLog, setViewerLog] = useState(null);
    const [generatingAI, setGeneratingAI] = useState(false);

    // Flow & Modals
    const [confirmAIModal, setConfirmAIModal] = useState(false);

    // AI History
    const [aiHistoryModal, setAiHistoryModal] = useState(false);
    const [aiHistoryData, setAiHistoryData] = useState([]);
    const [aiHistoryDetail, setAiHistoryDetail] = useState(null);

    // Share History
    const [shareHistoryModal, setShareHistoryModal] = useState(false);
    const [shareHistoryData, setShareHistoryData] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('all');
    const [selectedTechnology, setSelectedTechnology] = useState('All Technologies');
    const [selectedClient, setSelectedClient] = useState('All Clients');
    const [selectedServer, setSelectedServer] = useState('All Servers');
    const [selectedLogType, setSelectedLogType] = useState('All Log Types');
    const [selectedSeverity, setSelectedSeverity] = useState('All Severities');
    const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('None');
    const [usersInTech, setUsersInTech] = useState([]);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // New State for Counts
    const [totalLogsCount, setTotalLogsCount] = useState(0);
    const [ownerCounts, setOwnerCounts] = useState({});
    const [totalAssignedCount, setTotalAssignedCount] = useState(0);
    const [totalUnassignedCount, setTotalUnassignedCount] = useState(0);
    const [selectedLogHashes, setSelectedLogHashes] = useState([]);
    const [isArchiving, setIsArchiving] = useState(false);



    // Filter Options from API
    const [filterData, setFilterData] = useState({
        db_types: [], db_server_map: {}, db_client_map: {}, clients: [],
        client_server_map: {}, server_logtype_map: {}
    });

    const handleTechnologyChange = (e) => {
        setSelectedTechnology(e.target.value);
        setSelectedClient('All Clients');
        setSelectedServer('All Servers');
        setSelectedLogType('All Log Types');
    };

    const handleClientChange = (e) => {
        setSelectedClient(e.target.value);
        setSelectedServer('All Servers');
        setSelectedLogType('All Log Types');
    };

    const handleServerChange = (e) => {
        setSelectedServer(e.target.value);
        setSelectedLogType('All Log Types');
    };

    const handleOwnerFilterChange = (e) => {
        setSelectedOwnerFilter(e.target.value);
    };

    useEffect(() => {
        const fetchUsers = async () => {
            if (selectedTechnology === 'All Technologies') {
                setUsersInTech([]);
                return;
            }
            try {
                const res = await api.get('/users/by-tech', {
                    ...authHeader(),
                    params: { db_type: selectedTechnology }
                });
                setUsersInTech(res.data?.users || []);
            } catch (err) {
                console.error("Error fetching users by tech:", err);
            }
        };
        if (token) fetchUsers();
    }, [selectedTechnology, token]);
    const fetchOwnerCounts = useCallback(async (params) => {
        try {
            const res = await api.get('/owner-counts', { ...authHeader(), params });
            if (res.data) {
                setOwnerCounts(res.data.owner_counts || {});
                setTotalAssignedCount(res.data.total_assigned || 0);
                setTotalUnassignedCount(res.data.total_unassigned || 0);
            }
        } catch (err) {
            console.error("Error fetching owner counts:", err);
        }
    }, [token]);

    const fetchAIHistory = async () => {
        setAiHistoryModal(true);
        setAiHistoryDetail(null);
        try {
            const res = await api.get('/history', authHeader());
            setAiHistoryData(res.data?.history || []);
        } catch (e) { console.error(e); }
    };

    const fetchAIHistoryDetail = async (id) => {
        try {
            const res = await api.get(`/history/${id}`, authHeader());
            setAiHistoryDetail(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchShareHistory = async () => {
        setShareHistoryModal(true);
        try {
            const res = await api.get('/share/history', authHeader());
            setShareHistoryData(res.data?.history || []);
        } catch (e) { console.error(e); }
    };

    const handleGenerateAISummary = async () => {
        if (!selectedLog) {
            alert('Please select a log first to generate an AI summary.');
            return;
        }
        setGeneratingAI(true);
        try {
            const reqData = {
                logs: [`[Count: ${selectedLog.count}] ${selectedLog.log_message}`],
                filters: {
                    start: timeRange,
                    end: 'Now',
                    technology: selectedLog.db_type,
                    client: selectedLog.client_name,
                    server: selectedLog.server_name
                }
            };
            const response = await api.post('/summarize', reqData, authHeader());
            if (response.data?.summary) {
                setAiReport(response.data.summary);
            } else if (response.data) {
                setAiReport(JSON.stringify(response.data, null, 2));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate AI summary: ' + (err.response?.data?.detail || err.message));
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleDownloadWord = async (logToDownload = null, overrideContent = null, overrideMeta = null) => {
        const targetLog = logToDownload || selectedLog;
        const reportContent = overrideContent || (targetLog === selectedLog ? aiReport : (targetLog ? targetLog.log_message : ''));

        if (!reportContent) return;

        const meta = {
            client_name: overrideMeta?.client_name || targetLog?.client_name || 'N/A',
            server_name: overrideMeta?.server_name || targetLog?.server_name || 'N/A',
            db_type: overrideMeta?.db_type || targetLog?.db_type || 'N/A',
            severity: overrideMeta?.severity || targetLog?.severity || 'N/A',
            generated_on: overrideMeta?.generated_on || new Date().toLocaleString()
        };

        try {
            const response = await api.post('/export/docx', {
                title: 'Diagnostic Report',
                content: reportContent,
                ...meta
            }, {
                ...authHeader(),
                responseType: 'blob',
                headers: {
                  Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }
            });

            const blob = new Blob([response.data], {type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const safeClient = (meta.client_name || 'Log').replace(/[^a-zA-Z0-9]/g, '_');
            link.download = `AI_Report_${safeClient}_${new Date().toISOString().split('T')[0]}.docx`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Docx export error:", err);
            alert("Failed to download report. Please ensure the backend is running correctly.");
        }
    };

    const initiateShare = (log, target) => {
        if (!log.owner || log.owner === 'None') {
            alert("Please assign an owner to this log before sharing.");
            return;
        }
        setSharingLog(log);
        setShareTarget(target);
        setSharePurpose('');
        setShareModalOpen(true);
        setMenuOpenFor(null);
    };

    const handleExecuteShare = async () => {
        if (!sharingLog || !shareTarget) return;

        try {
            const reportContent = (sharingLog === selectedLog && aiReport) ? aiReport : sharingLog.log_message;

            // Record in history first
            await api.post('/share/record', {
                notes: sharePurpose || 'No purpose stated',
                platform: shareTarget === 'whats-app' ? 'WhatsApp' : (shareTarget === 'teams' ? 'Teams' : 'Download'),
                content_type: 'Log Activity',
                client_name: sharingLog.client_name,
                server_name: sharingLog.server_name,
                log_message: sharingLog.log_message,
                status: sharingLog.status || 'None',
                owner: sharingLog.owner || 'None',
                client_visibility: sharingLog.client_visibility || 'None',
                ticket_status: sharingLog.ticket_status || 'None',
                next_action: sharingLog.next_action || '',
                db_type: sharingLog.db_type
            }, authHeader());

            // Execute the actual action
            if (shareTarget === 'whats-app') {
                handleShareWhatsApp(reportContent);
            } else if (shareTarget === 'teams') {
                handleShareTeams(reportContent);
            } else if (shareTarget === 'word') {
                handleDownloadWord(sharingLog);
            }

            setShareModalOpen(false);
            setSharingLog(null);
            setSharePurpose('');
        } catch (err) {
            console.error("Share error:", err);
            alert("Failed to record share history.");
        }
    };

    const handleShareWhatsApp = (overrideContent = null) => {
        const content = overrideContent || aiReport;
        if (!content) return;
        const text = `*Diagnostic Report*\n\n${content}\n\n_Generated via AI Log Analyzer_`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleShareTeams = (overrideContent = null) => {
        const content = overrideContent || aiReport;
        if (!content) return;
        const text = `Diagnostic Report\n\n${content}`;
        window.open(`https://teams.microsoft.com/l/chat/0/0?users=&message=${encodeURIComponent(text)}`, '_blank');
    };



    const initData = useCallback(async () => {
        setLoading(true);
        try {
            const start = '2000-01-01 00:00:00';

            const [fRes, response] = await Promise.all([
                api.get('/filters', authHeader()),
                api.get('/logs', { ...authHeader(), params: { start_time: start, limit: PAGE_SIZE, offset: 0 } })
            ]);

            if (fRes.data) setFilterData(fRes.data);
            const enrichedLogs = (response.data?.logs || []).map(l => ({ ...l, persistedOwner: l.owner }));
            setAllLogs(enrichedLogs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (user?.username && token) initData();
    }, [user?.username, token, initData]);

    const handleApplyFilters = async (newOffset = 0, isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            let start = null;
            let end = null;

            if (timeRange === 'custom') {
                if (customStart) start = customStart.replace('T', ' ') + ':00';
                if (customEnd) end = customEnd.replace('T', ' ') + ':00';
            } else {
                if (timeRange === 'all') start = '2000-01-01 00:00:00';
                else if (timeRange === '1h') start = getISTDateString(1 * 60 * 60 * 1000);
                else if (timeRange === '3h') start = getISTDateString(3 * 60 * 60 * 1000);
                else if (timeRange === '6h') start = getISTDateString(6 * 60 * 60 * 1000);
                else if (timeRange === '12h') start = getISTDateString(12 * 60 * 60 * 1000);
                else if (timeRange === '18h') start = getISTDateString(18 * 60 * 60 * 1000);
                else if (timeRange === '24h') start = getISTDateString(24 * 60 * 60 * 1000);
                else if (timeRange === '7d') start = getISTDateString(7 * 24 * 60 * 60 * 1000);
                else if (timeRange === '30d') start = getISTDateString(30 * 24 * 60 * 60 * 1000);
            }

            const params = { limit: PAGE_SIZE, offset: newOffset };
            if (start) params.start_time = start;
            if (end) params.end_time = end;
            if (selectedTechnology !== 'All Technologies') params.db_type = selectedTechnology;
            if (selectedClient !== 'All Clients') params.client_name = selectedClient;
            if (selectedServer !== 'All Servers') params.server_name = selectedServer;
            if (selectedLogType !== 'All Log Types') params.log_type = selectedLogType;
            if (selectedSeverity !== 'All Severities') params.severity = selectedSeverity;

            if (selectedOwnerFilter !== 'None') {
                if (selectedOwnerFilter === 'Assigned') {
                    params.owner = 'assigned';
                } else if (selectedOwnerFilter === 'Unassigned') {
                    params.owner = 'unassigned';
                } else {
                    params.owner = selectedOwnerFilter;
                }
            }

            const response = await api.get('/logs', { ...authHeader(), params });
            const enrichedLogs = (response.data?.logs || []).map(l => ({ ...l, persistedOwner: l.owner }));
            setAllLogs(enrichedLogs);
            setTotalLogsCount(response.data?.total || 0);
            setOffset(newOffset);
            const countParams = { ...params };
            delete countParams.owner;
            fetchOwnerCounts(countParams);
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
            setLastUpdateTime(new Date());
        }
    };

    // Polling for synchronicity every 30 seconds
    useEffect(() => {
        const pollInterval = setInterval(() => {
            // Only poll if window is visible and NOT when a log is selected or AI report is open
            if (document.visibilityState === 'visible' && !selectedLog && !aiReport) {
                console.log("Auto-polling for log updates...");
                handleApplyFilters(offset, true); // Pass current offset for background refresh
            }
        }, 30000);
        return () => clearInterval(pollInterval);
    }, [selectedTechnology, selectedClient, selectedServer, selectedLogType, selectedSeverity, selectedOwnerFilter, timeRange, selectedLog, aiReport, offset]);

    const handleClearFilters = () => {
        setTimeRange('all');
        setSelectedTechnology('All Technologies');
        setSelectedClient('All Clients');
        setSelectedServer('All Servers');
        setSelectedLogType('All Log Types');
        setSelectedSeverity('All Severities');
        setSearchTerm('');
        setCustomStart('');
        setCustomEnd('');
        setSelectedOwnerFilter('None');
        initData();
    };

    const groupedLogs = useMemo(() => {
        const groups = {};
        allLogs.forEach(log => {
            if (searchTerm && !log.log_message?.toLowerCase().includes(searchTerm.toLowerCase())) return;
            const key = `${log.log_time_ist}|${log.client_name}|${log.server_name}|${log.log_message}`;
            if (!groups[key]) groups[key] = { ...log, count: 1 };
            else groups[key].count++;
        });
        return Object.values(groups).sort((a, b) => new Date(b.log_time_ist) - new Date(a.log_time_ist));
    }, [allLogs, searchTerm]);

    const terminalStatuses = ['Resolved', 'Ignored', 'No action Required'];
    const activeStatuses = ['Open', 'Under Review', 'Action Needed from Client', 'Action Needed from DBA', 'Monitoring'];

    const handleMetadataChange = async (log, field, newValue, forceSave = false) => {
        // Update local state immediately for responsiveness
        setAllLogs(prev => prev.map(l =>
            (l.client_name === log.client_name && l.server_name === log.server_name && l.log_message === log.log_message)
                ? { ...l, [field]: newValue } : l
        ));

        const updatedLog = { ...log, [field]: newValue };
        const isTerminal = terminalStatuses.includes(updatedLog.status);

        // Skip auto-save for owner field - must be manual via Assign button
        if (field === 'owner') return;

        // If NOT terminal, auto-save immediately. If terminal, only save if forceSave is true.
        if (!isTerminal || forceSave) {
            try {
                const currentMetadata = {
                    status: updatedLog.status || '',
                    owner: log.persistedOwner || 'None',
                    client_visibility: updatedLog.client_visibility || 'None',
                    ticket_status: updatedLog.ticket_status || 'None',
                    next_action: updatedLog.next_action || '',
                    severity: updatedLog.severity || ''
                };

                await api.patch('/logs/metadata', {
                    client_name: log.client_name,
                    server_name: log.server_name,
                    log_message: log.log_message,
                    log_hash: log.log_hash,
                    ...currentMetadata
                }, authHeader());
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleUnassign = async (log) => {
        try {
            const resetMetadata = {
                status: 'None',
                owner: 'None',
                client_visibility: 'None',
                ticket_status: 'None',
                next_action: '',
                severity: 'Unknown'
            };

            await api.patch('/logs/metadata', {
                client_name: log.client_name,
                server_name: log.server_name,
                log_message: log.log_message,
                log_hash: log.log_hash,
                ...resetMetadata
            }, authHeader());

            setAllLogs(prev => prev.map(l =>
                (l.client_name === log.client_name && l.server_name === log.server_name && l.log_message === log.log_message)
                    ? { ...l, ...resetMetadata, persistedOwner: 'None' } : l
            ));
        } catch (err) {
            console.error("Error unassigning log:", err);
        }
    };

    const handleAssignToMe = async (log) => {
        if (!user?.username) return;
        try {
            const assignmentMetadata = {
                owner: user.username,
                status: log.status,
                severity: log.severity,
                client_visibility: log.client_visibility || 'None',
                ticket_status: log.ticket_status || 'None',
                next_action: log.next_action || ''
            };

            await api.patch('/logs/metadata', {
                client_name: log.client_name,
                server_name: log.server_name,
                log_message: log.log_message,
                log_hash: log.log_hash,
                ...assignmentMetadata
            }, authHeader());

            setAllLogs(prev => prev.map(l =>
                (l.client_name === log.client_name && l.server_name === log.server_name && l.log_message === log.log_message)
                    ? { ...l, ...assignmentMetadata, persistedOwner: user.username } : l
            ));
        } catch (err) {
            console.error("Error assigning log to self:", err);
            alert("Failed to assign log.");
        }
    };

    const handleSaveArchive = async (log) => {
        try {
            const metadata = {
                status: log.status,
                owner: log.owner,
                client_visibility: log.client_visibility || 'None',
                ticket_status: log.ticket_status || 'None',
                next_action: log.next_action || '',
                severity: log.severity || ''
            };

            await api.patch('/logs/metadata', {
                client_name: log.client_name,
                server_name: log.server_name,
                log_message: log.log_message,
                log_hash: log.log_hash,
                ...metadata
            }, authHeader());

            // Remove from active dashboard
            setAllLogs(prev => prev.filter(l =>
                !(l.client_name === log.client_name && l.server_name === log.server_name && l.log_message === log.log_message)
            ));
            alert("Log successfully moved to Archive.");
        } catch (err) {
            console.error(err);
            alert("Failed to archive log: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleLogSelect = (log) => {
        if (selectedLogHashes.includes(log.log_hash)) {
            setSelectedLogHashes(prev => prev.filter(h => h !== log.log_hash));
            if (selectedLog?.log_hash === log.log_hash) setSelectedLog(null);
        } else {
            setSelectedLogHashes(prev => [...prev, log.log_hash]);
            setSelectedLog(log);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allHashes = groupedLogs.map(l => l.log_hash);
            setSelectedLogHashes(allHashes);
        } else {
            setSelectedLogHashes([]);
            setSelectedLog(null);
        }
    };

    const handleBulkArchive = async () => {
        if (selectedLogHashes.length === 0) return;
        
        const confirmMsg = `Are you sure you want to archive ${selectedLogHashes.length} selected logs? This will mark them as Resolved and move them to history.`;
        if (!window.confirm(confirmMsg)) return;

        setIsArchiving(true);
        try {
            for (const logHash of selectedLogHashes) {
                const logObj = allLogs.find(l => l.log_hash === logHash);
                if (!logObj) continue;

                await api.patch('/logs/metadata', {
                    client_name: logObj.client_name,
                    server_name: logObj.server_name,
                    log_message: logObj.log_message,
                    log_hash: logObj.log_hash,
                    status: 'Resolved',
                    owner: logObj.owner || user.username,
                    client_visibility: logObj.client_visibility || 'Internal only',
                    ticket_status: logObj.ticket_status || 'Not required',
                    next_action: logObj.next_action || 'Bulk Archived',
                    severity: logObj.severity || 'Medium'
                }, authHeader());
            }
            
            setSelectedLogHashes([]);
            setSelectedLog(null);
            await handleApplyFilters(offset, true);
        } catch (err) {
            console.error("Bulk archive error:", err);
            alert("An error occurred during bulk archiving. Some logs may not have been moved.");
        } finally {
            setIsArchiving(false);
        }
    };

    const usernameDisplay = user?.fullName || user?.username || 'User';
    const profileInitial = usernameDisplay.charAt(0).toUpperCase();

    // Derived filter arrays based on combinations
    const clientOptions = useMemo(() => {
        if (selectedTechnology === 'All Technologies') return filterData.clients || [];
        return filterData.db_client_map[selectedTechnology] || [];
    }, [selectedTechnology, filterData]);

    const serverOptions = useMemo(() => {
        if (selectedClient !== 'All Clients') return filterData.client_server_map[selectedClient] || [];
        if (selectedTechnology !== 'All Technologies') return filterData.db_server_map[selectedTechnology] || [];
        return [...new Set(Object.values(filterData.client_server_map).flat())];
    }, [selectedClient, selectedTechnology, filterData]);

    const logTypeOptions = useMemo(() => {
        if (selectedServer !== 'All Servers' && filterData.server_logtype_map) {
            return filterData.server_logtype_map[selectedServer] || ['agent_log', 'error_log'];
        }
        return ['agent_log', 'error_log'];
    }, [selectedServer, filterData]);


    return (
        <div className="dashboard-layout">
            {isArchiving && (
                <div className="modal-backdrop" style={{ zIndex: 9999 }}>
                    <div className="glass modal-content" style={{ textAlign: 'center', padding: '40px' }}>
                        <div className="bubble-loader" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                            <div className="bubble" style={{ background: '#ef4444' }}></div>
                            <div className="bubble" style={{ background: '#ef4444', animationDelay: '0.2s' }}></div>
                            <div className="bubble" style={{ background: '#ef4444', animationDelay: '0.4s' }}></div>
                        </div>
                        <h3 style={{ color: 'white', margin: '10px 0' }}>Archiving Logs</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Logs are moving to archive, please wait...</p>
                    </div>
                </div>
            )}
            <header className="top-nav">
                <div className="nav-left">
                    <GeopitsLogo textColor={isDarkMode ? '#ffffff' : '#0f172a'} fontSize={1.15} dotSize="7px" />
                    <span className="nav-title">Geopits</span>
                </div>

                <div className="nav-right">
                    <button className="theme-toggle nav-icon-btn" onClick={toggleTheme}>
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    <div className="nav-profile">
                        <div className="profile-avatar">{profileInitial}</div>
                        <div className="profile-info">
                            <span className="profile-name">{usernameDisplay}</span>
                            <span className="profile-email">{user?.email || user?.username || ''}</span>
                        </div>
                    </div>

                    {user?.role === 'lead' && (
                        <button className="nav-icon-btn lead-panel-toggle" onClick={() => navigate('/lead')} title="User Management Panel">
                            <ShieldCheck size={20} color="#10b981" />
                        </button>
                    )}

                    {user?.isAdmin && <Link to="/admin" className="btn btn-admin nav-link-btn">Admin Panel</Link>}

                    <button className="btn-icon-subtle" onClick={() => navigate('/log-status')} title="Log Status Archive" style={{ marginRight: '10px' }}>
                        <History size={20} />
                    </button>

                    <button className="btn btn-share" onClick={fetchShareHistory}>
                        <Share2 size={16} style={{ marginRight: '6px' }} /> Share History
                    </button>
                    <button className="btn btn-ai-gradient" onClick={fetchAIHistory} style={{ whiteSpace: 'nowrap' }}>
                        <Sparkles size={16} style={{ marginRight: '6px' }} /> History
                    </button>
                    <button className="btn btn-logout" onClick={logout}>
                        <LogOut size={16} style={{ marginRight: '6px' }} /> Logout
                    </button>
                </div>
            </header>

            <main className="workspace">
                {/* AI Summary Confirmation */}
                {confirmAIModal && (
                    <div className="modal-backdrop">
                        <div className="glass modal-content" style={{ width: '400px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <Sparkles size={48} color="var(--accent-glow)" style={{ marginBottom: '15px' }} />
                                <h3 style={{ margin: 0, color: 'white' }}>Confirm AI Diagnostics</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Are you sure you want to proceed with AI diagnostic analysis for the selected log?
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '30px' }}>
                                <button className="btn btn-outline" onClick={() => setConfirmAIModal(false)}>Cancel</button>
                                <button className="btn btn-ai-gradient" onClick={() => { setConfirmAIModal(false); handleGenerateAISummary(); }}>Proceed</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Log Viewer Modal */}
                {viewerLog && (
                    <div className="modal-backdrop">
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

                {/* AI History Modal */}
                {aiHistoryModal && (
                    <div className="modal-backdrop">
                        <div className="glass modal-content" style={{ width: '90vw', maxWidth: '1200px', height: '85vh', position: 'relative', display: 'flex', flexDirection: 'column', padding: '30px' }}>
                            <button onClick={() => setAiHistoryModal(false)} className="btn-close" style={{ position: 'absolute', top: '20px', right: '20px' }}><X size={20} /></button>
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <History size={24} color="var(--accent-glow)" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Summary History</h2>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {!aiHistoryDetail ? (
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead><tr><th>ID</th><th>Date</th><th>Owner</th><th>Action</th></tr></thead>
                                            <tbody>
                                                {aiHistoryData.map(h => (
                                                    <tr key={h.id}>
                                                        <td>{h.id}</td>
                                                        <td>{h.created_at}</td>
                                                        <td>{h.username || 'System'}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    className="btn btn-outline"
                                                                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                    title="View Full Report"
                                                                    onClick={() => fetchAIHistoryDetail(h.id)}
                                                                >
                                                                    <Eye size={16} /> View Report
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {aiHistoryData.length === 0 && (
                                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No historical reports found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', padding: '0 5px' }}>
                                            <button className="btn btn-outline" onClick={() => setAiHistoryDetail(null)} style={{ minWidth: '120px' }}>&larr; Back to History</button>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button className="btn-footer wa" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={() => handleShareWhatsApp(aiHistoryDetail.summary_text)}>
                                                    <MessageSquare size={16} /> WhatsApp
                                                </button>
                                                <button className="btn-footer teams" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={() => handleShareTeams(aiHistoryDetail.summary_text)}>
                                                    <Share2 size={16} /> Teams
                                                </button>
                                                <button className="btn-footer download" style={{ padding: '10px 20px', fontSize: '0.9rem' }} onClick={() => {
                                                    const filters = aiHistoryDetail.filters_json || {};
                                                    handleDownloadWord(null, aiHistoryDetail.summary_text, {
                                                        client_name: filters.client || 'N/A',
                                                        server_name: filters.server || 'N/A',
                                                        db_type: filters.technology || 'N/A',
                                                        generated_on: aiHistoryDetail.created_at
                                                    });
                                                }}>
                                                    <Download size={16} /> Word
                                                </button>
                                            </div>
                                        </div>

                                        <div className="ai-overlay-card glass" style={{ height: 'auto', maxHeight: 'none', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', flex: 1, overflowY: 'auto' }}>
                                            <div className="ai-overlay-header">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Sparkles size={20} color="var(--accent-glow)" />
                                                    <h3 style={{ margin: 0 }}>Diagnostic Report</h3>
                                                </div>
                                            </div>
                                            <div className="ai-overlay-content" style={{ padding: '30px' }}>
                                                <div className="ai-report-meta">
                                                    <div className="meta-item"><strong>Client:</strong> {aiHistoryDetail.filters_json?.client || 'N/A'}</div>
                                                    <div className="meta-item"><strong>Server:</strong> {aiHistoryDetail.filters_json?.server || 'N/A'}</div>
                                                    <div className="meta-item"><strong>Generated:</strong> {aiHistoryDetail.created_at}</div>
                                                    <div className="meta-item"><strong>By:</strong> {aiHistoryDetail.username || 'System'}</div>
                                                </div>
                                                <div className="ai-report-body" dangerouslySetInnerHTML={{
                                                    __html: aiHistoryDetail.summary_text
                                                        ? (marked.parse ? marked.parse(aiHistoryDetail.summary_text) : aiHistoryDetail.summary_text.replace(/\n/g, '<br/>'))
                                                        : 'No summary available.'
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Share History Modal */}
                {shareHistoryModal && (
                    <div className="modal-backdrop">
                        <div className="glass modal-content" style={{ width: '90vw', maxWidth: '1200px', maxHeight: '80vh', position: 'relative', display: 'flex', flexDirection: 'column', padding: '30px' }}>
                            <button onClick={() => setShareHistoryModal(false)} className="btn-close" style={{ position: 'absolute', top: '20px', right: '20px' }}><X size={20} /></button>
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Share2 size={24} color="var(--accent-glow)" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Share History</h2>
                            </div>
                            <div className="table-responsive" style={{ flex: 1, overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Platform</th>
                                            <th>Status</th>
                                            <th>Owner</th>
                                            <th>Visibility</th>
                                            <th>Ticket</th>
                                            <th>Next Action</th>
                                            <th>Tech</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shareHistoryData.map(h => (
                                            <tr key={h.id}>
                                                <td>{h.created_at}</td>
                                                <td>{h.platform}</td>
                                                <td><span className={`status-badge status-${(h.status || 'none').toLowerCase()}`}>{h.status || 'None'}</span></td>
                                                <td>{h.owner || 'None'}</td>
                                                <td>{h.client_visibility || 'None'}</td>
                                                <td>{h.ticket_status || 'None'}</td>
                                                <td>{h.next_action || '-'}</td>
                                                <td>{h.db_type || '-'}</td>
                                            </tr>
                                        ))}
                                        {shareHistoryData.length === 0 && (
                                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No share history found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {aiReport && (
                    <div className="ai-overlay">
                        <div className="ai-overlay-card glass">
                            <div className="ai-overlay-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sparkles size={20} color="var(--accent-glow)" />
                                    <h3 style={{ margin: 0 }}>Diagnostic Report</h3>
                                </div>
                                <button onClick={() => setAiReport(null)} className="btn-close"><X size={20} /></button>
                            </div>

                            <div className="ai-overlay-content">
                                <div className="ai-report-meta">
                                    <div className="meta-item"><strong>Client:</strong> {selectedLog?.client_name}</div>
                                    <div className="meta-item"><strong>Server:</strong> {selectedLog?.server_name}</div>
                                    <div className="meta-item"><strong>Generated:</strong> {new Date().toLocaleString()}</div>
                                </div>
                                <div className="ai-report-body" dangerouslySetInnerHTML={{ __html: marked.parse ? marked.parse(aiReport) : aiReport.replace(/\n/g, '<br/>') }} />
                            </div>

                            <div className="ai-overlay-footer">
                                <button className="btn-footer wa" onClick={() => handleShareWhatsApp()}>
                                    <MessageSquare size={16} /> WhatsApp
                                </button>
                                <button className="btn-footer teams" onClick={() => handleShareTeams()}>
                                    <Share2 size={16} /> Teams
                                </button>
                                <button className="btn-footer download" onClick={() => handleDownloadWord()}>
                                    <Download size={16} /> Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="filters-glass">
                    <div className="filters-grid">
                        <div className="filter-group">
                            <label>TIME RANGE</label>
                            <select className="filter-select" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
                                <option value="all">All Time</option>
                                <option value="1h">Last 1 Hour</option>
                                <option value="3h">Last 3 Hours</option>
                                <option value="6h">Last 6 Hours</option>
                                <option value="12h">Last 12 Hours</option>
                                <option value="18h">Last 18 Hours</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>
                        {timeRange === 'custom' && (
                            <>
                                <div className="filter-group">
                                    <label>START TIME</label>
                                    <input
                                        type="datetime-local"
                                        className="filter-select"
                                        value={customStart}
                                        onChange={e => setCustomStart(e.target.value)}
                                    />
                                </div>
                                <div className="filter-group">
                                    <label>END TIME</label>
                                    <input
                                        type="datetime-local"
                                        className="filter-select"
                                        value={customEnd}
                                        onChange={e => setCustomEnd(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                        <div className="filter-group">
                            <label>TECHNOLOGY</label>
                            <select className="filter-select" value={selectedTechnology} onChange={handleTechnologyChange}>
                                <option value="All Technologies">All Technologies</option>
                                {filterData.db_types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>CLIENT</label>
                            <select className="filter-select" value={selectedClient} onChange={handleClientChange}>
                                <option value="All Clients">All Clients</option>
                                {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>SERVER</label>
                            <select
                                className="filter-select"
                                value={selectedServer}
                                onChange={handleServerChange}
                                disabled={selectedClient === 'All Clients'}
                            >
                                <option value="All Servers">All Servers</option>
                                {serverOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>LOG TYPE</label>
                            <select
                                className="filter-select"
                                value={selectedLogType}
                                onChange={e => setSelectedLogType(e.target.value)}
                                disabled={selectedServer === 'All Servers'}
                            >
                                <option value="All Log Types">All Log Types</option>
                                {logTypeOptions.map(lt => <option key={lt} value={lt}>{lt}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>LOG LEVEL</label>
                            <select className="filter-select" value={selectedSeverity} onChange={e => setSelectedSeverity(e.target.value)}>
                                <option value="All Severities">All Severities</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                                <option value="Unknown">Uncategorized</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>ASSIGNED OWNER</label>
                            <select
                                className="filter-select"
                                value={selectedOwnerFilter}
                                onChange={handleOwnerFilterChange}
                                disabled={selectedTechnology === 'All Technologies'}
                            >
                                <option value="None">None</option>
                                <option value="Assigned">All Assigned</option>
                                <option value="Unassigned">Unassigned</option>
                                {usersInTech.map(u => (
                                    <option key={u.username} value={u.username}>
                                        {u.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="filter-actions">
                        <button
                            className="btn btn-primary"
                            onClick={() => handleApplyFilters(0)}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader className="spin" size={16} style={{ marginRight: '6px' }} />
                            ) : (
                                <Search size={16} style={{ marginRight: '6px' }} />
                            )}
                            {loading ? 'Fetching logs...' : 'Apply Filters'}
                        </button>
                        <button className="btn btn-outline" onClick={handleClearFilters}>
                            <RefreshCw size={16} style={{ marginRight: '6px' }} /> Clear Filters
                        </button>
                        <button
                            className="btn btn-ai-gradient"
                            onClick={() => setConfirmAIModal(true)}
                            disabled={!selectedLog || selectedLogHashes.length > 1 || generatingAI}
                        >
                            {generatingAI ? <Loader className="spin" size={16} style={{ marginRight: '6px' }} /> : <Sparkles size={16} style={{ marginRight: '6px' }} />}
                            {generatingAI ? 'Generating...' : 'Summary'}
                        </button>
                        {selectedLogHashes.length > 1 && (
                            <button className="btn btn-primary" onClick={handleBulkArchive} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                                <Save size={16} style={{ marginRight: '6px' }} /> Archive {selectedLogHashes.length} Logs
                            </button>
                        )}
                    </div>
                </div>
                <div className="logs-summary-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0 10px 0', padding: '0 5px' }}>
                    <div className="logs-count-badge" style={{ 
                        background: 'rgba(59, 130, 246, 0.15)', 
                        color: '#60a5fa', 
                        padding: '6px 14px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        fontWeight: '600',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 10px #60a5fa' }}></div>
                        OVERALL LOADED LOGS: {totalLogsCount}
                    </div>
                    {lastUpdateTime && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Last updated: {lastUpdateTime.toLocaleTimeString()}
                        </div>
                    )}
                </div>

                <div className="table-glass">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input 
                                        type="checkbox" 
                                        className="log-checkbox"
                                        checked={selectedLogHashes.length === groupedLogs.length && groupedLogs.length > 0} 
                                        onChange={handleSelectAll} 
                                    />
                                </th>
                                <th>ID</th>
                                <th>TIME (IST)</th>
                                <th>CLIENT</th>
                                <th>SERVER</th>
                                <th>TYPE</th>
                                <th>OCCURRENCES</th>
                                <th>MESSAGE</th>
                                <th>SEVERITY</th>
                                <th>OWNER</th>
                                <th>CLIENT VISIBILITY</th>
                                <th>TICKET</th>
                                <th>STATUS</th>
                                <th>NEXT ACTION</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="15" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="bubble-loader" style={{ justifyContent: 'center' }}>
                                            <div className="bubble"></div>
                                            <div className="bubble"></div>
                                            <div className="bubble"></div>
                                        </div>
                                        <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Retrieving log activity...</p>
                                    </td>
                                </tr>
                            ) : groupedLogs.map((log, i) => {
                                const isAssignedToOther = log.owner && log.owner !== 'None' && log.owner !== user?.username;
                                const isAssignedToMe = log.owner === user?.username && log.owner !== 'None';

                                return (
                                    <tr
                                        key={i}
                                        className={`log-row ${selectedLogHashes.includes(log.log_hash) ? 'selected' : ''} ${isAssignedToOther ? 'assigned-to-other' : ''}`}
                                        onClick={() => !isAssignedToOther && handleLogSelect(log)}
                                    >
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input 
                                                type="checkbox" 
                                                className="log-checkbox"
                                                checked={selectedLogHashes.includes(log.log_hash)}
                                                onChange={() => handleLogSelect(log)}
                                                disabled={isAssignedToOther}
                                            />
                                        </td>
                                        <td>{log.id}</td>
                                        <td className="time-cell">{log.log_time_ist ? String(log.log_time_ist).substring(0, 19).replace('T', ' ') : '-'}</td>
                                        <td>{log.client_name}</td>
                                        <td className="truncate-cell" title={log.server_name}>{log.server_name}</td>
                                        <td>{log.log_type}</td>
                                        <td className="center-text">{log.count || 1}</td>
                                        <td className="message-cell">
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                                                <div className="log-text">{log.log_message}</div>
                                                <button
                                                    className="btn-icon-subtle"
                                                    onClick={(e) => { e.stopPropagation(); setViewerLog(log); }}
                                                    title="View Full Log"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <select
                                                className={`badge badge-${getSeverityLevel(log.severity, log.log_message)}`}
                                                style={{ border: 'none', cursor: 'pointer', appearance: 'none', textAlign: 'center', width: '100%' }}
                                                value={log.severity || 'Unknown'}
                                                onChange={(e) => handleMetadataChange(log, 'severity', e.target.value)}
                                                disabled={isAssignedToOther || !log.status || log.status === 'None'}
                                            >
                                                <option value="Unknown">Uncategorized</option>
                                                <option value="Critical">Critical</option>
                                                <option value="High">High</option>
                                                <option value="Medium">Medium</option>
                                                <option value="Low">Low</option>
                                            </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <select
                                                className="status-select"
                                                value={log.owner || 'None'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAllLogs(prev => prev.map(l =>
                                                        (l.client_name === log.client_name && l.server_name === log.server_name && l.log_message === log.log_message)
                                                            ? { ...l, owner: val } : l
                                                    ));
                                                }}
                                                disabled={isAssignedToOther || !log.status || log.status === 'None'}
                                            >
                                                <option value="None">Assign Owner</option>
                                                {user?.username && <option value={user.username}>{user.username}</option>}
                                                {log.owner && log.owner !== 'None' && log.owner !== user?.username && (
                                                    <option value={log.owner}>{log.owner}</option>
                                                )}
                                            </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <select
                                                className="status-select"
                                                value={log.client_visibility || 'None'}
                                                onChange={(e) => handleMetadataChange(log, 'client_visibility', e.target.value)}
                                                disabled={isAssignedToOther || !log.status || log.status === 'None'}
                                            >
                                                <option value="None">None</option>
                                                <option value="Internal only">Internal only</option>
                                                <option value="Shared with client">Shared with client</option>
                                            </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <select
                                                className="status-select"
                                                value={log.ticket_status || 'None'}
                                                onChange={(e) => handleMetadataChange(log, 'ticket_status', e.target.value)}
                                                disabled={isAssignedToOther || !log.status || log.status === 'None'}
                                            >
                                                <option value="None">None</option>
                                                <option value="Created">Created</option>
                                                <option value="In progress">In progress</option>
                                                <option value="Not required">Not required</option>
                                            </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <select
                                                className="status-select"
                                                value={log.status || 'None'}
                                                onChange={(e) => handleMetadataChange(log, 'status', e.target.value)}
                                                disabled={isAssignedToOther}
                                            >
                                                <option value="None">None</option>
                                                <option value="Open">Open</option>
                                                <option value="Under Review">Under Review</option>
                                                <option value="Action Needed from Client">Action Needed from Client</option>
                                                <option value="Action Needed from DBA">Action Needed from DBA</option>
                                                <option value="Monitoring">Monitoring</option>
                                                <option value="Resolved">Resolved</option>
                                                <option value="Ignored">Ignored</option>
                                                <option value="No action Required">No action Required</option>
                                            </select>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                className="status-select"
                                                style={{ width: '100%', minWidth: '150px' }}
                                                value={log.next_action || ''}
                                                maxLength={250}
                                                placeholder="Next action..."
                                                onChange={(e) => handleMetadataChange(log, 'next_action', e.target.value)}
                                                disabled={isAssignedToOther || !log.status || log.status === 'None'}
                                            />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {terminalStatuses.includes(log.status) && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '4px 12px', fontSize: '0.8rem', opacity: (log.owner && log.owner !== 'None') ? 1 : 0.5 }}
                                                        disabled={!log.owner || log.owner === 'None' || isAssignedToOther}
                                                        onClick={() => handleSaveArchive(log)}
                                                        title={(!log.owner || log.owner === 'None') ? "Please assign an Owner first" : "Commit to Archive"}
                                                    >
                                                        <Save size={14} style={{ marginRight: '4px' }} /> Save
                                                    </button>
                                                )}
                                                {(!log.owner || log.owner === 'None') ? (
                                                    (activeStatuses.includes(log.status) &&
                                                        log.ticket_status && log.ticket_status !== 'None' &&
                                                        log.client_visibility && log.client_visibility !== 'None') ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontStyle: 'italic', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                Waiting for Owner
                                                            </span>
                                                        </div>
                                                    ) : activeStatuses.includes(log.status) && (
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                            Select filters to Assign
                                                        </span>
                                                    )
                                                ) : (
                                                    /* Selection Phase: Selected owner but not persisted yet */
                                                    activeStatuses.includes(log.status) && log.owner === user?.username && log.persistedOwner !== user?.username && !isAssignedToOther ? (
                                                        <button
                                                            className="btn btn-primary"
                                                            style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#10b981', border: 'none', boxShadow: '0 0 10px rgba(16,185,129,0.3)', opacity: (log.ticket_status === 'None' || log.client_visibility === 'None') ? 0.5 : 1 }}
                                                            disabled={
                                                                !log.ticket_status || log.ticket_status === 'None' ||
                                                                !log.client_visibility || log.client_visibility === 'None'
                                                            }
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAssignToMe(log);
                                                            }}
                                                            title={(!log.ticket_status || log.ticket_status === 'None' || !log.client_visibility || log.client_visibility === 'None') ? "Please select all tracking filters (Ticket & Visibility) first" : "Confirm and Save Assignment"}
                                                        >
                                                            Assign User
                                                        </button>
                                                    ) : (
                                                        /* Persistent Phase: Log is officially assigned to me */
                                                        log.persistedOwner === user?.username && !terminalStatuses.includes(log.status) && (
                                                            <button
                                                                className="btn btn-outline"
                                                                style={{ padding: '4px 8px', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444', height: '28px' }}
                                                                onClick={(e) => { e.stopPropagation(); handleUnassign(log); }}
                                                                title="Unassign this log"
                                                            >
                                                                Unassign
                                                            </button>
                                                        )
                                                    )
                                                )}
                                            </div>
                                        </td>
                                        <td onClick={e => e.stopPropagation()} style={{ width: '40px', textAlign: 'center' }}>
                                            <div className="more-options-container">
                                                <button
                                                    className="btn-icon-more"
                                                    onClick={() => setMenuOpenFor(menuOpenFor === log.log_hash ? null : log.log_hash)}
                                                    title="More Options"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {menuOpenFor === log.log_hash && (
                                                    <div className="more-menu-dropdown">
                                                        <div className="more-menu-item" onClick={() => initiateShare(log, 'word')}>
                                                            <Download size={16} /> Download
                                                        </div>
                                                        <div className="more-menu-item" onClick={() => initiateShare(log, 'teams')}>
                                                            <Share2 size={16} /> Share to Teams
                                                        </div>
                                                        <div className="more-menu-item" onClick={() => initiateShare(log, 'whats-app')}>
                                                            <MessageSquare size={16} /> Share to WhatsApp
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {groupedLogs.length === 0 && !loading && (
                        <div className="no-data">Showing 0 to 0 of 0 logs</div>
                    )}
                </div>

                {/* Pagination Controls */}
                {!loading && allLogs.length > 0 && (
                    <div className="pagination-container">
                        <button
                            className="btn btn-secondary btn-pagination"
                            onClick={() => handleApplyFilters(Math.max(0, offset - PAGE_SIZE))}
                            disabled={offset === 0}
                        >
                            <ChevronLeft size={18} /> Previous
                        </button>

                        <div className="pagination-info">
                            Showing {offset + 1} - {offset + allLogs.length} logs
                        </div>

                        <button
                            className="btn btn-secondary btn-pagination"
                            onClick={() => handleApplyFilters(offset + PAGE_SIZE)}
                            disabled={allLogs.length < PAGE_SIZE}
                        >
                            Next <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </main>

            {/* Share Purpose Modal */}
            {shareModalOpen && (
                <div className="modal-backdrop">
                    <div className="glass modal-content share-modal-glass">
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'white' }}>Share Log Activity</h3>
                            <button className="btn-icon-subtle" onClick={() => setShareModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px' }}>
                                Target Platform: <strong style={{ color: 'var(--accent-glow)' }}>{shareTarget === 'word' ? 'Word Document' : (shareTarget === 'teams' ? 'Microsoft Teams' : 'WhatsApp')}</strong>
                            </div>
                            <p style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                Please specify the purpose of this share for tracking in history.
                            </p>
                            <textarea
                                className="purpose-textarea"
                                placeholder="Enter share purpose or notes..."
                                rows={4}
                                value={sharePurpose}
                                onChange={(e) => setSharePurpose(e.target.value)}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button className="btn btn-outline" onClick={() => setShareModalOpen(false)}>Cancel</button>
                                <button
                                    className="btn btn-ai-gradient"
                                    onClick={handleExecuteShare}
                                    style={{ padding: '8px 24px' }}
                                >
                                    Confirm & Share
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

