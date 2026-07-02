import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { 
    ArrowLeft, 
    Search, 
    Plus, 
    Filter,
    X,
    Calendar,
    User,
    CheckCircle,
    AlertCircle,
    Info,
    TrendingUp,
    Clock,
    Check,
    MessageSquare,
    Eye,
    Users,
    Activity,
    Bell,
    CheckSquare,
    Download,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Globe,
    FileText,
    EyeOff,
    Trash2,
    Edit3,
    CornerUpLeft,
    CornerUpRight,
    GitMerge,
    Paperclip,
    Mail,
    ChevronDown
} from 'lucide-react';

const MultiSelectDropdown = ({ label, options, selectedString, onChange, placeholder, isLight, themeStyles }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = React.useRef(null);

    const selectedValues = useMemo(() => {
        return selectedString ? selectedString.split(',').filter(Boolean) : [];
    }, [selectedString]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleOption = (option) => {
        let updated;
        if (selectedValues.includes(option)) {
            updated = selectedValues.filter(val => val !== option);
        } else {
            updated = [...selectedValues, option];
        }
        onChange(updated.join(','));
    };

    const handleRemoveOption = (option, e) => {
        e.stopPropagation();
        const updated = selectedValues.filter(val => val !== option);
        onChange(updated.join(','));
    };

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: themeStyles.textMuted }}>{label}</label>
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '38px',
                    padding: '6px 12px',
                    background: themeStyles.inputBg,
                    border: themeStyles.inputBorder,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    flexWrap: 'wrap',
                    gap: '4px'
                }}
            >
                {selectedValues.length === 0 ? (
                    <span style={{ color: themeStyles.textMuted, fontSize: '0.78rem' }}>{placeholder}</span>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {selectedValues.map((val, idx) => (
                            <span 
                                key={idx} 
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                                    color: themeStyles.textMain,
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    border: themeStyles.cardBorder,
                                    fontWeight: '500'
                                }}
                            >
                                {val}
                                <span 
                                    onClick={(e) => handleRemoveOption(val, e)}
                                    style={{
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        fontWeight: '700',
                                        fontSize: '0.72rem',
                                        marginLeft: '2px'
                                    }}
                                >
                                    ×
                                </span>
                            </span>
                        ))}
                    </div>
                )}
                
                <ChevronDown size={14} style={{ color: themeStyles.textMuted, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', marginLeft: 'auto' }} />
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    background: isLight ? '#ffffff' : '#1f2937',
                    border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    padding: '6px'
                }}>
                    {options.length > 5 && (
                        <div style={{ padding: '4px', borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}`, marginBottom: '4px' }}>
                            <input 
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    borderRadius: '4px',
                                    border: themeStyles.inputBorder,
                                    background: themeStyles.inputBg,
                                    color: themeStyles.textMain,
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}
                    {filteredOptions.length === 0 ? (
                        <div style={{ padding: '8px', fontSize: '0.75rem', color: themeStyles.textMuted, textAlign: 'center' }}>No options found</div>
                    ) : (
                        filteredOptions.map((opt, idx) => {
                            const isSelected = selectedValues.includes(opt);
                            return (
                                <div 
                                    key={idx}
                                    onClick={() => handleToggleOption(opt)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '0.78rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        background: isSelected ? (isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.15)') : 'transparent',
                                        color: isSelected ? '#2563eb' : themeStyles.textMain,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontWeight: isSelected ? '700' : 'normal'
                                    }}
                                >
                                    <span>{opt}</span>
                                    {isSelected && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

const DateRangeSelector = ({ label, selectedRangeString, onChange, isLight, themeStyles }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef(null);

    // Track active preset
    const [activePreset, setActivePreset] = useState('All time');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const handleSelectPreset = (preset) => {
        setActivePreset(preset);
        const today = new Date();
        
        if (preset === 'All time') {
            onChange('');
            setIsOpen(false);
            return;
        }

        let start, end;
        if (preset === 'Today') {
            start = formatDate(today);
            end = formatDate(today);
            onChange(`${start},${end}`);
            setIsOpen(false);
        } else if (preset === 'Yesterday') {
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            start = formatDate(yesterday);
            end = formatDate(yesterday);
            onChange(`${start},${end}`);
            setIsOpen(false);
        } else if (preset === 'last 7 days') {
            const last7 = new Date();
            last7.setDate(today.getDate() - 7);
            start = formatDate(last7);
            end = formatDate(today);
            onChange(`${start},${end}`);
            setIsOpen(false);
        } else if (preset === 'Last 15 Days') {
            const last15 = new Date();
            last15.setDate(today.getDate() - 15);
            start = formatDate(last15);
            end = formatDate(today);
            onChange(`${start},${end}`);
            setIsOpen(false);
        } else if (preset === 'Last 30 Days') {
            const last30 = new Date();
            last30.setDate(today.getDate() - 30);
            start = formatDate(last30);
            end = formatDate(today);
            onChange(`${start},${end}`);
            setIsOpen(false);
        } else if (preset === 'Custom Date Range') {
            // Keep open to let them choose dates
        }
    };

    const handleApplyCustom = () => {
        if (customStart && customEnd) {
            onChange(`${customStart},${customEnd}`);
            setIsOpen(false);
        }
    };

    // Determine display value
    const displayValue = useMemo(() => {
        if (!selectedRangeString) return 'Select Date Range';
        if (activePreset !== 'Custom Date Range') return activePreset;
        const parts = selectedRangeString.split(',');
        if (parts.length === 2) return `${parts[0]} to ${parts[1]}`;
        return selectedRangeString;
    }, [selectedRangeString, activePreset]);

    return (
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: themeStyles.textMuted }}>{label}</label>
            
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '38px',
                    padding: '8px 12px',
                    background: themeStyles.inputBg,
                    border: themeStyles.inputBorder,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    color: selectedRangeString ? themeStyles.textMain : themeStyles.textMuted
                }}
            >
                <span>{displayValue}</span>
                <ChevronDown size={14} style={{ color: themeStyles.textMuted, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    background: isLight ? '#ffffff' : '#1f2937',
                    border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    {['All time', 'Today', 'Yesterday', 'last 7 days', 'Last 15 Days', 'Last 30 Days', 'Custom Date Range'].map((preset, idx) => {
                        const isSelected = activePreset === preset;
                        return (
                            <div key={idx}>
                                <div 
                                    onClick={() => handleSelectPreset(preset)}
                                    style={{
                                        padding: '8px 12px',
                                        fontSize: '0.78rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        background: isSelected ? (isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.15)') : 'transparent',
                                        color: isSelected ? '#2563eb' : themeStyles.textMain,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontWeight: isSelected ? '700' : 'normal'
                                    }}
                                >
                                    <span>{preset}</span>
                                    {isSelected && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>}
                                </div>
                                
                                {preset === 'Custom Date Range' && activePreset === 'Custom Date Range' && (
                                    <div 
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '8px', 
                                            padding: '8px', 
                                            borderTop: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}`,
                                            marginTop: '4px' 
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: themeStyles.textMuted }}>Start</span>
                                                <input 
                                                    type="date"
                                                    value={customStart}
                                                    onChange={(e) => setCustomStart(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{ width: '100%', padding: '4px 6px', fontSize: '0.72rem', borderRadius: '4px', border: themeStyles.inputBorder, background: themeStyles.inputBg, color: themeStyles.textMain }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: themeStyles.textMuted }}>End</span>
                                                <input 
                                                    type="date"
                                                    value={customEnd}
                                                    onChange={(e) => setCustomEnd(e.target.value)}
                                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                                    style={{ width: '100%', padding: '4px 6px', fontSize: '0.72rem', borderRadius: '4px', border: themeStyles.inputBorder, background: themeStyles.inputBg, color: themeStyles.textMain }}
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleApplyCustom}
                                            disabled={!customStart || !customEnd}
                                            style={{
                                                padding: '6px 12px',
                                                background: '#2563eb',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '0.72rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                opacity: (!customStart || !customEnd) ? 0.6 : 1
                                            }}
                                        >
                                            Apply Date Range
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const TicketsHub = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const isUserAdmin = user?.isAdmin || user?.role === 'admin';

    // Style mapping matching exact light / dark profiles
    const themeStyles = {
        bg: isLight ? '#f8fafc' : '#030712',
        cardBg: isLight ? '#ffffff' : 'rgba(17, 24, 39, 0.7)',
        cardBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.04)',
        headerBg: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(3, 7, 18, 0.8)',
        headerBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#1e293b' : '#f3f4f6',
        textMuted: isLight ? '#64748b' : '#9ca3af',
        inputBg: isLight ? '#ffffff' : 'rgba(17, 24, 39, 0.5)',
        inputBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
        tableHeaderBg: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.4)',
        tableRowBorder: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.03)',
    };

    // Core Tabs: 'incident-center' (Incident Helpdesk), 'engineer-workspaces' (Online Users), 'incident-assignment' (Ticket Assigned/Creation)
    const [activeTab, setActiveTab] = useState('incident-center');
    
    // Within 'incident-center', we support 'list' (Image 2) or 'dashboard' (Image 1) views
    const [viewType, setViewType] = useState('list'); 
    
    // Within 'incident-assignment', we support 'ticket' (Image 3) or 'contact' sub-tabs
    const [creationTab, setCreationTab] = useState('ticket'); 
    
    const [formTab, setFormTab] = useState('write'); // Rich description write vs preview
    
    // Search and filters
    const [search, setSearch] = useState('');
    const [filterBU, setFilterBU] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState(''); 
    const [filterCreatedBy, setFilterCreatedBy] = useState('');
    const [filterResolvedBy, setFilterResolvedBy] = useState('');
    const [filterCreatedAt, setFilterCreatedAt] = useState('');
    const [filterResolvedAt, setFilterResolvedAt] = useState('');

    // Dynamic database tickets list & stats
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Persisted notifications
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [notifSearch, setNotifSearch] = useState('');

    const [dbClients, setDbClients] = useState([]);
    const [technologiesList, setTechnologiesList] = useState([]);
    const [agentsList, setAgentsList] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allReplies, setAllReplies] = useState([]);
    const [allRepliesLoading, setAllRepliesLoading] = useState(false);

    // New Ticket Form State
    const [bu, setBu] = useState('');
    const [company, setCompany] = useState('');
    const [contact, setContact] = useState('');
    const [ticketName, setTicketName] = useState('');
    const [category, setCategory] = useState('');
    const [ticketStatus, setTicketStatus] = useState('OPEN');
    const [priority, setPriority] = useState('');
    const [agent, setAgent] = useState('');
    const [description, setDescription] = useState('');

    // New Contact Form State
    const [contactName, setContactName] = useState('');
    const [contactCompany, setContactCompany] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactStatus, setContactStatus] = useState('Active');

    const getTicketNotificationType = (ticketId) => {
        const matching = notifications.find(n => 
            !n.is_read && 
            n.message && 
            (n.message.includes(`#${ticketId}`) || n.message.toLowerCase().includes(`ticket #${ticketId}`))
        );
        if (!matching) return null;
        if (matching.message.toLowerCase().includes('reply') || matching.message.toLowerCase().includes('replied') || matching.message.toLowerCase().includes('comment')) {
            return 'reply';
        }
        return 'ticket';
    };

    // Details & Update Modal State
    const [viewDetailTicket, setViewDetailTicket] = useState(null);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [ticketComments, setTicketComments] = useState([]);
    const [commentsViewMode, setCommentsViewMode] = useState('categorized');
    const [replyContent, setReplyContent] = useState('');
    const [commentAttachments, setCommentAttachments] = useState([]);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [activeComposeType, setActiveComposeType] = useState('note');
    const [ccEmail, setCcEmail] = useState('');
    const [toEmail, setToEmail] = useState('');
    const [subjectText, setSubjectText] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [showMergeDrawer, setShowMergeDrawer] = useState(false);
    const [mergeSearchText, setMergeSearchText] = useState('');
    const [editBu, setEditBu] = useState('');
    const [editCompany, setEditCompany] = useState('');
    const [editContact, setEditContact] = useState('');
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [editPriority, setEditPriority] = useState('');
    const [editAgent, setEditAgent] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Dynamic Database-Driven Online Users
    const [onlineUsers, setOnlineUsers] = useState([]);

    // List of Assigned Tickets Dashboard Data (Calculated dynamically from live DB tickets - starts at zero baseline!)
    const assignedTicketsList = agentsList.map(name => {
        const agentTickets = tickets.filter(t => t.agent && t.agent.includes(name));
        return {
            name,
            open: agentTickets.filter(t => (t.status || 'OPEN').toUpperCase() === 'OPEN').length,
            resolved: agentTickets.filter(t => (t.status || '').toUpperCase() === 'RESOLVED').length,
            pending: agentTickets.filter(t => (t.status || '').toUpperCase() === 'PENDING').length,
            inprogress: agentTickets.filter(t => (t.status || '').toUpperCase() === 'IN PROGRESS').length,
        };
    });

    // Dynamic Status Count helpers (calculated dynamically - 100% database-driven!)
    const openCount = tickets.filter(t => (t.status || 'OPEN').toUpperCase() === 'OPEN').length;
    const resolvedCount = tickets.filter(t => (t.status || '').toUpperCase() === 'RESOLVED').length;
    const pendingCount = tickets.filter(t => (t.status || '').toUpperCase() === 'PENDING').length;
    const inProgressCount = tickets.filter(t => (t.status || '').toUpperCase() === 'IN PROGRESS').length;

    // Fetch tickets from database
    const fetchTickets = (showSpinner = true) => {
        if (showSpinner) setIsLoading(true);
        let url = `/new-features/tickets?search=${search}`;
        if (filterBU) url += `&business_unit=${filterBU}`;
        if (filterCompany) url += `&company=${filterCompany}`;
        if (filterAgent) url += `&agent=${filterAgent}`;
        if (filterPriority) url += `&priority=${filterPriority}`;
        if (filterStatus) url += `&status=${filterStatus}`;
        if (filterCreatedBy) url += `&created_by=${filterCreatedBy}`;
        if (filterResolvedBy) url += `&resolved_by=${filterResolvedBy}`;
        if (filterCreatedAt) url += `&created_at=${filterCreatedAt}`;
        if (filterResolvedAt) url += `&resolved_at=${filterResolvedAt}`;

        api.get(url)
            .then(res => {
                setTickets(res.data.tickets || []);
            })
            .catch(err => console.error("Error fetching tickets:", err))
            .finally(() => setIsLoading(false));
    };

    // Fetch persisted notifications
    const fetchNotifications = () => {
        api.get('/new-features/notifications')
            .then(res => {
                setNotifications(res.data.notifications || []);
            })
            .catch(err => console.error("Error fetching notifications:", err));
    };

    const fetchOnlineUsers = () => {
        api.get('/new-features/admin/online-users')
            .then(res => {
                setOnlineUsers(res.data.online_users || []);
            })
            .catch(err => console.error("Error fetching online users:", err));
    };

    const fetchAllReplies = () => {
        setAllRepliesLoading(true);
        api.get('/new-features/tickets/all-comments/replies')
            .then(res => {
                setAllReplies(res.data.comments || []);
            })
            .catch(err => console.error("Error fetching all replies:", err))
            .finally(() => setAllRepliesLoading(false));
    };

    const handleGoToTicket = (ticketId) => {
        const t = tickets.find(ticket => ticket.id === ticketId);
        if (t) {
            setViewDetailTicket(t);
            setActiveTab('incident-center');
        } else {
            api.get(`/new-features/tickets?search=${ticketId}`)
                .then(res => {
                    const foundTickets = res.data.tickets || [];
                    const exactTicket = foundTickets.find(ticket => ticket.id === ticketId);
                    if (exactTicket) {
                        setViewDetailTicket(exactTicket);
                        setActiveTab('incident-center');
                    } else if (foundTickets.length > 0) {
                        setViewDetailTicket(foundTickets[0]);
                        setActiveTab('incident-center');
                    }
                })
                .catch(err => console.error("Error fetching ticket by ID:", err));
        }
    };

    useEffect(() => {
        fetchOnlineUsers();
        
        api.get('/new-features/admin/clients')
            .then(res => {
                const clients = res.data.clients || [];
                setDbClients(clients);
            })
            .catch(err => console.error("Error fetching db clients in Tickets:", err));

        api.get('/new-features/admin/business-units')
            .then(res => {
                const bus = res.data.business_units || [];
                setTechnologiesList(bus.map(b => b.name));
            })
            .catch(err => console.error("Error fetching business units in Tickets:", err));

        api.get('/new-features/admin/ticket-agents')
            .then(res => {
                const ags = res.data.agents || [];
                setAgentsList(ags.map(a => a.name));
            })
            .catch(err => console.error("Error fetching agents in Tickets:", err));

        api.get('/new-features/tickets/categories')
            .then(res => {
                setCategories(res.data || ["Alert", "Incident", "Events", "Logs", "System Alert"]);
            })
            .catch(err => {
                console.error("Error fetching ticket categories:", err);
                setCategories(["Alert", "Incident", "Events", "Logs", "System Alert"]);
            });
    }, []);

    useEffect(() => {
        if (activeTab === 'all-reply-mails') {
            fetchAllReplies();
        } else {
            fetchTickets();
        }
        fetchNotifications();
    }, [search, filterBU, filterCompany, filterAgent, filterPriority, filterStatus, filterCreatedBy, filterResolvedBy, filterCreatedAt, filterResolvedAt, activeTab]);

    useEffect(() => {
        if (!autoRefreshEnabled) return;
        const timer = setInterval(() => {
            fetchTickets(false); // Silent background auto-refresh bypasses loading overlays
            fetchNotifications();
        }, 8000);
        return () => clearInterval(timer);
    }, [autoRefreshEnabled, search, filterBU, filterCompany, filterAgent, filterPriority, filterStatus, filterCreatedBy, filterResolvedBy, filterCreatedAt, filterResolvedAt, activeTab]);

    // Handle ticket creation with database persistence
    const handleCreateTicket = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        if (!bu || !company || !contact || !ticketName || !category || !priority || !agent || !description) {
            setError('Please fill in all ticket details correctly. No field should be left blank.');
            setIsLoading(false);
            return;
        }

        try {
            await api.post('/new-features/tickets', {
                business_unit: bu,
                company,
                contact,
                ticket_name: ticketName,
                category,
                status: ticketStatus,
                priority,
                agent,
                description
            });

            setSuccess(`Incident Ticket "${ticketName}" successfully created and stored in Postgres database!`);
            setTicketName('');
            setDescription('');
            setBu('');
            setCompany('');
            setContact('');
            setCategory('');
            setTicketStatus('OPEN');
            setPriority('');
            setAgent('');
            setToastMessage(`Notification stored: Ticket assigned!`);
            
            // Reload tickets and notifications
            fetchTickets();
            fetchNotifications();
            
            // Auto redirect back to list
            setTimeout(() => {
                setActiveTab('incident-center');
                setViewType('list');
                setSuccess('');
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.detail || "Failed to create ticket.");
        } finally {
            setIsLoading(false);
        }
    };

    const clearNotificationsForTicket = (ticketId) => {
        const matchingNotifs = notifications.filter(n => 
            !n.is_read && 
            n.message && 
            (n.message.includes(`#${ticketId}`) || n.message.toLowerCase().includes(`ticket #${ticketId}`))
        );
        matchingNotifs.forEach(n => {
            api.post(`/new-features/notifications/read/${n.id}`).catch(() => {});
        });
        if (matchingNotifs.length > 0) {
            setNotifications(prev => prev.map(n => 
                (n.message && (n.message.includes(`#${ticketId}`) || n.message.toLowerCase().includes(`ticket #${ticketId}`)))
                ? { ...n, is_read: true }
                : n
            ));
        }
    };

    const handleOpenDetailsModal = (t) => {
        setViewDetailTicket(t);
        setSelectedTicket(t);
        setEditBu(t.business_unit || '');
        setEditCompany(t.company || '');
        setEditContact(t.contact || '');
        setEditName(t.ticket_name || '');
        setEditCategory(t.category || 'Alert');
        setEditStatus(t.status || 'OPEN');
        setEditPriority(t.priority || 'Low');
        setEditAgent(t.agent || '');
        setEditDescription(t.description || '');
        if (t && t.id) {
            clearNotificationsForTicket(t.id);
        }
    };

    const handleUpdateTicket = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const targetId = viewDetailTicket?.id || selectedTicket?.id;
        try {
            await api.put(`/new-features/tickets/${targetId}`, {
                business_unit: editBu,
                company: editCompany,
                contact: editContact,
                ticket_name: editName,
                category: editCategory,
                status: editStatus,
                priority: editPriority,
                agent: editAgent,
                description: editDescription
            });

            setSuccess(`Incident Ticket #${targetId} updated successfully!`);
            try {
                await api.post(`/new-features/tickets/${targetId}/comments`, {
                    comment_type: 'log',
                    content: `Ticket modified: Status set to "${editStatus}", Priority to "${editPriority}", Agent to "${editAgent || 'Unassigned'}"`,
                    attachments: ''
                });
                fetchTicketComments(targetId);
            } catch (logErr) {
                console.error("Failed to write audit log:", logErr);
            }
            fetchTickets();
            fetchNotifications();
            setViewDetailTicket(prev => prev ? {
                ...prev,
                business_unit: editBu,
                company: editCompany,
                contact: editContact,
                ticket_name: editName,
                category: editCategory,
                status: editStatus,
                priority: editPriority,
                agent: editAgent,
                description: editDescription
            } : null);
            setTimeout(() => setSuccess(''), 2000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update ticket.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTicketComments = async (ticketId) => {
        try {
            const res = await api.get(`/new-features/tickets/${ticketId}/comments`);
            setTicketComments(res.data.comments || []);
        } catch (err) {
            console.error("Failed to fetch comments:", err);
        }
    };

    useEffect(() => {
        if (viewDetailTicket && viewDetailTicket.id) {
            fetchTicketComments(viewDetailTicket.id);
        } else {
            setTicketComments([]);
        }
    }, [viewDetailTicket]);

    const handleFileAttachmentChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                setCommentAttachments(prev => [...prev, { name: file.name, data: reader.result, type: file.type }]);
            };
            reader.readAsDataURL(file);
        });
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handlePostComment = async (type, content, attachmentsArr = []) => {
        if (!content || !content.trim()) return;
        try {
            setError(null);
            if (type === 'forward') {
                const trimmedTo = (toEmail || '').trim();
                if (!trimmedTo || trimmedTo.toLowerCase() === 'none') {
                    setError("Recipient email (To:) is required to forward a ticket.");
                    return;
                }
                const emails = trimmedTo.split(/[,;]/);
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                for (let email of emails) {
                    email = email.trim();
                    if (email && !emailRegex.test(email)) {
                        setError(`"${email}" is not a valid email address.`);
                        return;
                    }
                }
            }
            let finalContent = content;
            if (type === 'reply') {
                finalContent = `Subject: ${subjectText || 'No Subject'}\nCc: ${ccEmail || 'None'}\n\n${content}`;
            } else if (type === 'forward') {
                finalContent = `To: ${toEmail || 'None'}\nCc: ${ccEmail || 'None'}\n\n${content}`;
            } else if (type === 'note' && isPrivate) {
                finalContent = `[PRIVATE NOTE]\n${content}`;
            }

            const attachmentsJson = attachmentsArr.length > 0 ? JSON.stringify(attachmentsArr) : '';

            const res = await api.post(`/new-features/tickets/${viewDetailTicket.id}/comments`, {
                comment_type: type,
                content: finalContent,
                attachments: attachmentsJson
            });
            if (res.data.status === "success") {
                setTicketComments(prev => [...prev, res.data.comment]);
                setReplyContent('');
                setCommentAttachments([]);
                setCcEmail('');
                setToEmail('');
                setSubjectText('');
            }
        } catch (err) {
            console.error("Failed to post comment:", err);
            setError(err.response?.data?.detail || "Failed to add activity log.");
        }
    };

    const handleMergeTicket = async (mergedTicketId, mergedTicketName) => {
        try {
            // Post merge comment
            await api.post(`/new-features/tickets/${viewDetailTicket.id}/comments`, {
                comment_type: 'merge',
                content: `Merged Ticket #${mergedTicketId} - "${mergedTicketName}" into this ticket.`,
                attachments: ''
            });

            // Post audit log
            await api.post(`/new-features/tickets/${viewDetailTicket.id}/comments`, {
                comment_type: 'log',
                content: `Ticket #${mergedTicketId} merged into this ticket.`,
                attachments: ''
            });

            fetchTicketComments(viewDetailTicket.id);
            setShowMergeDrawer(false);
            setSuccess(`Successfully merged ticket #${mergedTicketId} into #${viewDetailTicket.id}!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error("Failed to merge ticket:", err);
            setError("Failed to merge tickets.");
        }
    };

    const handleUpdateComment = async (commentId, type, newContent, attachmentStr = "") => {
        if (!newContent || !newContent.trim()) return;
        try {
            await api.put(`/new-features/tickets/${viewDetailTicket.id}/comments/${commentId}`, {
                comment_type: type,
                content: newContent,
                attachments: attachmentStr
            });
            setTicketComments(prev => prev.map(c => c.id === commentId ? {
                ...c,
                content: newContent,
                comment_type: type,
                attachments: attachmentStr
            } : c));
            setEditingCommentId(null);
            setEditingContent('');
        } catch (err) {
            console.error("Failed to update comment:", err);
            setError(err.response?.data?.detail || "Failed to update comment.");
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await api.delete(`/new-features/tickets/${viewDetailTicket.id}/comments/${commentId}`);
            setTicketComments(prev => prev.filter(c => c.id !== commentId));
        } catch (err) {
            console.error("Failed to delete comment:", err);
            setError(err.response?.data?.detail || "Failed to delete comment.");
        }
    };

    const renderTicketDetailPage = () => {
        if (!viewDetailTicket) return null;

        const isReadOnly = false;
        const canEditAllFields = true;
        const canEditStatusOnly = false;

        const renderCommentItem = (c) => {
            const canManageComment = isUserAdmin || (user?.username && c.author.toLowerCase() === user.username.toLowerCase());
            return (
                <div key={c.id} style={{
                    background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.2)',
                    border: themeStyles.cardBorder,
                    borderRadius: '8px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    gap: '12px',
                    position: 'relative'
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#64748b',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.9rem'
                    }}>
                        {(c.author || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: themeStyles.textMain }}>{c.author}</span>
                                <span style={{
                                    marginLeft: '8px',
                                    padding: '2px 6px',
                                    background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)',
                                    border: themeStyles.cardBorder,
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    color: themeStyles.textMain,
                                    fontWeight: '800'
                                }}>Ticket #{c.ticket_id || selectedTicket?.id}</span>
                                {c.comment_type === 'dba_reply' && (
                                    <span style={{
                                        marginLeft: '8px',
                                        padding: '2px 6px',
                                        background: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '4px',
                                        fontSize: '0.68rem',
                                        color: '#2563eb',
                                        fontWeight: '800'
                                    }}>DBA TEAM</span>
                                )}
                                {c.comment_type === 'client_reply' && (
                                    <span style={{
                                        marginLeft: '8px',
                                        padding: '2px 6px',
                                        background: '#fff7ed',
                                        border: '1px solid #fed7aa',
                                        borderRadius: '4px',
                                        fontSize: '0.68rem',
                                        color: '#ea580c',
                                        fontWeight: '800'
                                    }}>CLIENT</span>
                                )}
                                <span style={{ fontSize: '0.82rem', color: themeStyles.textMuted, marginLeft: '6px' }}>
                                    {c.comment_type === 'note' ? 'Added a public note' : 
                                     c.comment_type === 'reply' ? 'Replied to this ticket' :
                                     c.comment_type === 'dba_reply' ? 'Replied via Email' :
                                     c.comment_type === 'client_reply' ? 'Replied via Email' :
                                     c.comment_type === 'forward' ? 'Forwarded this ticket' : 'Merged this ticket'}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                                    {new Date(c.created_at).toLocaleString()}
                                </span>
                            </div>
                            {canManageComment && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        onClick={() => {
                                            setEditingCommentId(c.id);
                                            setEditingContent(c.content);
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteComment(c.id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {editingCommentId === c.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '80px',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: themeStyles.inputBorder,
                                        background: themeStyles.inputBg,
                                        color: themeStyles.textMain,
                                        fontSize: '0.8rem',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={() => setEditingCommentId(null)}
                                        style={{ background: themeStyles.inputBg, color: themeStyles.textMuted, border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => handleUpdateComment(c.id, c.comment_type, editingContent, c.attachments)}
                                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: themeStyles.textMain, display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.5' }}>
                                {(() => {
                                    if (c.comment_type === 'forward') {
                                        const match = c.content.match(/^To:\s*(.*?)\nCc:\s*(.*?)\n\n([\s\S]*)$/);
                                        if (match) {
                                            const to = match[1];
                                            const cc = match[2];
                                            const msg = match[3];
                                            return (
                                                <div style={{ 
                                                    borderLeft: '3px solid #2563eb', 
                                                    paddingLeft: '12px', 
                                                    marginTop: '4px',
                                                    marginBottom: '4px'
                                                }}>
                                                    <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginBottom: '8px', borderBottom: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, paddingBottom: '6px' }}>
                                                        <span style={{ fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>Forwarded Email Info</span><br />
                                                        <strong>To:</strong> {to}<br />
                                                        <strong>Cc:</strong> {cc !== 'None' ? cc : '—'}
                                                    </div>
                                                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: themeStyles.textMain }}>{msg}</p>
                                                </div>
                                            );
                                        }
                                    } else if (c.comment_type === 'dba_reply') {
                                        return (
                                            <div style={{ 
                                                borderLeft: '3px solid #2563eb', 
                                                paddingLeft: '12px', 
                                                marginTop: '4px',
                                                marginBottom: '4px'
                                            }}>
                                                <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginBottom: '8px', borderBottom: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, paddingBottom: '6px' }}>
                                                    <span style={{ fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>DBA Team Email Reply</span>
                                                </div>
                                                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: themeStyles.textMain }}>{c.content}</p>
                                            </div>
                                        );
                                    } else if (c.comment_type === 'client_reply') {
                                        return (
                                            <div style={{ 
                                                borderLeft: '3px solid #ea580c', 
                                                paddingLeft: '12px', 
                                                marginTop: '4px',
                                                marginBottom: '4px'
                                            }}>
                                                <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginBottom: '8px', borderBottom: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, paddingBottom: '6px' }}>
                                                    <span style={{ fontWeight: '700', color: '#ea580c', textTransform: 'uppercase' }}>Client Email Reply</span>
                                                </div>
                                                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: themeStyles.textMain }}>{c.content}</p>
                                            </div>
                                        );
                                    } else if (c.comment_type === 'reply') {
                                        const match = c.content.match(/^Subject:\s*(.*?)\nCc:\s*(.*?)\n\n([\s\S]*)$/);
                                        if (match) {
                                            const subject = match[1];
                                            const cc = match[2];
                                            const msg = match[3];
                                            return (
                                                <div style={{ 
                                                    borderLeft: '3px solid #10b981', 
                                                    paddingLeft: '12px', 
                                                    marginTop: '4px',
                                                    marginBottom: '4px'
                                                }}>
                                                    <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginBottom: '8px', borderBottom: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, paddingBottom: '6px' }}>
                                                        <span style={{ fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>Email Reply Info</span><br />
                                                        <strong>Subject:</strong> {subject}<br />
                                                        <strong>Cc:</strong> {cc !== 'None' ? cc : '—'}
                                                    </div>
                                                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: themeStyles.textMain }}>{msg}</p>
                                                </div>
                                            );
                                        }
                                    }
                                    return <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.content}</p>;
                                })()}
                                {c.attachments && (() => {
                                     try {
                                         const parsed = JSON.parse(c.attachments);
                                         const fileList = Array.isArray(parsed) ? parsed : [parsed];
                                         if (!fileList.length) return null;
                                         return (
                                             <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                 <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '2px' }}>📎 Attachments ({fileList.length}):</span>
                                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                     {fileList.map((fileObj, idx) => {
                                                         const isImg = fileObj.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileObj.name || '');
                                                         const isPdf = /\.pdf$/i.test(fileObj.name || '');
                                                         return (
                                                             <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: isImg ? '200px' : 'none' }}>
                                                                 {isImg && (
                                                                     <img 
                                                                         src={fileObj.data} 
                                                                         alt={fileObj.name} 
                                                                         style={{ maxWidth: '200px', maxHeight: '140px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}
                                                                         onClick={() => window.open(fileObj.data, '_blank')}
                                                                     />
                                                                 )}
                                                                 <a 
                                                                     href={fileObj.data}
                                                                     download={fileObj.name}
                                                                     style={{
                                                                         display: 'inline-flex',
                                                                         alignItems: 'center',
                                                                         gap: '6px',
                                                                         padding: '5px 10px',
                                                                         background: isImg ? (isLight ? '#f0fdf4' : 'rgba(16,185,129,0.1)') : isPdf ? (isLight ? '#fef2f2' : 'rgba(239,68,68,0.1)') : (isLight ? '#eff6ff' : 'rgba(37,99,235,0.1)'),
                                                                         border: `1px solid ${isImg ? (isLight ? '#bbf7d0' : 'rgba(16,185,129,0.2)') : isPdf ? (isLight ? '#fecaca' : 'rgba(239,68,68,0.2)') : (isLight ? '#bfdbfe' : 'rgba(37,99,235,0.2)')}`,
                                                                         borderRadius: '5px',
                                                                         fontSize: '0.72rem',
                                                                         color: isImg ? '#16a34a' : isPdf ? '#dc2626' : '#2563eb',
                                                                         fontWeight: '700',
                                                                         textDecoration: 'none',
                                                                         transition: 'all 0.2s'
                                                                     }}
                                                                     onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                                     onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                                 >
                                                                     <Download size={12} />
                                                                     <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileObj.name}</span>
                                                                 </a>
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             </div>
                                         );
                                     } catch(err) {
                                         // Fallback for legacy string attachments
                                         return c.attachments ? (
                                             <div style={{ marginTop: '8px' }}>
                                                 <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px' }}>Attachments:</span>
                                                 <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '4px', fontSize: '0.75rem', color: themeStyles.textMain, fontWeight: '600' }}>
                                                     {c.attachments}
                                                 </span>
                                             </div>
                                         ) : null;
                                     }
                                 })()}
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease', color: themeStyles.textMain }}>
                {/* Top Bar: Go Back */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <button
                        onClick={() => setViewDetailTicket(null)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'none',
                            border: 'none',
                            color: themeStyles.textMuted,
                            fontWeight: '700',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            padding: '4px 0',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = themeStyles.textMain}
                        onMouseLeave={(e) => e.currentTarget.style.color = themeStyles.textMuted}
                    >
                        <ArrowLeft size={16} />
                        <span>Go Back</span>
                    </button>
                </div>

                {/* Action buttons box */}
                <div style={{
                    background: themeStyles.cardBg,
                    border: themeStyles.cardBorder,
                    borderRadius: '8px',
                    padding: '0.75rem 1.25rem',
                    display: 'flex',
                    gap: '10px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}>
                    <button 
                        onClick={() => setActiveComposeType(activeComposeType === 'reply' ? null : 'reply')}
                        style={{ 
                            display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', 
                            border: activeComposeType === 'reply' ? '1px solid #2563eb' : themeStyles.inputBorder, 
                            background: activeComposeType === 'reply' ? (isLight ? '#eff6ff' : 'rgba(37,99,235,0.15)') : themeStyles.inputBg, 
                            color: activeComposeType === 'reply' ? '#2563eb' : themeStyles.textMain, cursor: 'pointer' 
                        }}
                    >
                        <CornerUpLeft size={14} />
                        <span>Reply</span>
                    </button>
                    <button 
                        onClick={() => setActiveComposeType(activeComposeType === 'note' ? null : 'note')}
                        style={{ 
                            display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', 
                            border: activeComposeType === 'note' ? '1px solid #2563eb' : themeStyles.inputBorder, 
                            background: activeComposeType === 'note' ? (isLight ? '#eff6ff' : 'rgba(37,99,235,0.15)') : themeStyles.inputBg, 
                            color: activeComposeType === 'note' ? '#2563eb' : themeStyles.textMain, cursor: 'pointer' 
                        }}
                    >
                        <FileText size={14} />
                        <span>Add Note</span>
                    </button>
                    <button 
                        onClick={() => setActiveComposeType(activeComposeType === 'forward' ? null : 'forward')}
                        style={{ 
                            display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', 
                            border: activeComposeType === 'forward' ? '1px solid #2563eb' : themeStyles.inputBorder, 
                            background: activeComposeType === 'forward' ? (isLight ? '#eff6ff' : 'rgba(37,99,235,0.15)') : themeStyles.inputBg, 
                            color: activeComposeType === 'forward' ? '#2563eb' : themeStyles.textMain, cursor: 'pointer' 
                        }}
                    >
                        <CornerUpRight size={14} />
                        <span>Forward</span>
                    </button>
                    <button 
                        onClick={() => setShowMergeDrawer(!showMergeDrawer)}
                        style={{ 
                            display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', 
                            border: showMergeDrawer ? '1px solid #2563eb' : themeStyles.inputBorder, 
                            background: showMergeDrawer ? (isLight ? '#eff6ff' : 'rgba(37,99,235,0.15)') : themeStyles.inputBg, 
                            color: showMergeDrawer ? '#2563eb' : themeStyles.textMain, cursor: 'pointer' 
                        }}
                    >
                        <GitMerge size={14} />
                        <span>Merge</span>
                    </button>
                </div>

                {/* Main Layout Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '7fr 3fr',
                    gap: '2rem',
                    alignItems: 'flex-start'
                }}>
                    {/* Left Column */}
                    <div style={{
                        background: themeStyles.cardBg,
                        border: themeStyles.cardBorder,
                        borderRadius: '8px',
                        padding: '2.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                        {/* Status badge */}
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                            <span style={{
                                background: editStatus === 'RESOLVED' ? (isLight ? '#f1f5f9' : '#1f2937') : editStatus === 'PENDING' ? (isLight ? '#fef3c7' : '#78350f') : editStatus === 'IN PROGRESS' ? (isLight ? '#dbeafe' : '#1e3a8a') : (isLight ? '#dcfce7' : '#064e3b'),
                                color: editStatus === 'RESOLVED' ? themeStyles.textMuted : editStatus === 'PENDING' ? '#fbbf24' : editStatus === 'IN PROGRESS' ? '#3b82f6' : '#10b981',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: '800',
                                border: `1px solid ${editStatus === 'RESOLVED' ? (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)') : editStatus === 'PENDING' ? (isLight ? '#fde68a' : 'rgba(251,191,36,0.2)') : editStatus === 'IN PROGRESS' ? (isLight ? '#bfdbfe' : 'rgba(59,130,246,0.2)') : (isLight ? '#bbf7d0' : 'rgba(16,185,129,0.2)')}`,
                                textTransform: 'uppercase'
                            }}>
                                {editStatus}
                            </span>
                        </div>

                        {/* Ticket title with globe icon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <Globe size={24} style={{ color: '#3b82f6' }} />
                            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: themeStyles.textMain, margin: 0 }}>
                                {viewDetailTicket.ticket_name}
                            </h1>
                        </div>

                        {/* Creator Avatar Block */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: isLight ? '#475569' : '#374151',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '1.1rem'
                            }}>
                                {(viewDetailTicket.agent || viewDetailTicket.created_by || 'S')[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: themeStyles.textMain }}>
                                    {viewDetailTicket.agent || 'Unassigned Agent'}
                                </span>
                                <span style={{ fontSize: '0.76rem', color: themeStyles.textMuted }}>
                                    {viewDetailTicket.business_unit || 'Database Management'}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginTop: '2px' }}>
                                    {new Date(viewDetailTicket.created_at || Date.now()).toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        {/* File/Category label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: themeStyles.textMuted, fontSize: '0.78rem', marginBottom: '2.5rem' }}>
                            <FileText size={15} />
                            <span>{viewDetailTicket.company} ( {viewDetailTicket.category || 'Support Desk Ticket'} )</span>
                        </div>

                        {/* Horizontal key-value parameters */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 4fr',
                            gap: '1.25rem 2rem',
                            borderTop: themeStyles.tableRowBorder,
                            paddingTop: '1.5rem',
                            borderBottom: themeStyles.tableRowBorder,
                            paddingBottom: '1.5rem',
                            marginBottom: '2rem'
                        }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>Ticket ID</span>
                            <span style={{ fontSize: '0.8rem', color: themeStyles.textMain, fontWeight: '600' }}>#{viewDetailTicket.id}</span>

                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>Description</span>
                            <span style={{ fontSize: '0.8rem', color: themeStyles.textMain, lineHeight: '1.5' }}>{viewDetailTicket.description || 'No description provided.'}</span>

                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>First Occured</span>
                            <span style={{ fontSize: '0.8rem', color: themeStyles.textMain }}>
                                {new Date(viewDetailTicket.created_at || Date.now()).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                            </span>

                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>Last Occured</span>
                            <span style={{ fontSize: '0.8rem', color: themeStyles.textMain }}>
                                {(() => {
                                    if (ticketComments && ticketComments.length > 0) {
                                        const sortedComments = [...ticketComments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                        if (sortedComments.length > 0) {
                                            return new Date(sortedComments[0].created_at).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
                                        }
                                    }
                                    return new Date(viewDetailTicket.created_at || Date.now()).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
                                })()}
                            </span>
                        </div>

                        {/* SPID and EXECUTING SQL blocks for MSSQL alert ticket */}
                        {(() => {
                            const mssqlLogs = (ticketComments || [])
                                .filter(c => c.comment_type === 'log' && c.content && c.content.startsWith('MSSQL_LOG_DATA:'))
                                .map(c => {
                                    try {
                                        return JSON.parse(c.content.substring('MSSQL_LOG_DATA:'.length));
                                    } catch(e) {
                                        return null;
                                    }
                                })
                                .filter(x => x !== null);

                            let currentSpid = '';
                            let currentSql = '';
                            if (mssqlLogs.length > 0) {
                                currentSpid = mssqlLogs[0].spid || '';
                                currentSql = mssqlLogs[0].sql_text || mssqlLogs[0].executing_sql || '';
                            } else if (viewDetailTicket.description) {
                                const spidMatch = viewDetailTicket.description.match(/SPID\s*[:\-]?\s*(\d+)/i);
                                if (spidMatch) currentSpid = spidMatch[1];
                                const sqlMatch = viewDetailTicket.description.match(/Executing SQL:\s*\n?([\s\S]*?)(?:\n\nEmail Body:|$)/i);
                                if (sqlMatch) currentSql = sqlMatch[1].trim();
                            }

                            if (viewDetailTicket.business_unit === 'MSSQL' && viewDetailTicket.created_by && viewDetailTicket.created_by.toLowerCase() === 'system' && currentSpid && currentSql) {
                                return (
                                    <div style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '1.25rem', 
                                        marginTop: '0.5rem', 
                                        marginBottom: '2rem', 
                                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`, 
                                        padding: '1.5rem', 
                                        borderRadius: '8px', 
                                        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)' 
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted, width: '120px' }}>SPID</label>
                                            <input 
                                                type="text" 
                                                value={currentSpid} 
                                                readOnly 
                                                style={{ 
                                                    width: '120px', 
                                                    padding: '6px 12px', 
                                                    borderRadius: '6px', 
                                                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, 
                                                    background: themeStyles.inputBg, 
                                                    color: themeStyles.textMain, 
                                                    textAlign: 'center',
                                                    fontWeight: '700',
                                                    fontSize: '0.9rem' 
                                                }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>EXECUTING SQL</label>
                                            <textarea 
                                                value={currentSql} 
                                                readOnly 
                                                rows={12}
                                                style={{ 
                                                    width: '100%', 
                                                    padding: '12px', 
                                                    borderRadius: '6px', 
                                                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, 
                                                    background: themeStyles.inputBg, 
                                                    color: themeStyles.textMain, 
                                                    fontFamily: 'Courier New, Courier, monospace',
                                                    fontSize: '0.82rem',
                                                    lineHeight: '1.4',
                                                    resize: 'vertical'
                                                }} 
                                            />
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Logs Occurrence Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMuted }}>Logs:</span>
                            <div>
                                {(() => {
                                    const mssqlLogs = (ticketComments || [])
                                        .filter(c => c.comment_type === 'log' && c.content && c.content.startsWith('MSSQL_LOG_DATA:'))
                                        .map(c => {
                                            try {
                                                return JSON.parse(c.content.substring('MSSQL_LOG_DATA:'.length));
                                            } catch(e) {
                                                return null;
                                            }
                                        })
                                        .filter(x => x !== null);

                                    const isMssqlSystemAlert = (viewDetailTicket.business_unit === 'MSSQL' && viewDetailTicket.created_by && viewDetailTicket.created_by.toLowerCase() === 'system');
                                    let logsToRender = mssqlLogs;
                                    if (isMssqlSystemAlert && logsToRender.length === 0 && viewDetailTicket.description) {
                                        let spidVal = '';
                                        const spidMatch = viewDetailTicket.description.match(/SPID\s*[:\-]?\s*(\d+)/i);
                                        if (spidMatch) spidVal = spidMatch[1];
                                        
                                        let sqlTextVal = '';
                                        const sqlMatch = viewDetailTicket.description.match(/Executing SQL:\s*\n?([\s\S]*?)(?:\n\nEmail Body:|$)/i);
                                        if (sqlMatch) sqlTextVal = sqlMatch[1].trim();
                                        
                                        let databaseVal = '';
                                        const dbMatch = viewDetailTicket.description.match(/Database\s*[:\-]?\s*([a-zA-Z0-9_]+)/i);
                                        if (dbMatch) databaseVal = dbMatch[1].trim();

                                        let serverVal = viewDetailTicket.server_name || '';
                                        const serverMatch = viewDetailTicket.description.match(/Server\s*-\s*([a-zA-Z0-9_\-]+)/i);
                                        if (serverMatch) serverVal = serverMatch[1].trim();
                                        
                                        logsToRender = [{
                                            spid: spidVal,
                                            start_time: new Date(viewDetailTicket.created_at || Date.now()).toISOString().replace('T', ' ').substring(0, 19),
                                            elapsed_time: '-',
                                            user: 'System',
                                            hostname: serverVal,
                                            database: databaseVal,
                                            sql_text: sqlTextVal,
                                            wait_type: 'None',
                                            stored_procedure: 'None'
                                        }];
                                    }

                                    const hasValidLogs = logsToRender.length > 0 && logsToRender.some(log => log.spid && (log.sql_text || log.executing_sql));
                                    if (isMssqlSystemAlert && hasValidLogs) {
                                        return (
                                            <div style={{ overflowX: 'auto', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', width: '100%', marginTop: '0.5rem' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', fontFamily: 'Calibri, Arial, sans-serif' }}>
                                                    <thead>
                                                        <tr style={{ background: '#0088ff', borderBottom: `1px solid #cbd5e1` }}>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>SPID</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Start Time</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Elapsed Time (hh:mm:ss)</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>User</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>HostName</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Database</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>SQL Text</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Wait Type</th>
                                                            <th style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ffffff' }}>StoredProcedure</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {logsToRender.map((log, index) => (
                                                            <tr key={index} style={{ 
                                                                borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                                                background: index % 2 === 0 ? (isLight ? '#ffffff' : 'rgba(255,255,255,0.01)') : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)')
                                                            }}>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.spid || '-'}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, whiteSpace: 'nowrap', borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.start_time || log.login_time || '-'}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.elapsed_time || (log.duration_min ? `00:${log.duration_min}:00` : '-')}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, whiteSpace: 'nowrap', borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.user || log.login_name || '-'}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, whiteSpace: 'nowrap', borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.hostname || '-'}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, whiteSpace: 'nowrap', borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.database || '-'}</td>
                                                                <td style={{ 
                                                                    padding: '10px 12px', 
                                                                    color: themeStyles.textMain,
                                                                    borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                                                    fontFamily: 'Courier New, monospace',
                                                                    maxWidth: '300px',
                                                                    wordBreak: 'break-word'
                                                                }} title={log.sql_text || log.executing_sql}>
                                                                    {log.sql_text || log.executing_sql || '-'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>{log.wait_type || 'None'}</td>
                                                                <td style={{ padding: '10px 12px', color: themeStyles.textMain, fontFamily: 'Courier New, monospace', wordBreak: 'break-word' }}>{log.stored_procedure || 'None'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    }

                                    const rawLogs = ticketComments.filter(c => c.comment_type === 'log');
                                    if (rawLogs.length === 0) {
                                        return (
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '1rem 1.5rem',
                                                background: themeStyles.inputBg,
                                                border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: '6px',
                                                textAlign: 'center',
                                                maxWidth: '160px'
                                            }}>
                                                <EyeOff size={24} style={{ color: themeStyles.textMuted, marginBottom: '4px' }} />
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: themeStyles.textMuted }}>No Data</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {rawLogs.map((c) => (
                                                <div key={c.id} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '0.74rem', color: themeStyles.textMain, lineHeight: '1.4' }}>
                                                    <span style={{ color: '#2563eb', fontWeight: '900' }}>•</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span>{c.content}</span>
                                                        <span style={{ fontSize: '0.66rem', color: themeStyles.textMuted }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {c.author}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Compose Panel */}
                        {activeComposeType && (
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                boxShadow: isLight ? '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Header Bar */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: isLight ? '#1e293b' : '#0f172a',
                                    padding: '8px 12px',
                                    borderTopLeftRadius: '7px',
                                    borderTopRightRadius: '7px',
                                    gap: '8px'
                                }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: '#38bdf8',
                                        color: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.74rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {(user?.username || 'A')[0].toUpperCase()}
                                    </div>

                                    {/* Action Select Dropdown */}
                                    <select
                                        value={activeComposeType}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'merge') {
                                                setShowMergeDrawer(true);
                                            } else {
                                                setActiveComposeType(val);
                                            }
                                        }}
                                        style={{
                                            background: isLight ? '#334155' : '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '4px',
                                            color: '#ffffff',
                                            fontWeight: '700',
                                            fontSize: '0.76rem',
                                            padding: '2px 8px',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="note">Add Note</option>
                                        <option value="reply">Reply</option>
                                        <option value="forward">Forward</option>
                                        <option value="merge">Merge</option>
                                    </select>

                                    {/* Public/Private selector */}
                                    {activeComposeType === 'note' && (
                                        <select
                                            value={isPrivate ? 'private' : 'public'}
                                            onChange={(e) => setIsPrivate(e.target.value === 'private')}
                                            style={{
                                                background: isLight ? '#334155' : '#1e293b',
                                                border: '1px solid #475569',
                                                borderRadius: '4px',
                                                color: '#ffffff',
                                                fontSize: '0.74rem',
                                                padding: '2px 8px',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="public">Public</option>
                                            <option value="private">Private</option>
                                        </select>
                                    )}

                                    {/* Attach Files Button */}
                                    <input 
                                        type="file" 
                                        id="rich-file-input" 
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                                        style={{ display: 'none' }} 
                                        onChange={handleFileAttachmentChange}
                                    />
                                    <button 
                                        onClick={() => document.getElementById('rich-file-input').click()}
                                        style={{
                                            background: '#2563eb',
                                            border: 'none',
                                            color: '#ffffff',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginLeft: 'auto'
                                        }}
                                    >
                                        Attach Files
                                    </button>

                                    {/* Close compose */}
                                    <button 
                                        onClick={() => setActiveComposeType(null)}
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Context Specific Fields (Reply / Forward) */}
                                {activeComposeType === 'reply' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.4)', borderBottom: themeStyles.cardBorder }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>From:</span>
                                            <span style={{ color: themeStyles.textMain, fontWeight: '600' }}>dccagent@geopits.com</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>Cc:</span>
                                            <input 
                                                type="text" 
                                                value={ccEmail} 
                                                onChange={(e) => setCcEmail(e.target.value)} 
                                                placeholder="Cc email addresses..." 
                                                style={{ flex: 1, padding: '4px 8px', border: themeStyles.inputBorder, borderRadius: '4px', outline: 'none', fontSize: '0.76rem', background: themeStyles.inputBg, color: themeStyles.textMain }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>Subject:</span>
                                            <input 
                                                type="text" 
                                                value={subjectText} 
                                                onChange={(e) => setSubjectText(e.target.value)} 
                                                placeholder="Enter subject..." 
                                                style={{ flex: 1, padding: '4px 8px', border: themeStyles.inputBorder, borderRadius: '4px', outline: 'none', fontSize: '0.76rem', background: themeStyles.inputBg, color: themeStyles.textMain }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeComposeType === 'forward' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.4)', borderBottom: themeStyles.cardBorder }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>From:</span>
                                            <span style={{ color: themeStyles.textMain, fontWeight: '600' }}>dccagent@geopits.com</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>To:</span>
                                            <input 
                                                type="text" 
                                                value={toEmail} 
                                                onChange={(e) => setToEmail(e.target.value)} 
                                                placeholder="Enter recipient email addresses..." 
                                                style={{ flex: 1, padding: '4px 8px', border: themeStyles.inputBorder, borderRadius: '4px', outline: 'none', fontSize: '0.76rem', background: themeStyles.inputBg, color: themeStyles.textMain }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem' }}>
                                            <span style={{ fontWeight: '700', color: themeStyles.textMuted, minWidth: '60px' }}>Cc:</span>
                                            <input 
                                                type="text" 
                                                value={ccEmail} 
                                                onChange={(e) => setCcEmail(e.target.value)} 
                                                placeholder="Cc email addresses..." 
                                                style={{ flex: 1, padding: '4px 8px', border: themeStyles.inputBorder, borderRadius: '4px', outline: 'none', fontSize: '0.76rem', background: themeStyles.inputBg, color: themeStyles.textMain }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Formatting Toolbar */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 12px', background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.2)', borderBottom: themeStyles.cardBorder, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: themeStyles.textMuted }}>Normal</span>
                                    <span style={{ color: themeStyles.cardBorder }}>|</span>
                                    <button style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.76rem', color: themeStyles.textMuted }}>B</button>
                                    <button style={{ background: 'none', border: 'none', fontStyle: 'italic', cursor: 'pointer', fontSize: '0.76rem', color: themeStyles.textMuted }}>I</button>
                                    <button style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.76rem', color: themeStyles.textMuted }}>U</button>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.76rem', color: themeStyles.textMuted }}>¶</button>
                                    <span style={{ color: themeStyles.cardBorder }}>|</span>
                                    <span style={{ fontSize: '0.76rem', color: themeStyles.textMuted, cursor: 'pointer' }}>≡</span>
                                    <span style={{ fontSize: '0.76rem', color: themeStyles.textMuted, cursor: 'pointer' }}>▤</span>
                                    <span style={{ color: themeStyles.cardBorder }}>|</span>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.76rem', color: themeStyles.textMuted }}>
                                        <Paperclip size={13} style={{ color: '#2563eb' }} />
                                        <span>Attach File</span>
                                        <input 
                                            type="file" 
                                            multiple
                                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                                            style={{ display: 'none' }} 
                                            onChange={handleFileAttachmentChange} 
                                        />
                                    </label>
                                </div>

                                {/* Attachment badges in compose box */}
                                {commentAttachments.length > 0 && (
                                    <div style={{ padding: '6px 12px', background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.2)', borderBottom: themeStyles.cardBorder, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: themeStyles.textMuted }}>Attached:</span>
                                        {commentAttachments.map((att, idx) => (
                                            <span key={idx} style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '2px 8px',
                                                background: att.type?.startsWith('image/') ? '#f0fdf4' : '#eff6ff',
                                                border: att.type?.startsWith('image/') ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                                                borderRadius: '4px',
                                                fontSize: '0.72rem',
                                                color: att.type?.startsWith('image/') ? '#15803d' : '#2563eb',
                                                fontWeight: '600'
                                            }}>
                                                <FileText size={12} style={{ marginRight: '4px' }} />
                                                {att.name}
                                                <button 
                                                    onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))} 
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: '6px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Editor Text Area */}
                                <textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder={
                                        activeComposeType === 'note' ? 'Add a note, @mention' :
                                        activeComposeType === 'reply' ? 'Type your reply here...' : 'Type forward message...'
                                    }
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '12px',
                                        background: themeStyles.inputBg,
                                        border: 'none',
                                        color: themeStyles.textMain,
                                        fontSize: '0.8rem',
                                        outline: 'none',
                                        resize: 'vertical'
                                    }}
                                />

                                {/* Action Buttons Footer */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '10px 12px', borderTop: themeStyles.cardBorder, background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.1)', borderBottomLeftRadius: '7px', borderBottomRightRadius: '7px' }}>
                                    <button 
                                        onClick={() => setActiveComposeType(null)}
                                        style={{ background: themeStyles.inputBg, color: themeStyles.textMain, border: themeStyles.cardBorder, padding: '6px 12px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handlePostComment(activeComposeType, replyContent, commentAttachments)}
                                        style={{
                                            background: '#2563eb',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '6px 16px',
                                            borderRadius: '4px',
                                            fontSize: '0.76rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                                        }}
                                    >
                                        {activeComposeType === 'note' ? 'Add Note' : activeComposeType === 'reply' ? 'Reply' : 'Forward'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Interactive Dynamic Comments Feed */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: themeStyles.cardBorder, paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, color: themeStyles.textMain }}>Ticket Activity & Conversations</h3>
                                <div style={{ display: 'flex', gap: '4px', background: isLight ? '#f1f5f9' : 'rgba(31, 41, 55, 0.4)', padding: '2px', borderRadius: '6px' }}>
                                    <button 
                                        onClick={() => setCommentsViewMode('categorized')}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            background: commentsViewMode === 'categorized' ? '#2563eb' : 'transparent',
                                            color: commentsViewMode === 'categorized' ? '#fff' : themeStyles.textMuted,
                                            fontSize: '0.74rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        Two Sections (DBA vs Client)
                                    </button>
                                    <button 
                                        onClick={() => setCommentsViewMode('replies')}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            background: commentsViewMode === 'replies' ? '#2563eb' : 'transparent',
                                            color: commentsViewMode === 'replies' ? '#fff' : themeStyles.textMuted,
                                            fontSize: '0.74rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        All Reply Mails
                                    </button>
                                    <button 
                                        onClick={() => setCommentsViewMode('chronological')}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            background: commentsViewMode === 'chronological' ? '#2563eb' : 'transparent',
                                            color: commentsViewMode === 'chronological' ? '#fff' : themeStyles.textMuted,
                                            fontSize: '0.74rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        Chronological Feed
                                    </button>
                                </div>
                            </div>

                            {ticketComments.filter(c => c.comment_type !== 'log').length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem 2rem',
                                    background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.1)',
                                    border: '1px dashed #cbd5e1',
                                    borderRadius: '8px',
                                    color: themeStyles.textMuted
                                }}>
                                    <FileText size={32} style={{ color: '#94a3b8', marginBottom: '8px', opacity: 0.7 }} />
                                    <h3 style={{ fontSize: '0.88rem', fontWeight: '800', color: themeStyles.textMain, margin: '0 0 4px 0' }}>No activity logged yet</h3>
                                    <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: 0 }}>Use the action buttons above to Reply, Add Note, Forward or Merge.</p>
                                </div>
                            ) : commentsViewMode === 'categorized' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        {/* DBA Team Replies Column */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '2px solid #bfdbfe' }}>
                                                <span style={{ fontSize: '1.1rem' }}>🛠️</span>
                                                <h4 style={{ fontSize: '0.84rem', fontWeight: '800', color: '#2563eb', margin: 0 }}>DBA TEAM CORRESPONDENCE</h4>
                                                <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '12px', fontWeight: '800', marginLeft: 'auto' }}>
                                                    {ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'reply').length}
                                                </span>
                                            </div>
                                            {ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'reply').length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', border: themeStyles.cardBorder, borderRadius: '8px', color: themeStyles.textMuted, fontSize: '0.76rem' }}>
                                                    No replies from DBA team yet.
                                                </div>
                                            ) : (
                                                ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'reply').map(renderCommentItem)
                                            )}
                                        </div>

                                        {/* Client Replies Column */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '2px solid #fed7aa' }}>
                                                <span style={{ fontSize: '1.1rem' }}>👥</span>
                                                <h4 style={{ fontSize: '0.84rem', fontWeight: '800', color: '#ea580c', margin: 0 }}>CLIENT CORRESPONDENCE</h4>
                                                <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#ea580c', padding: '2px 6px', borderRadius: '12px', fontWeight: '800', marginLeft: 'auto' }}>
                                                    {ticketComments.filter(c => c.comment_type === 'client_reply').length}
                                                </span>
                                            </div>
                                            {ticketComments.filter(c => c.comment_type === 'client_reply').length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '2rem 1rem', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', border: themeStyles.cardBorder, borderRadius: '8px', color: themeStyles.textMuted, fontSize: '0.76rem' }}>
                                                    No replies from client yet.
                                                </div>
                                            ) : (
                                                ticketComments.filter(c => c.comment_type === 'client_reply').map(renderCommentItem)
                                            )}
                                        </div>
                                    </div>

                                    {/* Internal Notes and Other Activity */}
                                    {ticketComments.filter(c => c.comment_type !== 'dba_reply' && c.comment_type !== 'reply' && c.comment_type !== 'client_reply' && c.comment_type !== 'log').length > 0 && (
                                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: themeStyles.tableRowBorder }}>
                                                <span style={{ fontSize: '1.1rem' }}>📝</span>
                                                <h4 style={{ fontSize: '0.84rem', fontWeight: '800', color: themeStyles.textMain, margin: 0 }}>INTERNAL NOTES & SYSTEM LOGS</h4>
                                            </div>
                                            {ticketComments.filter(c => c.comment_type !== 'dba_reply' && c.comment_type !== 'reply' && c.comment_type !== 'client_reply' && c.comment_type !== 'log').map(renderCommentItem)}
                                        </div>
                                    )}
                                </div>
                            ) : commentsViewMode === 'replies' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '2px solid #bfdbfe' }}>
                                            <span style={{ fontSize: '1.1rem' }}>📩</span>
                                            <h4 style={{ fontSize: '0.84rem', fontWeight: '800', color: '#2563eb', margin: 0 }}>ALL REPLY MAILS</h4>
                                            <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '12px', fontWeight: '800', marginLeft: 'auto' }}>
                                                {ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'client_reply' || c.comment_type === 'reply').length}
                                            </span>
                                        </div>
                                        {ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'client_reply' || c.comment_type === 'reply').length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', border: themeStyles.cardBorder, borderRadius: '8px', color: themeStyles.textMuted, fontSize: '0.76rem' }}>
                                                No reply emails logged yet.
                                            </div>
                                        ) : (
                                            ticketComments.filter(c => c.comment_type === 'dba_reply' || c.comment_type === 'client_reply' || c.comment_type === 'reply').map(renderCommentItem)
                                        )}
                                    </div>
                                </div>
                            ) : (
                                ticketComments.filter(c => c.comment_type !== 'log').map(renderCommentItem)
                            )}
                        </div>
                    </div>

                    {/* Right Column - Properties Sidebar */}
                    <div style={{
                        background: themeStyles.cardBg,
                        border: themeStyles.cardBorder,
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Banner Status Display */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderBottom: themeStyles.tableRowBorder,
                            fontSize: '1rem',
                            fontWeight: '900',
                            color: themeStyles.textMain,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {editStatus}
                        </div>

                        {/* PROPERTIES Label */}
                        <div style={{
                            padding: '1.25rem 1.5rem 0.5rem 1.5rem',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            color: themeStyles.textMuted,
                            letterSpacing: '0.8px'
                        }}>
                            PROPERTIES
                        </div>

                        {/* Access Control Information Banner in Sidebar */}
                        {isReadOnly && (
                            <div style={{ margin: '0 1.5rem 1rem 1.5rem', display: 'flex', gap: '8px', padding: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', lineHeight: '1.4' }}>
                                <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                <span><strong>View Only Mode:</strong> You are not authorized to update this ticket.</span>
                            </div>
                        )}
                        {canEditStatusOnly && (
                            <div style={{ margin: '0 1.5rem 1rem 1.5rem', display: 'flex', gap: '8px', padding: '10px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '6px', color: '#3b82f6', fontSize: '0.7rem', lineHeight: '1.4' }}>
                                <Info size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                                <span><strong>Assignee/Creator Access:</strong> You can modify the ticket <strong>Status</strong> only.</span>
                            </div>
                        )}

                        {/* Properties form fields */}
                        <div style={{
                            padding: '0 1.5rem 1.5rem 1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}>
                            {/* Category */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Category</label>
                                <select
                                    disabled={!canEditAllFields}
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', cursor: canEditAllFields ? 'pointer' : 'not-allowed', outline: 'none' }}
                                >
                                    <option value="Alert">Alert</option>
                                    <option value="Support Desk Ticket">Support Desk Ticket</option>
                                    <option value="System Alerts">System Alerts</option>
                                    <option value="Maintenance Request">Maintenance Request</option>
                                </select>
                            </div>

                            {/* Status */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Status</label>
                                <select
                                    disabled={isReadOnly}
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', cursor: isReadOnly ? 'not-allowed' : 'pointer', outline: 'none' }}
                                >
                                    <option value="OPEN">Open</option>
                                    <option value="IN PROGRESS">In Progress</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="RESOLVED">Resolved</option>
                                </select>
                            </div>

                            {/* Priority */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Priority</label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    {/* Color block representing priority indicator */}
                                    <div style={{
                                        position: 'absolute',
                                        left: '10px',
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '2px',
                                        background: editPriority === 'High' ? '#ef4444' : editPriority === 'Medium' ? '#f59e0b' : '#10b981'
                                    }} />
                                    <select
                                        disabled={!canEditAllFields}
                                        value={editPriority}
                                        onChange={(e) => setEditPriority(e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px 8px 28px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', cursor: canEditAllFields ? 'pointer' : 'not-allowed', outline: 'none' }}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                            </div>

                            {/* Agent */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Agent</label>
                                <select
                                    disabled={!canEditAllFields}
                                    value={editAgent}
                                    onChange={(e) => setEditAgent(e.target.value)}
                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', cursor: canEditAllFields ? 'pointer' : 'not-allowed', outline: 'none' }}
                                >
                                    <option value="">Unassigned</option>
                                    {agentsList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                                </select>
                            </div>

                            {/* Solid blue update button */}
                            {!isReadOnly && (
                                <button
                                    onClick={handleUpdateTicket}
                                    style={{
                                        marginTop: '0.5rem',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        fontWeight: '700',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        boxShadow: '0 1px 2px 0 rgba(37, 99, 235, 0.2)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                                >
                                    Update
                                </button>
                            )}
                        </div>
                </div>
            </div>

                {/* Sliding Right Merge Sidebar Drawer */}
                {showMergeDrawer && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '450px',
                        background: themeStyles.cardBg,
                        boxShadow: isLight ? '-4px 0 24px rgba(0,0,0,0.06)' : '-4px 0 32px rgba(0,0,0,0.45)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        borderLeft: themeStyles.cardBorder,
                        animation: 'slideIn 0.3s ease-out'
                    }}>
                        {/* Drawer Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: themeStyles.cardBorder }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: themeStyles.textMain }}>Merge Ticket</h3>
                            <button 
                                onClick={() => setShowMergeDrawer(false)}
                                style={{ background: 'none', border: 'none', color: themeStyles.textMuted, cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}
                            >
                                &times;
                            </button>
                        </div>
                        
                        {/* Drawer Search */}
                        <div style={{ padding: '1rem 1.5rem', borderBottom: themeStyles.cardBorder }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', color: themeStyles.textMuted }} />
                                <input
                                    type="text"
                                    value={mergeSearchText}
                                    onChange={(e) => setMergeSearchText(e.target.value)}
                                    placeholder="Search tickets by name or ID..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px 8px 32px',
                                        border: themeStyles.inputBorder,
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        color: themeStyles.textMain,
                                        outline: 'none',
                                        background: themeStyles.inputBg
                                    }}
                                />
                            </div>
                        </div>
                        
                        {/* Drawer List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tickets
                                .filter(t => t.id !== viewDetailTicket.id && (
                                    t.ticket_name.toLowerCase().includes(mergeSearchText.toLowerCase()) || 
                                    String(t.id).includes(mergeSearchText)
                                ))
                                .map((t) => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => handleMergeTicket(t.id, t.ticket_name)}
                                        style={{
                                            display: 'flex',
                                            gap: '12px',
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                                            border: themeStyles.cardBorder,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s, border-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)';
                                            e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)';
                                            e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.04)';
                                        }}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: '#64748b',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {(t.category || 'T')[0].toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: themeStyles.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                #{t.id} - {t.ticket_name}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted }}>
                                                Created: {new Date(t.created_at || Date.now()).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                        
                        {/* Drawer Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: themeStyles.cardBorder, display: 'flex', justifyContent: 'flex-end', background: isLight ? '#f8fafc' : 'rgba(31, 41, 55, 0.1)' }}>
                            <button 
                                onClick={() => setShowMergeDrawer(false)}
                                style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Handle mock contact creation
    const handleCreateContact = (e) => {
        e.preventDefault();
        setSuccess(`Contact "${contactName}" created successfully!`);
        setContactName('');
        setContactEmail('');
        setContactCompany('');
        setTimeout(() => setSuccess(''), 2000);
    };

    // Clear notifications feed in database
    const handleClearNotifications = () => {
        api.post('/new-features/notifications/read-all')
            .then(() => {
                fetchNotifications();
            })
            .catch(err => console.error("Error clearing notifications:", err));
    };

    // Mark a single notification as read in database (closes on click!)
    const handleMarkSingleRead = (notifId) => {
        api.post(`/new-features/notifications/read/${notifId}`)
            .then(() => {
                fetchNotifications();
                setShowNotifications(false); // Close dropdown tray instantly
            })
            .catch(err => console.error("Error marking notification as read:", err));
    };

    // CSV Exporter (Image 2 action)
    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,ID,Ticket Name,Company,Business Unit,Category,Status,Priority,Agent,Created By,Created At\n";
        tickets.forEach(t => {
            csvContent += `"${t.id}","${t.ticket_name}","${t.company}","${t.business_unit}","${t.category}","${t.status}","${t.priority}","${t.agent}","${t.created_by}","${t.created_at}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `geomon_helpdesk_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate pagination slices
    const paginatedTickets = tickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(tickets.length / pageSize) || 1;

    return (
        <div style={{ 
            background: themeStyles.bg, 
            color: themeStyles.textMain, 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'background 0.3s ease'
        }}>
            <style>{`
                @keyframes pulse-blue {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.6); }
                    50% { box-shadow: 0 0 0 5px rgba(37,99,235,0); }
                }
                @keyframes pulse-purple {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.6); }
                    50% { box-shadow: 0 0 0 5px rgba(139,92,246,0); }
                }
            `}</style>
            
            {/* Header Section */}
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
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button 
                        onClick={() => navigate('/')}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: themeStyles.textMain, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                        }}
                    >
                        <ArrowLeft size={16} />
                        <span>Go Back</span>
                    </button>
                    <div style={{ width: '1px', height: '20px', background: themeStyles.headerBorder, margin: '0 10px' }} />
                    <h1 style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 }}>
                        Helpdesk Command Center
                    </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Persistent Toast Alert */}
                    {toastMessage && (
                        <div style={{ 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            border: '1px solid rgba(59, 130, 246, 0.2)', 
                            borderRadius: '8px', 
                            padding: '6px 12px', 
                            fontSize: '0.78rem', 
                            color: '#3b82f6', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            animation: 'fadeInUp 0.3s ease'
                        }}>
                            <Check size={14} />
                            <span>{toastMessage}</span>
                            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setToastMessage('')} />
                        </div>
                    )}

                    {/* Real-time Telemetry Sync Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted, fontWeight: '700' }}>
                            {autoRefreshEnabled ? "SYNCING ACTIVE" : "TELEMETRY STANDBY"}
                        </span>
                        <button
                            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                            style={{
                                background: autoRefreshEnabled ? '#22c55e' : 'rgba(255,255,255,0.05)',
                                border: themeStyles.inputBorder,
                                padding: '5px 10px',
                                borderRadius: '20px',
                                color: autoRefreshEnabled ? '#000000' : themeStyles.textMuted,
                                fontSize: '0.68rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.3s ease',
                                boxShadow: autoRefreshEnabled ? '0 0 10px rgba(34, 229, 94, 0.4)' : 'none'
                            }}
                        >
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: autoRefreshEnabled ? '#ffffff' : '#9ca3af',
                                display: 'inline-block'
                            }}></span>
                            {autoRefreshEnabled ? "Live" : "Static"}
                        </button>
                    </div>

                    {/* Persisted DB Notifications dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{ 
                                background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                border: themeStyles.inputBorder,
                                padding: '8px',
                                borderRadius: '8px',
                                color: themeStyles.textMain,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative'
                            }}
                        >
                            <Bell size={16} />
                            {notifications.filter(n => !n.is_read).length > 0 && (
                                <span style={{ 
                                    position: 'absolute', 
                                    top: '-4px', 
                                    right: '-4px', 
                                    background: '#ef4444', 
                                    color: 'white', 
                                    fontSize: '0.62rem', 
                                    borderRadius: '50%', 
                                    padding: '2px 5px',
                                    fontWeight: '700'
                                }}>
                                    {notifications.filter(n => !n.is_read).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div style={{ 
                                position: 'absolute', 
                                right: 0, 
                                top: '45px', 
                                width: '320px', 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '12px 16px', borderBottom: themeStyles.tableRowBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>System Notifications</span>
                                    <button 
                                        onClick={handleClearNotifications}
                                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Mark All Read
                                    </button>
                                </div>

                                {/* Notification Search filter */}
                                <div style={{ padding: '6px 12px', borderBottom: themeStyles.tableRowBorder, background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.1)' }}>
                                    <input
                                        type="text"
                                        placeholder="Filter alerts..."
                                        value={notifSearch}
                                        onChange={(e) => setNotifSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.72rem',
                                            color: themeStyles.textMain,
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    {notifications.filter(n => !n.is_read).filter(n => !notifSearch || n.message.toLowerCase().includes(notifSearch.toLowerCase())).length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: themeStyles.textMuted, fontSize: '0.75rem' }}>
                                            No matching system notifications
                                        </div>
                                    ) : (
                                        notifications.filter(n => !n.is_read)
                                            .filter(n => !notifSearch || n.message.toLowerCase().includes(notifSearch.toLowerCase()))
                                            .map(n => (
                                                <div 
                                                    key={n.id} 
                                                    onClick={() => handleMarkSingleRead(n.id)}
                                                    title="Click to Mark Read and Close"
                                                    style={{ 
                                                        padding: '10px 16px', 
                                                        borderBottom: themeStyles.tableRowBorder,
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                    className="notification-item-hover"
                                                    onMouseEnter={(e) => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.02)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: themeStyles.textMain, lineHeight: '1.4' }}>{n.message}</p>
                                                        <span style={{ fontSize: '0.62rem', color: themeStyles.textMuted, display: 'block', marginTop: '4px' }}>
                                                            {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div style={{ 
                borderBottom: themeStyles.headerBorder,
                background: isLight ? '#ffffff' : 'rgba(5, 7, 16, 0.3)',
                padding: '0 2.5rem',
                display: 'flex',
                gap: '24px'
            }}>
                {[
                    { id: 'incident-center', label: 'Tickets Workspace', icon: <Activity size={15} /> },
                    { id: 'incident-assignment', label: 'Incident Registration', icon: <CheckSquare size={15} /> },
                    { id: 'engineer-workspaces', label: 'Online Status Directory', icon: <Users size={15} /> },
                    { id: 'all-reply-mails', label: 'All Reply Mails', icon: <Mail size={15} /> }
                ].map(tabItem => {
                    let hasDot = false;
                    let dotColor = '#2563eb';
                    let pulseAnim = 'pulse-blue';
                    if (tabItem.id === 'incident-center') {
                        hasDot = notifications.some(n => 
                            !n.is_read && 
                            n.message && 
                            (n.message.toLowerCase().includes('new ticket') || n.message.toLowerCase().includes('created'))
                        );
                    } else if (tabItem.id === 'all-reply-mails') {
                        hasDot = notifications.some(n => 
                            !n.is_read && 
                            n.message && 
                            (n.message.toLowerCase().includes('reply') || n.message.toLowerCase().includes('comment') || n.message.toLowerCase().includes('replied'))
                        );
                        dotColor = '#8b5cf6';
                        pulseAnim = 'pulse-purple';
                    }

                    return (
                        <button 
                            key={tabItem.id}
                            onClick={() => setActiveTab(tabItem.id)}
                            style={{ 
                                padding: '1.1rem 4px', 
                                background: 'none', 
                                border: 'none', 
                                borderBottom: activeTab === tabItem.id ? '2px solid #2563eb' : '2px solid transparent',
                                color: activeTab === tabItem.id ? '#2563eb' : themeStyles.textMuted,
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tabItem.icon}
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                                {tabItem.label}
                                {hasDot && (
                                    <span style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: dotColor,
                                        marginLeft: '6px',
                                        boxShadow: `0 0 6px ${dotColor}`,
                                        animation: `${pulseAnim} 1.5s infinite ease-in-out`
                                    }} />
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <main style={{ flex: 1, padding: '2rem 2.5rem', width: '100%' }}>
                {error && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)', fontSize: '0.85rem' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '0.85rem' }}>
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                {/* TAB 1: INCIDENT HELPDESK WORKSPACE */}
                {activeTab === 'incident-center' && (
                    viewDetailTicket ? (
                        renderTicketDetailPage()
                    ) : (
                        <>
                        {/* Action buttons bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Incident Logs Pipeline</h2>
                                <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: '4px 0 0 0' }}>Real-time database SLA pipeline telemetry.</p>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <select 
                                    value={viewType}
                                    onChange={(e) => setViewType(e.target.value)}
                                    style={{ 
                                        background: themeStyles.inputBg,
                                        border: themeStyles.inputBorder,
                                        color: themeStyles.textMain,
                                        padding: '7px 14px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="list">View: Ticket Logs</option>
                                    <option value="dashboard">View: Dashboard</option>
                                </select>

                                <button 
                                    onClick={() => {
                                        setActiveTab('incident-assignment');
                                        setCreationTab('ticket');
                                    }}
                                    style={{ 
                                        background: '#2563eb', 
                                        border: 'none', 
                                        color: '#fff', 
                                        padding: '7px 16px', 
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Plus size={14} />
                                    <span>Add New</span>
                                </button>

                                <button 
                                    onClick={handleExportCSV}
                                    style={{ 
                                        background: themeStyles.inputBg,
                                        border: themeStyles.inputBorder,
                                        color: themeStyles.textMain,
                                        padding: '7px 16px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Export
                                </button>
                            </div>
                        </div>

                        {/* SUB-VIEW 1: TICKET LOGS WORKSPACE (Image 2 style) */}
                        {viewType === 'list' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
                                
                                {/* Left Side: Ticket Cards List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeStyles.textMuted }} />
                                        <input 
                                            type="text" 
                                            placeholder="Search tickets by name, company..." 
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            style={{ 
                                                width: '100%', 
                                                padding: '10px 10px 10px 38px', 
                                                background: themeStyles.inputBg, 
                                                border: themeStyles.inputBorder, 
                                                borderRadius: '8px', 
                                                color: themeStyles.textMain, 
                                                fontSize: '0.85rem', 
                                                outline: 'none' 
                                            }}
                                        />
                                    </div>

                                    {/* Pagination indicator row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', fontSize: '0.78rem', color: themeStyles.textMuted }}>
                                        <span>
                                            Showing {(currentPage-1)*pageSize + 1} - {Math.min(currentPage*pageSize, tickets.length)} of {tickets.length} tickets
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button 
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(prev-1, 1))}
                                                style={{ background: 'none', border: 'none', color: currentPage === 1 ? 'transparent' : themeStyles.textMain, cursor: 'pointer' }}
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <span style={{ fontWeight: '700' }}>Page {currentPage} of {totalPages}</span>
                                            <button 
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => Math.min(prev+1, totalPages))}
                                                style={{ background: 'none', border: 'none', color: currentPage === totalPages ? 'transparent' : themeStyles.textMain, cursor: 'pointer' }}
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {isLoading ? (
                                        <div style={{ padding: '4rem', textAlign: 'center' }}>
                                            <div style={{ width: '28px', height: '28px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                                        </div>
                                    ) : paginatedTickets.length === 0 ? (
                                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '4rem 0', textAlign: 'center', borderRadius: '12px' }}>
                                            <Info size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                            <p style={{ margin: 0, color: themeStyles.textMuted, fontSize: '0.85rem' }}>No active incident records matches your queries.</p>
                                        </div>
                                    ) : (
                                        paginatedTickets.map((t, idx) => (
                                            <div 
                                                key={t.id || idx}
                                                onClick={() => handleOpenDetailsModal(t)}
                                                style={{ 
                                                    background: themeStyles.cardBg, 
                                                    border: themeStyles.cardBorder, 
                                                    padding: '1.25rem 1.5rem', 
                                                    borderRadius: '10px', 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    position: 'relative',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                                    cursor: 'pointer'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.08)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                                                    <div style={{ 
                                                        background: 'rgba(59, 130, 246, 0.08)', 
                                                        color: '#3b82f6', 
                                                        padding: '10px', 
                                                        borderRadius: '8px', 
                                                        height: '42px', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        fontWeight: '800',
                                                        fontSize: '0.95rem'
                                                    }}>
                                                        {(t.company || 'G')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: '0 0 4px 0', lineHeight: '1.4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {t.ticket_name}
                                                            {(() => {
                                                                const type = getTicketNotificationType(t.id);
                                                                if (!type) return null;
                                                                const dotColor = type === 'reply' ? '#8b5cf6' : '#2563eb';
                                                                const pulseAnim = type === 'reply' ? 'pulse-purple' : 'pulse-blue';
                                                                return (
                                                                    <span style={{
                                                                        display: 'inline-block',
                                                                        width: '8px',
                                                                        height: '8px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: dotColor,
                                                                        boxShadow: `0 0 6px ${dotColor}`,
                                                                        animation: `${pulseAnim} 1.5s infinite ease-in-out`
                                                                    }} title={type === 'reply' ? 'New unread reply' : 'New ticket alert'} />
                                                                );
                                                            })()}
                                                        </h3>
                                                        <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted, display: 'block', marginBottom: '8px' }}>
                                                            {t.category || 'Support Desk Ticket'}
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', color: themeStyles.textMuted }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Calendar size={12} />
                                                                <span>
                                                                    Created {t.created_by ? `by ${t.created_by}` : ''} on {new Date(t.created_at || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    {t.resolved_by && ` · Resolved by ${t.resolved_by} on ${new Date(t.resolved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                                                </span>
                                                            </span>
                                                            {t.company && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                                                                    {t.company}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', minWidth: '160px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: themeStyles.textMuted }}>
                                                        ( #{t.id || idx} )
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                                        <span style={{ 
                                                            width: '8px', 
                                                            height: '8px', 
                                                            borderRadius: '50%', 
                                                            background: (t.priority || '').toLowerCase() === 'high' ? '#ef4444' : (t.priority || '').toLowerCase() === 'low' ? '#10b981' : '#f59e0b'
                                                        }}></span>
                                                        <span style={{ fontWeight: '700' }}>{t.priority || 'Medium'}</span>
                                                        
                                                        {/* Dynamic SLA Countdown Target Badge */}
                                                        <span style={{ 
                                                            background: (t.priority || '').toLowerCase() === 'high' ? 'rgba(239, 68, 68, 0.1)' : (t.priority || '').toLowerCase() === 'low' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                                                            color: (t.priority || '').toLowerCase() === 'high' ? '#ef4444' : (t.priority || '').toLowerCase() === 'low' ? '#10b981' : '#f59e0b', 
                                                            padding: '2px 6px', 
                                                            borderRadius: '12px', 
                                                            fontSize: '0.62rem', 
                                                            fontWeight: '700',
                                                            marginLeft: '4px',
                                                            border: (t.priority || '').toLowerCase() === 'high' ? '1px solid rgba(239, 68, 68, 0.2)' : (t.priority || '').toLowerCase() === 'low' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                                                        }}>
                                                            🕒 SLA: {(t.priority || '').toLowerCase() === 'high' ? '4h Target' : (t.priority || '').toLowerCase() === 'low' ? '72h Target' : '24h Target'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: themeStyles.textMuted }}>
                                                        <User size={11} />
                                                        <span>{t.agent || 'Unassigned'}</span>
                                                        {t.comment_count > 0 && (
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                background: isLight ? '#eff6ff' : 'rgba(37,99,235,0.15)',
                                                                color: '#3b82f6',
                                                                padding: '1px 6px',
                                                                borderRadius: '10px',
                                                                fontSize: '0.62rem',
                                                                fontWeight: '700',
                                                                border: '1px solid rgba(59,130,246,0.2)'
                                                            }}>
                                                                💬 {t.comment_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(() => {
                                                        const st = (t.status || 'OPEN').toUpperCase();
                                                        const stColor = st === 'RESOLVED' ? '#64748b' : st === 'PENDING' ? '#f59e0b' : st === 'IN PROGRESS' ? '#3b82f6' : '#10b981';
                                                        const stBg = st === 'RESOLVED' ? 'rgba(100,116,139,0.1)' : st === 'PENDING' ? 'rgba(245,158,11,0.1)' : st === 'IN PROGRESS' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)';
                                                        return (
                                                            <span style={{ 
                                                                background: stBg,
                                                                color: stColor,
                                                                padding: '2px 8px', 
                                                                borderRadius: '4px', 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: '800',
                                                                letterSpacing: '0.5px',
                                                                border: `1px solid ${stColor}33`
                                                            }}>
                                                                {st}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                 {/* Right Side: Filter Panel */}
                                <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.5rem', borderRadius: '10px', height: 'fit-content' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                        <h3 style={{ fontSize: '0.82rem', fontWeight: '800', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filters</h3>
                                        <button 
                                            onClick={() => {
                                                setFilterBU('');
                                                setFilterCompany('');
                                                setFilterAgent('');
                                                setFilterPriority('');
                                                setFilterStatus('');
                                                setFilterCreatedBy('');
                                                setFilterResolvedBy('');
                                                setFilterCreatedAt('');
                                                setFilterResolvedAt('');
                                            }}
                                            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '700' }}
                                        >
                                            Clear Filters
                                        </button>
                                    </div>

                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <MultiSelectDropdown 
                                            label="Business Unit"
                                            options={technologiesList}
                                            selectedString={filterBU}
                                            onChange={setFilterBU}
                                            placeholder="Select Business Unit"
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        {(() => {
                                            const selectedBUs = filterBU ? filterBU.split(',').filter(Boolean).map(x => x.toLowerCase().trim()) : [];
                                            const companyOptions = dbClients
                                                .filter(c => selectedBUs.length === 0 || (c.db_type && selectedBUs.includes(c.db_type.toLowerCase().trim())))
                                                .map(c => c.client_name);
                                            const uniqueCompanyOptions = Array.from(new Set(companyOptions));
                                            return (
                                                <MultiSelectDropdown 
                                                    label="Company"
                                                    options={uniqueCompanyOptions}
                                                    selectedString={filterCompany}
                                                    onChange={setFilterCompany}
                                                    placeholder="All Companies"
                                                    isLight={isLight}
                                                    themeStyles={themeStyles}
                                                />
                                            );
                                        })()}

                                        <MultiSelectDropdown 
                                            label="Agent"
                                            options={agentsList}
                                            selectedString={filterAgent}
                                            onChange={setFilterAgent}
                                            placeholder="Select Agent"
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        <MultiSelectDropdown 
                                            label="Status"
                                            options={["OPEN", "IN PROGRESS", "PENDING", "RESOLVED"]}
                                            selectedString={filterStatus}
                                            onChange={setFilterStatus}
                                            placeholder="All Statuses"
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        <MultiSelectDropdown 
                                            label="Priority"
                                            options={["High", "Medium", "Low"]}
                                            selectedString={filterPriority}
                                            onChange={setFilterPriority}
                                            placeholder="All Priorities"
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: themeStyles.textMuted }}>Created By</label>
                                            <input 
                                                type="text"
                                                placeholder="e.g. System, Agent"
                                                value={filterCreatedBy} 
                                                onChange={(e) => setFilterCreatedBy(e.target.value)}
                                                style={{ width: '100%', padding: '7px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem' }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: themeStyles.textMuted }}>Resolved By</label>
                                            <input 
                                                type="text"
                                                placeholder="e.g. Agent"
                                                value={filterResolvedBy} 
                                                onChange={(e) => setFilterResolvedBy(e.target.value)}
                                                style={{ width: '100%', padding: '7px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem' }}
                                            />
                                        </div>

                                        <DateRangeSelector 
                                            label="Created At"
                                            selectedRangeString={filterCreatedAt}
                                            onChange={setFilterCreatedAt}
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        <DateRangeSelector 
                                            label="Resolved At"
                                            selectedRangeString={filterResolvedAt}
                                            onChange={setFilterResolvedAt}
                                            isLight={isLight}
                                            themeStyles={themeStyles}
                                        />

                                        <button 
                                            onClick={fetchTickets}
                                            style={{ 
                                                background: '#2563eb', 
                                                color: 'white', 
                                                border: 'none', 
                                                padding: '8px', 
                                                borderRadius: '6px', 
                                                fontSize: '0.8rem', 
                                                fontWeight: '700', 
                                                cursor: 'pointer',
                                                marginTop: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Filter size={13} />
                                            <span>Submit</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-VIEW 2: DASHBOARD VIEW (Image 1 style) */}
                        {viewType === 'dashboard' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                
                                {/* Metrics Donut Charts & KPIs row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: '1.5rem' }}>
                                    
                                    {/* Donut Chart 1: Ticket Status */}
                                    <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '1.25rem', color: themeStyles.textMain }}>Ticket Status</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                            <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                                                <svg width="100%" height="100%" viewBox="0 0 36 36">
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#eff6ff" strokeWidth="4.2" />
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="4.2" strokeDasharray="100 0" strokeDashoffset="25" />
                                                </svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem', color: themeStyles.textMuted }}>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', marginRight: '6px' }}></span>0% Open</div>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block', marginRight: '6px' }}></span>0% In progress</div>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#93c5fd', display: 'inline-block', marginRight: '6px' }}></span>0% Pending</div>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#bfdbfe', display: 'inline-block', marginRight: '6px' }}></span>100% Resolved</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Donut Chart 2: Open Ticket Priority */}
                                    <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '1.25rem', color: themeStyles.textMain }}>Open Ticket Priority</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                            <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                                                <svg width="100%" height="100%" viewBox="0 0 36 36">
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="4.2" />
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#2563eb" strokeWidth="4.2" strokeDasharray="62.5 37.5" strokeDashoffset="25" />
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#60a5fa" strokeWidth="4.2" strokeDasharray="25 75" strokeDashoffset="-37.5" />
                                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#93c5fd" strokeWidth="4.2" strokeDasharray="12.5 87.5" strokeDashoffset="-62.5" />
                                                </svg>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem', color: themeStyles.textMuted }}>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block', marginRight: '6px' }}></span>25% Low</div>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block', marginRight: '6px' }}></span>62.5% Medium</div>
                                                <div><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#93c5fd', display: 'inline-block', marginRight: '6px' }}></span>12.5% High</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4 Metric cards on the right */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.1rem', borderRadius: '12px', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: themeStyles.textMuted }}>Open</span>
                                            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: themeStyles.textMain }}>{openCount}</span>
                                        </div>
                                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.1rem', borderRadius: '12px', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: themeStyles.textMuted }}>Pending</span>
                                            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: themeStyles.textMain }}>{pendingCount}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.1rem', borderRadius: '12px', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: themeStyles.textMuted }}>Resolved</span>
                                            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: themeStyles.textMain }}>{resolvedCount}</span>
                                        </div>
                                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.1rem', borderRadius: '12px', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: themeStyles.textMuted }}>In progress</span>
                                            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: themeStyles.textMain }}>{inProgressCount}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bar Chart: Ticket Status Report (Maximum 30 days) */}
                                <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, padding: '1.5rem 2rem', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '0.8rem', fontWeight: '800', marginBottom: '1.5rem', color: themeStyles.textMain }}>
                                        Ticket Status Report <span style={{ fontWeight: '400', fontSize: '0.72rem', color: themeStyles.textMuted }}>Maximum 30 days</span>
                                    </h3>
                                    
                                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem', color: themeStyles.textMuted, marginBottom: '1.5rem', justifyContent: 'center' }}>
                                        <div><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}></span>Open</div>
                                        <div><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#eff6ff', display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}></span>Resolved</div>
                                    </div>

                                    {/* Graphical chart visualization */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', position: 'relative' }}>
                                        {/* Dynamic CSS Bar rendering matching high fidelity screenshot */}
                                        {Array.from({ length: 30 }).map((_, idx) => {
                                            const day = 25 - (29 - idx);
                                            const dateStr = `2026-05-${day < 10 ? '0' + day : day}`;
                                            const resolvedHeight = idx === 5 ? 18 : idx === 10 ? 22 : idx === 15 ? 17 : idx === 20 ? 24 : 3;
                                            const openHeight = idx === 5 ? 2 : idx === 10 ? 1.5 : idx === 15 ? 1.8 : idx === 20 ? 2.5 : 0.5;
                                            return (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '2px', cursor: 'pointer' }} title={`${dateStr}: Open ${openHeight}, Resolved ${resolvedHeight}`}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '110px' }}>
                                                        <div style={{ width: '6px', height: `${openHeight * 4}px`, background: '#3b82f6', borderRadius: '2px 2px 0 0' }}></div>
                                                        <div style={{ width: '6px', height: `${resolvedHeight * 4}px`, background: '#eff6ff', borderRadius: '2px 2px 0 0' }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Chart Dates Axis */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: themeStyles.textMuted, marginTop: '8px' }}>
                                        <span>2026-04-25</span>
                                        <span>2026-05-05</span>
                                        <span>2026-05-15</span>
                                        <span>2026-05-25</span>
                                    </div>
                                </div>

                                {/* Table: List of Assigned Tickets */}
                                <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: themeStyles.tableRowBorder }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0 }}>List of Assigned Tickets</h3>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: themeStyles.tableHeaderBg, color: themeStyles.textMuted, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                                <th style={{ padding: '12px 18px' }}>Name</th>
                                                <th style={{ padding: '12px 18px' }}>Open Tickets</th>
                                                <th style={{ padding: '12px 18px' }}>Resolved Tickets</th>
                                                <th style={{ padding: '12px 18px' }}>Pending Tickets</th>
                                                <th style={{ padding: '12px 18px' }}>In-Progress Tickets</th>
                                                <th style={{ padding: '12px 18px' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assignedTicketsList.map((row, idx) => (
                                                <tr key={idx} style={{ borderBottom: themeStyles.tableRowBorder }}>
                                                    <td style={{ padding: '12px 18px', fontWeight: '700' }}>{row.name}</td>
                                                    <td style={{ padding: '12px 18px' }}>{row.open}</td>
                                                    <td style={{ padding: '12px 18px' }}>{row.resolved}</td>
                                                    <td style={{ padding: '12px 18px' }}>{row.pending}</td>
                                                    <td style={{ padding: '12px 18px' }}>{row.inprogress}</td>
                                                    <td style={{ padding: '12px 18px' }}>
                                                        <button 
                                                            onClick={() => {
                                                                setViewType('list');
                                                                setFilterAgent(row.name);
                                                                fetchTickets();
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '700', cursor: 'pointer' }}
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Table: System Alerts & Logs Ticket Counts by Technology */}
                                <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '12px', overflow: 'hidden', marginTop: '1.5rem' }}>
                                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: themeStyles.tableRowBorder }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0 }}>System Alerts & Logs Ticket Counts by Technology</h3>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: themeStyles.tableHeaderBg, color: themeStyles.textMuted, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                                <th style={{ padding: '12px 18px' }}>Technology</th>
                                                <th style={{ padding: '12px 18px' }}>Open</th>
                                                <th style={{ padding: '12px 18px' }}>In Progress</th>
                                                <th style={{ padding: '12px 18px' }}>Pending</th>
                                                <th style={{ padding: '12px 18px' }}>Resolved</th>
                                                <th style={{ padding: '12px 18px' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const targetTechs = ['MySQL', 'MSSQL', 'Mongo', 'Oracle', 'Postgres'];
                                                return targetTechs.map((tech, idx) => {
                                                    const techTickets = tickets.filter(t => {
                                                        const bu = (t.business_unit || '').toLowerCase();
                                                        const matchesTech = 
                                                            (tech === 'MySQL' && bu.includes('mysql')) ||
                                                            (tech === 'MSSQL' && bu.includes('mssql')) ||
                                                            (tech === 'Mongo' && (bu.includes('mongo') || bu.includes('mongodb'))) ||
                                                            (tech === 'Oracle' && bu.includes('oracle')) ||
                                                            (tech === 'Postgres' && (bu.includes('postgres') || bu.includes('postgresql')));
                                                        
                                                        const cat = (t.category || '').toLowerCase();
                                                        const matchesCategory = cat === 'logs' || cat === 'system alert' || cat === 'alert';
                                                        
                                                        return matchesTech && matchesCategory;
                                                    });

                                                    const open = techTickets.filter(t => (t.status || 'OPEN').toUpperCase() === 'OPEN').length;
                                                    const inprogress = techTickets.filter(t => (t.status || '').toUpperCase() === 'IN PROGRESS').length;
                                                    const pending = techTickets.filter(t => (t.status || '').toUpperCase() === 'PENDING').length;
                                                    const resolved = techTickets.filter(t => (t.status || '').toUpperCase() === 'RESOLVED').length;

                                                    return (
                                                        <tr key={idx} style={{ borderBottom: themeStyles.tableRowBorder }}>
                                                            <td style={{ padding: '12px 18px', fontWeight: '700' }}>{tech}</td>
                                                            <td style={{ padding: '12px 18px' }}>{open}</td>
                                                            <td style={{ padding: '12px 18px' }}>{inprogress}</td>
                                                            <td style={{ padding: '12px 18px' }}>{pending}</td>
                                                            <td style={{ padding: '12px 18px' }}>{resolved}</td>
                                                            <td style={{ padding: '12px 18px', fontWeight: '700' }}>{techTickets.length}</td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        </>
                    )
                )}

                {/* TAB 2: INCIDENT REGISTRATION (Image 3 creation forms) */}
                {activeTab === 'incident-assignment' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto' }}>
                        
                        {/* Sub-tabs header */}
                        <div style={{ display: 'flex', gap: '16px', borderBottom: themeStyles.headerBorder, marginBottom: '1rem' }}>
                            <button 
                                onClick={() => setCreationTab('ticket')}
                                style={{ padding: '8px 4px', background: 'none', border: 'none', borderBottom: creationTab === 'ticket' ? '2px solid #2563eb' : '2px solid transparent', color: creationTab === 'ticket' ? '#2563eb' : themeStyles.textMuted, fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                                New Ticket
                            </button>
                            <button 
                                onClick={() => setCreationTab('contact')}
                                style={{ padding: '8px 4px', background: 'none', border: 'none', borderBottom: creationTab === 'contact' ? '2px solid #2563eb' : '2px solid transparent', color: creationTab === 'contact' ? '#2563eb' : themeStyles.textMuted, fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                                New Contact
                            </button>
                        </div>

                        {/* Sub-Tab: Ticket Form */}
                        {creationTab === 'ticket' && (
                            <form onSubmit={handleCreateTicket} style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '12px', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Business Unit</label>
                                    <select 
                                        value={bu} 
                                        onChange={(e) => setBu(e.target.value)}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Business Unit...</option>
                                        {technologiesList.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Company</label>
                                    <select 
                                        value={company} 
                                        onChange={(e) => {
                                            const selectedCompany = e.target.value;
                                            setCompany(selectedCompany);
                                            const matchedClient = dbClients.find(c => c.client_name === selectedCompany);
                                            if (matchedClient) {
                                                if (matchedClient.db_type) {
                                                    setBu(matchedClient.db_type);
                                                }
                                            }
                                        }}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Company...</option>
                                        {dbClients.length > 0 ? (
                                            dbClients
                                                .filter(c => !bu || (c.db_type && c.db_type.toLowerCase() === bu.toLowerCase()))
                                                .map(c => (
                                                    <option key={c.id} value={c.client_name}>{c.client_name} ({c.db_type})</option>
                                                ))
                                        ) : (
                                            [
                                                { name: "Cropin", tech: "MySQL" },
                                                { name: "RetailScan", tech: "PostgreSQL" },
                                                { name: "FlowGlobal", tech: "MySQL" },
                                                { name: "Shemaroo", tech: "MongoDB" },
                                                { name: "Credopay", tech: "MySQL" }
                                            ]
                                            .filter(c => !bu || c.tech.toLowerCase() === bu.toLowerCase())
                                            .map((c, i) => (
                                                <option key={i} value={c.name}>{c.name} ({c.tech})</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Contact</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                        <input 
                                            type="text" 
                                            list="contacts-datalist-new"
                                            placeholder="Select or enter contact name"
                                            value={contact} 
                                            onChange={(e) => setContact(e.target.value)}
                                            style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem', width: '100%' }}
                                        />
                                        <datalist id="contacts-datalist-new">
                                            {agentsList.map((a, i) => (
                                                <option key={i} value={a}>{a}</option>
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Ticket Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter ticket name"
                                        value={ticketName}
                                        onChange={(e) => setTicketName(e.target.value)}
                                        required
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Category</label>
                                    <select 
                                        value={category} 
                                        onChange={(e) => setCategory(e.target.value)}
                                        required
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Category...</option>
                                        {categories.map((cat, idx) => (
                                            <option key={idx} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Status</label>
                                    <select 
                                        value={ticketStatus} 
                                        onChange={(e) => setTicketStatus(e.target.value)}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="OPEN">OPEN</option>
                                        <option value="IN PROGRESS">IN PROGRESS</option>
                                        <option value="PENDING">PENDING</option>
                                        <option value="RESOLVED">RESOLVED</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Priority</label>
                                    <select 
                                        value={priority} 
                                        onChange={(e) => setPriority(e.target.value)}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Priority...</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Agent</label>
                                    <select 
                                        value={agent} 
                                        onChange={(e) => setAgent(e.target.value)}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Agent...</option>
                                        {agentsList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                                    </select>
                                </div>

                                {/* Rich Text Editor (Image 3) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'flex-start' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted, marginTop: '8px' }}>Description</label>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', border: themeStyles.inputBorder, borderRadius: '8px', background: themeStyles.inputBg }}>
                                        {/* Editor controls */}
                                        <div style={{ display: 'flex', gap: '12px', padding: '8px 12px', borderBottom: themeStyles.tableRowBorder, fontSize: '0.75rem', color: themeStyles.textMuted, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: '700', cursor: 'pointer' }}>Normal</span>
                                            <span style={{ fontWeight: '800', cursor: 'pointer' }}>B</span>
                                            <span style={{ fontStyle: 'italic', cursor: 'pointer' }}>I</span>
                                            <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>U</span>
                                            <span style={{ cursor: 'pointer', color: '#2563eb' }}>Link</span>
                                            <span style={{ cursor: 'pointer' }}>Ordered List</span>
                                            <span style={{ cursor: 'pointer' }}>Bullet List</span>
                                            <span style={{ cursor: 'pointer' }}>Tx (Clear)</span>
                                        </div>
                                        <textarea 
                                            placeholder="Write ticket description here..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            required
                                            style={{ width: '100%', minHeight: '120px', padding: '12px', background: 'transparent', border: 'none', color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                                    <button 
                                        type="button"
                                        onClick={() => setActiveTab('incident-center')}
                                        style={{ background: '#f1f5f9', border: 'none', color: '#1e293b', padding: '8px 18px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Sub-Tab: New Contact Form */}
                        {creationTab === 'contact' && (
                            <form onSubmit={handleCreateContact} style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '12px', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Name</label>
                                    <input 
                                        type="text" 
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        required
                                        placeholder="Enter contact name"
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Company</label>
                                    <select 
                                        value={contactCompany} 
                                        onChange={(e) => setContactCompany(e.target.value)}
                                        required
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="">Select Company...</option>
                                        {dbClients.map(c => (
                                            <option key={c.id} value={c.client_name}>{c.client_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Email</label>
                                    <input 
                                        type="email" 
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        required
                                        placeholder="Enter email address"
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMuted }}>Status</label>
                                    <select 
                                        value={contactStatus} 
                                        onChange={(e) => setContactStatus(e.target.value)}
                                        style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.85rem' }}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem' }}>
                                    <button 
                                        type="submit"
                                        style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        Create Contact
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* TAB 3: ONLINE USER STATUS DIRECTORY (Image 4 list of online users) */}
                {activeTab === 'engineer-workspaces' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>List of Online Users</h2>
                            <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: '4px 0 0 0' }}>Real-time directory of specialized database engineers online.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {onlineUsers.length === 0 ? (
                                <div style={{ 
                                    gridColumn: '1 / -1',
                                    background: themeStyles.cardBg, 
                                    border: themeStyles.cardBorder, 
                                    borderRadius: '16px', 
                                    padding: '3rem', 
                                    textAlign: 'center', 
                                    color: themeStyles.textMuted 
                                }}>
                                    No database administrators currently listed in the online directory.
                                </div>
                            ) : (
                                onlineUsers.map((eng, idx) => {
                                    const unitsList = eng.units ? eng.units.split(',').map(u => u.trim()).filter(Boolean) : [];
                                    const initials = eng.username ? eng.username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DB';
                                    
                                    const getBadgeStyles = (unit) => {
                                        const u = unit.trim().toUpperCase();
                                        if (u.includes('POSTGRES')) return { bg: 'rgba(59, 130, 246, 0.08)', text: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.15)' };
                                        if (u.includes('MYSQL') || u.includes('MARIADB') || u.includes('AURORA')) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#10b981', border: '1px solid rgba(16, 185, 129, 0.15)' };
                                        if (u.includes('ORACLE')) return { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)' };
                                        if (u.includes('MSSQL') || u.includes('SQL')) return { bg: 'rgba(139, 92, 246, 0.08)', text: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.15)' };
                                        if (u.includes('MONGO')) return { bg: 'rgba(245, 158, 11, 0.08)', text: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.15)' };
                                        if (u.includes('COSMOS')) return { bg: 'rgba(6, 182, 212, 0.08)', text: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.15)' };
                                        return { bg: 'rgba(100, 116, 139, 0.08)', text: '#64748b', border: '1px solid rgba(100, 116, 139, 0.15)' };
                                    };

                                    return (
                                        <div 
                                            key={idx}
                                            style={{
                                                background: themeStyles.cardBg,
                                                border: themeStyles.cardBorder,
                                                borderRadius: '16px',
                                                padding: '1.5rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '1.25rem',
                                                transition: 'transform 0.2s, box-shadow 0.2s',
                                                boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0,0,0,0.2)',
                                                position: 'relative'
                                            }}
                                        >
                                            {/* Pulse Online Indicator */}
                                            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    background: '#10b981',
                                                    borderRadius: '50%',
                                                    display: 'inline-block',
                                                    boxShadow: '0 0 8px #10b981'
                                                }}></span>
                                                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active</span>
                                            </div>

                                            {/* Top Row: Initial Avatar & Name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '12px',
                                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                                    color: '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: '800',
                                                    fontSize: '0.95rem'
                                                }}>
                                                    {initials}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: themeStyles.textMain }}>{eng.username}</span>
                                                    <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>Database Specialist</span>
                                                </div>
                                            </div>

                                            {/* Bottom Row: Tech badging with beautiful margins & flex-wrap */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.68rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Authorized Scopes</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {unitsList.map((unit, uidx) => {
                                                        const badgeStyle = getBadgeStyles(unit);
                                                        return (
                                                            <span 
                                                                key={uidx}
                                                                style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: '600',
                                                                    background: badgeStyle.bg,
                                                                    color: badgeStyle.text,
                                                                    border: badgeStyle.border,
                                                                    display: 'inline-block'
                                                                }}
                                                            >
                                                                {unit}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: CONSOLIDATED ALL REPLY MAILS ACROSS ALL TICKETS */}
                {activeTab === 'all-reply-mails' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: themeStyles.textMain }}>All Reply Mails</h2>
                                <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: '4px 0 0 0' }}>
                                    Consolidated list of all client and DBA team correspondence across all tickets.
                                </p>
                            </div>
                        </div>

                        {allRepliesLoading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: themeStyles.textMuted }}>
                                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                                <div>Loading reply correspondence...</div>
                            </div>
                        ) : allReplies.length === 0 ? (
                            <div style={{ 
                                background: themeStyles.cardBg, 
                                border: themeStyles.cardBorder, 
                                borderRadius: '16px', 
                                padding: '3rem', 
                                textAlign: 'center', 
                                color: themeStyles.textMuted 
                            }}>
                                No email replies found in the database.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {allReplies.map((reply) => {
                                    const isDba = reply.comment_type === 'dba_reply' || reply.comment_type === 'reply';
                                    const badgeBg = isDba ? 'rgba(37, 99, 235, 0.08)' : 'rgba(249, 115, 22, 0.08)';
                                    const badgeColor = isDba ? '#2563eb' : '#f97316';
                                    const borderLeft = isDba ? '3.5px solid #2563eb' : '3.5px solid #f97316';
                                    const badgeLabel = isDba ? 'DBA TEAM' : 'CLIENT';

                                    return (
                                        <div 
                                            key={reply.id}
                                            style={{
                                                background: themeStyles.cardBg,
                                                border: themeStyles.cardBorder,
                                                borderRadius: '16px',
                                                padding: '1.5rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.85rem',
                                                borderLeft: borderLeft,
                                                boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.02)' : '0 4px 20px rgba(0,0,0,0.15)',
                                            }}
                                        >
                                            {/* Top Row: Meta info */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: themeStyles.textMain }}>
                                                        {reply.author}
                                                    </span>
                                                    <span 
                                                        onClick={() => handleGoToTicket(reply.ticket_id)}
                                                        style={{
                                                            padding: '3px 9px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: '800',
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            color: '#3b82f6',
                                                            border: '1px solid rgba(59, 130, 246, 0.15)',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            transition: 'all 0.2s',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        Ticket #{reply.ticket_id}
                                                    </span>
                                                    <span style={{
                                                        padding: '3px 9px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '800',
                                                        background: badgeBg,
                                                        color: badgeColor,
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        {badgeLabel}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>
                                                    {new Date(reply.created_at).toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Middle Row: Ticket Reference Subject */}
                                            <div style={{ 
                                                fontSize: '0.78rem', 
                                                color: themeStyles.textMuted, 
                                                background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
                                                padding: '8px 14px', 
                                                borderRadius: '8px', 
                                                border: themeStyles.cardBorder 
                                            }}>
                                                <span style={{ fontWeight: '800', color: themeStyles.textMain }}>Subject:</span> [Ticket #{reply.ticket_id}] {reply.ticket_name}
                                            </div>

                                            {/* Bottom Row: Reply message body */}
                                            <div style={{ 
                                                fontSize: '0.85rem', 
                                                color: themeStyles.textMain, 
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.6',
                                                paddingLeft: '4px'
                                            }}>
                                                {reply.content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* TICKET DETAILS & UPDATE MODAL */}
            {false && selectedTicket && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: themeStyles.cardBg,
                        border: themeStyles.cardBorder,
                        borderRadius: '20px',
                        width: '90%',
                        maxWidth: '700px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.5rem 2rem',
                            borderBottom: themeStyles.tableRowBorder,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#3b82f6', margin: 0 }}>
                                    Ticket Details #{selectedTicket.id}
                                </h2>
                                <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '4px 0 0 0' }}>
                                    Created By: <span style={{ fontWeight: '700' }}>{selectedTicket.created_by || 'Anonymous'}</span>
                                    {selectedTicket.created_at && ` on ${new Date(selectedTicket.created_at).toLocaleString()}`}
                                    {selectedTicket.resolved_by && (
                                        <span style={{ marginLeft: '10px', color: '#10b981', fontWeight: '700' }}>
                                            · Resolved By: {selectedTicket.resolved_by} {selectedTicket.resolved_at && `on ${new Date(selectedTicket.resolved_at).toLocaleString()}`}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDetailsModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: themeStyles.cardBorder,
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: themeStyles.textMain
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body & Form */}
                        <form onSubmit={handleUpdateTicket} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Permission Info Banner */}
                            {(() => {
                                const isUserAdmin = true;
                                const canUpdate = true;
                                const isReadOnly = false;
                                const isAgentOnly = false;

                                return (
                                    <>
                                        {isReadOnly ? (
                                            <div style={{
                                                padding: '0.85rem 1.25rem',
                                                borderRadius: '10px',
                                                background: 'rgba(59, 130, 246, 0.08)',
                                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                                color: '#3b82f6',
                                                fontSize: '0.78rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontWeight: '600'
                                            }}>
                                                <Info size={16} />
                                                <span>View Only Mode: You are not the assigned agent, the creator, or an administrator for this ticket.</span>
                                            </div>
                                        ) : isAgentOnly ? (
                                            <div style={{
                                                padding: '0.85rem 1.25rem',
                                                borderRadius: '10px',
                                                background: 'rgba(245, 158, 11, 0.08)',
                                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                                color: '#f59e0b',
                                                fontSize: '0.78rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontWeight: '600'
                                            }}>
                                                <Info size={16} />
                                                <span>Assignee/Creator Access: You can update the Status of this ticket. Other details are read-only.</span>
                                            </div>
                                        ) : (
                                            <div style={{
                                                padding: '0.85rem 1.25rem',
                                                borderRadius: '10px',
                                                background: 'rgba(16, 185, 129, 0.08)',
                                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                                color: '#10b981',
                                                fontSize: '0.78rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontWeight: '600'
                                            }}>
                                                <CheckCircle size={16} />
                                                <span>Administrator Access: You have full permissions to edit all fields of this ticket.</span>
                                            </div>
                                        )}

                                        {/* Row 1: BU & Company */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Business Unit</label>
                                                <select
                                                    disabled={!isUserAdmin}
                                                    value={editBu}
                                                    onChange={(e) => setEditBu(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                >
                                                    {technologiesList.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Company</label>
                                                <select
                                                    disabled={!isUserAdmin}
                                                    value={editCompany}
                                                    onChange={(e) => {
                                                        const selectedCompany = e.target.value;
                                                        setEditCompany(selectedCompany);
                                                        const matchedClient = dbClients.find(c => c.client_name === selectedCompany);
                                                        if (matchedClient) {
                                                            if (matchedClient.db_type) {
                                                                setEditBu(matchedClient.db_type);
                                                            }
                                                        }
                                                    }}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                >
                                                    {dbClients.map(c => <option key={c.id} value={c.client_name}>{c.client_name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 2: Contact & Title */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Contact</label>
                                                <input
                                                    disabled={!isUserAdmin}
                                                    type="text"
                                                    list="contacts-datalist-edit"
                                                    placeholder="Select or enter contact name"
                                                    value={editContact}
                                                    onChange={(e) => setEditContact(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                />
                                                <datalist id="contacts-datalist-edit">
                                                    {agentsList.map((a, i) => (
                                                        <option key={i} value={a}>{a}</option>
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Ticket Name</label>
                                                <input
                                                    disabled={!isUserAdmin}
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Row 3: Category & Priority */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Category</label>
                                                <select
                                                    disabled={!isUserAdmin}
                                                    value={editCategory}
                                                    onChange={(e) => setEditCategory(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                >
                                                    <option value="Support Desk Ticket">Support Desk Ticket</option>
                                                    <option value="System Alerts">System Alerts</option>
                                                    <option value="Maintenance Request">Maintenance Request</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Priority</label>
                                                <select
                                                    disabled={!isUserAdmin}
                                                    value={editPriority}
                                                    onChange={(e) => setEditPriority(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                >
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 4: Status & Agent */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Status</label>
                                                <select
                                                    disabled={isReadOnly}
                                                    value={editStatus}
                                                    onChange={(e) => setEditStatus(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', fontWeight: '700' }}
                                                >
                                                    <option value="OPEN">OPEN</option>
                                                    <option value="IN PROGRESS">IN PROGRESS</option>
                                                    <option value="PENDING">PENDING</option>
                                                    <option value="RESOLVED">RESOLVED</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Assigned Agent</label>
                                                <select
                                                    disabled={!isUserAdmin}
                                                    value={editAgent}
                                                    onChange={(e) => setEditAgent(e.target.value)}
                                                    style={{ padding: '8px 10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem' }}
                                                >
                                                    {agentsList.map((a, i) => <option key={i} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 5: Description */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMuted }}>Description</label>
                                            <textarea
                                                disabled={!isUserAdmin}
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                style={{ width: '100%', minHeight: '100px', padding: '10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none', resize: 'vertical' }}
                                            />
                                        </div>

                                        {/* Modal Action Buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem', borderTop: themeStyles.tableRowBorder, paddingTop: '1.25rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailsModal(false)}
                                                style={{ padding: '8px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: themeStyles.cardBorder, color: themeStyles.textMain, fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                                            >
                                                Close
                                            </button>
                                            {!isReadOnly && (
                                                <button
                                                    type="submit"
                                                    style={{ padding: '8px 20px', borderRadius: '6px', background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                                                >
                                                    Save Changes
                                                </button>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TicketsHub;
