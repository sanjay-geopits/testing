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
    ShieldCheck,
    ShieldAlert,
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
    List,
    ChevronDown,
    Clock
} from 'lucide-react';


const AVAILABLE_TECHS = ['MSSQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'];

const AdminSetup = () => {
    const navigate = useNavigate();
    const { user, logout, logoUrl: globalLogoUrl, refreshLogo } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';

    // Sidebar Active Tab Navigation state (defaults to 'ticket-options' matching user screenshot)
    const [activeTab, setActiveTab] = useState('user-roles'); 

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
    // Business Units
    const [buList, setBuList] = useState([]);
    const [newBuName, setNewBuName] = useState('');

    // Company Clients
    const [clientsList, setClientsList] = useState([]);
    const [newClientName, setNewClientName] = useState('');
    const [newClientTech, setNewClientTech] = useState('MSSQL');
    const [selectedTechs, setSelectedTechs] = useState(['MSSQL']);
    const [newClientIp, setNewClientIp] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
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
    const [selectedPermTechs, setSelectedPermTechs] = useState(['MySQL']);
    const [permClientScope, setPermClientScope] = useState('');
    const [permStatus, setPermStatus] = useState('Active');
    const [permIsLead, setPermIsLead] = useState(false);
    const [permRole, setPermRole] = useState('user');
    const [permissionsSearch, setPermissionsSearch] = useState('');
    const [showTechDropdown, setShowTechDropdown] = useState(false);
    
    // User Clients Permission Mapping
    const [userClientsList, setUserClientsList] = useState([]);

    // Mapped Client Access Mappings (legacy clients tab)
    const [clientAccessList, setClientAccessList] = useState([]);
    const [clientAccessLoading, setClientAccessLoading] = useState(false);
    const [clientFilters, setClientFilters] = useState({ db_types: [], clients: [], client_server_map: {}, db_server_map: {}, db_client_map: {} });
    const [mapClientEmail, setMapClientEmail] = useState('');
    const [mapClientTech, setMapClientTech] = useState('');
    const [mapClientName, setMapClientName] = useState('');
    const [mapClientServer, setMapClientServer] = useState('');

    // Lead activity / User oversight (legacy activity tab)
    const [leadActivityList, setLeadActivityList] = useState([]);
    const [leadActivityLoading, setLeadActivityLoading] = useState(false);

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

    const fetchClientAccessList = () => {
        setClientAccessLoading(true);
        api.get('/admin/clients')
            .then(res => setClientAccessList(res.data.clients || []))
            .catch(err => console.error("Error fetching client access assignments:", err))
            .finally(() => setClientAccessLoading(false));
    };

    const fetchClientFilters = () => {
        api.get('/filters')
            .then(res => setClientFilters(res.data || { db_types: [], clients: [], client_server_map: {}, db_server_map: {}, db_client_map: {} }))
            .catch(err => console.error("Error fetching client filters:", err));
    };

    const fetchLeadActivity = () => {
        setLeadActivityLoading(true);
        api.get('/admin/lead-activity')
            .then(res => setLeadActivityList(res.data.activity || []))
            .catch(err => console.error("Error fetching lead activity:", err))
            .finally(() => setLeadActivityLoading(false));
    };

    useEffect(() => {
        if (user && user.role !== 'admin' && user.role !== 'lead') {
            navigate('/');
            return;
        }

        fetchBusinessUnits();
        fetchAdminClients();
        fetchLogoSettings();
        fetchSchedulerStatus();
        fetchPermissionsList();
        fetchUserClients();
        fetchTelemetry();
        fetchFeedbacks();
        fetchLoginUsers();
        fetchShareHistory();
        fetchAlertSettings();
        fetchTechAlertConfigs();
        fetchClientAccessList();
        fetchClientFilters();
        fetchLeadActivity();

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
                    db_type: selectedTechs.join(', '),
                    server_name: newClientIp || '127.0.0.1',
                    client_email: newClientEmail,
                    phone_number: newClientPhone
                });
                setSuccess(`Company client "${newClientName}" updated successfully.`);
                setEditingClient(null);
            } else {
                await api.post('/new-features/admin/clients', {
                    client_name: newClientName,
                    db_type: selectedTechs.join(', '),
                    server_name: newClientIp || '127.0.0.1',
                    client_email: newClientEmail,
                    phone_number: newClientPhone
                });
                setSuccess(`Company client "${newClientName}" registered successfully.`);
            }
            setNewClientName('');
            setNewClientIp('');
            setNewClientEmail('');
            setNewClientPhone('');
            setSelectedTechs(['MSSQL']);
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
        const techs = client.db_type ? client.db_type.split(',').map(t => t.trim()) : ['MSSQL'];
        setSelectedTechs(techs);
        setNewClientIp(client.server_name || '');
        setNewClientEmail(client.client_email || '');
        setNewClientPhone(client.phone_number || '');
        setError('');
        setSuccess('');
    };

    const handleCancelEditClient = () => {
        setEditingClient(null);
        setNewClientName('');
        setSelectedTechs(['MSSQL']);
        setNewClientIp('');
        setNewClientEmail('');
        setNewClientPhone('');
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

    const handleAddLoginUser = async (e) => {
        e.preventDefault();
        if (!newLoginUsername.trim() || !newLoginEmail.trim() || !newLoginFullName.trim() || !newLoginPassword.trim()) {
            setError("All fields are required to create a login account.");
            return;
        }
        if (user?.role === 'lead') {
            const leadEmail = user?.email || '';
            const leadDomain = leadEmail.includes('@') ? leadEmail.split('@').pop().toLowerCase() : '';
            const inputEmail = newLoginEmail.trim();
            const inputDomain = inputEmail.includes('@') ? inputEmail.split('@').pop().toLowerCase() : '';
            if (!leadDomain || leadDomain !== inputDomain) {
                setError(`Lead users can only add users within their own domain (@${leadDomain}).`);
                return;
            }
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

    // 4. Client Access Mapping & User Oversight actions
    const handleAddClientAccess = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.post('/admin/clients', {
                client_email: mapClientEmail.trim(),
                technology: mapClientTech,
                client_name: mapClientName,
                server_name: mapClientServer
            });
            setSuccess("Client access mapping registered successfully.");
            setMapClientEmail('');
            setMapClientTech('');
            setMapClientName('');
            setMapClientServer('');
            fetchClientAccessList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to register client access mapping.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleClientAccessStatus = async (client) => {
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.patch(`/admin/clients/${client.id}/status`);
            setSuccess("Client access status updated successfully.");
            fetchClientAccessList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update client access status.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClientAccess = async (client) => {
        if (!window.confirm(`Are you sure you want to delete the mapping for ${client.client_email}?`)) return;
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await api.delete(`/admin/clients/${client.id}`);
            setSuccess("Client access mapping deleted successfully.");
            fetchClientAccessList();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to delete client access mapping.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleAdmin = async (username, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const action = newRole === 'admin' ? 'Grant Admin Access' : 'Revoke Admin Access';
        
        if (!window.confirm(`Are you sure you want to ${action} for user ${username}?`)) return;
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await api.patch('/admin/users/role', { 
                username: username,
                role: newRole 
            });
            setSuccess(`User role successfully updated to ${newRole}.`);
            fetchLoginUsers();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || "Role update failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const isUserActive = (lastActive) => {
        if (!lastActive || lastActive === 'Never') return false;
        try {
            const activeTime = new Date(lastActive.replace(' ', 'T'));
            const diffMs = new Date() - activeTime;
            const diffMins = diffMs / 1000 / 60;
            return diffMins < 5;
        } catch (e) {
            return false;
        }
    };

    const mappedClientOptions = React.useMemo(() => {
        if (!mapClientTech) return clientFilters.clients || [];
        return clientFilters.db_client_map?.[mapClientTech] || [];
    }, [mapClientTech, clientFilters]);

    const mappedServerOptions = React.useMemo(() => {
        if (mapClientName) return clientFilters.client_server_map?.[mapClientName] || [];
        if (mapClientTech) return clientFilters.db_server_map?.[mapClientTech] || [];
        return [...new Set(Object.values(clientFilters.client_server_map || {}).flat())];
    }, [mapClientName, mapClientTech, clientFilters]);

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
        if (!permEmail.trim()) {
            setError("Email address is required");
            return;
        }
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            // 1. Assign privilege technologies
            await api.post('/admin/leads', {
                email: permEmail.trim(),
                technologies: selectedPermTechs,
                is_lead: permRole === 'lead'
            });

            // 2. Assign client environment view permission if selected
            if (permClientScope) {
                await api.post('/new-features/admin/user-clients', {
                    email: permEmail.trim(),
                    client_name: permClientScope,
                    access_level: permRole === 'admin' ? 'write' : 'view'
                });
            }

            setSuccess(`User registry & privilege scope allocated for ${permEmail}.`);
            setPermEmail('');
            setPermClientScope('');
            setSelectedPermTechs(['MySQL']);
            setPermRole('user');
            
            fetchPermissionsList();
            fetchUserClients();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to allocate engineering scope permissions.');
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

    const derivedTicketAgents = permissionsList
        .filter(p => p.status === 'Active')
        .reduce((acc, p) => {
            // Deduplicate by email
            if (!acc.some(agent => agent.email.toLowerCase() === p.email.toLowerCase())) {
                const loginUser = loginUsersList.find(u => u.email?.toLowerCase() === p.email?.toLowerCase());
                acc.push({
                    id: p.id,
                    name: loginUser ? loginUser.username : p.email.split('@')[0],
                    email: p.email
                });
            }
            return acc;
        }, []);

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
                            { id: 'user-roles', label: 'System Users', icon: <Users size={16} /> },
                            { id: 'privilege-allocation', label: 'User Management', icon: <Shield size={16} /> },
                            { id: 'client-database', label: 'Client Management', icon: <Database size={16} /> },
                            { id: 'share-history', label: 'Share History', icon: <Eye size={16} /> },
                            { id: 'alert-settings', label: 'Alert Settings', icon: <Bell size={16} /> },
                            { id: 'user-telemetry', label: 'User Audit Logs', icon: <Clock size={16} /> }
                        ].filter((item) => {
                            if (user?.role === 'lead') {
                                return item.id === 'user-roles';
                            }
                            return true;
                        }).map((item) => {
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
                

                {/* ======================================================================== */}
                {/* TAB 2: SYSTEM BRANDING & APPLICATION LOGO */}
                {/* ======================================================================== */}
                

                {/* ======================================================================== */}
                {/* TAB 3A: USER ROLE MANAGEMENT */}
                {/* ======================================================================== */}
                {activeTab === 'user-roles' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        
                        {/* Heading */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.75px' }}>System Users</h1>
                                <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Manage application users and monitor their activity.</p>
                            </div>
                        </div>

                        {/* Interactive Telemetry KPI Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                            {[
                                { title: 'Registered Logins', count: loginUsersList.length, icon: <Users size={20} color="#ffaa00" />, desc: 'Active web accounts', gradient: 'linear-gradient(135deg, rgba(255, 170, 0, 0.08) 0%, rgba(255, 170, 0, 0.02) 100%)', border: 'rgba(255,170,0,0.15)' },
                                { title: 'Online Users', count: loginUsersList.filter(u => isUserActive(u.last_active_at)).length, icon: <Activity size={20} color="#10b981" />, desc: 'Active within 5 mins', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', border: 'rgba(16,185,129,0.15)' },
                                { title: 'Overseen Assignments', count: leadActivityList.length, icon: <UserCheck size={20} color="#38bdf8" />, desc: 'Lead-monitored users', gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(56, 189, 248, 0.02) 100%)', border: 'rgba(56,189,248,0.15)' }
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

                        {/* System Users Full-Width Table */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', overflow: 'hidden' }}>
                            {/* Table header row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 120px 180px 48px', padding: '10px 20px', borderBottom: themeStyles.rowBorder, gap: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>User</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Active</span>
                                <span />
                            </div>

                            {/* Search bar */}
                            <div style={{ padding: '12px 20px', borderBottom: themeStyles.rowBorder, display: 'flex', justifyContent: 'flex-end' }}>
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={loginUsersSearch}
                                    onChange={e => setLoginUsersSearch(e.target.value)}
                                    style={{ padding: '7px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none', width: '200px' }}
                                />
                            </div>

                            {/* Rows */}
                            <div style={{ maxHeight: '520px', overflowY: 'auto' }} className="custom-scrollbar">
                                {loginUsersList
                                    .filter(u =>
                                        u.username?.toLowerCase().includes(loginUsersSearch.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(loginUsersSearch.toLowerCase()) ||
                                        u.full_name?.toLowerCase().includes(loginUsersSearch.toLowerCase())
                                    )
                                    .map(item => {
                                        const active = isUserActive(item.last_active_at);
                                        const roleColors = {
                                            admin:  { bg: 'rgba(234,88,12,0.15)',  text: '#ea580c' },
                                            lead:   { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
                                            client: { bg: 'rgba(37,99,235,0.15)',  text: '#3b82f6' },
                                            user:   { bg: 'transparent', text: themeStyles.textMain }
                                        };
                                        const rc = roleColors[item.role] || roleColors.user;
                                        const roleLabel = item.role === 'user' ? 'USER' : item.role === 'admin' ? 'ADMIN' : item.role === 'lead' ? 'LEAD' : item.role.toUpperCase();
                                        const initial = (item.full_name || item.username || 'U')[0].toUpperCase();
                                        const avatarColors = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899'];
                                        const avatarBg = avatarColors[(initial.charCodeAt(0)) % avatarColors.length];
                                        return (
                                            <div
                                                key={item.id}
                                                style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 120px 180px 48px', padding: '12px 20px', gap: '8px', alignItems: 'center', borderBottom: themeStyles.rowBorder }}
                                                className="table-row-hover"
                                            >
                                                {/* USER column */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {item.profile_pic ? (
                                                        <img src={item.profile_pic} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                                                    ) : (
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                                                            {initial}
                                                        </div>
                                                    )}
                                                    <span style={{ fontWeight: '700', fontSize: '0.84rem', color: themeStyles.textMain }}>{item.full_name || item.username}</span>
                                                </div>

                                                {/* EMAIL column */}
                                                <span style={{ fontSize: '0.82rem', color: themeStyles.textMuted }}>{item.email}</span>

                                                {/* ROLE column */}
                                                <div>
                                                    {item.role === 'admin' || item.role === 'lead' ? (
                                                        <span style={{ fontSize: '0.7rem', fontWeight: '800', background: rc.bg, color: rc.text, padding: '3px 9px', borderRadius: '5px', letterSpacing: '0.04em' }}>{roleLabel}</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.82rem', color: themeStyles.textMain }}>{roleLabel}</span>
                                                    )}
                                                </div>

                                                {/* LAST ACTIVE column */}
                                                <span style={{ fontSize: '0.78rem', color: themeStyles.textMuted }}>{item.last_active_at || '—'}</span>

                                                {/* ACTION column */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                    {user?.role !== 'lead' && (
                                                        <button
                                                            onClick={() => handleToggleAdmin(item.username, item.role)}
                                                            style={{ background: 'none', border: 'none', color: item.role === 'admin' ? '#ea580c' : themeStyles.textMuted, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                            title={item.role === 'admin' ? 'Revoke Administrator' : 'Grant Administrator'}
                                                        >
                                                            {item.role === 'admin' ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteLoginUser(item.id)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        title="Delete user"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                                {loginUsersList.filter(u =>
                                    u.username?.toLowerCase().includes(loginUsersSearch.toLowerCase()) ||
                                    u.email?.toLowerCase().includes(loginUsersSearch.toLowerCase()) ||
                                    u.full_name?.toLowerCase().includes(loginUsersSearch.toLowerCase())
                                ).length === 0 && (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: themeStyles.textMuted, fontSize: '0.85rem' }}>No users found.</div>
                                )}
                            </div>
                        </div>

                        {/* Add new user – collapsible form below table */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem 2rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#ffaa00', margin: '0 0 1.25rem 0' }}>Create Login Account</h3>
                            <form onSubmit={handleAddLoginUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '5px', textTransform: 'uppercase' }}>Username</label>
                                        <input type="text" placeholder="e.g. john" value={newLoginUsername} onChange={e => setNewLoginUsername(e.target.value)} required autoComplete="new-username"
                                            style={{ width: '100%', padding: '10px 13px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '5px', textTransform: 'uppercase' }}>Full Name</label>
                                        <input type="text" placeholder="e.g. John Doe" value={newLoginFullName} onChange={e => setNewLoginFullName(e.target.value)} required autoComplete="off"
                                            style={{ width: '100%', padding: '10px 13px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '5px', textTransform: 'uppercase' }}>Email</label>
                                        <input type="email" placeholder="e.g. john@geopits.com" value={newLoginEmail} onChange={e => setNewLoginEmail(e.target.value)} required autoComplete="new-email"
                                            style={{ width: '100%', padding: '10px 13px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '5px', textTransform: 'uppercase' }}>Password</label>
                                        <input type="password" placeholder="••••••••" value={newLoginPassword} onChange={e => setNewLoginPassword(e.target.value)} required autoComplete="new-password"
                                            style={{ width: '100%', padding: '10px 13px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '5px', textTransform: 'uppercase' }}>Role</label>
                                        <select value={newLoginRole} onChange={e => setNewLoginRole(e.target.value)}
                                            style={{ width: '100%', padding: '10px 13px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }}>
                                            <option value="user">System User</option>
                                            <option value="client">Client User</option>
                                            {user?.role !== 'lead' && <option value="lead">Lead</option>}
                                            {user?.role !== 'lead' && <option value="admin">Administrator</option>}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" style={{ padding: '10px 24px', background: '#ffaa00', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer' }}>
                                        Create Account
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* User Oversight (Lead-Assigned Activity) */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Lead-Assigned User Oversight</h3>
                                    <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Monitor user environments assigned by technology leads.</p>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder, color: themeStyles.textMuted }}>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Assigned User</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Technology</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Overseeing Lead(s)</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Activity Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leadActivityLoading ? (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>Loading oversight data...</td>
                                            </tr>
                                        ) : leadActivityList.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>No lead-assigned user records found.</td>
                                            </tr>
                                        ) : (
                                            leadActivityList.map(act => (
                                                <tr key={act.id} style={{ borderBottom: themeStyles.rowBorder }}>
                                                    <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {act.profile_pic ?
                                                            <img src={act.profile_pic} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} /> :
                                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #ffaa00 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#000' }}>
                                                                {act.username && act.username[0] ? act.username[0].toUpperCase() : (act.user_email && act.user_email[0] ? act.user_email[0].toUpperCase() : 'U')}
                                                            </div>
                                                        }
                                                        <div>
                                                            <div style={{ fontWeight: '700', color: themeStyles.textMain }}>{act.user_name || act.username || (act.user_email ? act.user_email.split('@')[0] : 'User')}</div>
                                                            <div style={{ fontSize: '0.68rem', color: themeStyles.textMuted }}>{act.user_email}</div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {act.technology}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: themeStyles.textMain, fontWeight: '600' }}>
                                                        {act.lead_emails || 'No active lead!'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                background: isUserActive(act.last_active_at) ? '#10b981' : themeStyles.textMuted,
                                                                boxShadow: isUserActive(act.last_active_at) ? '0 0 8px #10b981' : 'none'
                                                            }} />
                                                            <span style={{ color: isUserActive(act.last_active_at) ? '#10b981' : themeStyles.textMuted, fontSize: '0.75rem', fontWeight: '600' }}>
                                                                {isUserActive(act.last_active_at) ? 'Online' : (act.last_active_at === 'Never' ? 'Pending' : act.last_active_at)}
                                                            </span>
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
                )}

                {/* ======================================================================== */}
                {/* ======================================================================== */}
                {/* TAB 3B: PRIVILEGE ALLOCATION */}
                {activeTab === 'privilege-allocation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Page Header */}
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.5px' }}>User Management (Privileges)</h1>
                            <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, margin: '5px 0 0 0' }}>Configure technology-specific access and user roles.</p>
                        </div>

                        {/* Grant New Privilege Card */}
                        <div style={{
                            background: themeStyles.cardBg,
                            border: themeStyles.cardBorder,
                            borderRadius: '14px',
                            padding: '1.5rem 1.75rem'
                        }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: themeStyles.textMain, margin: '0 0 1rem 0' }}>Grant New Privilege</h3>
                            <form onSubmit={handleAssignPermission}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    {/* Email */}
                                    <input
                                        type="email"
                                        placeholder="Lead Email (e.g. user@gmail.com)"
                                        value={permEmail}
                                        onChange={e => setPermEmail(e.target.value)}
                                        required
                                        style={{
                                            flex: '1',
                                            minWidth: '220px',
                                            padding: '9px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none'
                                        }}
                                    />

                                    {/* Technology multi-select (shown as dropdown toggle) */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowTechDropdown(prev => !prev)}
                                            style={{
                                                padding: '9px 14px',
                                                borderRadius: '8px',
                                                background: themeStyles.inputBg,
                                                border: themeStyles.inputBorder,
                                                color: selectedPermTechs.length > 0 ? themeStyles.textMain : themeStyles.textMuted,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                minWidth: '190px',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <span>
                                                {selectedPermTechs.length === 0
                                                    ? 'Select Technologies'
                                                    : selectedPermTechs.length === 1
                                                        ? selectedPermTechs[0]
                                                        : `${selectedPermTechs.length} Technologies`}
                                            </span>
                                            <ChevronDown size={13} />
                                        </button>
                                        {showTechDropdown && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '110%',
                                                left: 0,
                                                zIndex: 200,
                                                background: isLight ? '#fff' : '#1a1f35',
                                                border: themeStyles.cardBorder,
                                                borderRadius: '10px',
                                                padding: '10px 14px',
                                                minWidth: '190px',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                                            }}>
                                                {AVAILABLE_TECHS.map(tech => {
                                                    const isSel = selectedPermTechs.includes(tech);
                                                    return (
                                                        <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer', fontSize: '0.83rem', color: themeStyles.textMain }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSel}
                                                                onChange={() => {
                                                                    if (isSel) {
                                                                        if (selectedPermTechs.length > 1) setSelectedPermTechs(selectedPermTechs.filter(t => t !== tech));
                                                                    } else {
                                                                        setSelectedPermTechs([...selectedPermTechs, tech]);
                                                                    }
                                                                }}
                                                                style={{ accentColor: '#ffaa00', width: '14px', height: '14px' }}
                                                            />
                                                            {tech}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Role */}
                                    <select
                                        value={permRole}
                                        onChange={e => setPermRole(e.target.value)}
                                        style={{
                                            padding: '9px 14px',
                                            borderRadius: '8px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.82rem',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            minWidth: '140px'
                                        }}
                                    >
                                        <option value="user">Regular User</option>
                                        <option value="lead">Technology Lead</option>
                                        <option value="admin">System Admin</option>
                                    </select>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        style={{
                                            padding: '9px 22px',
                                            background: '#ffaa00',
                                            color: '#000',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '800',
                                            fontSize: '0.84rem',
                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                            whiteSpace: 'nowrap',
                                            opacity: isLoading ? 0.7 : 1,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {isLoading ? 'Assigning...' : 'Assign Privilege'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Active Assignments Table */}
                        <div style={{
                            background: themeStyles.cardBg,
                            border: themeStyles.cardBorder,
                            borderRadius: '14px',
                            overflow: 'hidden'
                        }}>
                            {/* Table toolbar */}
                            <div style={{
                                padding: '14px 20px',
                                borderBottom: themeStyles.rowBorder,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '10px'
                            }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: themeStyles.textMain, margin: 0 }}>
                                    Active Assignments
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.78rem', color: themeStyles.textMuted, fontWeight: '600' }}>
                                        {filteredPermissions.length} Records Found
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={permissionsSearch}
                                        onChange={e => setPermissionsSearch(e.target.value)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '7px',
                                            background: themeStyles.inputBg,
                                            border: themeStyles.inputBorder,
                                            color: themeStyles.textMain,
                                            fontSize: '0.78rem',
                                            outline: 'none',
                                            width: '150px'
                                        }}
                                    />
                                    <button
                                        onClick={fetchPermissionsList}
                                        style={{ padding: '6px 10px', background: 'none', border: themeStyles.inputBorder, borderRadius: '7px', color: themeStyles.textMain, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                        <RefreshCw size={13} className={isLoading ? 'spin-anim' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder }}>
                                            {['Email Address', 'Technology', 'Status', 'Added On', 'Actions'].map((h, i) => (
                                                <th key={i} style={{
                                                    padding: '11px 18px',
                                                    fontSize: '0.68rem',
                                                    fontWeight: '800',
                                                    color: themeStyles.textMuted,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                    whiteSpace: 'nowrap'
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPermissions.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2.5rem', textAlign: 'center', color: themeStyles.textMuted, fontSize: '0.85rem' }}>
                                                    No privilege scopes configured yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPermissions.map(item => {
                                                const isActive = item.status === 'active' || item.status === 'Active';

                                                // Tech badge color map
                                                const techColors = {
                                                    'Global': { bg: 'rgba(255,170,0,0.15)', color: '#ffaa00' },
                                                    'MSSQL':  { bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
                                                    'MySQL':  { bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
                                                    'MongoDB':{ bg: 'rgba(52,211,153,0.15)', color: '#34d399' },
                                                    'PostgreSQL': { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
                                                    'Oracle': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
                                                };

                                                // Role badge
                                                const roleLabel = (item.role === 'admin' ? 'admin' : (item.is_lead || item.role === 'lead' ? 'lead' : 'user')).toUpperCase();
                                                const roleBadge = {
                                                    'ADMIN': { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
                                                    'LEAD':  { bg: 'rgba(168,85,247,0.18)', color: '#a855f7' },
                                                    'USER':  { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' },
                                                };
                                                const rb = roleBadge[roleLabel] || roleBadge['USER'];

                                                // Parse techs
                                                const techs = (item.technology || '').split(',').map(t => t.trim()).filter(Boolean);

                                                return (
                                                    <tr key={item.id} style={{ borderBottom: themeStyles.rowBorder }} className="table-row-hover">
                                                        {/* Email */}
                                                        <td style={{ padding: '13px 18px', color: themeStyles.textMain, fontWeight: '600', fontSize: '0.85rem' }}>
                                                            {item.email}
                                                        </td>

                                                        {/* Technology + Role badge */}
                                                        <td style={{ padding: '13px 18px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                {techs.map((tech, idx) => {
                                                                    const tc = techColors[tech] || { bg: 'rgba(255,170,0,0.12)', color: '#ffaa00' };
                                                                    return (
                                                                        <span key={idx} style={{
                                                                            fontSize: '0.72rem',
                                                                            fontWeight: '800',
                                                                            background: tc.bg,
                                                                            color: tc.color,
                                                                            padding: '2px 8px',
                                                                            borderRadius: '5px',
                                                                            letterSpacing: '0.03em'
                                                                        }}>{tech}</span>
                                                                    );
                                                                })}
                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: '800',
                                                                    background: rb.bg,
                                                                    color: rb.color,
                                                                    padding: '2px 7px',
                                                                    borderRadius: '5px',
                                                                    letterSpacing: '0.04em'
                                                                }}>{roleLabel}</span>
                                                            </div>
                                                        </td>

                                                        {/* Status */}
                                                        <td style={{ padding: '13px 18px' }}>
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: '800',
                                                                padding: '3px 10px',
                                                                borderRadius: '5px',
                                                                letterSpacing: '0.05em',
                                                                background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: isActive ? '#10b981' : '#ef4444'
                                                            }}>
                                                                {isActive ? 'ACTIVE' : 'REMOVED'}
                                                            </span>
                                                        </td>

                                                        {/* Added On */}
                                                        <td style={{ padding: '13px 18px', color: themeStyles.textMuted, fontSize: '0.8rem' }}>
                                                            {item.created_at || '—'}
                                                        </td>

                                                        {/* Actions */}
                                                        <td style={{ padding: '13px 18px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                                {isActive ? (
                                                                    <button
                                                                        onClick={() => handleTogglePermissionStatus(item.id)}
                                                                        style={{
                                                                            padding: '5px 14px',
                                                                            background: '#ffaa00',
                                                                            color: '#000',
                                                                            border: 'none',
                                                                            borderRadius: '6px',
                                                                            fontWeight: '800',
                                                                            fontSize: '0.75rem',
                                                                            cursor: 'pointer',
                                                                            whiteSpace: 'nowrap'
                                                                        }}
                                                                    >
                                                                        Revoke Access
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleTogglePermissionStatus(item.id)}
                                                                        style={{
                                                                            padding: '5px 14px',
                                                                            background: 'transparent',
                                                                            color: '#10b981',
                                                                            border: '1.5px solid #10b981',
                                                                            borderRadius: '6px',
                                                                            fontWeight: '800',
                                                                            fontSize: '0.75rem',
                                                                            cursor: 'pointer',
                                                                            whiteSpace: 'nowrap'
                                                                        }}
                                                                    >
                                                                        Reactivate
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeletePermission(item.id)}
                                                                    style={{
                                                                        padding: '5px 14px',
                                                                        background: '#ef4444',
                                                                        color: '#fff',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontWeight: '800',
                                                                        fontSize: '0.75rem',
                                                                        cursor: 'pointer',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'client-database' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        
                        {/* Heading */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.75px' }}>Client Management</h1>
                                <p style={{ fontSize: '0.85rem', color: themeStyles.textMuted, margin: '6px 0 0 0' }}>Register clients, configure database routing, and manage business units.</p>
                            </div>
                        </div>

                        {/* Client-Database KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                            {[
                                { title: 'Registered Clients', count: clientsList.length, icon: <Users size={20} color="#ffaa00" />, desc: 'Registered corporations', gradient: 'linear-gradient(135deg, rgba(255, 170, 0, 0.08) 0%, rgba(255, 170, 0, 0.02) 100%)', border: 'rgba(255,170,0,0.15)' },
                                { title: 'Business Units', count: buList.length, icon: <Briefcase size={20} color="#34d399" />, desc: 'Organizational sectors', gradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.08) 0%, rgba(52, 211, 153, 0.02) 100%)', border: 'rgba(52,211,153,0.15)' },
                                { title: 'Environment Mappings', count: clientAccessList.length, icon: <Database size={20} color="#38bdf8" />, desc: 'Client email to server maps', gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(56, 189, 248, 0.02) 100%)', border: 'rgba(56,189,248,0.15)' }
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

                        {/* SECTION 1: Client & Business Unit Directories (Grid of 2 columns) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
                            {/* Manage Company Clients */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
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
                                            {editingClient ? 'Edit Company Client' : 'Register Company Client'}
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>
                                            {editingClient ? `Editing client ID: ${editingClient.id}` : 'Register database client details'}
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem', flexShrink: 0 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Company Name</label>
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
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Client Email Address</label>
                                        <input
                                            type="text"
                                            placeholder="Alert emails (comma-separated: a@co.com, b@co.com)..."
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
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Client Phone Number</label>
                                        <input
                                            type="text"
                                            placeholder="Contact phone number (optional)..."
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

                                    {/* Multi-Technology Selector Pills */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
                                            Database Technologies (Multi-Select)
                                        </label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '10px' }}>
                                            {AVAILABLE_TECHS.map(tech => {
                                                const isSelected = selectedTechs.includes(tech);
                                                return (
                                                    <button
                                                        key={tech}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                if (selectedTechs.length > 1) {
                                                                    setSelectedTechs(selectedTechs.filter(t => t !== tech));
                                                                }
                                                            } else {
                                                                setSelectedTechs([...selectedTechs, tech]);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '5px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: '800',
                                                            cursor: 'pointer',
                                                            border: isSelected ? '1px solid #ffaa00' : themeStyles.rowBorder,
                                                            background: isSelected ? 'rgba(255, 170, 0, 0.15)' : 'transparent',
                                                            color: isSelected ? '#ffaa00' : themeStyles.textMuted,
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {tech}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {editingClient ? (
                                        <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
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
                                                marginTop: '6px',
                                                boxShadow: '0 2px 4px rgba(255,170,0,0.2)'
                                            }}
                                        >
                                            Add Company Client
                                        </button>
                                    )}
                                </form>
                            </div>

                            {/* Manage Business Units */}
                            <div style={{
                                background: themeStyles.cardBg,
                                border: themeStyles.cardBorder,
                                borderRadius: '20px',
                                padding: '2rem',
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

                                <div className="custom-scrollbar" style={{ flex: 1, maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
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
                                                    e.currentTarget.style.background = isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.01)';
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
                        </div>

                        {/* Company Clients Directory */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', marginBottom: '1.25rem' }}>Registered Company Clients Directory</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder, color: themeStyles.textMuted }}>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Company Name</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Technologies</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Email Contact</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Phone</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientsList.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>No company clients registered.</td>
                                            </tr>
                                        ) : (
                                            clientsList.map(client => (
                                                <tr key={client.id} style={{ borderBottom: themeStyles.rowBorder }}>
                                                    <td style={{ padding: '14px 16px', fontWeight: '700', color: themeStyles.textMain }}>{client.client_name}</td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {client.db_type?.split(',').map((tech, idx) => (
                                                            <span key={idx} style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', marginRight: '5px' }}>
                                                                {tech.trim()}
                                                            </span>
                                                        ))}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: themeStyles.textMain }}>{client.client_email || 'N/A'}</td>
                                                    <td style={{ padding: '14px 16px', color: themeStyles.textMuted }}>{client.phone_number || 'N/A'}</td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleEditClientClick(client)}
                                                                style={{ padding: '4px 8px', background: 'none', border: themeStyles.inputBorder, color: themeStyles.textMain, borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClient(client.id)}
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

                        {/* Client-Database Access Mappings (Oversight Center) */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffaa00', margin: 0 }}>Client-Database Environment Routing</h3>
                                    <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>Map client emails to database technologies, companies, and servers.</p>
                                </div>
                            </div>

                            {/* Assign Mappings Form */}
                            <form onSubmit={handleAddClientAccess} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', background: themeStyles.rowBg, padding: '1.25rem', borderRadius: '10px', border: themeStyles.rowBorder }}>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Client Email</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. client@corp.com" 
                                        value={mapClientEmail}
                                        onChange={e => setMapClientEmail(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.8rem', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Technology</label>
                                    <select 
                                        required 
                                        value={mapClientTech}
                                        onChange={e => {
                                            setMapClientTech(e.target.value);
                                            setMapClientName('');
                                            setMapClientServer('');
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.8rem', outline: 'none' }}
                                    >
                                        <option value="">Select Tech</option>
                                        {clientFilters.db_types?.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Client Name</label>
                                    <select 
                                        required 
                                        value={mapClientName}
                                        onChange={e => setMapClientName(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.8rem', outline: 'none' }}
                                    >
                                        <option value="">Select Client</option>
                                        {mappedClientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 150px' }}>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: themeStyles.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Server/Ip</label>
                                    <select 
                                        required 
                                        value={mapClientServer}
                                        onChange={e => setMapClientServer(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.8rem', outline: 'none' }}
                                    >
                                        <option value="">Select Server</option>
                                        {mappedServerOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <button 
                                    type="submit" 
                                    style={{ padding: '10px 20px', background: '#ffaa00', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(255,170,0,0.2)' }}
                                >
                                    Assign Routing
                                </button>
                            </form>

                            {/* Mappings List */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.rowBorder, color: themeStyles.textMuted }}>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Client Email</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Technology</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Client Name</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Server/Ip</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800' }}>Status</th>
                                            <th style={{ padding: '12px 16px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: '800', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientAccessLoading ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>Loading access mappings...</td>
                                            </tr>
                                        ) : clientAccessList.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: themeStyles.textMuted }}>No client access mappings found.</td>
                                            </tr>
                                        ) : (
                                            clientAccessList.map(item => (
                                                <tr key={item.id} style={{ borderBottom: themeStyles.rowBorder }}>
                                                    <td style={{ padding: '14px 16px', fontWeight: '700', color: themeStyles.textMain }}>{item.client_email}</td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {item.technology}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: themeStyles.textMain, fontWeight: '600' }}>{item.client_name}</td>
                                                    <td style={{ padding: '14px 16px', color: themeStyles.textMuted }}>{item.server_name}</td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: '800',
                                                            color: item.status === 'enabled' ? '#10b981' : '#ef4444',
                                                            background: item.status === 'enabled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            padding: '3px 8px',
                                                            borderRadius: '6px'
                                                        }}>{item.status}</span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button 
                                                                onClick={() => handleToggleClientAccessStatus(item)}
                                                                style={{ padding: '4px 8px', background: 'none', border: themeStyles.inputBorder, color: themeStyles.textMain, borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700', transition: 'all 0.2s' }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                                                            >
                                                                Toggle
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteClientAccess(item)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.2s' }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
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

                    </div>
                )}


                {/* ======================================================================== */}
                {/* TAB 4: SECURE FIREWALL & API ACCESS CONTROL CENTER */}
                {/* ======================================================================== */}
                

                {/* ======================================================================== */}
                {/* TAB 5: SLA ALERTS BROADCAST CENTER & TECH MATRIX */}
                {/* ======================================================================== */}
                

                {/* ======================================================================== */}
                {/* TAB 6: TELEMETRY ACTIVITY AUDITS & DATABASE MAINTENANCE SUITE */}
                {/* ======================================================================== */}
                

                

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

                {/* =========================================== */}
                {/* USER AUDIT LOGS / TELEMETRY PANEL           */}
                {/* =========================================== */}
                {activeTab === 'user-telemetry' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: '0 0 4px 0' }}>User Activity Audit Logs</h2>
                                <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, margin: 0 }}>
                                    Track session duration, navigation patterns, and active time spent on each portal page by authenticated system operators.
                                </p>
                            </div>
                            <button
                                onClick={fetchTelemetry}
                                style={{
                                    padding: '10px 16px',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: themeStyles.textMain,
                                    border: themeStyles.inputBorder,
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <RefreshCw size={14} />
                                <span>Refresh Logs</span>
                            </button>
                        </div>

                        {/* Search & Filter Controls */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="Search by username or page path..."
                                    value={telemetrySearch}
                                    onChange={(e) => setTelemetrySearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        background: themeStyles.cardBg,
                                        border: themeStyles.inputBorder,
                                        color: themeStyles.textMain,
                                        fontSize: '0.85rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Audit Table Card */}
                        <div style={{ background: themeStyles.cardBg, border: themeStyles.cardBorder, borderRadius: '16px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: themeStyles.cardBorder, color: themeStyles.textMuted }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left' }}>Operator Username</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left' }}>Accessed Page Path</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Time Spent</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Last Activity Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTelemetry.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '4rem', textAlign: 'center', color: themeStyles.textMuted }}>
                                                    No audit trail found matching the search criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTelemetry.map((item, idx) => {
                                                const formatTime = (secs) => {
                                                    if (!secs) return '0s';
                                                    const h = Math.floor(secs / 3600);
                                                    const m = Math.floor((secs % 3600) / 60);
                                                    const s = secs % 60;
                                                    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
                                                };
                                                const formattedDate = item.last_active_at 
                                                    ? new Date(item.last_active_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                                                    : 'N/A';

                                                return (
                                                    <tr key={idx} style={{ 
                                                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                                                    }}>
                                                        <td style={{ padding: '14px 16px', fontWeight: '700', color: themeStyles.accentColor }}>
                                                            {item.username}
                                                        </td>
                                                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: themeStyles.textMuted }}>
                                                            {item.page_path}
                                                        </td>
                                                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }}>
                                                            {formatTime(item.duration_seconds)}
                                                        </td>
                                                        <td style={{ padding: '14px 16px', textAlign: 'right', color: themeStyles.textMuted }}>
                                                            {formattedDate}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
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
