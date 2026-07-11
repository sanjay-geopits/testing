import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';

// Dynamic dynamic loading / Code splitting optimization
const Login = lazy(() => import('./Login'));
const Dashboard = lazy(() => import('./Dashboard'));
const LeadDashboard = lazy(() => import('./LeadDashboard'));
const LogStatusPage = lazy(() => import('./LogStatusPage'));
const ObservabilityDashboard = lazy(() => import('./ObservabilityDashboard'));

// Old Pages imports (lazy loaded)
const ReportHome = lazy(() => import('./ReportHome'));
const ReportUpload = lazy(() => import('./ReportUpload'));
const ReportDownload = lazy(() => import('./ReportDownload'));
const AdminMonitoring = lazy(() => import('./AdminMonitoring'));
const TicketsHome = lazy(() => import('./TicketsHome'));
const TicketDetails = lazy(() => import('./TicketDetails'));
const NewTicket = lazy(() => import('./NewTicket'));

// New Features imports (lazy loaded)
const Home = lazy(() => import('./new_features/Home'));
const ReportsHub = lazy(() => import('./new_features/ReportsHub'));
const TicketsHub = lazy(() => import('./new_features/TicketsHub'));
const AdminSetup = lazy(() => import('./new_features/AdminSetup'));
const ServerGridPage = lazy(() => import('./new_features/ServerGridPage'));
const TelemetryClients = lazy(() => import('./new_features/TelemetryClients'));
const TelemetryClientDetails = lazy(() => import('./new_features/TelemetryClientDetails'));
const TelemetryClientDatabases = lazy(() => import('./new_features/TelemetryClientDatabases'));
const TelemetryClientTables = lazy(() => import('./new_features/TelemetryClientTables'));
const TelemetryClientUptime = lazy(() => import('./new_features/TelemetryClientUptime'));
const OverallSummaryHub = lazy(() => import('./new_features/OverallSummaryHub'));


// Essential structural wrappers (imported statically for instant wrapper execution)
import PageTracker from './new_features/PageTracker';
import Chatbot from './new_features/Chatbot';

const ProtectedRoute = ({ children }) => {
    const { token, loading } = useAuth();
    
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#020308', color: 'white' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }
    
    if (!token) return <Navigate to="/login" />;
    
    return children;
};

// Premium themed placeholder for dynamically-resolved pages
const PageLoader = () => (
    <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        background: 'radial-gradient(circle at 50% 0%,#0c0f1d,#020308)', 
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif'
    }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ 
                width: 40, 
                height: 40, 
                border: '3px solid rgba(255,255,255,0.05)', 
                borderTopColor: '#3b82f6', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
            }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase' }}>
                Loading Dashboard Console...
            </div>
        </div>
    </div>
);

// Wrapper to inject userId from localStorage for old components
const WithUserId = ({ Component }) => {
    const userId = localStorage.getItem('userId') || '1';
    return <Component userId={userId} />;
};

const AppContent = () => {
    const { token } = useAuth();
    return (
        <PageTracker>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* --- PRIMARY APPLICATION FLOW (LOGIN -> HOME PAGE / NEW FEATURES) --- */}
                    <Route 
                        path="/" 
                        element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports" 
                        element={
                            <ProtectedRoute>
                                <ReportsHub />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports/" 
                        element={
                            <ProtectedRoute>
                                <ReportsHub />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tickets" 
                        element={
                            <ProtectedRoute>
                                <TicketsHub />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tickets/" 
                        element={
                            <ProtectedRoute>
                                <TicketsHub />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin/setup" 
                        element={
                            <ProtectedRoute>
                                <AdminSetup />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/servers" 
                        element={
                            <ProtectedRoute>
                                <ServerGridPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/telemetry-clients" 
                        element={
                            <ProtectedRoute>
                                <TelemetryClients />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/telemetry-client-details/:clientName" 
                        element={
                            <ProtectedRoute>
                                <TelemetryClientDetails />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/telemetry-client-databases/:clientName" 
                        element={
                            <ProtectedRoute>
                                <TelemetryClientDatabases />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/telemetry-client-tables/:clientName" 
                        element={
                            <ProtectedRoute>
                                <TelemetryClientTables />
                            </ProtectedRoute>
                        } 
                    />

                    <Route 
                        path="/telemetry-client-uptime/:clientName" 
                        element={
                            <ProtectedRoute>
                                <TelemetryClientUptime />
                            </ProtectedRoute>
                        } 
                    />



                    {/* --- CLASSIC FLOW & ADDITIONAL PAGES (dashboard, log-status, report templates, ticket details) --- */}
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin" 
                        element={
                            <ProtectedRoute>
                                <AdminSetup />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/lead" 
                        element={
                            <ProtectedRoute>
                                <LeadDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/log-status" 
                        element={
                            <ProtectedRoute>
                                <LogStatusPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/observability" 
                        element={
                            <ProtectedRoute>
                                <ObservabilityDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    {/* Report Management Routes */}
                    <Route 
                        path="/reports/home" 
                        element={
                            <ProtectedRoute>
                                <ReportHome />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports/upload" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={ReportUpload} />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports/download" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={ReportDownload} />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/reports/clients" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={ReportDownload} />
                            </ProtectedRoute>
                        } 
                    />
                    {/* Admin Monitoring Route */}
                    <Route 
                        path="/admin/monitoring" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={AdminMonitoring} />
                            </ProtectedRoute>
                        } 
                    />
                    {/* Support Tickets Routes */}
                    <Route 
                        path="/tickets/home" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={TicketsHome} />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tickets/list" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={TicketsHome} />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tickets/:id" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={TicketDetails} />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tickets/new" 
                        element={
                            <ProtectedRoute>
                                <WithUserId Component={NewTicket} />
                            </ProtectedRoute>
                        } 
                    />
                    
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Suspense>
            {token && <Chatbot />}
        </PageTracker>
    );
};

const App = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <AppContent />
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;
