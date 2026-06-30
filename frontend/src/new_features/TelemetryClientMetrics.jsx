import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, api } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { marked } from 'marked';
import {
    Cpu, Activity, HardDrive, Zap, Calendar, ArrowLeft, RefreshCw, Sparkles, Loader,
    ChevronDown, ChevronUp, Download, Info, CheckCircle, AlertTriangle, ShieldAlert, Sliders
} from 'lucide-react';

import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
    TitleComponent, TooltipComponent, GridComponent, LegendComponent,
    VisualMapComponent, DatasetComponent, TransformComponent
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    TitleComponent, TooltipComponent, GridComponent, LegendComponent,
    VisualMapComponent, DatasetComponent, TransformComponent,
    LineChart, BarChart, LabelLayout, UniversalTransition, CanvasRenderer
]);

// ── ReactECharts Wrapper ───────────────────────────────────────────────────
const ReactECharts = React.memo(({ option, style }) => {
    const containerRef = useRef(null);
    const instanceRef  = useRef(null);

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

    useEffect(() => {
        if (!instanceRef.current || !option || !Object.keys(option).length) return;
        instanceRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
    }, [option]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', minHeight: 320, ...style }}
        />
    );
});
ReactECharts.displayName = 'ReactECharts';

// ── Component ─────────────────────────────────────────────────────────────────
const TelemetryClientMetrics = () => {
    const { clientName } = useParams();
    const navigate       = useNavigate();
    const location       = useLocation();
    const { theme }      = useTheme();
    const isLight        = theme === 'light';

    // Parse query params (e.g. ?tech=MySQL&metric=cpu)
    const searchParams = new URLSearchParams(location.search);
    const techParam = searchParams.get('tech') || '';
    const metricParam = searchParams.get('metric') || '';
    const initialMetric = metricParam ? (metricParam.toLowerCase() === 'io' ? 'iops' : metricParam.toLowerCase()) : 'all';

    // ── Filter Options State ──
    const [filterOptions, setFilterOptions] = useState({
        clients: [],
        client_server_map: {},
        server_db_type_map: {}
    });

    // ── Selection States ──
    const [selectedClient, setSelectedClient] = useState(clientName || '');
    const [selectedServer, setSelectedServer] = useState('');
    const [selectedDbType, setSelectedDbType] = useState('');
    const [timeRange, setTimeRange]           = useState('30d');
    const [customStart, setCustomStart]       = useState('');
    const [customEnd, setCustomEnd]           = useState('');

    // ── Data State ──
    const [historyData, setHistoryData]   = useState([]);
    const [isAws, setIsAws]               = useState(false);
    const [diskNames, setDiskNames]       = useState([]);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState(null);

    // ── Metric Tab & Table State ──
    const [activeMetric, setActiveMetric] = useState(initialMetric || 'all');
    const [showTable, setShowTable]       = useState(true);

    // ── AI Diagnostics ──
    const [aiReport, setAiReport]         = useState('');
    const [aiLoading, setAiLoading]       = useState(false);
    const [showAiPanel, setShowAiPanel]   = useState(false);
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [autoRefreshSecs, setAutoRefreshSecs] = useState(0); // 0 = off
    const [countdown, setCountdown]            = useState(0);

    // ── Filter Options Isolation ──
    const filteredClients = useMemo(() => {
        // If a specific client is requested via route path, lock to that client only
        if (clientName) {
            return filterOptions.clients.filter(c => c.toLowerCase() === clientName.toLowerCase());
        }
        // If tech parameter is provided, show only clients that have servers of that tech/db_type
        if (techParam) {
            return filterOptions.clients.filter(c => {
                const servers = filterOptions.client_server_map[c] || [];
                return servers.some(s => {
                    const dbType = (filterOptions.server_db_type_map[c] || {})[s] || '';
                    return dbType.toLowerCase() === techParam.toLowerCase();
                });
            });
        }
        return filterOptions.clients;
    }, [filterOptions, clientName, techParam]);

    const filteredServers = useMemo(() => {
        const servers = filterOptions.client_server_map[selectedClient] || [];
        // If tech parameter is provided, show only servers of that tech/db_type
        if (techParam) {
            return servers.filter(s => {
                const dbType = (filterOptions.server_db_type_map[selectedClient] || {})[s] || '';
                return dbType.toLowerCase() === techParam.toLowerCase();
            });
        }
        return servers;
    }, [filterOptions, selectedClient, techParam]);

    // ── Fetch Filter Options ──
    useEffect(() => {
        api.get('/new-features/telemetry/utilization/filter-options')
            .then(res => {
                const data = res.data;
                setFilterOptions(data);
                
                // Set initial client based on clientName param or filtered list
                let client = '';
                if (clientName) {
                    client = data.clients.find(c => c.toLowerCase() === clientName.toLowerCase()) || clientName;
                } else if (techParam) {
                    client = data.clients.find(c => {
                        const servers = data.client_server_map[c] || [];
                        return servers.some(s => ((data.server_db_type_map[c] || {})[s] || '').toLowerCase() === techParam.toLowerCase());
                    }) || '';
                } else {
                    client = data.clients[0] || '';
                }
                setSelectedClient(client);
                
                // Set initial server and db type based on client and tech filters
                const servers = data.client_server_map[client] || [];
                const filteredSrvs = techParam
                    ? servers.filter(s => ((data.server_db_type_map[client] || {})[s] || '').toLowerCase() === techParam.toLowerCase())
                    : servers;
                
                if (filteredSrvs.length > 0) {
                    setSelectedServer(filteredSrvs[0]);
                    setSelectedDbType((data.server_db_type_map[client] || {})[filteredSrvs[0]] || '');
                } else {
                    setSelectedServer('');
                    setSelectedDbType('');
                }
            })
            .catch(err => {
                console.error("Error loading filter options:", err);
                setError("Failed to load telemetry clients and servers list.");
            });
    }, [clientName, techParam]);

    // Handle Client Change
    const handleClientChange = (client) => {
        setSelectedClient(client);
        const servers = filterOptions.client_server_map[client] || [];
        const filteredSrvs = techParam
            ? servers.filter(s => ((filterOptions.server_db_type_map[client] || {})[s] || '').toLowerCase() === techParam.toLowerCase())
            : servers;
            
        if (filteredSrvs.length > 0) {
            setSelectedServer(filteredSrvs[0]);
            setSelectedDbType((filterOptions.server_db_type_map[client] || {})[filteredSrvs[0]] || '');
        } else {
            setSelectedServer('');
            setSelectedDbType('');
        }
    };

    // Handle Server Change
    const handleServerChange = (server) => {
        setSelectedServer(server);
        setSelectedDbType((filterOptions.server_db_type_map[selectedClient] || {})[server] || '');
    };

    // ── Query Params Construction ──
    const dateParams = useMemo(() => {
        if (timeRange === 'custom') {
            return {
                start_date: customStart ? customStart.replace('T', ' ') : null,
                end_date:   customEnd   ? customEnd.replace('T', ' ')   : null
            };
        }
        const now = new Date();
        const start = new Date();
        if (timeRange === '7d') start.setDate(now.getDate() - 7);
        else if (timeRange === '15d') start.setDate(now.getDate() - 15);
        else if (timeRange === '30d') start.setDate(now.getDate() - 30);

        const pad = n => String(n).padStart(2, '0');
        const format = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        return { start_date: format(start), end_date: format(now) };
    }, [timeRange, customStart, customEnd]);

    // ── Fetch History Data ──
    const fetchHistory = useCallback((forceRefresh = false) => {
        if (!selectedClient) return;
        setIsLoading(true);
        setError(null);
        setAiReport('');
        
        const params = {
            client_name: selectedClient,
            server_name: selectedServer || undefined,
            db_type: selectedDbType || undefined,
            start_date: dateParams.start_date || undefined,
            end_date: dateParams.end_date || undefined,
            metric: activeMetric !== 'all' ? activeMetric : undefined,
            refresh: forceRefresh ? true : undefined
        };

        api.get('/new-features/telemetry/utilization/history', { params })
            .then(res => {
                setHistoryData(res.data.history || []);
                setIsAws(res.data.is_aws || false);
                setDiskNames(res.data.disk_names || []);
                setLastRefreshedAt(new Date());
            })
            .catch(err => {
                console.error("Error fetching telemetry history:", err);
                setError(err.response?.data?.detail || "Failed to load telemetry metrics history.");
            })
            .finally(() => setIsLoading(false));
    }, [selectedClient, selectedServer, selectedDbType, dateParams, activeMetric]);

    // ── CSV Export ──
    const exportCSV = useCallback(() => {
        if (historyData.length === 0) return;
        const headers = ['Date','CPU Avg%','CPU Max%','Mem Avg GB','Mem Min GB','Disk Avg GB','Disk Min GB','Read IO Avg','Write IO Avg'];
        const rows = historyData.map(d => [
            d.date,
            d.cpu.avg.toFixed(2), d.cpu.max.toFixed(2),
            d.memory.avg.toFixed(3), d.memory.min.toFixed(3),
            d.disk.avg.toFixed(3), d.disk.min.toFixed(3),
            d.read_io.avg.toFixed(1), d.write_io.avg.toFixed(1)
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `${selectedClient}_${selectedServer}_metrics_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    }, [historyData, selectedClient, selectedServer]);

    // ── Auto-refresh countdown ticker ──
    useEffect(() => {
        if (autoRefreshSecs <= 0) { setCountdown(0); return; }
        setCountdown(autoRefreshSecs);
        const ticker = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    fetchHistory(true);
                    return autoRefreshSecs;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(ticker);
    }, [autoRefreshSecs, fetchHistory]);

    useEffect(() => {
        if (selectedClient && selectedServer) {
            fetchHistory();
        }
    }, [selectedClient, selectedServer, fetchHistory]);

    // ── AI Diagnostics Generator ──
    const triggerAiDiagnostics = () => {
        if (historyData.length === 0) return;
        setAiLoading(true);
        setAiReport('');
        setShowAiPanel(true);

        const formattedLogs = [];
        formattedLogs.push(`Client Name: ${selectedClient}`);
        formattedLogs.push(`Server Name: ${selectedServer}`);
        formattedLogs.push(`Database Technology: ${selectedDbType}`);
        formattedLogs.push(`Infrastructure Model: ${isAws ? 'AWS CloudWatch Cloud (RDS/Aurora)' : 'On-Premises Bare Metal / VM'}`);
        formattedLogs.push(`Utilization history trends (daily min, avg, max):`);
        
        const memLabel  = isAws ? 'Freeable Memory'  : 'Free Memory';
        const memUnit   = 'GB';
        const diskLabel = isAws ? 'Free Storage'     : 'Free Disk';
        const cpuLabel  = 'CPU Load';
        
        historyData.slice(-15).forEach(day => {
            formattedLogs.push(
                `- Date: ${day.date} | ` +
                `${cpuLabel}: Min ${day.cpu.min.toFixed(1)}%, Avg ${day.cpu.avg.toFixed(1)}%, Max ${day.cpu.max.toFixed(1)}% | ` +
                `${memLabel}: Min ${day.memory.min.toFixed(2)} ${memUnit}, Avg ${day.memory.avg.toFixed(2)} ${memUnit}, Max ${day.memory.max.toFixed(2)} ${memUnit} | ` +
                `${diskLabel}: Min ${day.disk.min.toFixed(2)} GB, Avg ${day.disk.avg.toFixed(2)} GB, Max ${day.disk.max.toFixed(2)} GB | ` +
                `Read IOPS: Avg ${day.read_io.avg.toFixed(1)}, Max ${day.read_io.max.toFixed(1)} | ` +
                `Write IOPS: Avg ${day.write_io.avg.toFixed(1)}, Max ${day.write_io.max.toFixed(1)}`
            );
        });

        formattedLogs.push(
            isAws
                ? `[Instruction] This is an AWS RDS/Aurora instance monitored via CloudWatch. Analyze CPU bottlenecks, Freeable Memory trends (low values = memory pressure), Free Storage Space depletion risks, and IOPS peaks relative to provisioned capacity. Provide precise DBA recommendations: instance class right-sizing, parameter group tuning, read replica offloading, and storage auto-scaling. Be highly technical and actionable.`
                : `[Instruction] This is an on-premise bare-metal or VM database server. Analyze CPU bottlenecks, free memory shrinkage trends (memory leaks, bloated buffer pools), free disk space depletion, and I/O throughput patterns (high write IOPS may indicate missing indexes or batch job contention). Provide precise DBA recommendations. Be highly technical and actionable.`
        );

        api.post('/summarize', {
            logs: formattedLogs,
            filters: {
                start: timeRange === 'custom' ? customStart : `Past ${timeRange}`,
                end: 'Now',
                client: selectedClient
            }
        })
            .then(res => {
                setAiReport(res.data?.summary || 'No diagnostics summary could be compiled.');
            })
            .catch(err => {
                console.error('AI diagnostics error:', err);
                setAiReport('Failed to compile resource diagnostics: ' + (err.response?.data?.detail || err.message));
            })
            .finally(() => setAiLoading(false));
    };

    // ── Metric Aggregated Info ──
    const aggregates = useMemo(() => {
        if (historyData.length === 0) return null;
        
        let cpuSum = 0, memSum = 0, diskSum = 0, rIoSum = 0, wIoSum = 0;
        let cpuMax = 0, memMin = Infinity, diskMin = Infinity, rIoMax = 0, wIoMax = 0;

        historyData.forEach(d => {
            cpuSum += d.cpu.avg;
            memSum += d.memory.avg;
            diskSum += d.disk.avg;
            rIoSum += d.read_io.avg;
            wIoSum += d.write_io.avg;

            if (d.cpu.max > cpuMax) cpuMax = d.cpu.max;
            if (d.memory.min < memMin) memMin = d.memory.min;
            if (d.disk.min < diskMin) diskMin = d.disk.min;
            if (d.read_io.max > rIoMax) rIoMax = d.read_io.max;
            if (d.write_io.max > wIoMax) wIoMax = d.write_io.max;
        });

        const len = historyData.length;
        return {
            cpu: { avg: cpuSum / len, max: cpuMax },
            memory: { avg: memSum / len, min: memMin === Infinity ? 0 : memMin },
            disk: { avg: diskSum / len, min: diskMin === Infinity ? 0 : diskMin },
            read_io: { avg: rIoSum / len, max: rIoMax },
            write_io: { avg: wIoSum / len, max: wIoMax }
        };
    }, [historyData]);

    // ── Data Availability Checkers ──
    const hasCpuData = useMemo(() => {
        return historyData.some(h => h.cpu && (h.cpu.min !== 0 || h.cpu.max !== 0 || h.cpu.avg !== 0));
    }, [historyData]);

    const hasMemoryData = useMemo(() => {
        return historyData.some(h => h.memory && (h.memory.min !== 0 || h.memory.max !== 0 || h.memory.avg !== 0));
    }, [historyData]);

    const hasDiskData = useMemo(() => {
        return historyData.some(h => h.disk && (h.disk.min !== 0 || h.disk.max !== 0 || h.disk.avg !== 0));
    }, [historyData]);

    const hasIoData = useMemo(() => {
        return historyData.some(h => 
            (h.read_io && (h.read_io.min !== 0 || h.read_io.max !== 0 || h.read_io.avg !== 0)) ||
            (h.write_io && (h.write_io.min !== 0 || h.write_io.max !== 0 || h.write_io.avg !== 0))
        );
    }, [historyData]);

    // ── Theme tokens ──
    const T = {
        bg:          isLight ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)'
                             : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        hBg:         isLight ? 'rgba(255,255,255,0.9)'  : 'rgba(5,7,16,0.8)',
        hBorder:     isLight ? '1px solid #cbd5e1'      : '1px solid rgba(255,255,255,0.05)',
        card:        isLight ? '#ffffff'                 : 'rgba(13,18,36,0.45)',
        cardBorder:  isLight ? '1px solid #e2e8f0'      : '1px solid rgba(255,255,255,0.06)',
        text:        isLight ? '#0f172a'                 : '#f8fafc',
        muted:       isLight ? '#475569'                 : '#94a3b8',
        tag:         isLight ? '#f1f5f9'                 : 'rgba(255,255,255,0.04)',
        splitLine:   isLight ? 'rgba(0,0,0,0.06)'        : 'rgba(255,255,255,0.05)',
        tooltipBg:   isLight ? 'rgba(255,255,255,0.95)'  : 'rgba(15,23,42,0.9)',
        tooltipBorder: isLight ? 'rgba(0,0,0,0.1)'       : 'rgba(59,130,246,0.3)',
    };

    // ── Echarts Options Generators ──
    const dates = useMemo(() => historyData.map(h => h.date), [historyData]);

    const cpuOption = useMemo(() => {
        if (historyData.length === 0) return {};
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: T.tooltipBg,
                borderColor: T.tooltipBorder,
                textStyle: { color: T.text },
                formatter: (params) => {
                    const date = params[0].name;
                    let str = `<b>Date: ${date}</b><br/>`;
                    params.forEach(p => {
                        str += `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)}%</b><br/>`;
                    });
                    return str;
                }
            },
            legend: { textStyle: { color: T.text }, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLabel: { color: T.text },
                axisLine: { lineStyle: { color: T.splitLine } }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                splitLine: { lineStyle: { color: T.splitLine } },
                axisLabel: { color: T.text, formatter: '{value}%' }
            },
            series: [
                { name: 'Max CPU', type: 'line', data: historyData.map(h => h.cpu.max), color: '#ef4444', smooth: true, lineStyle: { width: 1.5, type: 'dashed' } },
                { name: 'Avg CPU', type: 'line', data: historyData.map(h => h.cpu.avg), color: '#f59e0b', smooth: true, lineStyle: { width: 3 } },
                { name: 'Min CPU', type: 'line', data: historyData.map(h => h.cpu.min), color: '#10b981', smooth: true, lineStyle: { width: 1.5, type: 'dotted' } }
            ]
        };
    }, [historyData, dates, T]);

    const memoryOption = useMemo(() => {
        if (historyData.length === 0) return {};
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: T.tooltipBg,
                borderColor: T.tooltipBorder,
                textStyle: { color: T.text },
                formatter: (params) => {
                    const date = params[0].name;
                    let str = `<b>Date: ${date}</b><br/>`;
                    params.forEach(p => {
                        str += `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)} GB</b><br/>`;
                    });
                    return str;
                }
            },
            legend: { textStyle: { color: T.text }, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLabel: { color: T.text },
                axisLine: { lineStyle: { color: T.splitLine } }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: T.splitLine } },
                axisLabel: { color: T.text, formatter: '{value} GB' }
            },
            series: [
                { name: 'Max Free Memory', type: 'line', data: historyData.map(h => h.memory.max), color: '#3b82f6', smooth: true, lineStyle: { width: 1.5, type: 'dashed' } },
                { name: 'Avg Free Memory', type: 'line', data: historyData.map(h => h.memory.avg), color: '#8b5cf6', smooth: true, lineStyle: { width: 3 } },
                { name: 'Min Free Memory', type: 'line', data: historyData.map(h => h.memory.min), color: '#ec4899', smooth: true, lineStyle: { width: 1.5, type: 'dotted' } }
            ]
        };
    }, [historyData, dates, T]);

    const diskOption = useMemo(() => {
        if (historyData.length === 0) return {};
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: T.tooltipBg,
                borderColor: T.tooltipBorder,
                textStyle: { color: T.text },
                formatter: (params) => {
                    const date = params[0].name;
                    let str = `<b>Date: ${date}</b><br/>`;
                    params.forEach(p => {
                        str += `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)} GB</b><br/>`;
                    });
                    return str;
                }
            },
            legend: { textStyle: { color: T.text }, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLabel: { color: T.text },
                axisLine: { lineStyle: { color: T.splitLine } }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: T.splitLine } },
                axisLabel: { color: T.text, formatter: '{value} GB' }
            },
            series: [
                { name: 'Max Free Storage', type: 'line', data: historyData.map(h => h.disk.max), color: '#10b981', smooth: true, lineStyle: { width: 1.5, type: 'dashed' } },
                { name: 'Avg Free Storage', type: 'line', data: historyData.map(h => h.disk.avg), color: '#ef4444', smooth: true, lineStyle: { width: 3 } },
                { name: 'Min Free Storage', type: 'line', data: historyData.map(h => h.disk.min), color: '#f59e0b', smooth: true, lineStyle: { width: 1.5, type: 'dotted' } }
            ]
        };
    }, [historyData, dates, T]);

    const ioOption = useMemo(() => {
        if (historyData.length === 0) return {};
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: T.tooltipBg,
                borderColor: T.tooltipBorder,
                textStyle: { color: T.text },
                formatter: (params) => {
                    const date = params[0].name;
                    let str = `<b>Date: ${date}</b><br/>`;
                    params.forEach(p => {
                        str += `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)} IOPS</b><br/>`;
                    });
                    return str;
                }
            },
            legend: { textStyle: { color: T.text }, top: 0 },
            grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLabel: { color: T.text },
                axisLine: { lineStyle: { color: T.splitLine } }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: T.splitLine } },
                axisLabel: { color: T.text, formatter: '{value}' }
            },
            series: [
                { name: 'Read IOPS (Avg)', type: 'line', data: historyData.map(h => h.read_io.avg), color: '#06b6d4', smooth: true, lineStyle: { width: 3 } },
                { name: 'Read IOPS (Max)', type: 'line', data: historyData.map(h => h.read_io.max), color: '#0ea5e9', smooth: true, lineStyle: { width: 1.5, type: 'dotted' } },
                { name: 'Write IOPS (Avg)', type: 'line', data: historyData.map(h => h.write_io.avg), color: '#d97706', smooth: true, lineStyle: { width: 3 } },
                { name: 'Write IOPS (Max)', type: 'line', data: historyData.map(h => h.write_io.max), color: '#f97316', smooth: true, lineStyle: { width: 1.5, type: 'dotted' } }
            ]
        };
    }, [historyData, dates, T]);

    // Set activeMetric from URL param on data load
    useEffect(() => {
        if (initialMetric && initialMetric !== 'all') setActiveMetric(initialMetric);
    }, [initialMetric]);

    return (
        <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: T.text, fontFamily: 'Inter, sans-serif', transition: 'all 0.3s' }}>
            
            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <header style={{ borderBottom: T.hBorder, background: T.hBg, backdropFilter: 'blur(20px)', padding: '1rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => navigate(`/telemetry-client-details/${selectedClient}`)} style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Cpu style={{ color: 'white' }} size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px', margin: 0, color: T.text }}>
                                {selectedClient} Resource Matrix
                            </h1>
                            <p style={{ fontSize: '0.72rem', color: T.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                                Utilization and Server Performance Analytics
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={triggerAiDiagnostics} disabled={isLoading || historyData.length === 0 || aiLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#a855f7,#6366f1)', border: 'none', borderRadius: 10, color: 'white', padding: '9px 18px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.25)', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Run Resource Diagnostics
                    </button>
                </div>
            </header>

            {/* ── MAIN ───────────────────────────────────────────────────── */}
            <main style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: 1440, width: '100%', margin: '0 auto' }}>
                
                {/* ── STICKY FILTER BAR ─────────────────────────────────────── */}
                <div style={{ background: T.card, border: T.cardBorder, borderRadius: 20, padding: '1.5rem', boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.02)' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                        
                         <div>
                             <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                 Client
                             </label>
                             <select value={selectedClient} onChange={e => handleClientChange(e.target.value)}
                                 style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}>
                                 {filteredClients.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
 
                         <div>
                             <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                 Server Instance
                             </label>
                             <select value={selectedServer} onChange={e => handleServerChange(e.target.value)}
                                 style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}>
                                 {filteredServers.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                         </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                Database Type
                            </label>
                            <div style={{ padding: '11px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>
                                {selectedDbType || 'Unknown'}
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                                Time Range
                            </label>
                            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}>
                                <option value="7d">Last 7 Days</option>
                                <option value="15d">Last 15 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>

                        {timeRange === 'custom' && (
                            <>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Start Date</label>
                                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                        style={{ width: '100%', padding: '9px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>End Date</label>
                                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                        style={{ width: '100%', padding: '9px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem' }} />
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={() => fetchHistory(true)} style={{ flex: '1 1 auto', padding: '10px 20px', borderRadius: 10, background: '#2563eb', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <RefreshCw size={14} /> Apply
                            </button>
                            <button onClick={exportCSV} disabled={historyData.length === 0} style={{ flex: '1 1 auto', padding: '10px 16px', borderRadius: 10, background: historyData.length === 0 ? T.tag : 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: historyData.length === 0 ? T.muted : '#10b981', fontWeight: 700, fontSize: '0.82rem', cursor: historyData.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <Download size={13} /> CSV
                            </button>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Auto Refresh</label>
                            <select value={autoRefreshSecs} onChange={e => setAutoRefreshSecs(Number(e.target.value))}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.tag, border: T.cardBorder, color: T.text, fontSize: '0.82rem', fontWeight: 600, outline: 'none' }}>
                                <option value={0}>Off</option>
                                <option value={30}>30 sec</option>
                                <option value={60}>1 min</option>
                                <option value={300}>5 min</option>
                            </select>
                        </div>
                        {lastRefreshedAt && (
                            <div style={{ fontSize: '0.72rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                                <CheckCircle size={11} style={{ color: '#10b981' }} />
                                Updated {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                {countdown > 0 && <span style={{ color: '#3b82f6', fontWeight: 700 }}> · Next in {countdown}s</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── ERROR DISPLAY ────────────────────────────────────────── */}
                {error && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle style={{ color: '#ef4444' }} size={24} />
                        <div>
                            <div style={{ fontWeight: 700, color: '#ef4444' }}>Telemetry Connection Error</div>
                            <div style={{ fontSize: '0.83rem', color: T.muted }}>{error}</div>
                        </div>
                    </div>
                )}

                {/* ── AI DIAGNOSTICS REPORT DISPLAY ──────────────────────────── */}
                {showAiPanel && (
                    <div style={{ background: T.card, border: T.cardBorder, borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.03)' }}>
                        <div style={{ padding: '1.25rem 2rem', borderBottom: T.hBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.01)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Sparkles style={{ color: '#a855f7' }} size={20} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Expert AI Resource Diagnostics</h3>
                            </div>
                            <button onClick={() => setShowAiPanel(false)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>Hide Report</button>
                        </div>
                        <div style={{ padding: '2rem' }}>
                            {aiLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '2rem 0' }}>
                                    <Loader size={32} className="animate-spin" style={{ color: '#a855f7' }} />
                                    <p style={{ fontSize: '0.85rem', color: T.muted }}>Analyzing server utilization thresholds and drafting recommendations...</p>
                                </div>
                            ) : (
                                <div className="markdown-body" style={{ fontSize: '0.88rem', lineHeight: 1.7, color: T.text }}
                                    dangerouslySetInnerHTML={{ __html: marked(aiReport || "Failed to compile AI insights.") }} />
                            )}
                        </div>
                    </div>
                )}

                {/* ── AGGREGATES CARDS ──────────────────────────────────────── */}
                {aggregates && !isLoading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                        {hasCpuData && (
                            <div style={{ background: T.card, border: T.cardBorder, borderRadius: 18, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Avg / Peak CPU Load</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                                    {aggregates.cpu.avg.toFixed(1)}% <span style={{ fontSize: '0.9rem', fontWeight: 500, color: T.muted }}>/ {aggregates.cpu.max.toFixed(1)}%</span>
                                </span>
                                <span style={{ fontSize: '0.72rem', color: T.muted }}>Average / Maximum across {historyData.length} days</span>
                            </div>
                        )}
                        {hasMemoryData && (
                            <div style={{ background: T.card, border: T.cardBorder, borderRadius: 18, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>
                                    {isAws ? 'Min Freeable Memory' : 'Min Free Memory'}
                                </span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6' }}>
                                    {aggregates.memory.min.toFixed(2)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: T.muted }}>GB</span>
                                </span>
                                <span style={{ fontSize: '0.72rem', color: T.muted }}>
                                    {isAws ? 'Lowest recorded free memory on RDS instance' : 'Lowest free RAM across reporting period'}
                                </span>
                            </div>
                        )}
                        {hasDiskData && (
                            <div style={{ background: T.card, border: T.cardBorder, borderRadius: 18, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>
                                    {isAws ? 'Min Free Storage' : 'Min Free Disk Space'}
                                </span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>
                                    {aggregates.disk.min.toFixed(2)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: T.muted }}>GB</span>
                                </span>
                                <span style={{ fontSize: '0.72rem', color: T.muted }}>
                                    {isAws ? 'Lowest free local storage on RDS' : 'Lowest free disk across reporting period'}
                                </span>
                            </div>
                        )}
                        {hasIoData && (
                            <div style={{ background: T.card, border: T.cardBorder, borderRadius: 18, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'uppercase', fontWeight: 700 }}>Peak Read / Write IOPS</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#06b6d4' }}>
                                    {aggregates.read_io.max.toFixed(0)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: T.muted }}>/ {aggregates.write_io.max.toFixed(0)}</span>
                                </span>
                                <span style={{ fontSize: '0.72rem', color: T.muted }}>Maximum read / write I/O operations per second</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── METRIC TABS ──────────────────────────────────────────── */}
                {!isLoading && historyData.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            { key: 'all',    label: 'All Metrics', icon: <Sliders size={14}/>,    color: '#6366f1', show: true },
                            { key: 'cpu',    label: 'CPU',         icon: <Cpu size={14}/>,         color: '#f59e0b', show: hasCpuData },
                            { key: 'memory', label: 'Memory',      icon: <Activity size={14}/>,    color: '#8b5cf6', show: hasMemoryData },
                            { key: 'disk',   label: 'Disk',        icon: <HardDrive size={14}/>,   color: '#ef4444', show: hasDiskData },
                            { key: 'iops',   label: 'I/O (IOPS)',  icon: <Zap size={14}/>,         color: '#06b6d4', show: hasIoData },
                        ].filter(tab => {
                            if (!tab.show) return false;
                            if (!metricParam) return true;
                            const mappedKey = metricParam.toLowerCase() === 'io' ? 'iops' : metricParam.toLowerCase();
                            return tab.key === mappedKey;
                        }).map(tab => (
                            <button key={tab.key} onClick={() => setActiveMetric(tab.key)}
                                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:10, border: activeMetric===tab.key ? `2px solid ${tab.color}` : T.cardBorder, background: activeMetric===tab.key ? `${tab.color}22` : T.card, color: activeMetric===tab.key ? tab.color : T.muted, fontWeight:700, fontSize:'0.8rem', cursor:'pointer', transition:'all 0.2s' }}>
                                {tab.icon}{tab.label}
                            </button>
                        ))}
                        <button onClick={() => setShowTable(v => !v)}
                            style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:10, border: showTable ? '2px solid #10b981' : T.cardBorder, background: showTable ? '#10b98122' : T.card, color: showTable ? '#10b981' : T.muted, fontWeight:700, fontSize:'0.8rem', cursor:'pointer', transition:'all 0.2s' }}>
                            <Download size={14}/> {showTable ? 'Hide Table' : 'Show Table'}
                        </button>
                    </div>
                )}

                {/* ── CHARTS ───────────────────────────────────────────────── */}
                {isLoading ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8rem 0', gap:14 }}>
                        <Loader size={36} className="animate-spin" style={{ color:'#2563eb' }}/>
                        <span style={{ fontSize:'0.85rem', color:T.muted }}>Retrieving server telemetrics for {selectedClient} · {selectedServer}...</span>
                    </div>
                ) : historyData.length === 0 ? (
                    <div style={{ background:T.card, border:T.cardBorder, borderRadius:22, padding:'5rem', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
                        <Info size={40} style={{ color:T.muted }}/>
                        <h3 style={{ fontSize:'1.1rem', fontWeight:700, margin:0 }}>No Telemetry Data for {selectedClient}</h3>
                        <p style={{ fontSize:'0.82rem', color:T.muted, maxWidth:450, margin:0 }}>No CPU, Memory, Disk or I/O records found for server <b>{selectedServer}</b> ({selectedDbType}) in the selected date range.</p>
                    </div>
                ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'2.5rem' }}>

                        {/* CPU Chart */}
                        {(activeMetric==='all' || activeMetric==='cpu') && hasCpuData && (
                        <div id="metric-card-cpu" style={{ background:T.card, border:T.cardBorder, borderRadius:22, padding:'2rem' }}>
                            <h3 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 4px 0', display:'flex', alignItems:'center', gap:8 }}>
                                <Cpu size={18} style={{ color:'#f59e0b' }}/> CPU Utilization — {selectedClient} · {selectedServer}
                            </h3>
                            <p style={{ fontSize:'0.78rem', color:T.muted, margin:'0 0 1.5rem 0' }}>Daily Min / Avg / Max CPU load % — {selectedDbType}</p>
                            <div style={{ height:320 }}><ReactECharts option={cpuOption}/></div>
                        </div>
                        )}

                        {/* Memory Chart */}
                        {(activeMetric==='all' || activeMetric==='memory') && hasMemoryData && (
                        <div id="metric-card-memory" style={{ background:T.card, border:T.cardBorder, borderRadius:22, padding:'2rem' }}>
                            <h3 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 4px 0', display:'flex', alignItems:'center', gap:8 }}>
                                <Activity size={18} style={{ color:'#8b5cf6' }}/> {isAws?'Freeable Memory':'Free Memory'} — {selectedClient} · {selectedServer}
                            </h3>
                            <p style={{ fontSize:'0.78rem', color:T.muted, margin:'0 0 1.5rem 0' }}>Daily Min / Avg / Max free memory (GB) — {selectedDbType}</p>
                            <div style={{ height:320 }}><ReactECharts option={memoryOption}/></div>
                        </div>
                        )}

                        {/* Disk Chart */}
                        {(activeMetric==='all' || activeMetric==='disk') && hasDiskData && (
                        <div id="metric-card-disk" style={{ background:T.card, border:T.cardBorder, borderRadius:22, padding:'2rem' }}>
                            <h3 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 4px 0', display:'flex', alignItems:'center', gap:8 }}>
                                <HardDrive size={18} style={{ color:'#ef4444' }}/> {isAws?'Free Storage':'Free Disk'} — {selectedClient} · {selectedServer}
                            </h3>
                            <p style={{ fontSize:'0.78rem', color:T.muted, margin:'0 0 1.5rem 0' }}>
                                Daily Min / Avg / Max free storage (GB) — {selectedDbType} {diskNames && diskNames.length > 0 ? `[ Disks: ${diskNames.join(', ')} ]` : ''}
                            </p>
                            <div style={{ height:320 }}><ReactECharts option={diskOption}/></div>
                        </div>
                        )}

                        {/* IOPS Chart */}
                        {(activeMetric==='all' || activeMetric==='iops') && hasIoData && (
                        <div id="metric-card-iops" style={{ background:T.card, border:T.cardBorder, borderRadius:22, padding:'2rem' }}>
                            <h3 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 4px 0', display:'flex', alignItems:'center', gap:8 }}>
                                <Zap size={18} style={{ color:'#06b6d4' }}/> Read &amp; Write IOPS — {selectedClient} · {selectedServer}
                            </h3>
                            <p style={{ fontSize:'0.78rem', color:T.muted, margin:'0 0 1.5rem 0' }}>Daily Read / Write I/O operations per second — {selectedDbType}</p>
                            <div style={{ height:320 }}><ReactECharts option={ioOption}/></div>
                        </div>
                        )}

                        {/* ── DAY-WISE TABLE ──────────────────────────────── */}
                        {showTable && (
                        <div style={{ background:T.card, border:T.cardBorder, borderRadius:22, overflow:'hidden' }}>
                            <div style={{ padding:'1.25rem 2rem', borderBottom:T.hBorder, display:'flex', justifyContent:'space-between', alignItems:'center', background: isLight?'#f8fafc':'rgba(255,255,255,0.01)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                    <Download size={16} style={{ color:'#10b981' }}/>
                                    <span style={{ fontWeight:800, fontSize:'1rem' }}>Day-wise Utilization Table — {selectedClient} · {selectedServer}</span>
                                </div>
                                <span style={{ fontSize:'0.75rem', color:T.muted, fontWeight:600 }}>{historyData.length} day(s) · {selectedDbType}</span>
                            </div>
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                                    <thead>
                                        <tr style={{ background: isLight?'#f1f5f9':'rgba(255,255,255,0.04)' }}>
                                            <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:700, color:T.muted, whiteSpace:'nowrap', borderBottom:T.cardBorder }}>Date</th>
                                            {(activeMetric==='all'||activeMetric==='cpu') && <>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#f59e0b', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>CPU Min%</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#f59e0b', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>CPU Avg%</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#f59e0b', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>CPU Max%</th>
                                            </>}
                                            {(activeMetric==='all'||activeMetric==='memory') && <>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Mem Min GB</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Mem Avg GB</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Mem Max GB</th>
                                            </>}
                                            {(activeMetric==='all'||activeMetric==='disk') && <>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#ef4444', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Disk Min GB</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#ef4444', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Disk Avg GB</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#ef4444', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>Disk Max GB</th>
                                            </>}
                                            {(activeMetric==='all'||activeMetric==='iops') && <>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#06b6d4', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>R-IOPS Min</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#06b6d4', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>R-IOPS Avg</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#06b6d4', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>R-IOPS Max</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#d97706', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>W-IOPS Min</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#d97706', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>W-IOPS Avg</th>
                                                <th style={{ padding:'10px 10px', textAlign:'right', color:'#d97706', fontWeight:700, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>W-IOPS Max</th>
                                            </>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyData.map((row, i) => (
                                            <tr key={row.date} style={{ background: i%2===0 ? 'transparent' : (isLight?'rgba(0,0,0,0.02)':'rgba(255,255,255,0.02)'), transition:'background 0.15s' }}
                                                onMouseEnter={e=>e.currentTarget.style.background=isLight?'#eff6ff':'rgba(59,130,246,0.07)'}
                                                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'transparent':(isLight?'rgba(0,0,0,0.02)':'rgba(255,255,255,0.02)')}>
                                                <td style={{ padding:'9px 16px', fontWeight:700, color:T.text, borderBottom:T.cardBorder, whiteSpace:'nowrap' }}>{row.date}</td>
                                                {(activeMetric==='all'||activeMetric==='cpu') && <>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#f59e0b', borderBottom:T.cardBorder }}>{row.cpu.min.toFixed(2)}%</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#f59e0b', fontWeight:700, borderBottom:T.cardBorder }}>{row.cpu.avg.toFixed(2)}%</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#ef4444', borderBottom:T.cardBorder }}>{row.cpu.max.toFixed(2)}%</td>
                                                </>}
                                                {(activeMetric==='all'||activeMetric==='memory') && <>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#8b5cf6', borderBottom:T.cardBorder }}>{row.memory.min.toFixed(2)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:700, borderBottom:T.cardBorder }}>{row.memory.avg.toFixed(2)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#8b5cf6', borderBottom:T.cardBorder }}>{row.memory.max.toFixed(2)}</td>
                                                </>}
                                                {(activeMetric==='all'||activeMetric==='disk') && <>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#ef4444', borderBottom:T.cardBorder }}>{row.disk.min.toFixed(2)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#ef4444', fontWeight:700, borderBottom:T.cardBorder }}>{row.disk.avg.toFixed(2)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#ef4444', borderBottom:T.cardBorder }}>{row.disk.max.toFixed(2)}</td>
                                                </>}
                                                {(activeMetric==='all'||activeMetric==='iops') && <>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#06b6d4', borderBottom:T.cardBorder }}>{row.read_io.min.toFixed(1)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#06b6d4', fontWeight:700, borderBottom:T.cardBorder }}>{row.read_io.avg.toFixed(1)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#06b6d4', borderBottom:T.cardBorder }}>{row.read_io.max.toFixed(1)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#d97706', borderBottom:T.cardBorder }}>{row.write_io.min.toFixed(1)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#d97706', fontWeight:700, borderBottom:T.cardBorder }}>{row.write_io.avg.toFixed(1)}</td>
                                                    <td style={{ padding:'9px 10px', textAlign:'right', color:'#d97706', borderBottom:T.cardBorder }}>{row.write_io.max.toFixed(1)}</td>
                                                </>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )}

                    </div>
                )}
            </main>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <footer style={{ textAlign: 'center', padding: '2rem 2.5rem', borderTop: T.hBorder, color: T.muted, fontSize: '0.8rem', background: isLight ? '#ffffff' : 'rgba(5,7,16,0.4)', marginTop: 'auto' }}>
                <span>© {new Date().getFullYear()} GeoPITS Core Console · Active Telemetry Resource Monitor</span>
            </footer>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default TelemetryClientMetrics;
