import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as echarts from 'echarts/core';
import {
    PieChart,
    BarChart,
    LineChart,
    HeatmapChart,
    FunnelChart
} from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    VisualMapComponent,
    DatasetComponent,
    TransformComponent
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    TitleComponent, TooltipComponent, GridComponent, LegendComponent,
    VisualMapComponent, DatasetComponent, TransformComponent,
    PieChart, BarChart, LineChart, HeatmapChart, FunnelChart,
    LabelLayout, UniversalTransition, CanvasRenderer
]);

import { useAuth, api } from './AuthContext';
import { ThemeContext } from './ThemeContext';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw, Download, AlertTriangle, CheckCircle, Clock,
    Activity, ShieldAlert, TrendingUp, Users, Layers,
    Sliders, Calendar, ChevronUp, Database, Sun, Moon
} from 'lucide-react';
import './ObservabilityDashboard.css';

// ─────────────────────────────────────────────────────────────────────────────
// ReactECharts — stable wrapper, no unnecessary re-inits
// ─────────────────────────────────────────────────────────────────────────────
const ReactECharts = React.memo(({ option, style }) => {
    const containerRef = useRef(null);
    const instanceRef = useRef(null);

    // Init once
    useEffect(() => {
        if (!containerRef.current) return;
        instanceRef.current = echarts.init(containerRef.current);

        const onResize = () => instanceRef.current?.resize();
        const ro = new ResizeObserver(onResize);
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            instanceRef.current?.dispose();
            instanceRef.current = null;
        };
    }, []);

    // Update options separately — never re-init
    useEffect(() => {
        if (!instanceRef.current || !option || !Object.keys(option).length) return;
        instanceRef.current.setOption(option, { notMerge: false, lazyUpdate: true });
    }, [option]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', minHeight: 280, ...style }}
        />
    );
});
ReactECharts.displayName = 'ReactECharts';

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const ObservabilityDashboard = () => {
    const { user, token } = useAuth();
    const { theme, toggleTheme } = React.useContext(ThemeContext);
    const isDarkMode = theme === 'dark';
    const navigate = useNavigate();

    // ── 1. FILTER STATE ──────────────────────────────────────────────────────
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedTechnology, setSelectedTechnology] = useState('All Technologies');
    const [selectedClient, setSelectedClient] = useState('All Clients');
    const [selectedServer, setSelectedServer] = useState('All Servers');
    const [selectedSeverity, setSelectedSeverity] = useState('All Severities');
    const [selectedStatus, setSelectedStatus] = useState('All Statuses');
    const [selectedOwner, setSelectedOwner] = useState('All Owners');
    const [selectedLogType, setSelectedLogType] = useState('All Log Types');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [timeRange, setTimeRange] = useState(() => {
        const hour = new Date().getHours();
        return (hour >= 8 && hour < 20) ? '8am' : '8pm';
    });
    const [shiftStatusMessage, setShiftStatusMessage] = useState(null);

    useEffect(() => {
        const now = new Date();
        const nowHour = now.getHours();
        const isToday = selectedDate === now.toISOString().split('T')[0];

        let statusMsg = null;
        if (['8am', '8pm'].includes(timeRange) && isToday) {
            if (timeRange === '8pm' && nowHour < 20) {
                statusMsg = "This shift is currently in progress. Day logs (8 AM - 8 PM) will be automatically finalized and visible tonight @ 8:00 PM.";
            } else if (timeRange === '8am' && nowHour < 8) {
                statusMsg = "This shift is currently in progress. Night logs (8 PM yesterday - 8 AM today) will be automatically finalized and visible @ 8:00 AM.";
            }
        }
        setShiftStatusMessage(statusMsg);
    }, [timeRange, selectedDate]);

    // ── 2. COMPONENT FLOW & AUTO-REFRESH ─────────────────────────────────────
    const [activeTab, setActiveTab] = useState('overview');
    const [refreshInterval, setRefreshInterval] = useState(60);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [showScrollTop, setShowScrollTop] = useState(false);

    // ── 3. DATA STATE ────────────────────────────────────────────────────────
    const [filterOptions, setFilterOptions] = useState({
        db_types: [], clients: [], client_server_map: {},
        db_client_map: {}, db_server_map: {}, server_logtype_map: {}
    });
    const [overviewData, setOverviewData] = useState(null);
    const [executiveSummary, setExecutiveSummary] = useState(null);
    const [statusDistribution, setStatusDistribution] = useState({});
    const [severityDistribution, setSeverityDistribution] = useState({});
    const [clientHealth, setClientHealth] = useState([]);
    const [serverHealth, setServerHealth] = useState([]);
    const [clientHeatmap, setClientHeatmap] = useState([]);
    const [serverHeatmap, setServerHeatmap] = useState([]);
    const [workflowData, setWorkflowData] = useState({});
    const [bottleneckData, setBottleneckData] = useState([]);
    const [agingData, setAgingData] = useState({});
    const [trendsData, setTrendsData] = useState([]);
    const [ownersData, setOwnersData] = useState([]);
    const [criticalIssues, setCriticalIssues] = useState([]);
    const [recurringIssues, setRecurringIssues] = useState([]);
    const [mttrData, setMttrData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ownersList, setOwnersList] = useState([]);
    // FIX: Use a ref for loadedTabs to avoid it being a reactive dep that
    // triggers re-renders and re-fetches in a loop.
    const loadedTabsRef = useRef({});

    // ── 4. DATE PARAMS ───────────────────────────────────────────────────────
    const dateParams = useMemo(() => {
        const now = new Date();
        const isToday = selectedDate === now.toISOString().split('T')[0];

        if (timeRange === 'custom') {
            return {
                start_date: customStart ? customStart.replace('T', ' ') : null,
                end_date: customEnd ? customEnd.replace('T', ' ') : null
            };
        }

        if (['8am', '8pm', 'all_day'].includes(timeRange)) {
            const [yr, mo, dy] = selectedDate.split('-');
            const pad = n => String(n).padStart(2, '0');

            // Previous day
            const prevDate = new Date(`${selectedDate}T12:00:00`); // noon avoids DST issues
            prevDate.setDate(prevDate.getDate() - 1);
            const prevYr = prevDate.getFullYear();
            const prevMo = pad(prevDate.getMonth() + 1);
            const prevDy = pad(prevDate.getDate());

            if (timeRange === '8am') {
                return {
                    start_date: `${prevYr}-${prevMo}-${prevDy} 19:50:00`,
                    end_date: `${yr}-${mo}-${dy} 08:00:00`
                };
            } else if (timeRange === '8pm') {
                return {
                    start_date: `${yr}-${mo}-${dy} 07:50:00`,
                    end_date: `${yr}-${mo}-${dy} 20:00:00`
                };
            } else { // all_day
                return {
                    start_date: `${prevYr}-${prevMo}-${prevDy} 19:50:00`,
                    end_date: `${yr}-${mo}-${dy} 20:00:00`
                };
            }
        }

        const start = new Date();
        if (timeRange === '7d') start.setDate(now.getDate() - 7);
        else if (timeRange === '30d') start.setDate(now.getDate() - 30);
        else if (timeRange === '90d') start.setDate(now.getDate() - 90);

        const pad = n => String(n).padStart(2, '0');
        const format = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        return { start_date: format(start), end_date: format(now) };
    }, [timeRange, customStart, customEnd, selectedDate]);

    // ── 5. QUERY BUILDER ─────────────────────────────────────────────────────
    // Use a ref so getQueryParams is stable and doesn't bust downstream deps.
    const filtersRef = useRef({});
    filtersRef.current = {
        dateParams, selectedTechnology, selectedClient, selectedServer,
        selectedSeverity, selectedStatus, selectedOwner, selectedLogType,
        timeRange
    };

    const getQueryParams = useCallback(() => {
        const f = filtersRef.current;
        const p = { start_date: f.dateParams.start_date, end_date: f.dateParams.end_date };
        if (f.selectedTechnology !== 'All Technologies') p.technology = f.selectedTechnology;
        if (f.selectedClient !== 'All Clients') p.client = f.selectedClient;
        if (f.selectedServer !== 'All Servers') p.server = f.selectedServer;
        if (f.selectedSeverity !== 'All Severities') p.severity = [f.selectedSeverity];
        if (f.selectedStatus !== 'All Statuses') p.status = [f.selectedStatus];
        if (f.selectedOwner !== 'All Owners') p.owner = f.selectedOwner;
        if (f.selectedLogType !== 'All Log Types') p.log_type = [f.selectedLogType];
        return p;
    }, []); // stable — reads from ref

    // ── 6. FETCH CORE METRICS ────────────────────────────────────────────────
    const fetchCoreMetrics = useCallback(async (params, isSilent = false) => {
        if (!isSilent) setLoading(true);
        setIsRefreshing(true);

        const f = filtersRef.current;
        const isShiftView = ['8am', '8pm', 'all_day'].includes(f.timeRange ?? timeRange);
        
        // When a user selects a specific shift, they expect to see KPIs strictly for that shift.
        // Therefore, include_backlog is FALSE for shift views.
        // It is TRUE for broad open-ended range views (7 Days, 30 Days).
        const overviewParams = { ...params, include_backlog: !isShiftView };

        const settled = await Promise.allSettled([
            api.get('/observability/overview', { params: overviewParams }).then(r => setOverviewData(r.data)),
            api.get('/observability/executive-summary', { params: overviewParams }).then(r => setExecutiveSummary(r.data)),
            api.get('/observability/status', { params }).then(r => setStatusDistribution(r.data.status_distribution || {})),
            api.get('/observability/severity', { params }).then(r => setSeverityDistribution(r.data.severity_distribution || {})),
            api.get('/observability/trends', { params }).then(r => {
                setTrendsData(r.data.trends || []);
                loadedTabsRef.current.trends = true;
            }),
        ]);

        const failedCount = settled.filter(s => s.status === 'rejected').length;
        if (failedCount === settled.length) {
            setError('Dashboard data failed to load. Please refresh.');
        } else if (failedCount > 0) {
            console.warn(`${failedCount} of ${settled.length} dashboard endpoints failed.`);
        }

        loadedTabsRef.current.overview = true;
        setLastUpdated(new Date());
        setLoading(false);
        setIsRefreshing(false);
    }, [timeRange]); // Add timeRange back to dependency array


    // ── 7. FETCH TAB METRICS ─────────────────────────────────────────────────
    const fetchTabMetrics = useCallback(async (tabName, params, force = false) => {
        if (loadedTabsRef.current[tabName] && !force) return;

        try {
            switch (tabName) {
                case 'health': {
                    const [cr, sr] = await Promise.all([
                        api.get('/observability/client-health', { params }),
                        api.get('/observability/server-health', { params }),
                    ]);
                    setClientHealth(cr.data.client_health || []);
                    setServerHealth(sr.data.server_health || []);
                    break;
                }
                case 'heatmaps': {
                    const [ch, sh] = await Promise.all([
                        api.get('/observability/client-heatmap', { params }),
                        api.get('/observability/server-heatmap', { params }),
                    ]);
                    setClientHeatmap(ch.data.client_heatmap || []);
                    setServerHeatmap(sh.data.server_heatmap || []);
                    break;
                }
                case 'workflow': {
                    const [wr, br, ar] = await Promise.all([
                        api.get('/observability/workflow', { params }),
                        api.get('/observability/bottlenecks', { params }),
                        api.get('/observability/aging', { params }),
                    ]);
                    setWorkflowData(wr.data.workflow || {});
                    setBottleneckData(br.data.bottlenecks || []);
                    setAgingData(ar.data.aging || {});
                    break;
                }
                case 'trends': {
                    const mr = await api.get('/observability/mttr', { params });
                    setMttrData(mr.data || null);
                    break;
                }
                case 'critical': {
                    const [cr2, rr, or2] = await Promise.all([
                        api.get('/observability/critical', { params }),
                        api.get('/observability/recurring', { params }),
                        api.get('/observability/owners', { params }),
                    ]);
                    setCriticalIssues(cr2.data.critical_issues || []);
                    setRecurringIssues(rr.data.recurring_issues || []);
                    setOwnersData(or2.data.owners || []);
                    break;
                }
                default: break;
            }
            loadedTabsRef.current[tabName] = true;
        } catch (err) {
            console.error(`Error fetching ${tabName} metrics`, err);
        }
    }, []); // stable — no reactive deps

    const fetchOwnersList = useCallback(async () => {
        if (!token) return;
        try {
            const f = filtersRef.current;
            const params = {
                start_date: f.dateParams.start_date,
                end_date: f.dateParams.end_date,
            };
            // Scope by technology/client/server if selected so list stays relevant
            if (f.selectedTechnology !== 'All Technologies') params.technology = f.selectedTechnology;
            if (f.selectedClient !== 'All Clients') params.client = f.selectedClient;
            if (f.selectedServer !== 'All Servers') params.server = f.selectedServer;

            const res = await api.get('/observability/owners-list', { params });
            setOwnersList(res.data.owners || []);
        } catch (err) {
            console.error('Error fetching owners list', err);
        }
    }, [token]);

    // ── 8. ORCHESTRATOR ──────────────────────────────────────────────────────
    const fetchAllMetrics = useCallback(async (isSilent = false) => {
        if (!token) return;
        setError(null);
        if (!isSilent) loadedTabsRef.current = {};

        // Clear server-side cache when user explicitly triggers a filter change
        // This ensures fresh data, not a cached result from a prior filter combination
        if (!isSilent) {
            try { await api.post('/observability/clear-cache'); } catch (_) {}
        }

        const params = getQueryParams();
        await fetchCoreMetrics(params, isSilent);

        const currentTab = activTabRef.current;
        if (currentTab !== 'overview') {
            await fetchTabMetrics(currentTab, params, isSilent);
        }
    }, [token, getQueryParams, fetchCoreMetrics, fetchTabMetrics]);


    // Stable ref for activeTab so fetchAllMetrics doesn't re-create on tab change
    const activTabRef = useRef(activeTab);
    useEffect(() => { activTabRef.current = activeTab; }, [activeTab]);

    // ── 9. EFFECTS ───────────────────────────────────────────────────────────

    // Load filter dropdowns once
    useEffect(() => {
        if (!token) return;
        api.get('/filters')
            .then(r => setFilterOptions(r.data))
            .catch(err => console.error('Error loading filter options', err));
    }, [token]);

    // Initial data load — runs once when token is ready
    useEffect(() => {
        if (!token) return;
        fetchAllMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Lazy-load tab data on tab switch
    useEffect(() => {
        if (!token || activeTab === 'overview') return;
        fetchTabMetrics(activeTab, getQueryParams());
    }, [activeTab, token]); // intentionally narrow — tab switch only

    // Auto-refresh
    useEffect(() => {
        if (refreshInterval <= 0) return;
        const id = setInterval(() => fetchAllMetrics(true), refreshInterval * 1000);
        return () => clearInterval(id);
    }, [refreshInterval, fetchAllMetrics]);

    // Scroll-to-top button
    useEffect(() => {
        const onScroll = () => setShowScrollTop(window.pageYOffset > 300);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    // Fetch owner list on initial load
    useEffect(() => {
        fetchOwnersList();
    }, [token]); // eslint-disable-line

    // Re-fetch owner list when technology / client / server filter changes
    // so dropdown always shows owners relevant to the current scope
    useEffect(() => {
        fetchOwnersList();
    }, [selectedTechnology, selectedClient, selectedServer]); // eslint-disable-line

    // ── 10. DYNAMIC SELECT OPTIONS ───────────────────────────────────────────
    const filteredClients = useMemo(() => {
        if (selectedTechnology === 'All Technologies') return filterOptions.clients || [];
        return filterOptions.db_client_map[selectedTechnology] || [];
    }, [selectedTechnology, filterOptions]);

    const filteredServers = useMemo(() => {
        if (selectedClient !== 'All Clients') return filterOptions.client_server_map[selectedClient] || [];
        if (selectedTechnology !== 'All Technologies') return filterOptions.db_server_map[selectedTechnology] || [];
        return Object.values(filterOptions.client_server_map).flat().filter((v, i, a) => a.indexOf(v) === i);
    }, [selectedTechnology, selectedClient, filterOptions]);

    const filteredLogTypes = useMemo(() => {
        if (selectedServer !== 'All Servers') return filterOptions.server_logtype_map[selectedServer] || [];
        return Object.values(filterOptions.server_logtype_map).flat().filter((v, i, a) => a.indexOf(v) === i);
    }, [selectedServer, filterOptions]);

    // ── 11. CSV EXPORT ───────────────────────────────────────────────────────
    const exportTableToCSV = (filename, headers, rows) => {
        const csvContent = 'data:text/csv;charset=utf-8,'
            + headers.join(',') + '\n'
            + rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const link = Object.assign(document.createElement('a'), {
            href: encodeURI(csvContent),
            download: `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
        });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── 12. ECHARTS THEME ────────────────────────────────────────────────────
    const themeColors = useMemo(() => ({
        textColor: isDarkMode ? '#e2e8f0' : '#0f172a',
        splitLineColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
        tooltipBg: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)',
        tooltipBorder: isDarkMode ? 'rgba(0,242,255,0.3)' : 'rgba(0,0,0,0.1)',
        palette: ['#00f2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#6366f1', '#ec4899', '#14b8a6']
    }), [isDarkMode]);

    // ── 13. CHART OPTIONS (memoised) ─────────────────────────────────────────
    const statusChartOption = useMemo(() => {
        // Map "None" to "Unassigned" for display, but keep others
        const data = Object.entries(statusDistribution)
            .filter(([name]) => name)
            .map(([name, value]) => ({ 
                name: name === 'None' ? 'Unassigned' : name, 
                value 
            }));
        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor } },
            legend: { orient: 'vertical', right: '5%', top: 'middle', textStyle: { color: themeColors.textColor, fontSize: 11 }, icon: 'circle' },
            series: [{
                name: 'Status Distribution', type: 'pie', radius: ['45%', '70%'], center: ['40%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 6, borderColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 2 },
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold', color: themeColors.textColor } },
                data: data.length ? data : [{ name: 'No Data', value: 0 }]
            }]
        };
    }, [statusDistribution, themeColors, isDarkMode]);

    const severityChartOption = useMemo(() => {
        const data = Object.entries(severityDistribution).map(([name, value]) => ({ name, value }));
        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor } },
            legend: { orient: 'horizontal', bottom: '0', textStyle: { color: themeColors.textColor, fontSize: 11 }, icon: 'circle' },
            series: [{
                name: 'Severity Breakdown', type: 'pie', radius: '55%', center: ['50%', '45%'],
                roseType: 'area', itemStyle: { borderRadius: 8 },
                data: data.length ? data : [{ name: 'No Data', value: 0 }],
                label: { show: true, formatter: '{b}: {c}', color: themeColors.textColor }
            }]
        };
    }, [severityDistribution, themeColors]);

    const buildHealthChartOption = useCallback((rows, nameKey) => ({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor } },
        legend: { textStyle: { color: themeColors.textColor }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: { type: 'category', data: rows.map(r => r[nameKey]), axisLabel: { color: themeColors.textColor, interval: 0, rotate: 15 }, axisLine: { lineStyle: { color: themeColors.splitLineColor } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: themeColors.splitLineColor } }, axisLabel: { color: themeColors.textColor } },
        series: [
            { name: 'Critical', type: 'bar', stack: 'total', color: '#ef4444', data: rows.map(r => r.critical) },
            { name: 'High', type: 'bar', stack: 'total', color: '#f59e0b', data: rows.map(r => r.high) },
            { name: 'Medium', type: 'bar', stack: 'total', color: '#6366f1', data: rows.map(r => r.medium) },
            { name: 'Low', type: 'bar', stack: 'total', color: '#10b981', data: rows.map(r => r.low) },
        ]
    }), [themeColors]);

    const clientHealthChartOption = useMemo(() =>
        buildHealthChartOption(clientHealth.slice(0, 10), 'client_name'),
        [clientHealth, buildHealthChartOption]);

    const serverHealthChartOption = useMemo(() =>
        buildHealthChartOption(serverHealth.slice(0, 10), 'server_name'),
        [serverHealth, buildHealthChartOption]);

    const clientHeatmapChartOption = useMemo(() => {
        const uniqueClients = [...new Set(clientHeatmap.map(i => i.client_name))].slice(0, 10);
        const uniqueStatuses = ['Open', 'Under Review', 'Action Needed from Client', 'Action Needed from DBA', 'Monitoring', 'Resolved', 'Ignored'];
        const data = clientHeatmap.reduce((acc, item) => {
            const ci = uniqueClients.indexOf(item.client_name);
            const si = uniqueStatuses.indexOf(item.status);
            if (ci !== -1 && si !== -1) acc.push([ci, si, item.count]);
            return acc;
        }, []);
        return {
            backgroundColor: 'transparent',
            tooltip: {
                position: 'top', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor },
                formatter: p => `Client: ${uniqueClients[p.data[0]]}<br/>Status: ${uniqueStatuses[p.data[1]]}<br/>Issues: <b>${p.data[2]}</b>`
            },
            grid: { height: '70%', top: '10%', bottom: '20%', left: '15%', right: '5%' },
            xAxis: { type: 'category', data: uniqueClients, splitArea: { show: true }, axisLabel: { color: themeColors.textColor, rotate: 15 }, axisLine: { lineStyle: { color: themeColors.splitLineColor } } },
            yAxis: { type: 'category', data: uniqueStatuses, splitArea: { show: true }, axisLabel: { color: themeColors.textColor } },
            visualMap: {
                min: 0, max: Math.max(...clientHeatmap.map(i => i.count), 10), calculable: true, orient: 'horizontal', left: 'center', bottom: '0%', textStyle: { color: themeColors.textColor },
                inRange: { color: ['rgba(0,242,255,0.05)', '#00f2ff', '#10b981', '#f59e0b', '#ef4444'] }
            },
            series: [{ name: 'Incident Heatmap', type: 'heatmap', data, label: { show: true, color: themeColors.textColor }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
        };
    }, [clientHeatmap, themeColors]);

    const workflowChartOption = useMemo(() => {
        const order = ['None', 'Open', 'Under Review', 'Action Needed from Client', 'Action Needed from DBA', 'Monitoring', 'Resolved'];
        const data = order.map(s => ({ 
            name: s === 'None' ? 'Unassigned' : s, 
            value: workflowData[s] || 0 
        })).filter(d => d.value > 0);
        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor } },
            legend: { bottom: 0, textStyle: { color: themeColors.textColor }, icon: 'circle' },
            series: [{
                name: 'Log Lifecycle Pipeline', type: 'funnel', left: '10%', top: '10%', bottom: '15%', width: '80%',
                min: 0, maxSize: '100%', sort: 'descending', gap: 2,
                label: { show: true, position: 'inside', formatter: '{b}: {c}' },
                labelLine: { show: false }, itemStyle: { opacity: 0.8, borderRadius: 4 },
                data: data.length ? data : [{ name: 'No Active Workflow', value: 0 }]
            }]
        };
    }, [workflowData, themeColors]);

    const trendChartOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor } },
        legend: { textStyle: { color: themeColors.textColor }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: trendsData.map(t => t.date), axisLabel: { color: themeColors.textColor }, axisLine: { lineStyle: { color: themeColors.splitLineColor } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: themeColors.splitLineColor } }, axisLabel: { color: themeColors.textColor } },
        series: [
            { name: 'Active Logs', type: 'line', smooth: true, color: '#00f2ff', data: trendsData.map(t => t.active_logs) },
            { name: 'Resolved Logs', type: 'line', smooth: true, color: '#10b981', data: trendsData.map(t => t.resolved_logs) },
            { name: 'Critical Logs', type: 'line', smooth: true, color: '#ef4444', data: trendsData.map(t => t.critical_logs) },
            { name: 'Unique Issues', type: 'line', smooth: true, color: '#a855f7', data: trendsData.map(t => t.unique_issues) },
        ]
    }), [trendsData, themeColors]);

    const mttrChartOption = useMemo(() => {
        if (!mttrData?.client_mttr?.length) return {};
        const slice = mttrData.client_mttr.slice(0, 10);
        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', backgroundColor: themeColors.tooltipBg, borderColor: themeColors.tooltipBorder, textStyle: { color: themeColors.textColor }, formatter: '{b}: {c} Hours' },
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { type: 'value', splitLine: { lineStyle: { color: themeColors.splitLineColor } }, axisLabel: { color: themeColors.textColor } },
            yAxis: { type: 'category', data: slice.map(c => c.name), axisLabel: { color: themeColors.textColor }, axisLine: { lineStyle: { color: themeColors.splitLineColor } } },
            series: [{ name: 'MTTR (Hours)', type: 'bar', color: '#10b981', data: slice.map(c => c.mttr), label: { show: true, position: 'right', formatter: '{c}h', color: themeColors.textColor } }]
        };
    }, [mttrData, themeColors]);

    const getSparklineOption = useCallback((colorHex, dataList) => ({
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        xAxis: { type: 'category', show: false },
        yAxis: { type: 'value', show: false },
        series: [{
            data: dataList?.length ? dataList : [0, 0, 0, 0, 0, 0, 0],
            type: 'line', smooth: true, symbol: 'none',
            lineStyle: { color: colorHex, width: 1.5 },
            areaStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [{ offset: 0, color: `${colorHex}40` }, { offset: 1, color: `${colorHex}00` }]
                }
            }
        }]
    }), []);

    // Stable sparkline options — only recompute when trendsData changes
    const sparklineTotalLogs = useMemo(() => getSparklineOption('#00f2ff', trendsData.map(t => t.total_logs)), [trendsData, getSparklineOption]);
    const sparklineUniqueIssues = useMemo(() => getSparklineOption('#a855f7', trendsData.map(t => t.unique_issues)), [trendsData, getSparklineOption]);

    // ── 14. SCROLL ───────────────────────────────────────────────────────────
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    // ── 15. RENDER ───────────────────────────────────────────────────────────
    return (
        <div className={`obs-dashboard ${theme === 'dark' ? 'dark-mode' : 'light-mode'}`}>

            {/* STICKY FILTERS */}
            <div className="obs-sticky-filters">
                <div className="obs-filters-grid">

                    <div className="obs-filter-box">
                        <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="obs-filter-select">
                            <option value="8am">8:00 AM Shift</option>
                            <option value="8pm">8:00 PM Shift</option>
                            <option value="all_day">All Day</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {['8am', '8pm', 'all_day'].includes(timeRange) && (
                        <div className="obs-filter-box">
                            <label><Calendar size={12} style={{ marginRight: 4 }} />Select Date</label>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="obs-filter-input" />
                        </div>
                    )}

                    {timeRange === 'custom' && (<>
                        <div className="obs-filter-box">
                            <label>Start Date</label>
                            <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="obs-filter-input" />
                        </div>
                        <div className="obs-filter-box">
                            <label>End Date</label>
                            <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="obs-filter-input" />
                        </div>
                    </>)}

                    <div className="obs-filter-box">
                        <label><Sliders size={12} style={{ marginRight: 4 }} />Technology</label>
                        <select value={selectedTechnology} onChange={e => { setSelectedTechnology(e.target.value); setSelectedClient('All Clients'); setSelectedServer('All Servers'); }} className="obs-filter-select">
                            <option value="All Technologies">All Technologies</option>
                            {filterOptions.db_types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="obs-filter-box">
                        <label>Client</label>
                        <select value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setSelectedServer('All Servers'); }} className="obs-filter-select">
                            <option value="All Clients">All Clients</option>
                            {filteredClients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="obs-filter-box">
                        <label>Server</label>
                        <select value={selectedServer} onChange={e => setSelectedServer(e.target.value)} className="obs-filter-select">
                            <option value="All Servers">All Servers</option>
                            {filteredServers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="obs-filter-box">
                        <label>Severity</label>
                        <select value={selectedSeverity} onChange={e => setSelectedSeverity(e.target.value)} className="obs-filter-select">
                            <option value="All Severities">All Severities</option>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    <div className="obs-filter-box">
                        <label>Owner</label>
                        <select value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)} className="obs-filter-select">
                            <option value="All Owners">All Owners</option>
                            <option value="Unassigned">Unassigned</option>
                            {ownersList.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>

                    <div className="obs-filter-actions">
                        <button onClick={() => fetchAllMetrics()} className="btn btn-glassy-advanced" title="Apply Filters">Apply</button>
                        <button onClick={() => {
                            setTimeRange('7d');
                            setSelectedTechnology('All Technologies');
                            setSelectedClient('All Clients');
                            setSelectedServer('All Servers');
                            setSelectedSeverity('All Severities');
                            setSelectedStatus('All Statuses');
                            setSelectedOwner('All Owners');
                            setSelectedLogType('All Log Types');
                            loadedTabsRef.current = {};
                        }} className="btn btn-secondary" title="Reset Filters">Clear</button>
                    </div>

                </div>
            </div>

            {/* HEADER */}
            <div className="obs-header">
                <div className="obs-header-left">
                    <h1>Observability Analytics Dashboard</h1>
                    <p>Enterprise health, MTTR, deduplication patterns, and workflow bottlenecks</p>
                </div>
                <div className="obs-header-right">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Auto Refresh:</span>
                        <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))} className="obs-filter-select" style={{ width: 100 }}>
                            <option value={0}>Off</option>
                            <option value={30}>30s</option>
                            <option value={60}>1m</option>
                            <option value={300}>5m</option>
                        </select>
                    </div>
                    <button onClick={() => fetchAllMetrics(true)} className="btn btn-icon" disabled={isRefreshing} title="Refresh Dashboard">
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={toggleTheme} className="obs-theme-toggle" title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        {isDarkMode ? (
                            <><Sun size={15} /><span>Light</span></>
                        ) : (
                            <><Moon size={15} /><span>Dark</span></>
                        )}
                    </button>
                    <button onClick={() => navigate('/')} className="btn btn-secondary">Back to Logs</button>
                </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="obs-workspace">
                    <div className="glass p-6 border border-red-500/30 bg-red-950/15 rounded-2xl flex items-center gap-4">
                        <AlertTriangle size={24} className="text-red-500" />
                        <div>
                            <h4 className="font-bold text-red-400">Database Query Failure</h4>
                            <p className="text-sm text-red-300/80 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* WORKSPACE */}
            <div className="obs-workspace">

                {/* EXECUTIVE SUMMARY */}
                {loading ? (
                    <div className="obs-skeleton obs-skeleton-card" />
                ) : executiveSummary && (
                    <div className="obs-summary-panel glass">
                        {[
                            ['Total Incidents Checked', executiveSummary.total_issues, ''],
                            ['Critical Failures', executiveSummary.critical_issues, executiveSummary.critical_issues > 0 ? 'risk-high' : ''],
                            ['Pending Client Actions', executiveSummary.pending_client_actions, executiveSummary.pending_client_actions > 0 ? 'risk-medium' : ''],
                            ['Pending DBA Actions', executiveSummary.pending_dba_actions, ''],
                            ['Overall MTTR', `${executiveSummary.mttr_hours} Hours`, ''],
                            ['Resolution Rate', `${executiveSummary.resolution_rate}%`, ''],
                            ['Highest Risk Client', executiveSummary.highest_risk_client, 'risk-medium'],
                            ['Highest Risk Server', executiveSummary.highest_risk_server, 'risk-medium'],
                        ].map(([label, val, cls]) => (
                            <div className="obs-summary-item" key={label}>
                                <label>{label}</label>
                                <span className={cls}>{val}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* TABS */}
                <div className="obs-nav-tabs">
                    {[
                        ['overview', 'Overview & KPIs'],
                        ['health', 'Client & Server Health'],
                        ['heatmaps', 'Incident Heatmaps'],
                        ['workflow', 'Workflows & SLA Aging'],
                        ['trends', 'Time-Series Trends & MTTR'],
                        ['critical', 'Critical Incidents Center'],
                    ].map(([id, label]) => (
                        <button key={id} className={`obs-tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <>
                        {!overviewData ? (
                            <div className="obs-kpi-grid">
                                {[...Array(8)].map((_, i) => <div key={i} className="obs-skeleton obs-skeleton-card" />)}
                            </div>
                        ) : (
                            <div className="obs-kpi-grid">

                                <div className="obs-kpi-card glass border-cyan-500/20" onClick={() => setSelectedStatus('All Statuses')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Total Logs Analysed</span>
                                        <Activity size={18} className="obs-kpi-icon text-cyan-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.total_logs}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Active occurrences raw counts</div>
                                    <div className="obs-kpi-sparkline">
                                        <ReactECharts option={sparklineTotalLogs} style={{ height: '100%', width: '100%' }} />
                                    </div>
                                </div>

                                <div className="obs-kpi-card glass border-purple-500/20">
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Unique Issue Signatures</span>
                                        <Layers size={18} className="obs-kpi-icon text-purple-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.unique_issues}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Deduplicated log groups</div>
                                    <div className="obs-kpi-sparkline">
                                        <ReactECharts option={sparklineUniqueIssues} style={{ height: '100%', width: '100%' }} />
                                    </div>
                                </div>

                                <div className="obs-kpi-card glass border-emerald-500/20">
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Deduplication Ratio</span>
                                        <TrendingUp size={18} className="obs-kpi-icon text-emerald-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.dedup_ratio}x</span>
                                    </div>
                                    <div className="obs-kpi-footer">Average occurrences per unique issue</div>
                                </div>

                                <div className="obs-kpi-card glass border-slate-500/20" onClick={() => setSelectedStatus('None')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Unassigned</span>
                                        <AlertTriangle size={18} className="obs-kpi-icon text-slate-400" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['None'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">New logs with no lifecycle status</div>
                                </div>

                                <div className="obs-kpi-card glass border-blue-500/20" onClick={() => setSelectedStatus('Open')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Open Status</span>
                                        <Activity size={18} className="obs-kpi-icon text-blue-400" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['Open'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Issues explicitly assigned as Open</div>
                                </div>

                                <div className="obs-kpi-card glass border-amber-500/20" onClick={() => setSelectedStatus('Under Review')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Under Review</span>
                                        <Clock size={18} className="obs-kpi-icon text-amber-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['Under Review'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Assigned logs currently investigated</div>
                                </div>

                                <div className="obs-kpi-card glass border-pink-500/20" onClick={() => setSelectedStatus('Action Needed from Client')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Client Action</span>
                                        <Users size={18} className="obs-kpi-icon text-pink-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['Action Needed from Client'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Awaiting input or fix from client</div>
                                </div>

                                <div className="obs-kpi-card glass border-indigo-500/20" onClick={() => setSelectedStatus('Action Needed from DBA')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">DBA Action</span>
                                        <Database size={18} className="obs-kpi-icon text-indigo-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['Action Needed from DBA'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Escalated database task actions</div>
                                </div>

                                <div className="obs-kpi-card glass border-teal-500/20" onClick={() => setSelectedStatus('Resolved')}>
                                    <div className="obs-kpi-header">
                                        <span className="obs-kpi-title">Resolved</span>
                                        <CheckCircle size={18} className="obs-kpi-icon text-teal-500" />
                                    </div>
                                    <div className="obs-kpi-body">
                                        <span className="obs-kpi-value">{overviewData.status_counts['Resolved'] || 0}</span>
                                    </div>
                                    <div className="obs-kpi-footer">Successfully mitigated issues</div>
                                </div>

                            </div>
                        )}

                        <div className="obs-row">
                            {!statusDistribution || !Object.keys(statusDistribution).length ? (
                                <div className="obs-skeleton obs-skeleton-chart" />
                            ) : (
                                <div className="obs-card glass">
                                    <div className="obs-card-header">
                                        <h3 className="obs-card-title">Incident Status Distribution</h3>
                                    </div>
                                    <div className="obs-chart-container">
                                        <ReactECharts option={statusChartOption} />
                                    </div>
                                </div>
                            )}
                            {!severityDistribution || !Object.keys(severityDistribution).length ? (
                                <div className="obs-skeleton obs-skeleton-chart" />
                            ) : (
                                <div className="obs-card glass">
                                    <div className="obs-card-header">
                                        <h3 className="obs-card-title">Incident Severity Distribution</h3>
                                    </div>
                                    <div className="obs-chart-container">
                                        <ReactECharts option={severityChartOption} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── TAB: HEALTH ── */}
                {activeTab === 'health' && (!loadedTabsRef.current.health ? (
                    <div className="obs-row">
                        <div className="obs-skeleton obs-skeleton-chart" />
                        <div className="obs-skeleton obs-skeleton-chart" />
                    </div>
                ) : (
                    <div className="obs-row">
                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Top 10 Client risk breakdown</h3>
                                <button className="btn btn-secondary btn-icon" onClick={() => exportTableToCSV('client_health_report', ['Client', 'Critical', 'High', 'Medium', 'Low', 'Risk Score'], clientHealth.map(c => [c.client_name, c.critical, c.high, c.medium, c.low, c.risk_score]))}>
                                    <Download size={14} /> Export
                                </button>
                            </div>
                            <div className="obs-chart-container" style={{ height: 250 }}>
                                <ReactECharts option={clientHealthChartOption} />
                            </div>
                            <div style={{ overflowX: 'auto', marginTop: 15 }}>
                                <table className="obs-table">
                                    <thead><tr><th>Client Name</th><th>Unique Issues</th><th>Critical</th><th>High</th><th>Risk Score</th></tr></thead>
                                    <tbody>
                                        {clientHealth.slice(0, 10).map((c, i) => (
                                            <tr key={i}>
                                                <td>{c.client_name}</td>
                                                <td>{c.unique_issues}</td>
                                                <td className="text-red-500 font-bold">{c.critical}</td>
                                                <td className="text-amber-500 font-bold">{c.high}</td>
                                                <td><span className={`risk-score-badge ${c.risk_score > 30 ? 'risk-high-badge' : c.risk_score > 10 ? 'risk-medium-badge' : 'risk-low-badge'}`}>{c.risk_score}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Top 10 Server risk breakdown</h3>
                                <button className="btn btn-secondary btn-icon" onClick={() => exportTableToCSV('server_health_report', ['Server', 'Critical', 'High', 'Medium', 'Low', 'Risk Score'], serverHealth.map(s => [s.server_name, s.critical, s.high, s.medium, s.low, s.risk_score]))}>
                                    <Download size={14} /> Export
                                </button>
                            </div>
                            <div className="obs-chart-container" style={{ height: 250 }}>
                                <ReactECharts option={serverHealthChartOption} />
                            </div>
                            <div style={{ overflowX: 'auto', marginTop: 15 }}>
                                <table className="obs-table">
                                    <thead><tr><th>Server Name</th><th>Unique Issues</th><th>Critical</th><th>High</th><th>Risk Score</th></tr></thead>
                                    <tbody>
                                        {serverHealth.slice(0, 10).map((s, i) => (
                                            <tr key={i}>
                                                <td>{s.server_name}</td>
                                                <td>{s.unique_issues}</td>
                                                <td className="text-red-500 font-bold">{s.critical}</td>
                                                <td className="text-amber-500 font-bold">{s.high}</td>
                                                <td><span className={`risk-score-badge ${s.risk_score > 30 ? 'risk-high-badge' : s.risk_score > 10 ? 'risk-medium-badge' : 'risk-low-badge'}`}>{s.risk_score}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── TAB: HEATMAPS ── */}
                {activeTab === 'heatmaps' && (!loadedTabsRef.current.heatmaps ? (
                    <div className="obs-row full">
                        <div className="obs-skeleton obs-skeleton-chart" style={{ height: 400 }} />
                    </div>
                ) : (
                    <div className="obs-row full">
                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Incident Heatmap (Clients × Workflows)</h3>
                            </div>
                            <div className="obs-chart-container" style={{ height: 400 }}>
                                {clientHeatmap.length > 0
                                    ? <ReactECharts option={clientHeatmapChartOption} />
                                    : <div className="obs-empty-state">No client heatmap coordinate data available.</div>
                                }
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── TAB: WORKFLOW ── */}
                {activeTab === 'workflow' && (!loadedTabsRef.current.workflow ? (
                    <div className="obs-row">
                        <div className="obs-skeleton obs-skeleton-chart" />
                        <div className="obs-skeleton obs-skeleton-chart" />
                        <div className="obs-skeleton obs-skeleton-card" style={{ gridColumn: '1 / -1' }} />
                    </div>
                ) : (
                    <div className="obs-row">
                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Incident funnel pipeline</h3>
                            </div>
                            <div className="obs-chart-container">
                                <ReactECharts option={workflowChartOption} />
                            </div>
                        </div>

                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Workflow bottlenecks</h3>
                            </div>
                            <div className="obs-bottlenecks-list">
                                {bottleneckData.length > 0 ? bottleneckData.map((b, i) => (
                                    <div key={i} className={`obs-bottleneck-row ${b.avg_wait_hours > 48 ? 'obs-bottleneck-alert' : ''}`}>
                                        <div className="obs-bottleneck-info">
                                            <h4>{b.status}</h4>
                                            <p>{b.count} issues active ({b.percentage}%)</p>
                                        </div>
                                        <div className="obs-bottleneck-stats">
                                            <div className="obs-bottleneck-wait">{b.avg_wait_hours} Hrs</div>
                                            <label className="text-xs text-muted">Avg Queue Duration</label>
                                        </div>
                                    </div>
                                )) : <div className="obs-empty-state">No bottleneck queue data found for filters.</div>}
                            </div>
                        </div>

                        <div className="obs-card glass" style={{ gridColumn: '1 / -1' }}>
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">SLA Aging Violations (Pending Queue Checks)</h3>
                            </div>
                            <div className="obs-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                                {[
                                    ['Open > 24 Hrs', agingData.open_24h || 0, 'border-red-500/20', 'text-red-400'],
                                    ['Open > 48 Hrs', agingData.open_48h || 0, 'border-red-500/20', 'text-red-500'],
                                    ['Open > 7 Days', agingData.open_7d || 0, 'border-red-500/20', 'text-red-600'],
                                    ['Review > 3 Days', agingData.review_3d || 0, 'border-amber-500/20', 'text-amber-500'],
                                    ['Client Action > 7d', agingData.client_7d || 0, 'border-pink-500/20', 'text-pink-500'],
                                    ['DBA Action > 7d', agingData.dba_7d || 0, 'border-indigo-500/20', 'text-indigo-500'],
                                ].map(([title, val, border, color]) => (
                                    <div key={title} className={`obs-kpi-card glass ${border}`}>
                                        <span className="obs-kpi-title">{title}</span>
                                        <span className={`obs-kpi-value ${color} mt-2 block`}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── TAB: TRENDS ── */}
                {activeTab === 'trends' && (!loadedTabsRef.current.trends ? (
                    <div className="obs-row">
                        <div className="obs-skeleton obs-skeleton-chart" style={{ gridColumn: '1 / -1', height: 400 }} />
                        <div className="obs-skeleton obs-skeleton-chart" />
                        <div className="obs-skeleton obs-skeleton-chart" />
                    </div>
                ) : (
                    <div className="obs-row">
                        <div className="obs-card glass" style={{ gridColumn: '1 / -1' }}>
                            <div className="obs-card-header">
                                <h3 className="obs-card-title"><TrendingUp size={18} /> Incident Volume & Trends</h3>
                            </div>
                            <div className="obs-chart-container">
                                <ReactECharts option={trendChartOption} />
                            </div>
                        </div>

                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Mean Time To Resolution (Client Breakdown)</h3>
                            </div>
                            <div className="obs-chart-container">
                                {mttrData?.client_mttr?.length
                                    ? <ReactECharts option={mttrChartOption} />
                                    : <div className="obs-empty-state">No resolved incident MTTR logs found for filters.</div>
                                }
                            </div>
                        </div>

                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title">Owner performance leaderboard</h3>
                                <button className="btn btn-secondary btn-icon" onClick={() => exportTableToCSV('owner_performance_leaderboard', ['Owner', 'Assigned', 'Resolved', 'SLA Resolution Rate', 'MTTR Hours'], ownersData.map(o => [o.owner, o.assigned_logs, o.resolved_logs, `${o.resolution_rate}%`, o.avg_resolution_hours]))}>
                                    <Download size={14} /> Export
                                </button>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                                <table className="obs-table">
                                    <thead><tr><th>Owner</th><th>Assigned</th><th>Resolved</th><th>SLA Rate</th><th>MTTR</th></tr></thead>
                                    <tbody>
                                        {ownersData.map((o, i) => (
                                            <tr key={i}>
                                                <td>{o.owner}</td>
                                                <td>{o.assigned_logs}</td>
                                                <td>{o.resolved_logs}</td>
                                                <td className="text-emerald-400 font-bold">{o.resolution_rate}%</td>
                                                <td>{o.avg_resolution_hours} Hrs</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── TAB: CRITICAL ── */}
                {activeTab === 'critical' && (!loadedTabsRef.current.critical ? (
                    <div className="obs-row full">
                        <div className="obs-skeleton obs-skeleton-card" style={{ height: 400 }} />
                        <div className="obs-skeleton obs-skeleton-card" style={{ height: 300, marginTop: 20 }} />
                    </div>
                ) : (
                    <div className="obs-row full">
                        <div className="obs-card glass">
                            <div className="obs-card-header">
                                <h3 className="obs-card-title"><ShieldAlert size={18} /> High-Risk Active & Critical Incidents</h3>
                                <button className="btn btn-secondary btn-icon" onClick={() => exportTableToCSV('critical_incidents_report', ['Client', 'Server', 'Severity', 'Log Type', 'Status', 'Occurrences', 'Owner', 'Last Seen'], criticalIssues.map(c => [c.client_name, c.server_name, c.severity, c.log_type, c.status, c.occurrences, c.owner, c.last_seen]))}>
                                    <Download size={14} /> Export
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="obs-table">
                                    <thead><tr><th>Severity</th><th>Client</th><th>Server</th><th>Log Type</th><th>Occurrences</th><th>Owner</th><th>Status</th><th>Last Seen (IST)</th></tr></thead>
                                    <tbody>
                                        {criticalIssues.length > 0 ? criticalIssues.map((c, i) => (
                                            <tr key={i}>
                                                <td><span className={`risk-score-badge ${c.severity.toLowerCase() === 'critical' ? 'risk-high-badge' : 'risk-medium-badge'}`}>{c.severity}</span></td>
                                                <td>{c.client_name}</td>
                                                <td>{c.server_name}</td>
                                                <td>{c.log_type}</td>
                                                <td className="font-bold">{c.occurrences}</td>
                                                <td>{c.owner || 'Unassigned'}</td>
                                                <td>{c.status}</td>
                                                <td>{c.last_seen}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={8} className="text-center text-muted py-8">No active critical/high severity logs found under current filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="obs-card glass" style={{ marginTop: 20 }}>
                            <div className="obs-card-header">
                                <h3 className="obs-card-title"><Layers size={18} /> Top Recurring Issues Patterns</h3>
                                <button className="btn btn-secondary btn-icon" onClick={() => exportTableToCSV('recurring_patterns_report', ['Log Message', 'Client', 'Server', 'Severity', 'Occurrences', 'Last Seen'], recurringIssues.map(r => [r.log_message, r.client_name, r.server_name, r.severity, r.occurrences, r.last_seen]))}>
                                    <Download size={14} /> Export
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="obs-table">
                                    <thead><tr><th>Occurrences</th><th>Client</th><th>Server</th><th>Severity</th><th>Log Pattern</th><th>Last Seen (IST)</th></tr></thead>
                                    <tbody>
                                        {recurringIssues.slice(0, 15).map((r, i) => (
                                            <tr key={i}>
                                                <td className="font-bold text-cyan-400 text-lg">{r.occurrences}</td>
                                                <td>{r.client_name}</td>
                                                <td>{r.server_name}</td>
                                                <td><span className={`risk-score-badge ${r.severity.toLowerCase() === 'critical' ? 'risk-high-badge' : r.severity.toLowerCase() === 'high' ? 'risk-medium-badge' : 'risk-low-badge'}`}>{r.severity}</span></td>
                                                <td style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.log_message}>{r.log_message}</td>
                                                <td>{r.last_seen}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}

            </div>

            {showScrollTop && (
                <button onClick={scrollToTop} className="obs-scroll-top" title="Scroll to Top">
                    <ChevronUp size={20} />
                </button>
            )}

        </div>
    );
};

export default ObservabilityDashboard;