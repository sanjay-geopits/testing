import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import GeopitsLogo from '../components/GeopitsLogo';
import { 
    Users, 
    UserCheck, 
    FileText, 
    Megaphone, 
    Pencil, 
    Trash2, 
    Plus, 
    Moon, 
    Sun, 
    LogOut,
    CheckCircle,
    AlertCircle,
    Database,
    Briefcase,
    Activity,
    Shield,
    Upload,
    RefreshCw,
    Terminal,
    MessageSquare,
    Eye,
    Sliders,
    Settings,
    Star,
    Bell,
    Save,
    Mail,
    List
} from 'lucide-react';

const AdminSetup = () => {
    const navigate = useNavigate();
    const { user, logout, logoUrl: globalLogoUrl, refreshLogo } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';

    // Sidebar Active Tab Navigation state (defaults to 'ticket-options' matching user screenshot)
    const [activeTab, setActiveTab] = useState('ticket-options'); 

    // Status alerts
    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const parts = [];
        if (hrs > 0) parts.push(`${hrs}h`);
        if (mins > 0) parts.push(`${mins}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        return parts.join(' ');
    };

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ==========================================
    // 1. TICKET OPTIONS STATE VARIABLES
    // ==========================================
    // Support Agents (Admin Agents)
    const [agentsList, setAgentsList] = useState([]);
    const [adminAgentName, setAdminAgentName] = useState('');
    const [adminAgentCompany, setAdminAgentCompany] = useState('');
    const [adminAgentBU, setAdminAgentBU] = useState('');
    const [adminAgentTech, setAdminAgentTech] = useState('');

    // Ticket Dropdown Helper Agents
    const [ticketAgentsList, setTicketAgentsList] = useState([]);
    const [newTicketAgentName, setNewTicketAgentName] = useState('');

    // Business Units
    const [buList, setBuList] = useState([]);
    const [newBuName, setNewBuName] = useState('');

    // Company Clients
    const [clientsList, setClientsList] = useState([]);
    const [newClientName, setNewClientName] = useState('');
    const [newClientTech, setNewClientTech] = useState('MSSQL');
    const [newClientIp, setNewClientIp] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [contactClientName, setContactClientName] = useState('');
    const [editingClient, setEditingClient] = useState(null);

    // ==========================================
    // 2. BRANDING & CUSTOM LOGO
    // ==========================================
    const [logoUrl, setLogoUrl] = useState('/static/applogo.svg');
    const [customLogoInput, setCustomLogoInput] = useState('');
    const fileInputRef = useRef(null);

    // ==========================================
    // 3. USER MANAGEMENT STATE VARIABLES
    // ==========================================
    const [loginUsersList, setLoginUsersList] = useState([]);
    const [newLoginUsername, setNewLoginUsername] = useState('');
    const [newLoginEmail, setNewLoginEmail] = useState('');
    const [newLoginFullName, setNewLoginFullName] = useState('');
    const [newLoginPassword, setNewLoginPassword] = useState('');
    const [newLoginRole, setNewLoginRole] = useState('user');
    const [loginUsersSearch, setLoginUsersSearch] = useState('');

    const [permissionsList, setPermissionsList] = useState([]);
    const [permEmail, setPermEmail] = useState('');
    const [permTech, setPermTech] = useState('MySQL');
    const [permStatus, setPermStatus] = useState('Active');
    const [permIsLead, setPermIsLead] = useState(false);
    const [permRole, setPermRole] = useState('user');
    const [permissionsSearch, setPermissionsSearch] = useState('');
    
    // User Clients Permission Mapping
    const [userClientsList, setUserClientsList] = useState([]);
    const [ucEmail, setUcEmail] = useState('');
    const [ucClientName, setUcClientName] = useState('');
    const [ucAccessLevel, setUcAccessLevel] = useState('view');

    // Online Status Directory
    const [onlineUsersList, setOnlineUsersList] = useState([]);
    const [newOnlineUsername, setNewOnlineUsername] = useState('');
    const [newOnlineUnits, setNewOnlineUnits] = useState('');

    // ==========================================
    // 4. NETWORK & FIREWALL STATE VARIABLES
    // ==========================================
    const [whitelistedIPs, setWhitelistedIPs] = useState([
        { cidr: '192.168.1.0/24', description: 'Head Office Bangalore Primary LAN' },
        { cidr: '172.16.0.0/12', description: 'Internal Corporate Tailscale VPN Subnet' },
        { cidr: '10.0.0.0/8', description: 'Development and Testing Sandbox Gate' }
    ]);
    const [newCidr, setNewCidr] = useState('');
    const [newCidrDesc, setNewCidrDesc] = useState('');
    const [ipToTest, setIpToTest] = useState('');
    const [testResult, setTestResult] = useState(null);

    // ==========================================
    // 5. BROADCAST ALERTS & MONITORING
    // ==========================================
    const [broadcastMessage, setBroadcastMessage] = useState('');

    // ==========================================
    // 6. TELEMETRY & FEEDBACK AUDITS
    // ==========================================
    const [telemetry, setTelemetry] = useState([]);
    const [telemetrySearch, setTelemetrySearch] = useState('');
    const [feedbacks, setFeedbacks] = useState([]);

    // ==========================================
    // 7. DATABASE MAINTENANCE SUITE VARIABLES
    // ==========================================
    const [selectedClearTarget, setSelectedClearTarget] = useState('feedbacks');
    const [maintenanceConfirmInput, setMaintenanceConfirmInput] = useState('');
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

    // ==========================================
    // 8. TELEMETRY SCHEDULER STATE VARIABLES
    // ==========================================
    const [schedulerStatus, setSchedulerStatus] = useState(null);
    const [triggerHour, setTriggerHour] = useState(14);
    const [triggerMinute, setTriggerMinute] = useState(0);
    const [triggeringSync, setTriggeringSync] = useState(false);

    // ==========================================
    // 9. SHARE HISTORY (REPORTS) STATE
    // ==========================================
    const [shareHistory, setShareHistory] = useState([]);
    const [shareHistoryLoading, setShareHistoryLoading] = useState(false);
    const [shareHistorySearch, setShareHistorySearch] = useState('');

    // ==========================================
    // 10. CLIENT ALERT THRESHOLDS STATE
    // ==========================================
    const [alertSettingsList, setAlertSettingsList] = useState([]);
    const [alertClientName, setAlertClientName] = useState('');
    const [alertDbType, setAlertDbType] = useState('MSSQL');
    const [alertCpuThreshold, setAlertCpuThreshold] = useState(80);
    const [alertMemoryThreshold, setAlertMemoryThreshold] = useState(80);
    const [alertDiskThreshold, setAlertDiskThreshold] = useState(80);
    const [alertIoThreshold, setAlertIoThreshold] = useState(80);
    const [alertSlowQueryThresholdMs, setAlertSlowQueryThresholdMs] = useState(5000);
    const [alertLongRunningThresholdSec, setAlertLongRunningThresholdSec] = useState(3600);
    const [alertClientEmails, setAlertClientEmails] = useState('');
    const [alertCcEmails, setAlertCcEmails] = useState('');
    const [alertServerDownAlert, setAlertServerDownAlert] = useState(true);
    const [alertCriticalErrorAlert, setAlertCriticalErrorAlert] = useState(true);

    // Dynamic technology alerts configuration
    const [techAlertConfigs, setTechAlertConfigs] = useState([]);
    const [newTechName, setNewTechName] = useState('MSSQL');
    const [newTechEmail, setNewTechEmail] = useState('');
    const [editingTech, setEditingTech] = useState(null);

    useEffect(() => {
        const matchingConfig = techAlertConfigs.find(c => c.technology.toLowerCase() === newTechName.toLowerCase());
        if (matchingConfig) {
            setNewTechEmail(matchingConfig.alert_email);
        } else {
            setNewTechEmail('');
        }
    }, [newTechName, techAlertConfigs]);

    // Theme values configuration matching screenshot aesthetics perfectly
    const themeStyles = {
        background: isLight 
            ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' 
            : 'linear-gradient(135deg, #090a16 0%, #030409 100%)',
        sidebarBg: isLight ? '#ffffff' : 'rgba(11, 13, 27, 0.95)',
        cardBg: isLight ? '#ffffff' : 'rgba(20, 24, 46, 0.45)',
        cardBorder: isLight ? '1px solid rgba(226, 232, 240, 0.8)' : '1px solid rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#0f172a' : '#f1f5f9',
        textMuted: isLight ? '#64748b' : '#94a3b8',
        inputBg: isLight ? '#f8fafc' : 'rgba(8, 10, 20, 0.6)',
        inputBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
        activeNavBg: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(0, 225, 217, 0.08)',
        activeNavText: isLight ? '#2563eb' : '#00e1d9',
        accentColor: isLight ? '#2563eb' : '#00e1d9',
        rowBg: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)',
        rowBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.03)'
    };

    // Environment database technology environment matrix counts computed dynamically
    const mysqlCount = clientsList.filter(c => c.db_type?.toLowerCase() === 'mysql').length;
    const pgCount = clientsList.filter(c => c.db_type?.toLowerCase() === 'postgresql').length;
    const mongoCount = clientsList.filter(c => c.db_type?.toLowerCase() === 'mongodb').length;
    const oracleCount = clientsList.filter(c => c.db_type?.toLowerCase() === 'oracle').length;
    const mssqlCount = clientsList.filter(c => c.db_type?.toLowerCase() === 'mssql').length;
    const totalDbs = clientsList.length;

    // ==========================================
    // DATA FETCHING HOOKS
    // ==========================================
    const fetchAgents = () => {
        api.get('/new-features/admin/agents')
            .then(res => setAgentsList(res.data.agents || []))
            .catch(err => console.error("Error fetching admin agents:", err));
    };

    const fetchTicketAgents = () => {
        api.get('/new-features/admin/ticket-agents')
            .then(res => setTicketAgentsList(res.data.agents || []))
            .catch(err => console.error("Error fetching ticket agents:", err));
    };

    const fetchBusinessUnits = () => {
        api.get('/new-features/admin/business-units')
            .then(res => setBuList(res.data.business_units || []))
            .catch(err => console.error("Error fetching business units:", err));
    };

    const fetchAdminClients = () => {
        api.get('/new-features/admin/clients')
            .then(res => setClientsList(res.data.clients || []))
            .catch(err => console.error("Error fetching clients:", err));
    };

    const fetchLogoSettings = () => {
        api.get('/new-features/settings/logo')
            .then(res => {
                if (res.data.logo) {
                    setLogoUrl(res.data.logo);
                    setCustomLogoInput(res.data.logo);
                }
            })
            .catch(err => console.error("Error fetching logo:", err));
    };

    const fetchPermissionsList = () => {
        api.get('/admin/leads')
            .then(res => setPermissionsList(res.data.leads || []))
            .catch(err => console.error("Error fetching permissions:", err));
    };

    const fetchUserClients = () => {
        api.get('/new-features/admin/user-clients')
            .then(res => setUserClientsList(res.data.permissions || []))
            .catch(err => console.error("Error fetching user client permissions:", err));
    };

    const fetchOnlineUsers = () => {
        api.get('/new-features/admin/online-users')
            .then(res => setOnlineUsersList(res.data.online_users || []))
            .catch(err => console.error("Error fetching online users:", err));
    };

    const fetchTelemetry = () => {
        api.get('/new-features/monitoring/page-time')
            .then(res => setTelemetry(res.data.telemetry || []))
            .catch(err => console.error("Error fetching telemetry:", err));
    };

    const fetchFeedbacks = () => {
        api.get('/new-features/admin/feedbacks')
            .then(res => setFeedbacks(res.data.feedbacks || []))
            .catch(err => console.error("Error fetching feedbacks:", err));
    };

    const fetchSchedulerStatus = () => {
        api.get('/admin/scheduler/status')
            .then(res => {
                setSchedulerStatus(res.data);
                if (res.data) {
                    setTriggerHour(res.data.trigger_hour);
                    setTriggerMinute(res.data.trigger_minute);
                }
            })
            .catch(err => console.error("Error fetching scheduler status:", err));
    };

    const fetchShareHistory = () => {
        setShareHistoryLoading(true);
        api.get('/new-features/reports/share/history')
            .then(res => setShareHistory(res.data.history || []))
            .catch(err => console.error("Error fetching share history:", err))
            .finally(() => setShareHistoryLoading(false));
    };

    const fetchLoginUsers = () => {
        api.get('/new-features/admin/users')
            .then(res => setLoginUsersList(res.data.users || []))
            .catch(err => console.error("Error fetching login users:", err));
    };

    const fetchAlertSettings = () => {
        api.get('/new-features/admin/alert-settings')
            .then(res => setAlertSettingsList(res.data.settings || []))
            .catch(err => console.error("Error fetching alert settings:", err));
    };

    const fetchTechAlertConfigs = () => {
        api.get('/new-features/admin/technology-alerts')
            .then(res => setTechAlertConfigs(res.data.configs || []))
            .catch(err => console.error("Error fetching technology alerts config:", err));
    };

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/');
            return;
        }

        fetchAgents();
        fetchTicketAgents();
        fetchBusinessUnits();
        fetchAdminClients();
        fetchLogoSettings();
        fetchSchedulerStatus();
        fetchPermissionsList();
        fetchUserClients();
        fetchOnlineUsers();
        fetchTelemetry();
        fetchFeedbacks();
        fetchLoginUsers();
        fetchShareHistory();
        fetchAlertSettings();
        fetchTechAlertConfigs();

        const interval = setInterval(fetchTelemetry, 25000);
        return () => clearInterval(interval);
    }, [user]);

    // ==========================================
    // ACTION HANDLERS
    // ==========================================
    
    // 10. Client Alert Settings actions
    const handleSaveAlertSetting = async (e) => {
        e.preventDefault();
        if (!alertClientName.trim()) {
            setError("Client Name is required");
            return;
        }
        try {
            setIsLoading(true);
            await api.post('/new-features/admin/alert-settings', {
                client_name: alertClientName,
                db_type: alertDbType,
                cpu_threshold: parseFloat(alertCpuThreshold),
                memory_threshold: parseFloat(alertMemoryThreshold),
                disk_threshold: parseFloat(alertDiskThreshold),
                io_threshold: parseFloat(alertIoThreshold),
                slow_query_threshold_ms: parseInt(alertSlowQueryThresholdMs),
                long_running_threshold_sec: parseInt(alertLongRunningThresholdSec),
                client_emails: alertClientEmails,
                cc_emails: alertCcEmails,
                server_down_alert: alertServerDownAlert,
                critical_error_alert: alertCriticalErrorAlert
            });
            setSuccess("Alert settings saved successfully!");
            setError('');
            // Reset form fields
            setAlertClientName('');
            setAlertCpuThreshold(80);
            setAlertMemoryThreshold(80);
            setAlertDiskThreshold(80);
            setAlertIoThreshold(80);
            setAlertSlowQueryThresholdMs(5000);
            setAlertLongRunningThresholdSec(3600);
            setAlertClientEmails('');
            setAlertCcEmails('');
            setAlertServerDownAlert(true);
            setAlertCriticalErrorAlert(true);
            fetchAlertSettings();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save alert settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAlertSetting = async (settingId) => {
        if (!window.confirm("Are you sure you want to delete this alert threshold configuration?")) return;
        try {
            setIsLoading(true);
            await api.delete(`/new-features/admin/alert-settings/${settingId}`);
            setSuccess("Alert configuration deleted successfully!");
            setError('');
            fetchAlertSettings();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to delete alert setting.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditAlertSetting = (setting) => {
        setAlertClientName(setting.client_name);
        setAlertDbType(setting.db_type);
        setAlertCpuThreshold(setting.cpu_threshold);
        setAlertMemoryThreshold(setting.memory_threshold);
        setAlertDiskThreshold(setting.disk_threshold);
        setAlertIoThreshold(setting.io_threshold);
        setAlertSlowQueryThresholdMs(setting.slow_query_threshold_ms);
        setAlertLongRunningThresholdSec(setting.long_running_threshold_sec);
        setAlertClientEmails(setting.client_emails || '');
        setAlertCcEmails(setting.cc_emails || '');
        setAlertServerDownAlert(setting.server_down_alert);
        setAlertCriticalErrorAlert(setting.critical_error_alert);
    };

    const handleSaveTechAlertConfig = async (e) => {
        e.preventDefault();
        if (!newTechEmail.trim()) {
            setError("Email address is required");
            return;
        }
        try {
            setIsLoading(true);
            await api.post('/new-features/admin/technology-alerts', {
                technology: newTechName,
                alert_email: newTechEmail.trim()
            });
            setSuccess("Technology alert email saved successfully!");
            setError('');
            setNewTechEmail('');
            setEditingTech(null);
            fetchTechAlertConfigs();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save technology alert email.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTechAlertConfig = async (tech) => {
        if (!window.confirm(`Are you sure you want to delete email routing for ${tech}?`)) return;
        try {
            setIsLoading(true);
            await api.delete(`/new-features/admin/technology-alerts/${tech}`);
            setSuccess("Technology alert email configuration deleted successfully!");
            setError('');
            fetchTechAlertConfigs();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to delete technology email configuration.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditTechAlertConfig = (config) => {
        setNewTechName(config.technology);
        setNewTechEmail(config.alert_email);
        setEditingTech(config.technology);
    };

    // 1. Ticket Agents dropdown actions
    const handleAddTicketAgent = async (e) => {
        e.preventDefault();
        if (!newTicketAgentName.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/ticket-agents', { name: newTicketAgentName });
            setSuccess(`Ticket Agent "${newTicketAgentName}" added successfully.`);
            setNewTicketAgentName('');
            fetchTicketAgents();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to add ticket agent.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTicketAgent = async (agentId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/ticket-agents/${agentId}`);
            setSuccess("Ticket Agent deallocated successfully.");
            fetchTicketAgents();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete ticket agent.');
        } finally {
            setIsLoading(false);
        }
    };

    // 1b. Support Specialists (Admin Agents) Actions
    const handleAddAdminAgent = async (e) => {
        e.preventDefault();
        if (!adminAgentName.trim() || !adminAgentCompany.trim() || !adminAgentBU.trim() || !adminAgentTech.trim()) {
            setError('All support specialist fields (name, company, business unit, technology) are required.');
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/agents', {
                agent_name: adminAgentName,
                company_name: adminAgentCompany,
                business_unit: adminAgentBU,
                technology: adminAgentTech
            });
            setSuccess(`Support Specialist "${adminAgentName}" registered successfully.`);
            setAdminAgentName('');
            setAdminAgentCompany('');
            setAdminAgentBU('');
            setAdminAgentTech('');
            fetchAgents();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to register support specialist.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAdminAgent = async (agentId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/agents/${agentId}`);
            setSuccess("Support Specialist entry revoked.");
            fetchAgents();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete support specialist.');
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Business Units Action
    const handleAddBu = async (e) => {
        e.preventDefault();
        if (!newBuName.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/business-units', { name: newBuName });
            setSuccess(`Business Unit "${newBuName}" registered successfully.`);
            setNewBuName('');
            fetchBusinessUnits();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to add business unit.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteBu = async (buId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/business-units/${buId}`);
            setSuccess("Business Unit removed successfully.");
            fetchBusinessUnits();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete business unit.');
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Company Clients Action
    const handleAddClient = async (e) => {
        e.preventDefault();
        if (!newClientName.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (editingClient) {
                await api.put(`/new-features/admin/clients/${editingClient.id}`, {
                    client_name: newClientName,
                    db_type: newClientTech,
                    server_name: newClientIp || '127.0.0.1',
                    client_email: editingClient.client_email || '',
                    phone_number: editingClient.phone_number || ''
                });
                setSuccess(`Company client "${newClientName}" updated successfully.`);
                setEditingClient(null);
            } else {
                await api.post('/new-features/admin/clients', {
                    client_name: newClientName,
                    db_type: newClientTech,
                    server_name: newClientIp || '127.0.0.1'
                });
                setSuccess(`Company client "${newClientName}" registered successfully.`);
            }
            setNewClientName('');
            setNewClientIp('');
            setNewClientTech('MSSQL');
            fetchAdminClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save company client.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClientClick = (client) => {
        setEditingClient(client);
        setNewClientName(client.client_name);
        setNewClientTech(client.db_type);
        setNewClientIp(client.server_name || '');
        setError('');
        setSuccess('');
    };

    const handleCancelEditClient = () => {
        setEditingClient(null);
        setNewClientName('');
        setNewClientTech('MSSQL');
        setNewClientIp('');
        setError('');
        setSuccess('');
    };

    const handleDeleteClient = async (clientId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/clients/${clientId}`);
            setSuccess("Company client entry revoked.");
            fetchAdminClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete company client.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveClientContacts = async (e) => {
        e.preventDefault();
        if (!contactClientName) {
            setError('Please select a client to configure contacts.');
            return;
        }
        const matchedClient = clientsList.find(c => c.client_name === contactClientName);
        if (!matchedClient) {
            setError('Selected client not found.');
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.put(`/new-features/admin/clients/${matchedClient.id}`, {
                client_name: matchedClient.client_name,
                db_type: matchedClient.db_type,
                server_name: matchedClient.server_name || '127.0.0.1',
                client_email: newClientEmail,
                phone_number: newClientPhone
            });
            setSuccess(`Contacts updated for client "${contactClientName}".`);
            setNewClientEmail('');
            setNewClientPhone('');
            setContactClientName('');
            fetchAdminClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update client contacts.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClientContactClick = (client) => {
        setContactClientName(client.client_name);
        setNewClientEmail(client.client_email || '');
        setNewClientPhone(client.phone_number || '');
        setError('');
        setSuccess('');
    };

    const handleDeleteClientContact = async (client) => {
        if (!window.confirm(`Are you sure you want to clear contact details for client "${client.client_name}"?`)) return;
        try {
            setIsLoading(true);
            await api.put(`/new-features/admin/clients/${client.id}`, {
                client_name: client.client_name,
                db_type: client.db_type,
                server_name: client.server_name || '127.0.0.1',
                client_email: '',
                phone_number: ''
            });
            setSuccess(`Contact details cleared for client "${client.client_name}".`);
            fetchAdminClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to clear client contacts.');
        } finally {
            setIsLoading(false);
        }
    };

    // 4. Logo Management Actions
    const handleLogoFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setCustomLogoInput(reader.result); // Base64 data URL
        };
        reader.readAsDataURL(file);
    };

    const handleSaveLogo = async () => {
        if (!customLogoInput) {
            setError("Please upload a logo file first.");
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/settings/logo', {
                logo_data: customLogoInput
            });
            setSuccess("Application branding logo saved dynamically!");
            setLogoUrl(customLogoInput);
            refreshLogo();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to save custom logo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetLogo = async () => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/settings/logo', {
                logo_data: '/static/applogo.svg'
            });
            setSuccess("Logo successfully reset to default.");
            setLogoUrl('/static/applogo.svg');
            setCustomLogoInput('/static/applogo.svg');
            refreshLogo();
            if (fileInputRef.current) fileInputRef.current.value = '';
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to reset logo.");
        } finally {
            setIsLoading(false);
        }
    };

    // 4.5 User Clients Permission Actions
    const handleAssignUserClient = async (e) => {
        e.preventDefault();
        if (!ucEmail.trim() || !ucClientName) return;
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/new-features/admin/user-clients', {
                email: ucEmail.trim(),
                client_name: ucClientName,
                access_level: ucAccessLevel
            });
            setSuccess('User client permission successfully mapped!');
            setUcEmail('');
            setUcClientName('');
            fetchUserClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            console.error("Error assigning client permission:", err);
            setError(err.response?.data?.detail || "Failed to assign user client permission.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUserClient = async (permId) => {
        if (!window.confirm("Are you sure you want to revoke this user's client permission?")) return;
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.delete(`/new-features/admin/user-clients/${permId}`);
            setSuccess('User client permission successfully revoked!');
            fetchUserClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            console.error("Error revoking client permission:", err);
            setError(err.response?.data?.detail || "Failed to revoke client permission.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddLoginUser = async (e) => {
        e.preventDefault();
        if (!newLoginUsername.trim() || !newLoginEmail.trim() || !newLoginFullName.trim() || !newLoginPassword.trim()) {
            setError("All fields are required to create a login account.");
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/users', {
                username: newLoginUsername.trim(),
                email: newLoginEmail.trim(),
                full_name: newLoginFullName.trim(),
                password: newLoginPassword,
                role: newLoginRole
            });
            setSuccess(`User login account for "${newLoginUsername}" created successfully.`);
            setNewLoginUsername('');
            setNewLoginEmail('');
            setNewLoginFullName('');
            setNewLoginPassword('');
            setNewLoginRole('user');
            fetchLoginUsers();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to create login account.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteLoginUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user login account?")) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/users/${userId}`);
            setSuccess("User login account successfully deleted.");
            fetchLoginUsers();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to delete login account.");
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Whitelist CIDR Registry Actions
    const handleRegisterCidr = (e) => {
        e.preventDefault();
        if (!newCidr.trim()) return;

        setWhitelistedIPs(prev => [...prev, {
            cidr: newCidr,
            description: newCidrDesc || 'Manually added administrative network'
        }]);

        setSuccess(`CIDR Network Range "${newCidr}" whitelisted.`);
        setNewCidr('');
        setNewCidrDesc('');
        setTimeout(() => setSuccess(''), 4000);
    };

    const handleRemoveCidr = (cidrToRemove) => {
        setWhitelistedIPs(prev => prev.filter(ip => ip.cidr !== cidrToRemove));
        setSuccess("Network scope revoked from active gate.");
        setTimeout(() => setSuccess(''), 4000);
    };

    const handleValidateClientIp = (e) => {
        e.preventDefault();
        if (!ipToTest.trim()) return;

        const isMatch = whitelistedIPs.some(item => {
            try {
                // Simplified comparison for visualization
                if (item.cidr === '0.0.0.0/0') return true;
                const baseCidr = item.cidr.split('/')[0];
                const baseIp = baseCidr.substring(0, baseCidr.lastIndexOf('.'));
                const testIpBase = ipToTest.substring(0, ipToTest.lastIndexOf('.'));
                return baseIp === testIpBase;
            } catch (err) {
                return false;
            }
        });

        if (isMatch) {
            setTestResult({
                status: 'success',
                message: `ACCESS ALLOWED: IP range match found in whitelisted networks.`
            });
        } else {
            setTestResult({
                status: 'error',
                message: `ACCESS DENIED: IP address does not match any registered CIDR scopes.`
            });
        }
    };

    // 6. SLA Alert Broadcast Console Action
    const handleBroadcastAlert = async (e) => {
        e.preventDefault();
        if (!broadcastMessage.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/broadcast-alert', { message: broadcastMessage });
            setSuccess("SLA warning broadcast pushed to all clients successfully!");
            setBroadcastMessage('');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to push SLA system alert.");
        } finally {
            setIsLoading(false);
        }
    };

    // 7. Telemetry & Feedback Purge Actions
    const handleDeleteFeedback = async (id) => {
        try {
            await api.delete(`/new-features/admin/feedbacks/${id}`);
            setSuccess("User feedback response deleted.");
            fetchFeedbacks();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to delete feedback.");
        }
    };

    // 8. Dynamic PostgreSQL Maintenance Suite Wipe Action
    const handleClearDatabase = async () => {
        if (maintenanceConfirmInput !== 'RESET') {
            setError("Confirmation mismatch. Please type 'RESET' exactly.");
            return;
        }

        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const res = await api.post('/new-features/admin/database/clear', {
                target: selectedClearTarget
            });
            setSuccess(res.data.message || "Database maintenance table purged successfully!");
            setMaintenanceConfirmInput('');
            setShowMaintenanceModal(false);

            // Dynamically refresh affected panels
            if (selectedClearTarget === 'feedbacks' || selectedClearTarget === 'all') fetchFeedbacks();
            if (selectedClearTarget === 'telemetry' || selectedClearTarget === 'all') fetchTelemetry();
            if (selectedClearTarget === 'reports' || selectedClearTarget === 'all') fetchAdminClients();

            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to purge targeted database tables.");
        } finally {
            setIsLoading(false);
        }
    };

    // 9. User Privilege Allocator Actions
    const handleAssignPermission = async (e) => {
        e.preventDefault();
        if (!permEmail.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/admin/leads', {
                email: permEmail,
                technology: permTech,
                status: permStatus,
                is_lead: permIsLead,
                role: permRole
            });
            setSuccess(`Technology scope allocated to ${permEmail}.`);
            setPermEmail('');
            fetchPermissionsList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Failed to allocate engineering scope permissions.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTogglePermissionStatus = async (permId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.patch(`/admin/leads/${permId}/status`);
            setSuccess("Specialist permission status updated successfully.");
            fetchPermissionsList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Failed to update scope status.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePermission = async (permId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.delete(`/admin/leads/${permId}`);
            setSuccess("Specialist permission scope completely purged.");
            fetchPermissionsList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Failed to purge permission scope.');
        } finally {
            setIsLoading(false);
        }
    };

    // 10. Active Duty Online Specialist Actions
    const handleCreateOnlineUser = async (e) => {
        e.preventDefault();
        if (!newOnlineUsername.trim()) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.post('/new-features/admin/online-users', {
                username: newOnlineUsername,
                units: newOnlineUnits || 'DBA Specialist'
            });
            setSuccess(`Specialist "${newOnlineUsername}" registered active.`);
            setNewOnlineUsername('');
            setNewOnlineUnits('');
            fetchOnlineUsers();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to register active specialist.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteOnlineUser = async (userId) => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.delete(`/new-features/admin/online-users/${userId}`);
            setSuccess("Specialist marked offline.");
            fetchOnlineUsers();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError("Failed to set offline status.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateSchedulerSettings = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.post('/admin/scheduler/settings', {
                trigger_hour: parseInt(triggerHour),
                trigger_minute: parseInt(triggerMinute)
            });
            setSuccess("Scheduler settings updated successfully.");
            fetchSchedulerStatus();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update scheduler settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTriggerSync = async () => {
        if (schedulerStatus?.sync_in_progress) return;
        setError('');
        setSuccess('');
        setTriggeringSync(true);
        try {
            await api.post('/admin/scheduler/trigger');
            setSuccess("Telemetry sync triggered successfully in background.");
            setTimeout(fetchSchedulerStatus, 1500);
            setTimeout(fetchSchedulerStatus, 4000);
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to trigger telemetry sync.");
        } finally {
            setTriggeringSync(false);
        }
    };

    // Helpers
    const filteredPermissions = permissionsList.filter(p =>
        p.email?.toLowerCase().includes(permissionsSearch.toLowerCase()) ||
        p.technology?.toLowerCase().includes(permissionsSearch.toLowerCase())
    );

    const filteredTelemetry = telemetry.filter(t =>
        t.username?.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
        t.page_path?.toLowerCase().includes(telemetrySearch.toLowerCase())
    );

    return (
        <div style={{
            background: themeStyles.background,
            minHeight: '100vh',
            display: 'flex',
            color: themeStyles.textMain,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            transition: 'background 0.3s ease, color 0.3s ease'
        }}>
            
            {/* LEFT SIDEBAR NAVIGATION - MATCHING SCREENSHOT EXACTLY */}
            <aside style={{
                width: '280px',
                background: themeStyles.sidebarBg,
                borderRight: themeStyles.cardBorder,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '2.5rem 1.5rem',
                height: '100vh',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Brand header */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={globalLogoUrl || "/static/applogo.svg"} alt="GeoMon" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px', color: themeStyles.accentColor }}>Admin Panel</h2>
                                <p style={{ fontSize: '0.68rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Management Console</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Menu - ALL features perfectly categorized into structured paths! */}
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                            { id: 'ticket-options', label: 'Ticket Options', icon: <FileText size={16} /> },
                            { id: 'system-branding', label: 'System Branding', icon: <Pencil size={16} /> },
                            { id: 'user-management', label: 'User Management', icon: <UserCheck size={16} /> },
                            { id: 'network-firewall', label: 'Network & Firewall', icon: <Shield size={16} /> },
                            { id: 'broadcast-alerts', label: 'Broadcast Alerts', icon: <Megaphone size={16} /> },
                            { id: 'telemetry-audits', label: 'Telemetry & DB Maintenance', icon: <Activity size={16} /> },
                            { id: 'telemetry-scheduler', label: 'Telemetry Scheduler', icon: <RefreshCw size={16} /> },
                            { id: 'share-history', label: 'Share History (Reports)', icon: <Eye size={16} /> },
                            { id: 'alert-settings', label: 'Client Alert Settings', icon: <Bell size={16} /> }
                        ].map((item) => {
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        background: isActive ? themeStyles.activeNavBg : 'transparent',
                                        border: 'none',
                                        borderLeft: isActive ? `3px solid ${themeStyles.accentColor}` : '3px solid transparent',
                                        color: isActive ? themeStyles.activeNavText : themeStyles.textMuted,
                                        fontWeight: isActive ? '800' : '600',
                                        fontSize: '0.85rem',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Sidebar Bottom Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Theme Switcher Pills */}
                    <div style={{
                        display: 'flex',
                        background: isLight ? '#f1f5f9' : '#16171e',
                        padding: '4px',
                        borderRadius: '10px',
                        border: themeStyles.inputBorder
                    }}>
                        <button
                            onClick={() => { if (!isLight) toggleTheme(); }}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '8px',
                                border: 'none',
                                borderRadius: '8px',
                                background: isLight ? '#ffffff' : 'transparent',
                                color: isLight ? '#f97316' : themeStyles.textMuted,
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Sun size={14} />
                            <span>Light</span>
                        </button>
                        <button
                            onClick={() => { if (isLight) toggleTheme(); }}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '8px',
                                border: 'none',
                                borderRadius: '8px',
                                background: !isLight ? '#00e1d9' : 'transparent',
                                color: !isLight ? '#000000' : themeStyles.textMuted,
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Moon size={14} />
                            <span>Dark</span>
                        </button>
                    </div>

                    {/* Back to Dashboard */}
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            padding: '12px',
                            background: 'none',
                            border: themeStyles.inputBorder,
                            color: themeStyles.textMain,
                            borderRadius: '10px',
                            fontWeight: '700',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                        <LogOut size={16} style={{ transform: 'rotate(180deg)' }} />
                        <span>Back to Dashboard</span>
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT WORKSPACE AREA */}
            <main style={{
                flex: 1,
                padding: '2.5rem 3.5rem',
                overflowY: 'auto',
                height: '100vh'
            }}>
                
                {/* Global Status Notifications */}
                {success && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '2rem', fontSize: '0.85rem', fontWeight: '600' }}>
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '2rem', fontSize: '0.85rem', fontWeight: '600' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 1: TICKET OPTIONS (MATCHES USER SCREENSHOT EXACTLY!) */}
                {/* ======================================================================== */}
                {activeTab === 'ticket-options' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        
                        {/* Heading */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.75px' }}>Ticket Attributes Manager</h1>
                                <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Manage global ticket dropdown options, technologies, client databases, and specialists.</p>
                            </div>
                        </div>

                        {/* Interactive Telemetry KPI Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                            {[
                                { title: 'Total Ticket Agents', count: ticketAgentsList.length, icon: <Users size={20} color="#ffaa00" />, desc: 'Allocated to active queues', gradient: 'linear-gradient(135deg, rgba(255, 170, 0, 0.08) 0%, rgba(255, 170, 0, 0.02) 100%)', border: 'rgba(255,170,0,0.15)' },
                                { title: 'Active Business Units', count: buList.length, icon: <Briefcase size={20} color="#38bdf8" />, desc: 'Organizational sectors', gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(56, 189, 248, 0.02) 100%)', border: 'rgba(56,189,248,0.15)' },
                                { title: 'Client Environments', count: clientsList.length, icon: <Database size={20} color="#34d399" />, desc: 'Registered databases', gradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.08) 0%, rgba(52, 211, 153, 0.02) 100%)', border: 'rgba(52,211,153,0.15)' },
                                { title: 'Specialists Directory', count: agentsList.length, icon: <Shield size={20} color="#a78bfa" />, desc: 'SLA Escalation specialists', gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08) 0%, rgba(167, 139, 250, 0.02) 100%)', border: 'rgba(167,139,250,0.15)' }
                            ].map((kpi, idx) => (
                                <div key={idx} style={{
                                    background: isLight ? '#ffffff' : themeStyles.cardBg,
                                    border: `1px solid ${isLight ? '#cbd5e1' : kpi.border}`,
                                    borderRadius: '16px',
                                    padding: '1.25rem 1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundImage: isLight ? 'none' : kpi.gradient,
                                    boxShadow: isLight ? '0 4px 6px rgba(0,0,0,0.02)' : 'none',
                                    transition: 'transform 0.2s ease',
                                    cursor: 'default'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: themeStyles.textMuted }}>{kpi.title}</p>
                                        <h3 style={{ margin: '8px 0 2px 0', fontSize: '1.75rem', fontWeight: '900', color: themeStyles.textMain }}>{kpi.count}</h3>
                                        <p style={{ margin: 0, fontSize: '0.68rem', color: themeStyles.textMuted }}>{kpi.desc}</p>
                                    </div>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '12px',
                                        background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {kpi.icon}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Three side-by-side attributes columns with pixel-perfect bottom alignments */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
                            
                            {/* COLUMN 1: Manage Support Agents */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
                                height: '540px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 10px 15px -3px rgba(0,0,0,0.02)' : '0 10px 30px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexShrink: 0 }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(167, 139, 250, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        👥
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '850', margin: 0, color: themeStyles.textMain }}>Manage Support Agents</h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Assign ticketing directory roles</p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddTicketAgent} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexShrink: 0 }}>
                                    <input
                                        type="text"
                                        placeholder="Enter agent name..."
                                        value={newTicketAgentName}
                                        onChange={(e) => setNewTicketAgentName(e.target.value)}
                                        required
                                        style={{
                                            flex: 1,
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '12px 20px',
                                            background: '#ffaa00',
                                            color: '#000000',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: '800',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(255,170,0,0.2)'
                                        }}
                                    >
                                        Add
                                    </button>
                                </form>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                    {ticketAgentsList.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📭</span>
                                            <p style={{ fontSize: '0.76rem', color: themeStyles.textMuted, margin: 0 }}>No agents configured.</p>
                                        </div>
                                    ) : (
                                        ticketAgentsList.map(agent => (
                                            <div
                                                key={agent.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '11px 14px',
                                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)',
                                                    border: themeStyles.rowBorder,
                                                    borderRadius: '10px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)';
                                                    e.currentTarget.style.transform = 'translateX(2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)';
                                                    e.currentTarget.style.transform = 'translateX(0)';
                                                }}
                                            >
                                                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMain }}>{agent.name}</span>
                                                <button
                                                    onClick={() => handleDeleteTicketAgent(agent.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* COLUMN 2: Manage Business Units */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
                                height: '540px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 10px 15px -3px rgba(0,0,0,0.02)' : '0 10px 30px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexShrink: 0 }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(56, 189, 248, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        💼
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '850', margin: 0, color: themeStyles.textMain }}>Manage Business Units</h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Configure team divisions</p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddBu} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexShrink: 0 }}>
                                    <input
                                        type="text"
                                        placeholder="Enter new BU name..."
                                        value={newBuName}
                                        onChange={(e) => setNewBuName(e.target.value)}
                                        required
                                        style={{
                                            flex: 1,
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '12px 20px',
                                            background: '#ffaa00',
                                            color: '#000000',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: '800',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(255,170,0,0.2)'
                                        }}
                                    >
                                        Add
                                    </button>
                                </form>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                    {buList.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📭</span>
                                            <p style={{ fontSize: '0.76rem', color: themeStyles.textMuted, margin: 0 }}>No business units found.</p>
                                        </div>
                                    ) : (
                                        buList.map(bu => (
                                            <div
                                                key={bu.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '11px 14px',
                                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)',
                                                    border: themeStyles.rowBorder,
                                                    borderRadius: '10px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)';
                                                    e.currentTarget.style.transform = 'translateX(2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)';
                                                    e.currentTarget.style.transform = 'translateX(0)';
                                                }}
                                            >
                                                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMain }}>{bu.name}</span>
                                                <button
                                                    onClick={() => handleDeleteBu(bu.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* COLUMN 3: Manage Company Clients */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
                                height: '620px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 10px 15px -3px rgba(0,0,0,0.02)' : '0 10px 30px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', flexShrink: 0 }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(52, 211, 153, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        🏢
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '850', margin: 0, color: themeStyles.textMain }}>
                                            {editingClient ? 'Edit Company Client' : 'Manage Company Clients'}
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>
                                            {editingClient ? `Editing client ID: ${editingClient.id}` : 'Register database client details'}
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem', flexShrink: 0 }}>
                                    <input
                                        type="text"
                                        placeholder="Company name (e.g. Cropin)..."
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        required
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            width: '100%',
                                            transition: 'all 0.2s',
                                            marginBottom: '4px'
                                        }}
                                    />
                                    
                                    <select
                                        value={newClientTech}
                                        onChange={(e) => setNewClientTech(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            width: '100%',
                                            marginBottom: '4px'
                                        }}
                                    >
                                        <option value="MSSQL">MSSQL</option>
                                        <option value="PostgreSQL">PostgreSQL</option>
                                        <option value="MySQL">MySQL</option>
                                        <option value="MongoDB">MongoDB</option>
                                        <option value="Oracle">Oracle</option>
                                    </select>

                                    {editingClient ? (
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <button
                                                type="submit"
                                                style={{
                                                    flex: 1,
                                                    padding: '10px',
                                                    background: '#ffaa00',
                                                    color: '#000000',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontWeight: '800',
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(255,170,0,0.2)'
                                                }}
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelEditClient}
                                                style={{
                                                    flex: 1,
                                                    padding: '10px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: themeStyles.textMain,
                                                    border: themeStyles.inputBorder,
                                                    borderRadius: '10px',
                                                    fontWeight: '800',
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="submit"
                                            style={{
                                                padding: '10px',
                                                background: '#ffaa00',
                                                color: '#000000',
                                                border: 'none',
                                                borderRadius: '10px',
                                                fontWeight: '800',
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                width: '100%',
                                                boxShadow: '0 2px 4px rgba(255,170,0,0.2)'
                                            }}
                                        >
                                            Add Company
                                        </button>
                                    )}
                                </form>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                    {clientsList.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📭</span>
                                            <p style={{ fontSize: '0.76rem', color: themeStyles.textMuted, margin: 0 }}>No company clients found.</p>
                                        </div>
                                    ) : (
                                        clientsList.map(client => (
                                            <div
                                                key={client.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '11px 14px',
                                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)',
                                                    border: themeStyles.rowBorder,
                                                    borderRadius: '10px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)';
                                                    e.currentTarget.style.transform = 'translateX(2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)';
                                                    e.currentTarget.style.transform = 'translateX(0)';
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: '800', color: themeStyles.textMain }}>{client.client_name}</div>
                                                    <div style={{ fontSize: '0.68rem', color: themeStyles.textMuted, marginTop: '2px' }}>
                                                        {client.db_type}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleEditClientClick(client)}
                                                        style={{ background: 'none', border: 'none', color: '#ffaa00', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 170, 0, 0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClient(client.id)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Manage Client Contacts Form & List */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 2fr',
                            gap: '1.75rem',
                            marginTop: '2rem'
                        }}>
                            {/* Card 1: Setup Contacts */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
                                boxShadow: isLight ? '0 10px 15px -3px rgba(0,0,0,0.02)' : '0 10px 30px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 170, 0, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        📧
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '850', margin: 0, color: themeStyles.textMain }}>Manage Client Contacts</h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Configure alert emails & phone numbers</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveClientContacts} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Select Client</label>
                                        <select
                                            value={contactClientName}
                                            onChange={(e) => {
                                                const selectedName = e.target.value;
                                                setContactClientName(selectedName);
                                                const matchedClient = clientsList.find(c => c.client_name === selectedName);
                                                if (matchedClient) {
                                                    setNewClientEmail(matchedClient.client_email || '');
                                                    setNewClientPhone(matchedClient.phone_number || '');
                                                } else {
                                                    setNewClientEmail('');
                                                    setNewClientPhone('');
                                                }
                                            }}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                background: themeStyles.inputBg,
                                                border: themeStyles.inputBorder,
                                                color: themeStyles.textMain,
                                                fontSize: '0.82rem',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                width: '100%'
                                            }}
                                        >
                                            <option value="">-- Choose Client --</option>
                                            {clientsList.map(client => (
                                                <option key={client.id} value={client.client_name}>{client.client_name} ({client.db_type})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Client Email IDs</label>
                                        <input
                                            type="text"
                                            placeholder="Enter mail IDs (e.g. alerts@company.com)..."
                                            value={newClientEmail}
                                            onChange={(e) => setNewClientEmail(e.target.value)}
                                            required
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                background: themeStyles.inputBg,
                                                border: themeStyles.inputBorder,
                                                color: themeStyles.textMain,
                                                fontSize: '0.82rem',
                                                outline: 'none',
                                                width: '100%',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.65rem', color: themeStyles.textMuted, marginTop: '4px', display: 'block' }}>You can add multiple comma-separated emails.</span>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Contact Number (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="Contact phone number..."
                                            value={newClientPhone}
                                            onChange={(e) => setNewClientPhone(e.target.value)}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '10px',
                                                background: themeStyles.inputBg,
                                                border: themeStyles.inputBorder,
                                                color: themeStyles.textMain,
                                                fontSize: '0.82rem',
                                                outline: 'none',
                                                width: '100%',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        style={{
                                            padding: '10.5px',
                                            background: '#ffaa00',
                                            color: '#000000',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: '800',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            width: '100%',
                                            boxShadow: '0 2px 4px rgba(255,170,0,0.2)',
                                            marginTop: '6px'
                                        }}
                                    >
                                        Save Client Contacts
                                    </button>
                                </form>
                            </div>

                            {/* Card 2: Contact Directory List */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: isLight ? '0 10px 15px -3px rgba(0,0,0,0.02)' : '0 10px 30px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(52, 211, 153, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.1rem'
                                    }}>
                                        📞
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: '850', margin: 0, color: themeStyles.textMain }}>Client Contacts Directory</h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Overview of registered client contact information</p>
                                    </div>
                                </div>

                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {clientsList.filter(c => c.client_email || c.phone_number).length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '2rem 0' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📭</span>
                                            <p style={{ fontSize: '0.76rem', color: themeStyles.textMuted, margin: 0 }}>No client contacts configured yet.</p>
                                        </div>
                                    ) : (
                                        clientsList.filter(c => c.client_email || c.phone_number).map(client => (
                                            <div
                                                key={client.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '12px 16px',
                                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)',
                                                    border: themeStyles.rowBorder,
                                                    borderRadius: '12px'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: themeStyles.textMain }}>{client.client_name}</div>
                                                    <div style={{ fontSize: '0.72rem', color: themeStyles.textMuted, marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span><strong>Emails:</strong> {client.client_email || '—'}</span>
                                                        {client.phone_number && <span><strong>Phone:</strong> {client.phone_number}</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleEditClientContactClick(client)}
                                                        style={{ background: 'none', border: 'none', color: '#ffaa00', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 170, 0, 0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClientContact(client)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SUPPORT SPECIALISTS CONSOLE (ADMIN AGENTS TABLE) */}
                        <div style={{
                            background: themeStyles.cardBg,
                            border: themeStyles.cardBorder,
                            borderRadius: '16px',
                            padding: '2rem',
                            marginTop: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: '#ffaa00' }}>Support Specialist Directory</h3>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                Configure database engineers, client systems mapping, and dynamic technology scopes. These assignments are stored in the PostgreSQL database and determine high-priority SLA allocations.
                            </p>

                            <form onSubmit={handleAddAdminAgent} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '2rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Specialist Name</label>
                                    <input
                                        type="text"
                                        placeholder="E.g. Rathnagopal..."
                                        value={adminAgentName}
                                        onChange={(e) => setAdminAgentName(e.target.value)}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Client Scope (Company)</label>
                                    <input
                                        type="text"
                                        placeholder="E.g. Cropin..."
                                        value={adminAgentCompany}
                                        onChange={(e) => setAdminAgentCompany(e.target.value)}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Business Unit</label>
                                    <input
                                        type="text"
                                        placeholder="E.g. DBA Support..."
                                        value={adminAgentBU}
                                        onChange={(e) => setAdminAgentBU(e.target.value)}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Database Technology</label>
                                    <select
                                        value={adminAgentTech}
                                        onChange={(e) => setAdminAgentTech(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="PostgreSQL">PostgreSQL</option>
                                        <option value="MySQL">MySQL</option>
                                        <option value="MongoDB">MongoDB</option>
                                        <option value="Oracle">Oracle</option>
                                        <option value="MSSQL">MSSQL</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button
                                        type="submit"
                                        style={{
                                            width: '100%',
                                            padding: '11px',
                                            background: '#ffaa00',
                                            color: '#000000',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '800',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Register Specialist
                                    </button>
                                </div>
                            </form>

                            {/* Specialists Directory List */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder }}>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Specialist Engineer</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Client Scope</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Business Unit</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Technology</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800' }}>Created At</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', color: themeStyles.textMuted, textTransform: 'uppercase', fontWeight: '800', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agentsList.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', fontSize: '0.8rem', color: themeStyles.textMuted }}>
                                                    No registered support specialists found in the database.
                                                </td>
                                            </tr>
                                        ) : (
                                            agentsList.map(item => (
                                                <tr key={item.id} style={{ borderBottom: themeStyles.rowBorder }} className="table-row-hover">
                                                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', fontWeight: '700', color: themeStyles.textMain }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '800' }}>
                                                                {(item.agent_name || 'S')[0].toUpperCase()}
                                                            </div>
                                                            <span>{item.agent_name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: themeStyles.textMain }}>
                                                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: themeStyles.rowBorder, fontWeight: '600' }}>
                                                            {item.company_name}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: themeStyles.textMuted }}>
                                                        {item.business_unit}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontSize: '0.8rem' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: '800',
                                                            border: '1px solid rgba(255,170,0,0.2)',
                                                            color: '#ffaa00',
                                                            background: 'rgba(255,170,0,0.05)'
                                                        }}>
                                                            {item.technology}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontSize: '0.75rem', color: themeStyles.textMuted }}>
                                                        {new Date(item.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleDeleteAdminAgent(item.id)}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 2: SYSTEM BRANDING & APPLICATION LOGO */}
                {/* ======================================================================== */}
                {activeTab === 'system-branding' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>Corporate System Branding</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Configure application headers, dynamic logos, and themes globally.</p>
                        </div>

                        <div style={{
                            background: themeStyles.cardBg,
                            border: themeStyles.cardBorder,
                            borderRadius: '16px',
                            padding: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>🎨</span>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: '#ffaa00' }}>System Branding & Application Logo</h3>
                            </div>

                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, lineHeight: '1.5', margin: '0 0 2rem 0' }}>
                                Upload a custom logo to update the branding across the entire application (Login, main dashboard, portal headers, etc.). The logo will be permanently saved to the PostgreSQL database and served dynamically.
                            </p>

                            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
                                
                                {/* Left Side: Preview */}
                                <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: themeStyles.textMuted, letterSpacing: '0.5px' }}>Current Dynamic Logo</span>
                                    <div style={{
                                        background: '#040508',
                                        border: '1px solid #1a1c24',
                                        borderRadius: '12px',
                                        padding: '2.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '120px'
                                    }}>
                                        <img src={logoUrl} alt="Branding Logo" style={{ maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
                                    </div>
                                </div>

                                {/* Right Side: File Upload */}
                                <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.25rem' }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: themeStyles.textMuted, marginBottom: '8px', letterSpacing: '0.5px' }}>Upload New Logo File</span>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            padding: '8px 12px',
                                            borderRadius: '8px'
                                        }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                ref={fileInputRef}
                                                onChange={handleLogoFileChange}
                                                style={{
                                                    fontSize: '0.8rem',
                                                    color: themeStyles.textMain,
                                                    width: '100%'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={handleSaveLogo}
                                            disabled={isLoading}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                background: '#ffaa00',
                                                color: '#000000',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: '800',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <Upload size={14} />
                                            <span>Save Dynamic Logo to DB</span>
                                        </button>
                                        
                                        <button
                                            onClick={handleResetLogo}
                                            disabled={isLoading}
                                            style={{
                                                padding: '12px 20px',
                                                background: '#20222e',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '8px',
                                                fontWeight: '700',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Reset to Default Logo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 3: USER MANAGEMENT & ACTIVE DIRECTORY */}
                {/* ======================================================================== */}
                {activeTab === 'user-management' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>User Privileges & Directories</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Assign access scopes, manage technologies, and register engineers on active duty.</p>
                        </div>

                        {/* System Login Accounts Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
                            {/* Create Login Account Form */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: '#ffaa00' }}>Create Login Account</h3>
                                <p style={{ fontSize: '0.75rem', color: themeStyles.textMuted, marginBottom: '1.25rem' }}>Register a new user login credential. These credentials are used to access the application dashboard.</p>
                                <form onSubmit={handleAddLoginUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Username</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. opyin"
                                                value={newLoginUsername}
                                                onChange={e => setNewLoginUsername(e.target.value)}
                                                required
                                                autoComplete="new-username"
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Full Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Opyin Dev"
                                                value={newLoginFullName}
                                                onChange={e => setNewLoginFullName(e.target.value)}
                                                required
                                                autoComplete="off"
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Email Address</label>
                                        <input
                                            type="email"
                                            placeholder="e.g. opyin@geopits.com"
                                            value={newLoginEmail}
                                            onChange={e => setNewLoginEmail(e.target.value)}
                                            required
                                            autoComplete="new-email"
                                            style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Password</label>
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                value={newLoginPassword}
                                                onChange={e => setNewLoginPassword(e.target.value)}
                                                required
                                                autoComplete="new-password"
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Role</label>
                                            <select
                                                value={newLoginRole}
                                                onChange={e => setNewLoginRole(e.target.value)}
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            >
                                                <option value="user">Standard User</option>
                                                <option value="client">Client User</option>
                                                <option value="admin">Administrator</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        style={{ padding: '12px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', marginTop: '6px' }}
                                    >
                                        Create Login Account
                                    </button>
                                </form>
                            </div>

                            {/* Active Login Accounts List */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Login Accounts Directory</h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Manage all registered web application users.</p>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search logins..."
                                        value={loginUsersSearch}
                                        onChange={e => setLoginUsersSearch(e.target.value)}
                                        style={{ padding: '6px 12px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.75rem', outline: 'none', width: '150px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                                    {loginUsersList.filter(u => 
                                        u.username?.toLowerCase().includes(loginUsersSearch.toLowerCase()) || 
                                        u.email?.toLowerCase().includes(loginUsersSearch.toLowerCase()) || 
                                        u.full_name?.toLowerCase().includes(loginUsersSearch.toLowerCase())
                                    ).length === 0 ? (
                                        <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, textAlign: 'center', padding: '1.5rem' }}>No user login accounts found.</p>
                                    ) : (
                                        loginUsersList.filter(u => 
                                            u.username?.toLowerCase().includes(loginUsersSearch.toLowerCase()) || 
                                            u.email?.toLowerCase().includes(loginUsersSearch.toLowerCase()) || 
                                            u.full_name?.toLowerCase().includes(loginUsersSearch.toLowerCase())
                                        ).map(item => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: themeStyles.rowBg, border: themeStyles.rowBorder, borderRadius: '8px' }}>
                                                <div>
                                                    <span style={{ fontWeight: '800', fontSize: '0.82rem', color: themeStyles.textMain }}>{item.full_name} ({item.username})</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted }}>{item.email}</span>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', background: item.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : item.role === 'client' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: item.role === 'admin' ? '#ef4444' : item.role === 'client' ? '#2563eb' : '#10b981', padding: '1px 6px', borderRadius: '4px' }}>
                                                            {item.role}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteLoginUser(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Top: 2 column side-by-side forms */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
                            
                            {/* Specialist Privilege Scope Allocator */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', color: '#ffaa00' }}>Allocate Specialist Privilege Scope</h3>
                                <form onSubmit={handleAssignPermission} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Operator Email</label>
                                        <input
                                            type="email"
                                            placeholder="e.g. specialist@geopits.com"
                                            value={permEmail}
                                            onChange={e => setPermEmail(e.target.value)}
                                            required
                                            style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Technology Scope</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. MySQL, Postgres"
                                                value={permTech}
                                                onChange={e => setPermTech(e.target.value)}
                                                required
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Account Status</label>
                                            <select
                                                value={permStatus}
                                                onChange={e => setPermStatus(e.target.value)}
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Revoked">Revoked</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Privilege Level</label>
                                        <select
                                            value={permRole}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setPermRole(val);
                                                setPermIsLead(val === 'lead');
                                            }}
                                            style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        >
                                            <option value="user">Standard Specialist</option>
                                            <option value="lead">Technology Lead</option>
                                            <option value="admin">System Administrator</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        style={{ padding: '12px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', marginTop: '6px' }}
                                    >
                                        Assign Privilege Scope
                                    </button>
                                </form>
                            </div>

                            {/* Specialist Active Duty Directory */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Active Duty Directory</h3>
                                    <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Register active duty engineers dynamically for operations.</p>
                                </div>

                                <form onSubmit={handleCreateOnlineUser} style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="Specialist Name (e.g. Kalai)..."
                                        value={newOnlineUsername}
                                        onChange={e => setNewOnlineUsername(e.target.value)}
                                        required
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tech (e.g. MySQL)..."
                                        value={newOnlineUnits}
                                        onChange={e => setNewOnlineUnits(e.target.value)}
                                        required
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                    />
                                    <button
                                        type="submit"
                                        style={{ padding: '10px 16px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                                    >
                                        Register
                                    </button>
                                </form>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {onlineUsersList.length === 0 ? (
                                        <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, textAlign: 'center', padding: '1.5rem' }}>No active duty specialists recorded.</p>
                                    ) : (
                                        onlineUsersList.map(item => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: themeStyles.rowBg, border: themeStyles.rowBorder, borderRadius: '8px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                                        <span style={{ fontWeight: '800', fontSize: '0.82rem', color: themeStyles.textMain }}>{item.username}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted, display: 'block', marginTop: '2px' }}>Scope: {item.units}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteOnlineUser(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Privilege scopes registry list table */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Active Privilege Registry</h3>
                                <input
                                    type="text"
                                    placeholder="Search scopes..."
                                    value={permissionsSearch}
                                    onChange={e => setPermissionsSearch(e.target.value)}
                                    style={{ padding: '8px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none', width: '240px' }}
                                />
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder, color: themeStyles.textMuted }}>
                                            <th style={{ padding: '12px' }}>Email Address</th>
                                            <th style={{ padding: '12px' }}>Scope Stack</th>
                                            <th style={{ padding: '12px' }}>Role Level</th>
                                            <th style={{ padding: '12px' }}>Status Gate</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPermissions.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>No privilege scopes configured.</td>
                                            </tr>
                                        ) : (
                                            filteredPermissions.map(item => (
                                                <tr key={item.id} style={{ borderBottom: themeStyles.rowBorder }}>
                                                    <td style={{ padding: '12px', fontWeight: '700' }}>{item.email}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        {item.technology.split(',').map((tech, idx) => (
                                                            <span key={idx} style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', padding: '2px 6px', borderRadius: '4px', marginRight: '5px' }}>
                                                                {tech.trim()}
                                                            </span>
                                                        ))}
                                                    </td>
                                                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>{item.role || (item.is_lead ? 'lead' : 'user')}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: '800',
                                                            color: item.status === 'Active' ? '#10b981' : '#ef4444',
                                                            background: item.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px'
                                                        }}>{item.status}</span>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleTogglePermissionStatus(item.id)}
                                                                style={{
                                                                    padding: '4px 8px',
                                                                    background: 'none',
                                                                    border: themeStyles.inputBorder,
                                                                    color: themeStyles.textMain,
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: '700'
                                                                }}
                                                            >
                                                                Toggle
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePermission(item.id)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Granular Client Permissions Mapping Center */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
                            {/* Client Access Allocator Form */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: '#ffaa00' }}>Allocate Client View PermissionsCenter</h3>
                                <p style={{ fontSize: '0.75rem', color: themeStyles.textMuted, marginBottom: '1.25rem' }}>Map specific operators to client databases. They will only be permitted to view logs, metrics, and telemetry for these client environments.</p>
                                
                                <form onSubmit={handleAssignUserClient} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Operator Email</label>
                                        <input
                                            type="email"
                                            placeholder="e.g. specialist@geopits.com"
                                            value={ucEmail}
                                            onChange={e => setUcEmail(e.target.value)}
                                            required
                                            style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Client Environment</label>
                                            <select
                                                value={ucClientName}
                                                onChange={e => setUcClientName(e.target.value)}
                                                required
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            >
                                                <option value="">-- Select Client --</option>
                                                {clientsList.map(c => (
                                                    <option key={c.id} value={c.client_name}>{c.client_name} ({c.db_type})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '750', color: themeStyles.textMuted, marginBottom: '6px' }}>Access Scope</label>
                                            <select
                                                value={ucAccessLevel}
                                                onChange={e => setUcAccessLevel(e.target.value)}
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                            >
                                                <option value="view">Read Only View</option>
                                                <option value="write">Read & Write</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        style={{ padding: '12px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', marginTop: '6px' }}
                                    >
                                        Grant Client Access Permission
                                    </button>
                                </form>
                            </div>

                            {/* Client Access Registry Grid */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Client Visibility Matrix</h3>
                                    <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Active granular email-to-client environment map listings.</p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {userClientsList.length === 0 ? (
                                        <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, textAlign: 'center', padding: '1.5rem' }}>No client visibility maps assigned.</p>
                                    ) : (
                                        userClientsList.map(item => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: themeStyles.rowBg, border: themeStyles.rowBorder, borderRadius: '8px' }}>
                                                <div>
                                                    <span style={{ fontWeight: '800', fontSize: '0.82rem', color: themeStyles.textMain, display: 'block' }}>{item.email}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: '800', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>{item.client_name}</span>
                                                        <span style={{ fontSize: '0.65rem', color: themeStyles.textMuted }}>Scope: {item.access_level}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteUserClient(item.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 4: SECURE FIREWALL & API ACCESS CONTROL CENTER */}
                {/* ======================================================================== */}
                {activeTab === 'network-firewall' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>Secure Network IP Firewall</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Manage allowed administrative office IP networks and test client access compliance.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                            
                            {/* Whitelisted subnet list */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', color: '#ffaa00' }}>Whitelisted Corporate CIDR Networks</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                                    {whitelistedIPs.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: themeStyles.rowBg, border: themeStyles.rowBorder, borderRadius: '10px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Terminal size={12} style={{ color: '#10b981' }} />
                                                    <code style={{ fontSize: '0.82rem', fontWeight: '800', color: themeStyles.textMain }}>{item.cidr}</code>
                                                    <span style={{ fontSize: '0.58rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>Active Gate</span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: themeStyles.textMuted, marginTop: '2px', display: 'block' }}>{item.description}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveCidr(item.cidr)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', display: 'flex' }}
                                                title="Revoke Network Range"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add CIDR Form */}
                                <form onSubmit={handleRegisterCidr} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="Subnet CIDR (e.g. 172.16.0.0/12)"
                                            value={newCidr}
                                            onChange={e => setNewCidr(e.target.value)}
                                            required
                                            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <button 
                                            type="submit"
                                            style={{ padding: '10px 16px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                                        >
                                            Add CIDR
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Description (e.g. Office Chennai LAN)..."
                                        value={newCidrDesc}
                                        onChange={e => setNewCidrDesc(e.target.value)}
                                        style={{ padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                    />
                                </form>
                            </div>

                            {/* Validate IP compliance test */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', color: '#ffaa00' }}>Client IP Access Compliance Tester</h3>
                                <form onSubmit={handleValidateClientIp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: 0 }}>
                                        Input an external client IP address to check if it matches the registered CIDR whitelist criteria.
                                    </p>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="Client IP (e.g. 172.16.42.1)"
                                            value={ipToTest}
                                            onChange={e => setIpToTest(e.target.value)}
                                            required
                                            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <button 
                                            type="submit"
                                            style={{ padding: '10px 16px', background: '#ffaa00', color: '#000000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                                        >
                                            Test Compliance
                                        </button>
                                    </div>
                                </form>

                                {testResult && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: testResult.status === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                                        color: testResult.status === 'success' ? '#10b981' : '#ef4444'
                                    }}>
                                        {testResult.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 5: SLA ALERTS BROADCAST CENTER & TECH MATRIX */}
                {/* ======================================================================== */}
                {activeTab === 'broadcast-alerts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>SLA Alerts Broadcast Center</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Push urgent real-time system alerts to all users and monitor environment counts.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                            
                            {/* Broadcast Console */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', color: '#ffaa00' }}>Real-Time SLA Broadcast Console</h3>
                                <form onSubmit={handleBroadcastAlert} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <textarea
                                        placeholder="Type critical system alert warning (e.g. Postgres replication lag exceeds SLA policy)..."
                                        value={broadcastMessage}
                                        onChange={(e) => setBroadcastMessage(e.target.value)}
                                        rows={4}
                                        required
                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', resize: 'none' }}
                                    />
                                    <button 
                                        type="submit"
                                        disabled={isLoading}
                                        style={{ padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <Megaphone size={16} />
                                        <span>Broadcast Global Alert</span>
                                    </button>
                                </form>
                            </div>

                            {/* Technology Environment Matrix */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', color: '#ffaa00' }}>Active Technology Environment Matrix</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[
                                        { label: 'MySQL', count: mysqlCount, color: '#f59e0b' },
                                        { label: 'PostgreSQL', count: pgCount, color: '#3b82f6' },
                                        { label: 'MongoDB', count: mongoCount, color: '#10b981' },
                                        { label: 'Oracle', count: oracleCount, color: '#ef4444' },
                                        { label: 'MSSQL', count: mssqlCount, color: '#8b5cf6' }
                                    ].map(tech => {
                                        const percent = totalDbs > 0 ? (tech.count / totalDbs) * 100 : 0;
                                        return (
                                            <div key={tech.label} style={{ fontSize: '0.78rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: '700', color: themeStyles.textMain }}>{tech.label}</span>
                                                    <span style={{ fontWeight: '800', color: tech.color }}>{tech.count} active nodes</span>
                                                </div>
                                                <div style={{ background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ background: tech.color, width: `${percent}%`, height: '100%', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================================== */}
                {/* TAB 6: TELEMETRY ACTIVITY AUDITS & DATABASE MAINTENANCE SUITE */}
                {/* ======================================================================== */}
                {activeTab === 'telemetry-audits' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>Telemetry Audits & DB Maintenance</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Review active sessions telemetry, customer feedback history, and apply target maintenance purges.</p>
                        </div>

                        {/* Side-by-Side: Specialist Logs vs. DB Maintenance Console */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                            
                            {/* Specialist Session Activity Logs */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Specialist Session Activity</h3>
                                    <input
                                        type="text"
                                        placeholder="Search logs..."
                                        value={telemetrySearch}
                                        onChange={e => setTelemetrySearch(e.target.value)}
                                        style={{ padding: '8px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none', width: '180px' }}
                                    />
                                </div>

                                <div style={{ overflowX: 'auto', maxHeight: '350px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: themeStyles.rowBorder, color: themeStyles.textMuted }}>
                                                <th style={{ padding: '10px' }}>User</th>
                                                <th style={{ padding: '10px' }}>Page</th>
                                                <th style={{ padding: '10px' }}>Duration</th>
                                                <th style={{ padding: '10px' }}>Last Login</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTelemetry.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>No logs recorded.</td>
                                                </tr>
                                            ) : (
                                                filteredTelemetry.map(item => (
                                                    <tr key={item.id} style={{ borderBottom: themeStyles.rowBorder }}>
                                                        <td style={{ padding: '10px', fontWeight: '700' }}>{item.username}</td>
                                                        <td style={{ padding: '10px' }}>
                                                            <code style={{ background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px', border: themeStyles.inputBorder, color: '#3b82f6', fontSize: '0.7rem' }}>
                                                                {item.page_path}
                                                            </code>
                                                        </td>
                                                        <td style={{ padding: '10px', fontWeight: '800' }}>{formatDuration(item.duration_seconds)}</td>
                                                        <td style={{ padding: '10px', color: themeStyles.textMuted }}>
                                                            {item.last_active_at ? new Date(item.last_active_at).toLocaleString() : 'Never'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* TRANSIENT DATABASE MAINTENANCE SUITE - PRESERVING ALL ORIGINAL PURGE CRITERIA! */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🗄️</span>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: '#ffaa00' }}>Transient Database Maintenance Suite</h3>
                                    </div>
                                    <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
                                        Perform dynamic targeted purges or complete transactional resets directly on the PostgreSQL database instances. Access is highly restricted and requires authorization.
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Select Purge Target Table</label>
                                            <select
                                                value={selectedClearTarget}
                                                onChange={e => setSelectedClearTarget(e.target.value)}
                                                style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            >
                                                <option value="feedbacks">Purge Feedback Reviews (feedbacks)</option>
                                                <option value="telemetry">Purge Page Activity Logs (user_page_activity)</option>
                                                <option value="notifications">Purge SLA Warnings & Broadcast Alerts (notifications)</option>
                                                <option value="reports">Purge Client Reports Vault (client_reports)</option>
                                                <option value="all">Complete Transient Database Reset (all tables)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowMaintenanceModal(true)}
                                    disabled={isLoading}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '800',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                                    }}
                                >
                                    <Settings size={15} />
                                    <span>Execute Targeted Database Purge</span>
                                </button>
                            </div>
                        </div>

                        {/* Bottom: Feedbacks logs */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Recorded User Feedbacks ({feedbacks.length})</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {feedbacks.length === 0 ? (
                                    <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, textAlign: 'center', padding: '2rem' }}>No user feedbacks collected.</p>
                                ) : (
                                    feedbacks.map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '14px 18px', background: themeStyles.rowBg, border: themeStyles.rowBorder, borderRadius: '10px' }}>
                                            <div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: themeStyles.textMain }}>
                                                        {item.username || 'Anonymous'} <span style={{ fontWeight: '400', color: themeStyles.textMuted, fontSize: '0.78rem' }}>({item.email || 'no-email'})</span>
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star 
                                                                key={star} 
                                                                size={12} 
                                                                style={{ 
                                                                    fill: star <= (item.rating || 0) ? '#ffaa00' : 'none', 
                                                                    color: star <= (item.rating || 0) ? '#ffaa00' : themeStyles.textMuted 
                                                                }} 
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: '0.82rem', color: themeStyles.textMain, margin: '8px 0 0 0', lineHeight: '1.4' }}>{item.feedback_text}</p>
                                                <span style={{ fontSize: '0.65rem', color: themeStyles.textMuted, display: 'block', marginTop: '6px' }}>Submitted: {new Date(item.created_at).toLocaleString()}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteFeedback(item.id)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'telemetry-scheduler' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>Telemetry Ingestion Scheduler</h1>
                            <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Configure automated daily database capacity audits, telemetry metrics pulling, or execute manual ingestion.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                            {/* Scheduler Status Panel */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Activity size={18} /> Daemon Status & Heartbeat
                                    </h3>
                                    
                                    {schedulerStatus ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ fontSize: '0.9rem', color: themeStyles.textMain }}>
                                                Daemon Status: <strong style={{ color: schedulerStatus.sync_in_progress ? '#ffaa00' : '#34d399', textTransform: 'uppercase', fontSize: '0.85rem' }}>{schedulerStatus.status}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: themeStyles.textMain }}>
                                                Scheduled Time: <strong>{String(schedulerStatus.trigger_hour).padStart(2, '0')}:{String(schedulerStatus.trigger_minute).padStart(2, '0')} IST</strong> Daily
                                            </div>
                                            <div style={{ borderTop: themeStyles.rowBorder, paddingTop: '15px' }}>
                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: themeStyles.textMuted }}>Last Run Report</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                                                    <div>Timestamp: <span style={{ fontWeight: 600 }}>{schedulerStatus.last_sync_time}</span></div>
                                                    <div>Status: <span style={{ 
                                                        fontWeight: 600,
                                                        color: schedulerStatus.last_sync_status?.startsWith('Success') ? '#34d399' : (schedulerStatus.last_sync_status === 'N/A' ? themeStyles.textMuted : '#ef4444')
                                                    }}>{schedulerStatus.last_sync_status}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p style={{ color: themeStyles.textMuted, fontSize: '0.85rem' }}>Querying daemon heartbeat...</p>
                                    )}
                                </div>

                                <button
                                    onClick={handleTriggerSync}
                                    disabled={schedulerStatus?.sync_in_progress || triggeringSync}
                                    style={{
                                        marginTop: '2rem',
                                        width: '100%',
                                        padding: '12px',
                                        background: schedulerStatus?.sync_in_progress || triggeringSync ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #ffaa00, #d97706)',
                                        color: schedulerStatus?.sync_in_progress || triggeringSync ? themeStyles.textMuted : '#000000',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '800',
                                        fontSize: '0.85rem',
                                        cursor: schedulerStatus?.sync_in_progress || triggeringSync ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: schedulerStatus?.sync_in_progress || triggeringSync ? 'none' : '0 4px 12px rgba(255,170,0,0.2)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <RefreshCw size={15} className={schedulerStatus?.sync_in_progress || triggeringSync ? "spin-sync-icon" : ""} />
                                    <span>{schedulerStatus?.sync_in_progress ? 'Ingestion In Progress...' : 'Sync Telemetry Now'}</span>
                                </button>
                            </div>

                            {/* Scheduler Configuration Form */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', minHeight: '320px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Settings size={18} /> Schedule Settings
                                </h3>

                                <form onSubmit={handleUpdateSchedulerSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Trigger Hour (0 - 23)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="23"
                                                required
                                                value={triggerHour}
                                                onChange={e => setTriggerHour(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 14px',
                                                    borderRadius: '8px',
                                                    background: themeStyles.inputBg,
                                                    border: themeStyles.inputBorder,
                                                    color: themeStyles.textMain,
                                                    fontSize: '0.9rem',
                                                    fontWeight: '700',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Trigger Minute (0 - 59)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                required
                                                value={triggerMinute}
                                                onChange={e => setTriggerMinute(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 14px',
                                                    borderRadius: '8px',
                                                    background: themeStyles.inputBg,
                                                    border: themeStyles.inputBorder,
                                                    color: themeStyles.textMain,
                                                    fontSize: '0.9rem',
                                                    fontWeight: '700',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: themeStyles.textMuted, lineHeight: '1.5' }}>
                                        Note: The daemon monitors local timezone changes and runs the sync daily at the specified time. Triggering sync manually updates the history immediately in the background without affecting the automated schedule.
                                    </div>

                                    <button
                                        type="submit"
                                        style={{
                                            padding: '12px',
                                            background: '#ffaa00',
                                            color: '#000000',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '800',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(255,170,0,0.15)',
                                            transition: 'all 0.2s',
                                            marginTop: 'auto'
                                        }}
                                    >
                                        Save Schedule Settings
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================== */}
                {/* SHARE HISTORY (REPORTS) PANEL               */}
                {/* =========================================== */}
                {activeTab === 'share-history' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 4px 0' }}>Share History — Report Documents</h2>
                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, margin: 0 }}>
                                Audit trail of all report documents shared via WhatsApp, Teams, or email. Read-only admin view.
                            </p>
                        </div>

                        {/* Search + Refresh */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '10px', padding: '10px 14px' }}>
                                <Eye size={16} style={{ color: themeStyles.textMuted }} />
                                <input
                                    type="text"
                                    placeholder="Search by report title, shared by, or recipient..."
                                    value={shareHistorySearch}
                                    onChange={e => setShareHistorySearch(e.target.value)}
                                    style={{ background: 'none', border: 'none', color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', width: '100%' }}
                                />
                            </div>
                            <button
                                onClick={fetchShareHistory}
                                style={{ padding: '10px 18px', background: themeStyles.accentColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                        </div>

                        {/* Table */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', overflow: 'hidden' }}>
                            {shareHistoryLoading ? (
                                <div style={{ padding: '4rem', textAlign: 'center', color: themeStyles.textMuted }}>Loading share history...</div>
                            ) : shareHistory.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', color: themeStyles.textMuted }}>
                                    <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                    <p style={{ margin: 0, fontWeight: '600' }}>No report sharing records found.</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>Share actions on reports will appear here automatically.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: themeStyles.cardBorder }}>
                                                {['#', 'Report Title', 'Shared By', 'Platform', 'Recipient', 'Shared At'].map(h => (
                                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.68rem', color: themeStyles.textMuted, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {shareHistory
                                                .filter(r =>
                                                    !shareHistorySearch ||
                                                    (r.report_title || '').toLowerCase().includes(shareHistorySearch.toLowerCase()) ||
                                                    (r.shared_by || '').toLowerCase().includes(shareHistorySearch.toLowerCase()) ||
                                                    (r.recipient || '').toLowerCase().includes(shareHistorySearch.toLowerCase()) ||
                                                    (r.share_platform || '').toLowerCase().includes(shareHistorySearch.toLowerCase())
                                                )
                                                .map((item, idx) => {
                                                    const platformColor = item.share_platform?.toLowerCase().includes('whatsapp') ? '#25d366'
                                                        : item.share_platform?.toLowerCase().includes('teams') ? '#5059c9'
                                                        : '#0ea5e9';
                                                    return (
                                                        <tr key={item.id} className="table-row-hover" style={{ borderBottom: themeStyles.rowBorder }}>
                                                            <td style={{ padding: '12px 16px', color: themeStyles.textMuted, fontWeight: '700' }}>{idx + 1}</td>
                                                            <td style={{ padding: '12px 16px', color: themeStyles.textMain, fontWeight: '600', maxWidth: '240px' }}>
                                                                <span title={item.report_title} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {item.report_title || `Report #${item.report_id}`}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 16px', color: themeStyles.textMain }}>{item.shared_by || '—'}</td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                <span style={{ background: `${platformColor}18`, border: `1px solid ${platformColor}44`, color: platformColor, padding: '3px 10px', borderRadius: '20px', fontWeight: '700', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                                    {item.share_platform || 'Unknown'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 16px', color: themeStyles.textMuted }}>{item.recipient || '—'}</td>
                                                            <td style={{ padding: '12px 16px', color: themeStyles.textMuted, whiteSpace: 'nowrap' }}>
                                                                {item.created_at ? new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* =========================================== */}
                {/* CLIENT ALERT THRESHOLDS PANEL               */}
                {/* =========================================== */}
                {activeTab === 'alert-settings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 4px 0' }}>Client Alert Thresholds & Spikes Control</h2>
                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, margin: 0 }}>
                                Configure administrative resource thresholds, slow query limits, and automated email summarization schedules per client and technology.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                            {/* Form Card */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bell size={18} style={{ color: themeStyles.accentColor }} />
                                    Configure Spike Parameters
                                </h3>

                                <form onSubmit={handleSaveAlertSetting} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {/* Client and Tech */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Client Name</label>
                                            <select
                                                value={alertClientName}
                                                onChange={e => {
                                                    const selectedName = e.target.value;
                                                    setAlertClientName(selectedName);
                                                    const matchedClient = clientsList.find(c => c.client_name === selectedName);
                                                    if (matchedClient) {
                                                        if (matchedClient.db_type) {
                                                            setAlertDbType(matchedClient.db_type);
                                                        }
                                                        if (matchedClient.client_email) {
                                                            setAlertClientEmails(matchedClient.client_email);
                                                        }
                                                    }
                                                }}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="">-- Select Client --</option>
                                                {Array.from(new Set(clientsList.map(c => c.client_name))).map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Technology</label>
                                            <select
                                                value={alertDbType}
                                                onChange={e => setAlertDbType(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                            >
                                                {['MSSQL', 'MySQL', 'MongoDB', 'PostgreSQL', 'Oracle'].map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Thresholds (CPU/Mem) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>CPU Spike Limit (%)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={alertCpuThreshold}
                                                onChange={e => setAlertCpuThreshold(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Memory Spike Limit (%)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={alertMemoryThreshold}
                                                onChange={e => setAlertMemoryThreshold(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Thresholds (Disk/IO) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Disk Spike Limit (%)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={alertDiskThreshold}
                                                onChange={e => setAlertDiskThreshold(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>IO Spike Limit (%)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={alertIoThreshold}
                                                onChange={e => setAlertIoThreshold(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Slow Query and Long Running limits */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Slow Query Limit (ms)</label>
                                            <input
                                                type="number"
                                                min="100"
                                                value={alertSlowQueryThresholdMs}
                                                onChange={e => setAlertSlowQueryThresholdMs(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Long Running Limit (sec)</label>
                                            <input
                                                type="number"
                                                min="10"
                                                value={alertLongRunningThresholdSec}
                                                onChange={e => setAlertLongRunningThresholdSec(e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Emails list */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Recipient Emails (Comma separated)</label>
                                        <input
                                            type="text"
                                            placeholder="client-admin@company.com, support@company.com"
                                            value={alertClientEmails}
                                            onChange={e => setAlertClientEmails(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>CC Emails (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="secondary-alerts@company.com"
                                            value={alertCcEmails}
                                            onChange={e => setAlertCcEmails(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                        />
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: themeStyles.textMuted }}>
                                            * Technology-specific alerts will automatically include defaults (e.g. <code>mssqlalerts@geopits.com</code>).
                                        </p>
                                    </div>

                                    {/* Toggles */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={alertServerDownAlert}
                                                onChange={e => setAlertServerDownAlert(e.target.checked)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                            <span>Enable Server Down Monitoring Alerts</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={alertCriticalErrorAlert}
                                                onChange={e => setAlertCriticalErrorAlert(e.target.checked)}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                            <span>Enable Critical Error Log Auto-Ticketing</span>
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        style={{ width: '100%', padding: '12px', background: themeStyles.accentColor, color: isLight ? '#fff' : '#000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <Save size={16} />
                                        Save Settings
                                    </button>
                                </form>
                            </div>

                            {/* Configurations List */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} style={{ color: themeStyles.accentColor }} />
                                    Active Threshold Profiles
                                </h3>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: themeStyles.cardBorder, color: themeStyles.textMuted }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Client / Tech</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>CPU/Mem/Disk/IO</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Slow/Long Limits</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Recipients</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {alertSettingsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: themeStyles.textMuted }}>
                                                        No threshold profiles configured yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                alertSettingsList.map(item => (
                                                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ padding: '12px 8px', fontWeight: '700' }}>
                                                            {item.client_name}
                                                            <div style={{ fontSize: '0.68rem', fontWeight: '600', color: themeStyles.accentColor }}>{item.db_type}</div>
                                                        </td>
                                                        <td style={{ padding: '12px 8px' }}>
                                                            CPU: {item.cpu_threshold}% | Mem: {item.memory_threshold}%<br/>
                                                            Disk: {item.disk_threshold}% | IO: {item.io_threshold}%
                                                        </td>
                                                        <td style={{ padding: '12px 8px' }}>
                                                            Slow: {item.slow_query_threshold_ms}ms<br/>
                                                            Long: {item.long_running_threshold_sec}s
                                                        </td>
                                                        <td style={{ padding: '12px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.client_emails}>
                                                            {item.client_emails || '—'}
                                                        </td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                <button
                                                                    onClick={() => handleEditAlertSetting(item)}
                                                                    style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: themeStyles.textMain, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteAlertSetting(item.id)}
                                                                    style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <hr style={{ border: 0, borderTop: themeStyles.cardBorder, margin: '1rem 0' }} />

                        {/* Second section: Technology Alert Email Routing Configuration */}
                        <div>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 4px 0' }}>Technology Alert Email Routing</h2>
                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, margin: 0 }}>
                                Map database technologies to target operations/distribution email addresses dynamically.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                            {/* Technology Form Card */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Mail size={18} style={{ color: themeStyles.accentColor }} />
                                    Configure Email Route
                                </h3>

                                <form onSubmit={handleSaveTechAlertConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Database Technology</label>
                                        <select
                                            value={newTechName}
                                            onChange={e => setNewTechName(e.target.value)}
                                            disabled={editingTech !== null}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                                        >
                                            {['MSSQL', 'MySQL', 'MongoDB', 'PostgreSQL', 'Oracle'].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Alert Distribution List Email</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. mssqlalerts@geomon.com, team@geomon.com"
                                            value={newTechEmail}
                                            onChange={e => setNewTechEmail(e.target.value)}
                                            required
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.85rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            style={{ flex: 1, padding: '12px', background: themeStyles.accentColor, color: isLight ? '#fff' : '#000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        >
                                            <Save size={16} />
                                            {editingTech ? "Update Route" : "Save Route"}
                                        </button>
                                        {editingTech && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewTechName('MSSQL');
                                                    setNewTechEmail('');
                                                    setEditingTech(null);
                                                }}
                                                style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', color: themeStyles.textMain, border: themeStyles.inputBorder, borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* Configurations List */}
                            <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <List size={18} style={{ color: themeStyles.accentColor }} />
                                    Active Technology Routing
                                </h3>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: themeStyles.cardBorder, color: themeStyles.textMuted }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Technology</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ops Email Address</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {techAlertConfigs.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: themeStyles.textMuted }}>
                                                        No technology routes configured yet. Defaulting to system rules.
                                                    </td>
                                                </tr>
                                            ) : (
                                                techAlertConfigs.map(item => (
                                                    <tr key={item.technology} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ padding: '12px 8px', fontWeight: '700', color: themeStyles.accentColor }}>
                                                            {item.technology}
                                                        </td>
                                                        <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                                                            {item.alert_email}
                                                        </td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                <button
                                                                    onClick={() => handleEditTechAlertConfig(item)}
                                                                    style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: themeStyles.textMain, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTechAlertConfig(item.technology)}
                                                                    style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* CONFIRMATION OVERLAY MODAL FOR DATABASE MAINTENANCE SUITE */}
            {showMaintenanceModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        background: '#111217',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '16px',
                        padding: '2.5rem',
                        maxWidth: '480px',
                        width: '100%',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                        margin: '0 20px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '1rem' }}>
                            <AlertCircle size={24} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>Critical Maintenance Action</h3>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
                            You are about to completely wipe the active <strong>{selectedClearTarget}</strong> table database records. This transactional operation is irreversible.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Type "RESET" in all-caps to authorize this targeted purge:
                            </label>
                            <input
                                type="text"
                                placeholder="Type RESET..."
                                value={maintenanceConfirmInput}
                                onChange={e => setMaintenanceConfirmInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    background: '#1e202b',
                                    border: '1px solid #2a2d3e',
                                    color: '#f8fafc',
                                    fontSize: '0.9rem',
                                    fontWeight: '800',
                                    outline: 'none',
                                    textAlign: 'center',
                                    letterSpacing: '2px'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleClearDatabase}
                                disabled={isLoading || maintenanceConfirmInput !== 'RESET'}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '800',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    opacity: (maintenanceConfirmInput === 'RESET') ? 1 : 0.5
                                }}
                            >
                                Authorize & Wipe Target
                            </button>
                            <button
                                onClick={() => {
                                    setShowMaintenanceModal(false);
                                    setMaintenanceConfirmInput('');
                                }}
                                style={{
                                    padding: '12px 20px',
                                    background: '#20222e',
                                    color: '#94a3b8',
                                    border: '1px solid #2a2d3e',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSetup;
