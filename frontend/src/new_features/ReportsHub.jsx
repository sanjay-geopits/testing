import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { 
    ArrowLeft, 
    UploadCloud, 
    FileText, 
    Download, 
    Calendar,
    CheckCircle,
    AlertCircle,
    Search,
    Database,
    Tag,
    Clock,
    Plus,
    Filter,
    FileSpreadsheet,
    FileUp,
    Eye,
    X,
    Maximize2,
    ShieldCheck,
    Sun,
    Moon,
    File,
    Trash2,
    Share2
} from 'lucide-react';

const base64ToBlobUrl = (base64String, contentType = '') => {
    try {
        if (!base64String) return '';
        const base64Data = base64String.includes(',') 
            ? base64String.split(',')[1] 
            : base64String;
        const actualContentType = contentType || (base64String.includes(',') 
            ? base64String.split(',')[0].split(':')[1].split(';')[0]
            : '');
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: actualContentType || 'application/octet-stream' });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error("Error creating Blob URL:", e);
        return base64String;
    }
};

const ReportsHub = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === 'light';
    
    // Default clients list with mapped technology environments
    const [clients, setClients] = useState([]);
    
    const [selectedClient, setSelectedClient] = useState(null);
    const [reports, setReports] = useState([]);
    
    // View state: 'detail', 'upload'
    const [viewMode, setViewMode] = useState('detail'); 
    const [expandedReportId, setExpandedReportId] = useState(null);
    const [viewingReport, setViewingReport] = useState(null); // Report modal reader state
    const [modalTab, setModalTab] = useState('native');
    const [extractedTextSearch, setExtractedTextSearch] = useState('');
    const [activeShareReportId, setActiveShareReportId] = useState(null);
    
    // Form fields
    const [title, setTitle] = useState('');
    const [month, setMonth] = useState('January');
    const [year, setYear] = useState('2026');
    const [notes, setNotes] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Email sharing state variables
    const [emailShareModalReport, setEmailShareModalReport] = useState(null);
    
    const [emailRecipient, setEmailRecipient] = useState('');
    const [emailCc, setEmailCc] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    
    // Report specific filters
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Review and Comments state
    const [reportReviews, setReportReviews] = useState({}); // { [reportId]: [...] }
    const [reviewComments, setReviewComments] = useState({}); // { [reportId]: '' }
    const [reviewMoms, setReviewMoms] = useState({}); // { [reportId]: '' }
    const [expandedReviewReportId, setExpandedReviewReportId] = useState(null);
    const [expandedReviewTab, setExpandedReviewTab] = useState(null); // 'reviews' or 'mom'

    const fetchReviews = async (reportId) => {
        try {
            const res = await api.get(`/new-features/reports/${reportId}/reviews`);
            setReportReviews(prev => ({
                ...prev,
                [reportId]: res.data.reviews || []
            }));
        } catch (err) {
            console.error("Error fetching reviews:", err);
        }
    };

    const handleToggleReviews = (reportId, tabType) => {
        if (expandedReviewReportId === reportId && expandedReviewTab === tabType) {
            setExpandedReviewReportId(null);
            setExpandedReviewTab(null);
        } else {
            setExpandedReviewReportId(reportId);
            setExpandedReviewTab(tabType);
            fetchReviews(reportId);
            setReviewComments(prev => ({ ...prev, [reportId]: '' }));
            setReviewMoms(prev => ({ ...prev, [reportId]: '' }));
        }
    };

    const handleSubmitComment = async (reportId) => {
        try {
            const comment = reviewComments[reportId] || '';
            await api.post(`/new-features/reports/${reportId}/reviews`, {
                rating: 5,
                comment,
                mom: ''
            });
            setReviewComments(prev => ({ ...prev, [reportId]: '' }));
            fetchReviews(reportId);
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to submit comment");
        }
    };

    const handleSubmitMom = async (reportId) => {
        try {
            const mom = reviewMoms[reportId] || '';
            await api.post(`/new-features/reports/${reportId}/reviews`, {
                rating: 5,
                comment: '',
                mom
            });
            setReviewMoms(prev => ({ ...prev, [reportId]: '' }));
            fetchReviews(reportId);
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to submit Minutes of Meeting (MoM)");
        }
    };

    useEffect(() => {
        const loadScripts = async () => {
            if (!window.JSZip) {
                const jszipScript = document.createElement('script');
                jszipScript.src = "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js";
                jszipScript.async = true;
                document.body.appendChild(jszipScript);
                await new Promise((resolve) => { jszipScript.onload = resolve; });
            }
            if (!window.docx) {
                const docxScript = document.createElement('script');
                docxScript.src = "https://unpkg.com/docx-preview@0.1.15/dist/docx-preview.js";
                docxScript.async = true;
                document.body.appendChild(docxScript);
                await new Promise((resolve) => { docxScript.onload = resolve; });
            }
        };
        loadScripts();
    }, []);

    useEffect(() => {
        const loadClientsAndCounts = async () => {
            try {
                // Fetch dynamic counts from DB
                const countsRes = await api.get('/new-features/reports/counts');
                const countsMap = countsRes.data || {};

                // Fetch custom registered admin clients if any
                const adminClientsRes = await api.get('/new-features/admin/clients');
                
                let baseClients = [];

                if (adminClientsRes.data.clients && adminClientsRes.data.clients.length > 0) {
                    baseClients = adminClientsRes.data.clients.map(c => ({
                        name: c.client_name,
                        tech: c.db_type || "PostgreSQL",
                        files: countsMap[c.client_name] || 0,
                        lastUpdated: "Recently Added"
                    }));
                }

                setClients(baseClients);
            } catch (err) {
                console.error("Could not fetch reports data:", err);
            }
        };

        loadClientsAndCounts();
    }, []);

    const fetchReports = (clientName) => {
        setIsLoading(true);
        api.get(`/new-features/reports?client_name=${clientName}`)
            .then(res => {
                setReports(res.data.reports || []);
            })
            .catch(err => {
                console.error("Fetch reports error:", err);
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const handleClientClick = (client) => {
        setSelectedClient(client);
        setViewMode('detail');
        setExpandedReportId(null);
        fetchReports(client.name);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            setSelectedFile({
                name: file.name,
                size: (file.size / 1024).toFixed(1) + " KB",
                base64: uploadEvent.target.result
            });
        };
        reader.readAsDataURL(file);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!selectedFile) {
            setError('Please select a report document to upload');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/new-features/reports', {
                client_name: selectedClient.name,
                title,
                month,
                year,
                file_name: selectedFile.name,
                file_data: selectedFile.base64,
                notes
            });
            
            setSuccess('Report uploaded successfully!');
            setTitle('');
            setNotes('');
            setSelectedFile(null);
            setViewMode('detail');
            fetchReports(selectedClient.name);
            
            // Increment files count dynamically
            setClients(prev => prev.map(c => 
                c.name === selectedClient.name ? { ...c, files: c.files + 1, lastUpdated: `${month} ${year}` } : c
            ));
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to upload report');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async (reportId, filename) => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Determine the correct backend origin dynamically to bypass local Vite proxy header stripping
                const backendOrigin = (window.location.port === '5173' || window.location.port === '3000')
                    ? 'http://localhost:8000'
                    : window.location.origin;
                
                const downloadUrl = `${backendOrigin}/api/new-features/reports/download/${reportId}?token=${encodeURIComponent(token)}`;
                
                // Create a temporary anchor element to trigger completely native browser download with direct backend origin
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else {
                throw new Error("No token available");
            }
        } catch (err) {
            console.error("Direct download failed, falling back to blob", err);
            // fallback (just in case)
            try {
                const response = await api.get(`/new-features/reports/download/${reportId}`, {
                    responseType: 'blob'
                });
                const blobUrl = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(blobUrl);
            } catch (fallbackErr) {
                alert("Could not download report file.");
            }
        }
    };

    const handleViewDocument = async (reportId) => {
        setIsLoading(true);
        try {
            const res = await api.get(`/new-features/reports/view-text/${reportId}`);
            const reportData = res.data;
            if (reportData && reportData.file_data) {
                const ext = reportData.file_ext || reportData.file_name?.split('.').pop().toLowerCase();
                let mimeType = 'application/octet-stream';
                if (ext === 'pdf') mimeType = 'application/pdf';
                else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                
                reportData.blob_url = base64ToBlobUrl(reportData.file_data, mimeType);
            }
            setViewingReport(reportData);
        } catch (err) {
            alert("Could not load report content for viewing.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteReport = async (reportId, reportTitle) => {
        if (!window.confirm(`Are you sure you want to delete the report "${reportTitle}"?`)) {
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.delete(`/new-features/reports/${reportId}`);
            setSuccess('Report deleted successfully!');
            fetchReports(selectedClient.name);
            // Decrement files count dynamically
            setClients(prev => prev.map(c => 
                c.name === selectedClient.name ? { ...c, files: Math.max(0, c.files - 1) } : c
            ));
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete report');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewingReport && modalTab === 'native') {
            const ext = viewingReport.file_ext || viewingReport.file_name?.split('.').pop().toLowerCase();
            if (ext === 'docx') {
                setTimeout(async () => {
                    const container = document.getElementById('docx-native-container');
                    if (container) {
                        container.innerHTML = '<p style="text-align: center; color: #2563eb; font-size: 0.85rem; padding: 2rem; font-weight: 600;">Generating high-fidelity 1:1 original document preview...</p>';
                        try {
                            const base64Data = viewingReport.file_data.includes(',') 
                                ? viewingReport.file_data.split(',')[1] 
                                : viewingReport.file_data;
                            const binaryString = window.atob(base64Data);
                            const len = binaryString.length;
                            const bytes = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const arrayBuffer = bytes.buffer;

                            if (window.docx) {
                                container.innerHTML = '';
                                await window.docx.renderAsync(arrayBuffer, container, null, {
                                    className: "docx-preview-rendered",
                                    inWrapper: true,
                                    ignoreWidth: false,
                                    ignoreHeight: false,
                                    ignoreFonts: false,
                                    breakPages: true,
                                    debug: false
                                });
                            } else {
                                container.innerHTML = '<p style="text-align: center; color: #ef4444; font-size: 0.85rem; padding: 2rem;">GeoMon document engine is loading. Please select standard tab or retry in a few seconds...</p>';
                            }
                        } catch (err) {
                            console.error("DOCX rendering error:", err);
                            container.innerHTML = `<p style="text-align: center; color: #ef4444; font-size: 0.85rem; padding: 2rem;">Native viewer failed to parse document structure. Please click 'Extracted Content' tab or download file directly.</p>`;
                        }
                    }
                }, 150);
            }
        }
    }, [viewingReport, modalTab]);

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.tech.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredReports = reports.filter(r => {
        const matchesMonth = filterMonth ? r.month.toLowerCase() === filterMonth.toLowerCase() : true;
        const matchesYear = filterYear ? r.year.toString() === filterYear.toString() : true;
        return matchesMonth && matchesYear;
    });

    const getFileIcon = (filename) => {
        const ext = filename?.split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
            return <FileSpreadsheet style={{ color: '#16a34a' }} size={20} />;
        }
        return <FileText style={{ color: '#2563eb' }} size={20} />;
    };

    const themeStyles = {
        background: isLight 
            ? 'radial-gradient(circle at 50% 0%, #f1f5f9 0%, #e2e8f0 100%)' 
            : 'radial-gradient(circle at 50% 0%, #0c0f1d 0%, #020308 100%)',
        headerBg: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(5, 7, 16, 0.8)',
        headerBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.05)',
        cardBg: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.4)',
        cardBorder: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.05)',
        textMain: isLight ? '#0f172a' : '#f8fafc',
        textMuted: isLight ? '#475569' : '#94a3b8',
        inputBg: isLight ? '#ffffff' : 'rgba(5, 7, 16, 0.6)',
        inputBorder: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
        modalBg: isLight ? '#ffffff' : '#0c0f1d',
    };

    const renderStyledDocxPage = (text) => {
        if (!text) return <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No readable content found inside this document.</p>;
        
        // Split into paragraphs
        const paragraphs = text.split('\n\n');
        
        return paragraphs.map((para, pIdx) => {
            const trimmed = para.trim();
            if (!trimmed) return null;
            
            // 1. Check if table row structure
            if (trimmed.includes('|')) {
                const lines = trimmed.split('\n');
                return (
                    <div key={pIdx} style={{ margin: '1.25rem 0', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif' }}>
                            <tbody>
                                {lines.map((line, rIdx) => {
                                    const cells = line.split('|');
                                    return (
                                        <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0', background: rIdx === 0 ? '#f8fafc' : 'transparent' }}>
                                            {cells.map((cell, cIdx) => (
                                                <td key={cIdx} style={{ 
                                                    padding: '8px 12px', 
                                                    fontWeight: rIdx === 0 ? '700' : '400', 
                                                    color: rIdx === 0 ? '#1e3a8a' : '#334155',
                                                    border: '1px solid #cbd5e1'
                                                }}>
                                                    {cell.trim()}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            }
            
            // 2. Check if a section header
            const isHeader = trimmed.length < 80 && (
                /^[0-9]\.?\s+[A-Za-z]/.test(trimmed) || 
                trimmed === trimmed.toUpperCase() || 
                trimmed.startsWith('SECTION') || 
                trimmed.startsWith('CHAPTER')
            );
            
            if (isHeader) {
                return (
                    <h3 key={pIdx} style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: '800', 
                        color: '#1e3a8a', 
                        marginTop: '1.5rem', 
                        marginBottom: '0.75rem',
                        borderBottom: '2px solid #3b82f6',
                        paddingBottom: '4px'
                    }}>
                        {trimmed}
                    </h3>
                );
            }
            
            // 3. Standard Paragraph
            return (
                <p key={pIdx} style={{ 
                    fontSize: '0.85rem', 
                    color: '#334155', 
                    lineHeight: '1.7', 
                    textAlign: 'justify', 
                    margin: '0.85rem 0' 
                }}>
                    {trimmed}
                </p>
            );
        });
    };

    return (
        <div style={{ 
            background: themeStyles.background, 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            color: themeStyles.textMain,
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.3s ease, color 0.3s ease'
        }}>
            {/* APP BAR HEADER */}
            <header style={{ 
                borderBottom: themeStyles.headerBorder, 
                background: themeStyles.headerBg,
                backdropFilter: 'blur(20px)',
                padding: '1rem 2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1000
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => selectedClient ? setSelectedClient(null) : navigate('/')} 
                        style={{ 
                            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                            border: themeStyles.inputBorder,
                            color: themeStyles.textMuted,
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0, color: themeStyles.textMain }}>
                            {selectedClient ? `${selectedClient.name} Archives` : "Client Reports Vault"}
                        </h1>
                        <p style={{ fontSize: '0.72rem', color: themeStyles.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                            {selectedClient ? `Dynamic Document History logs for ${selectedClient.name}` : "Manage and download corporate audit records"}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Light/Dark Toggle switch */}
                    <button 
                        onClick={toggleTheme}
                        style={{ 
                            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                            border: themeStyles.inputBorder,
                            padding: '8px 14px', 
                            borderRadius: '8px', 
                            color: themeStyles.textMain, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600',
                            fontSize: '0.8rem',
                            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        {isLight ? (
                            <>
                                <Moon size={15} style={{ color: '#64748b' }} />
                                <span>Dark Mode</span>
                            </>
                        ) : (
                            <>
                                <Sun size={15} style={{ color: '#fbbf24' }} />
                                <span>Light Mode</span>
                            </>
                        )}
                    </button>

                    {selectedClient && viewMode === 'detail' && user?.role !== 'client' && (
                        <button 
                            onClick={() => setViewMode('upload')} 
                            style={{ 
                                background: '#10b981',
                                border: 'none',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '0.5rem 1.25rem',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            <Plus size={16} />
                            <span>Publish Report</span>
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN PORTAL VIEWPORTS */}
            <main style={{ flex: 1, padding: '2.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
                
                {/* Error & Success indicators */}
                {error && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)', fontSize: '0.9rem' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '0.9rem' }}>
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                {/* VIEW 1: CLIENTS SELECTION DIRECTORY */}
                {!selectedClient && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                        
                        {/* Search and summary metrics bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ position: 'relative', width: '320px' }}>
                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search by client or stack..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '9px 12px 9px 38px', 
                                        background: themeStyles.inputBg, 
                                        border: themeStyles.inputBorder,
                                        borderRadius: '8px', 
                                        color: themeStyles.textMain, 
                                        fontSize: '0.88rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <span style={{ fontSize: '0.8rem', color: themeStyles.textMuted }}>
                                Enforcing strict aggregate database-to-report synchronization metrics.
                            </span>
                        </div>

                        {/* Clients Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {filteredClients.map((client, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => handleClientClick(client)}
                                    style={{ 
                                        background: themeStyles.cardBg, 
                                        border: themeStyles.cardBorder, 
                                        borderRadius: '16px', 
                                        padding: '1.75rem', 
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.02)' : 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
                                        e.currentTarget.style.boxShadow = isLight ? '0 8px 24px rgba(0,0,0,0.04)' : '0 10px 30px rgba(0, 0, 0, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = themeStyles.cardBorder.split(' ')[2];
                                        e.currentTarget.style.boxShadow = isLight ? '0 4px 12px rgba(0,0,0,0.02)' : 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Database style={{ color: '#2563eb' }} size={18} />
                                            <span style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', color: '#2563eb', letterSpacing: '0.5px' }}>
                                                {client.tech}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', color: themeStyles.textMuted }}>
                                            Last Updated: {client.lastUpdated}
                                        </span>
                                    </div>

                                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '4px 0 0 0', color: themeStyles.textMain }}>{client.name}</h3>
                                    
                                    <div style={{ marginTop: '1rem', borderTop: themeStyles.tableRowBorder, paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.78rem', color: themeStyles.textMuted }}>SLA Reports Registered</span>
                                        <strong style={{ fontSize: '1rem', color: themeStyles.textMain }}>
                                            {client.files} {client.files === 1 ? 'file' : 'files'}
                                        </strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VIEW 2: REPORTS FOR SELECTED CLIENT */}
                {selectedClient && viewMode === 'detail' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        
                        {/* Summary Header Metrics */}
                        <div style={{ 
                            background: isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(13, 18, 36, 0.45)', 
                            border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(59, 130, 246, 0.15)'}`, 
                            borderRadius: '20px',
                            padding: '1.75rem 2.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '24px',
                            backdropFilter: 'blur(16px)',
                            boxShadow: isLight ? '0 10px 25px rgba(148, 163, 184, 0.08)' : '0 10px 30px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    background: '#2563eb',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                                }}>
                                    <Database size={24} />
                                </div>
                                <div>
                                    <span style={{ 
                                        fontSize: '0.68rem', 
                                        color: '#2563eb', 
                                        fontWeight: '800', 
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        display: 'inline-block',
                                        background: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        marginBottom: '6px'
                                    }}>
                                        {selectedClient.tech} Active Node
                                    </span>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: themeStyles.textMain, letterSpacing: '-0.3px' }}>
                                        {selectedClient.name} Archives
                                    </h3>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ 
                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                                    border: themeStyles.cardBorder,
                                    borderRadius: '12px',
                                    padding: '10px 20px',
                                    textAlign: 'center',
                                    minWidth: '120px'
                                }}>
                                    <span style={{ fontSize: '0.62rem', color: themeStyles.textMuted, display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL AUDITS</span>
                                    <strong style={{ fontSize: '1.25rem', color: themeStyles.textMain, fontWeight: '800' }}>{filteredReports.length} {filteredReports.length === 1 ? 'File' : 'Files'}</strong>
                                </div>
                                <div style={{ 
                                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                                    border: themeStyles.cardBorder,
                                    borderRadius: '12px',
                                    padding: '10px 20px',
                                    textAlign: 'center',
                                    minWidth: '150px'
                                }}>
                                    <span style={{ fontSize: '0.62rem', color: themeStyles.textMuted, display: 'block', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REPORTS COMPLIANCE</span>
                                    <strong style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: '800' }}>100% SLA PASS</strong>
                                </div>
                            </div>
                        </div>

                        {/* Filtering controls bar */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            flexWrap: 'wrap', 
                            gap: '16px',
                            background: isLight ? '#ffffff' : 'rgba(13, 18, 36, 0.2)',
                            border: themeStyles.cardBorder,
                            borderRadius: '14px',
                            padding: '10px 16px',
                            boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.02)' : 'none'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Filter size={15} style={{ color: '#2563eb' }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: themeStyles.textMain }}>Filter Logs:</span>
                                </div>

                                <select 
                                    value={filterMonth} 
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                    style={{ 
                                        padding: '6px 12px', 
                                        background: themeStyles.inputBg, 
                                        border: themeStyles.inputBorder, 
                                        borderRadius: '8px', 
                                        color: themeStyles.textMain, 
                                        fontSize: '0.78rem',
                                        fontWeight: '600',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s'
                                    }}
                                >
                                    <option value="">All Months</option>
                                    <option value="January">January</option>
                                    <option value="February">February</option>
                                    <option value="March">March</option>
                                    <option value="April">April</option>
                                    <option value="May">May</option>
                                    <option value="June">June</option>
                                    <option value="July">July</option>
                                    <option value="August">August</option>
                                    <option value="September">September</option>
                                    <option value="October">October</option>
                                    <option value="November">November</option>
                                    <option value="December">December</option>
                                </select>

                                <select 
                                    value={filterYear} 
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    style={{ 
                                        padding: '6px 12px', 
                                        background: themeStyles.inputBg, 
                                        border: themeStyles.inputBorder, 
                                        borderRadius: '8px', 
                                        color: themeStyles.textMain, 
                                        fontSize: '0.78rem',
                                        fontWeight: '600',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s'
                                    }}
                                >
                                    <option value="">All Years</option>
                                    <option value="2026">2026</option>
                                    <option value="2025">2025</option>
                                </select>
                            </div>

                            {(filterMonth || filterYear) && (
                                <button 
                                    onClick={() => { setFilterMonth(''); setFilterYear(''); }}
                                    style={{ 
                                        background: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)', 
                                        border: 'none', 
                                        color: '#2563eb', 
                                        fontSize: '0.75rem', 
                                        fontWeight: '800', 
                                        cursor: 'pointer',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)'}
                                >
                                    Clear Active Filters
                                </button>
                            )}
                        </div>

                        {/* List of Report Documents */}
                        {isLoading ? (
                            <div style={{ padding: '5rem 0', textAlign: 'center' }}>
                                <div className="loader" style={{ width: '32px', height: '32px', borderTopColor: '#2563eb', margin: '0 auto' }}></div>
                                <span style={{ display: 'block', marginTop: '12px', fontSize: '0.8rem', color: themeStyles.textMuted }}>Accessing SLA Archive files...</span>
                            </div>
                        ) : filteredReports.length === 0 ? (
                            <div style={{ 
                                background: isLight ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : 'linear-gradient(135deg, #070b19 0%, #030408 100%)', 
                                border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(59, 130, 246, 0.2)'}`, 
                                padding: '5rem 2rem', 
                                textAlign: 'center', 
                                borderRadius: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px',
                                boxShadow: isLight ? 'inset 0 2px 4px rgba(0,0,0,0.02)' : 'none'
                            }}>
                                <div style={{
                                    background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                    border: themeStyles.cardBorder,
                                    borderRadius: '50%',
                                    padding: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: themeStyles.textMuted,
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.03)',
                                    marginBottom: '8px'
                                }}>
                                    <FileText size={36} style={{ opacity: 0.6 }} />
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: '800', color: themeStyles.textMain }}>
                                        No SLA Records Registered
                                    </h4>
                                    <p style={{ margin: 0, color: themeStyles.textMuted, fontSize: '0.85rem', maxWidth: '380px', lineHeight: '1.5' }}>
                                        There are no dynamic audit logs published for this client environment matching the month/year filters.
                                    </p>
                                </div>
                                {user?.role !== 'client' && (
                                    <button
                                        onClick={() => setViewMode('upload')}
                                        style={{
                                            marginTop: '8px',
                                            background: '#2563eb',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.35)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
                                        }}
                                    >
                                        Publish First SLA Report
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                                {filteredReports.map((report) => (
                                    <div 
                                        key={report.id}
                                        style={{ 
                                            background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(13, 18, 36, 0.4)', 
                                            border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(59, 130, 246, 0.12)'}`, 
                                            borderRadius: '16px',
                                            padding: '1.75rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '18px',
                                            boxShadow: isLight ? '0 4px 20px rgba(148, 163, 184, 0.05)' : '0 4px 30px rgba(0, 0, 0, 0.15)',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(59, 130, 246, 0.12)';
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ 
                                                    background: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)', 
                                                    padding: '12px', 
                                                    borderRadius: '12px',
                                                    border: `1px solid ${isLight ? '#bfdbfe' : 'rgba(37, 99, 235, 0.2)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                                                }}>
                                                    {getFileIcon(report.file_name)}
                                                </div>

                                                <div>
                                                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '800', color: themeStyles.textMain, letterSpacing: '-0.3px' }}>
                                                        {report.title}
                                                    </h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                                                        <span style={{ 
                                                            color: '#2563eb', 
                                                            fontWeight: '800',
                                                            background: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px'
                                                        }}>
                                                            {report.month} {report.year}
                                                        </span>
                                                        <span style={{ color: themeStyles.textMuted }}>•</span>
                                                        <span style={{ color: themeStyles.textMuted, fontWeight: '600' }}>
                                                            Author: <span style={{ color: themeStyles.textMain }}>{report.uploaded_by}</span>
                                                        </span>
                                                        <span style={{ color: themeStyles.textMuted }}>•</span>
                                                        <span style={{ color: themeStyles.textMuted }}>
                                                            Date: {new Date(report.uploaded_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {/* In-Browser Secure Plain/Formatted Reader option */}
                                                <button 
                                                    onClick={() => handleViewDocument(report.id)}
                                                    style={{ 
                                                        background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                                        border: themeStyles.inputBorder,
                                                        color: themeStyles.textMain,
                                                        borderRadius: '8px',
                                                        padding: '8px 16px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        transition: 'all 0.2s',
                                                        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = '#2563eb';
                                                        e.currentTarget.style.background = isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)';
                                                     }}
                                                     onMouseLeave={(e) => {
                                                         e.currentTarget.style.borderColor = themeStyles.inputBorder.split(' ')[2];
                                                         e.currentTarget.style.background = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
                                                     }}
                                                 >
                                                     <Eye size={14} style={{ color: '#2563eb' }} />
                                                     <span>View</span>
                                                 </button>

                                                 {/* Secure Raw Download stream */}
                                                 <button 
                                                      onClick={() => handleDownload(report.id, report.file_name)}
                                                      style={{ 
                                                          background: '#2563eb',
                                                          border: 'none',
                                                          color: '#ffffff',
                                                          borderRadius: '8px',
                                                          padding: '8px 16px',
                                                          fontSize: '0.8rem',
                                                          fontWeight: '700',
                                                          cursor: 'pointer',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '6px',
                                                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                                                          transition: 'all 0.2s'
                                                      }}
                                                      onMouseEnter={(e) => {
                                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)';
                                                      }}
                                                      onMouseLeave={(e) => {
                                                          e.currentTarget.style.transform = 'translateY(0)';
                                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
                                                      }}
                                                  >
                                                      <Download size={14} />
                                                      <span>Download</span>
                                                  </button>

                                                  {/* Share Option (WhatsApp, Outlook, Teams) */}
                                                  <div style={{ position: 'relative' }}>
                                                      <button 
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              setActiveShareReportId(activeShareReportId === report.id ? null : report.id);
                                                          }}
                                                          style={{ 
                                                              background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                                              border: themeStyles.inputBorder,
                                                              color: themeStyles.textMain,
                                                              borderRadius: '8px',
                                                              padding: '8px 16px',
                                                              fontSize: '0.8rem',
                                                              fontWeight: '700',
                                                              cursor: 'pointer',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: '6px',
                                                              transition: 'all 0.2s',
                                                              boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                                          }}
                                                          onMouseEnter={(e) => {
                                                              e.currentTarget.style.borderColor = '#2563eb';
                                                              e.currentTarget.style.background = isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)';
                                                          }}
                                                          onMouseLeave={(e) => {
                                                              e.currentTarget.style.borderColor = themeStyles.inputBorder.split(' ')[2];
                                                              e.currentTarget.style.background = isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)';
                                                          }}
                                                      >
                                                          <Share2 size={14} style={{ color: '#2563eb' }} />
                                                          <span>Share</span>
                                                      </button>

                                                                                                               {activeShareReportId === report.id && (
                                                            <div style={{ 
                                                                position: 'absolute',
                                                                top: '40px',
                                                                right: 0,
                                                                background: themeStyles.modalBg || themeStyles.cardBg,
                                                                border: themeStyles.cardBorder,
                                                                borderRadius: '12px',
                                                                boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                                                                zIndex: 50,
                                                                width: '210px',
                                                                padding: '6px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '4px'
                                                            }}>
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const fileResponse = await api.get(`/new-features/reports/download/${report.id}`, { responseType: 'blob' });
                                                                            const blob = fileResponse.data;
                                                                            const file = new File([blob], report.file_name, { type: blob.type || 'application/octet-stream' });
                                                                            
                                                                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                                                                await navigator.share({
                                                                                    files: [file],
                                                                                    title: report.file_name,
                                                                                    text: `GeoMon Audit Document: ${report.file_name}`
                                                                                });
                                                                                setActiveShareReportId(null);
                                                                            } else {
                                                                                // Secure authenticated local download fallback
                                                                                const blobUrl = window.URL.createObjectURL(blob);
                                                                                const link = document.createElement('a');
                                                                                link.href = blobUrl;
                                                                                link.setAttribute('download', report.file_name);
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                link.remove();
                                                                                window.URL.revokeObjectURL(blobUrl);
                                                                                setActiveShareReportId(null);
                                                                            }
                                                                        } catch (err) {
                                                                            console.error("Direct share failed, falling back to download", err);
                                                                            try {
                                                                                const fileResponse = await api.get(`/new-features/reports/download/${report.id}`, { responseType: 'blob' });
                                                                                const blobUrl = window.URL.createObjectURL(fileResponse.data);
                                                                                const link = document.createElement('a');
                                                                                link.href = blobUrl;
                                                                                link.setAttribute('download', report.file_name);
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                link.remove();
                                                                                window.URL.revokeObjectURL(blobUrl);
                                                                            } catch (dlErr) {
                                                                                alert("Could not download report file.");
                                                                            }
                                                                            setActiveShareReportId(null);
                                                                        }
                                                                    }}
                                                                    style={{ 
                                                                        background: 'none', border: 'none', color: themeStyles.textMain, padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                                >
                                                                    <span style={{ fontSize: '14px' }}>📁</span> Share Document File
                                                                </button>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEmailShareModalReport(report);
                                                                        setEmailRecipient('');
                                                                        setEmailCc('');
                                                                        setEmailSubject(`GeoMon Report Document: ${report.title}`);
                                                                        setEmailBody(`Hi,\n\nPlease find attached the original SLA Diagnostic Report document file for ${selectedClient.name}.\n\nDocument Title: ${report.title}\nFile Name: ${report.file_name}\n\nBest regards,\n${user?.username || 'Operator'}`);
                                                                        setActiveShareReportId(null);
                                                                    }}
                                                                    style={{ 
                                                                        background: 'none', border: 'none', color: themeStyles.textMain, padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                                >
                                                                    <span style={{ fontSize: '14px' }}>📧</span> Outlook Mail Share
                                                                </button>
                                                            </div>
                                                        )}
                                                   </div>

                                                    <button 
                                                        onClick={() => handleToggleReviews(report.id, 'reviews')}
                                                        style={{ 
                                                            background: (expandedReviewReportId === report.id && expandedReviewTab === 'reviews') 
                                                                ? (isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.15)')
                                                                : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)'),
                                                            border: (expandedReviewReportId === report.id && expandedReviewTab === 'reviews')
                                                                ? '1px solid #2563eb'
                                                                : themeStyles.inputBorder,
                                                            color: (expandedReviewReportId === report.id && expandedReviewTab === 'reviews')
                                                                ? '#2563eb'
                                                                : themeStyles.textMain,
                                                            borderRadius: '8px',
                                                            padding: '8px 16px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '700',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            transition: 'all 0.2s',
                                                            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '14px' }}>💬</span>
                                                        <span>Reviews {reportReviews[report.id] !== undefined ? `(${reportReviews[report.id]?.filter(r => r.comment)?.length || 0})` : ''}</span>
                                                    </button>

                                                    <button 
                                                        onClick={() => handleToggleReviews(report.id, 'mom')}
                                                        style={{ 
                                                            background: (expandedReviewReportId === report.id && expandedReviewTab === 'mom') 
                                                                ? (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)')
                                                                : (isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)'),
                                                            border: (expandedReviewReportId === report.id && expandedReviewTab === 'mom')
                                                                ? '1px solid #10b981'
                                                                : themeStyles.inputBorder,
                                                            color: (expandedReviewReportId === report.id && expandedReviewTab === 'mom')
                                                                ? '#10b981'
                                                                : themeStyles.textMain,
                                                            borderRadius: '8px',
                                                            padding: '8px 16px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '700',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            transition: 'all 0.2s',
                                                            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '14px' }}>📝</span>
                                                        <span>MoM {reportReviews[report.id] !== undefined ? `(${reportReviews[report.id]?.filter(r => r.mom)?.length || 0})` : ''}</span>
                                                    </button>
                                                   
{(user?.role === 'admin' || user?.isAdmin) && (
                                                      <button 
                                                          onClick={() => handleDeleteReport(report.id, report.title)}
                                                          style={{ 
                                                              background: 'rgba(239, 68, 68, 0.06)',
                                                              border: '1px solid rgba(239, 68, 68, 0.15)',
                                                              color: '#ef4444',
                                                              borderRadius: '8px',
                                                              padding: '8px 16px',
                                                              fontSize: '0.8rem',
                                                              fontWeight: '700',
                                                              cursor: 'pointer',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              gap: '6px',
                                                              transition: 'all 0.2s'
                                                          }}
                                                          onMouseEnter={(e) => {
                                                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                                          }}
                                                          onMouseLeave={(e) => {
                                                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
                                                          }}
                                                      >
                                                          <Trash2 size={14} />
                                                          <span>Delete</span>
                                                      </button>
                                                  )}
                                                </div>
                                           </div>
                                                  {report.notes && (
                                                <div style={{ 
                                                    marginTop: '6px',
                                                    padding: '16px 20px',
                                                    background: isLight ? '#f8fafc' : 'rgba(37, 99, 235, 0.03)',
                                                    border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(37, 99, 235, 0.1)'}`,
                                                    borderLeft: '4px solid #2563eb',
                                                    borderRadius: '10px',
                                                    fontSize: '0.85rem',
                                                    color: themeStyles.textMuted,
                                                    lineHeight: '1.8',
                                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.01)'
                                                }}>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px', 
                                                        fontWeight: '800', 
                                                        color: '#2563eb', 
                                                        fontSize: '0.72rem', 
                                                        textTransform: 'uppercase', 
                                                        letterSpacing: '1px',
                                                        marginBottom: '8px'
                                                    }}>
                                                        <span style={{ width: '6px', height: '6px', background: '#2563eb', borderRadius: '50%' }}></span>
                                                        Executive Insight Summary
                                                    </div>
                                                    <div style={{ color: themeStyles.textMain, fontWeight: '500' }}>
                                                        {report.notes}
                                                    </div>
                                                </div>
                                            )}

                                            {expandedReviewReportId === report.id && (
                                                <div style={{
                                                    marginTop: '12px',
                                                    padding: '20px',
                                                    background: isLight ? '#f8fafc' : 'rgba(13, 18, 36, 0.6)',
                                                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.05)'}`,
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '16px'
                                                }}>
                                                    {expandedReviewTab === 'reviews' && (
                                                         /* Column 1: Diagnostic Reviews */
                                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                             <div style={{ fontSize: '0.82rem', fontWeight: '800', color: themeStyles.textMain, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.05)'}`, paddingBottom: '6px' }}>
                                                                 Diagnostic Comments & Reviews
                                                             </div>
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', minHeight: '60px' }}>
                                                                 {(!reportReviews[report.id] || reportReviews[report.id].filter(r => r.comment).length === 0) ? (
                                                                     <div style={{ color: themeStyles.textMuted, fontSize: '0.75rem', fontStyle: 'italic', padding: '6px 0' }}>
                                                                         No diagnostic comments submitted yet.
                                                                     </div>
                                                                 ) : (
                                                                     reportReviews[report.id].filter(r => r.comment).map((rev) => (
                                                                         <div key={rev.id} style={{ 
                                                                             padding: '10px 12px', 
                                                                             background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)', 
                                                                             border: themeStyles.cardBorder, 
                                                                             borderRadius: '8px' 
                                                                         }}>
                                                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                                 <span style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMain }}>{rev.username}</span>
                                                                                 <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted }}>{new Date(rev.created_at).toLocaleDateString()}</span>
                                                                             </div>
                                                                             <div style={{ fontSize: '0.78rem', color: themeStyles.textMain, whiteSpace: 'pre-wrap' }}>
                                                                                 {rev.comment}
                                                                             </div>
                                                                         </div>
                                                                     ))
                                                                 )}
                                                             </div>
                                                             {/* Submit Comment Form */}
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                                                                 <textarea
                                                                     placeholder="Write your comments/review here..."
                                                                     value={reviewComments[report.id] || ''}
                                                                     onChange={(e) => setReviewComments(prev => ({ ...prev, [report.id]: e.target.value }))}
                                                                     rows={2}
                                                                     style={{
                                                                         width: '100%',
                                                                         padding: '8px 12px',
                                                                         background: themeStyles.inputBg,
                                                                         border: themeStyles.inputBorder,
                                                                         borderRadius: '8px',
                                                                         color: themeStyles.textMain,
                                                                         fontSize: '0.8rem',
                                                                         resize: 'vertical',
                                                                         outline: 'none'
                                                                     }}
                                                                 />
                                                                 <button
                                                                     onClick={() => handleSubmitComment(report.id)}
                                                                     disabled={!reviewComments[report.id]?.trim()}
                                                                     style={{
                                                                         alignSelf: 'flex-end',
                                                                         background: '#2563eb',
                                                                         color: '#ffffff',
                                                                         border: 'none',
                                                                         padding: '5px 12px',
                                                                         borderRadius: '6px',
                                                                         fontSize: '0.75rem',
                                                                         fontWeight: '700',
                                                                         cursor: 'pointer',
                                                                         opacity: !reviewComments[report.id]?.trim() ? 0.6 : 1,
                                                                         transition: 'all 0.2s'
                                                                     }}
                                                                 >
                                                                     Submit Comment
                                                                 </button>
                                                             </div>
                                                         </div>
                                                    )}

                                                    {expandedReviewTab === 'mom' && (
                                                         /* Column 2: Minutes of Meeting (MoM) */
                                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                             <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.05)'}`, paddingBottom: '6px' }}>
                                                                 Minutes of Meeting (MoM)
                                                             </div>
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', minHeight: '60px' }}>
                                                                 {(!reportReviews[report.id] || reportReviews[report.id].filter(r => r.mom).length === 0) ? (
                                                                     <div style={{ color: themeStyles.textMuted, fontSize: '0.75rem', fontStyle: 'italic', padding: '6px 0' }}>
                                                                         No MoM logs submitted yet.
                                                                     </div>
                                                                 ) : (
                                                                     reportReviews[report.id].filter(r => r.mom).map((rev) => (
                                                                         <div key={rev.id} style={{ 
                                                                             padding: '10px 12px', 
                                                                             background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)', 
                                                                             borderLeft: '3px solid #10b981',
                                                                             borderTop: themeStyles.cardBorder.split(' ').slice(1).join(' '),
                                                                             borderRight: themeStyles.cardBorder.split(' ').slice(1).join(' '),
                                                                             borderBottom: themeStyles.cardBorder.split(' ').slice(1).join(' '),
                                                                             borderRadius: '8px' 
                                                                         }}>
                                                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                                                 <span style={{ fontSize: '0.75rem', fontWeight: '700', color: themeStyles.textMain }}>{rev.username}</span>
                                                                                 <span style={{ fontSize: '0.68rem', color: themeStyles.textMuted }}>{new Date(rev.created_at).toLocaleDateString()}</span>
                                                                             </div>
                                                                             <div style={{ fontSize: '0.78rem', color: themeStyles.textMain, whiteSpace: 'pre-wrap' }}>
                                                                                 {rev.mom}
                                                                             </div>
                                                                         </div>
                                                                     ))
                                                                 )}
                                                             </div>
                                                             {/* Submit MoM Form */}
                                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                                                                 <textarea
                                                                     placeholder="Add Minutes of Meeting (MoM) details here..."
                                                                     value={reviewMoms[report.id] || ''}
                                                                     onChange={(e) => setReviewMoms(prev => ({ ...prev, [report.id]: e.target.value }))}
                                                                     rows={2}
                                                                     style={{
                                                                         width: '100%',
                                                                         padding: '8px 12px',
                                                                         background: themeStyles.inputBg,
                                                                         border: themeStyles.inputBorder,
                                                                         borderRadius: '8px',
                                                                         color: themeStyles.textMain,
                                                                         fontSize: '0.8rem',
                                                                         resize: 'vertical',
                                                                         outline: 'none'
                                                                     }}
                                                                 />
                                                                 <button
                                                                     onClick={() => handleSubmitMom(report.id)}
                                                                     disabled={!reviewMoms[report.id]?.trim()}
                                                                     style={{
                                                                         alignSelf: 'flex-end',
                                                                         background: '#10b981',
                                                                         color: '#ffffff',
                                                                         border: 'none',
                                                                         padding: '5px 12px',
                                                                         borderRadius: '6px',
                                                                         fontSize: '0.75rem',
                                                                         fontWeight: '700',
                                                                         cursor: 'pointer',
                                                                         opacity: !reviewMoms[report.id]?.trim() ? 0.6 : 1,
                                                                         transition: 'all 0.2s'
                                                                     }}
                                                                 >
                                                                     Submit MoM
                                                                 </button>
                                                             </div>
                                                         </div>
                                                    )}
                                                </div>
                                            )}
                                     </div>
                                 ))}
                             </div>
                        )}
                    </div>
                )}

                {/* VIEW 3: PUBLISH NEW DOCUMENT FORM */}
                {selectedClient && viewMode === 'upload' && (
                    <div style={{ 
                        background: themeStyles.cardBg, 
                        border: themeStyles.cardBorder, 
                        borderRadius: '16px',
                        padding: '2rem 2.5rem',
                        maxWidth: '750px',
                        margin: '0 auto',
                        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                    }}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: themeStyles.textMain }}>Publish SLA Diagnostic Audit Report</h3>
                            <p style={{ fontSize: '0.78rem', color: themeStyles.textMuted, margin: '2px 0 0 0' }}>
                                Registering a file increments dynamic database statistics for {selectedClient.name}
                            </p>
                        </div>

                        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMuted }}>Report Title / Identifier</label>
                                <input 
                                    type="text" 
                                    className="login-input" 
                                    placeholder="e.g. MySQL Master Node Replication Health Audit"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    style={{ margin: 0, width: '100%', padding: '10px 14px', borderRadius: '8px', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMuted }}>Audit Month</label>
                                    <select 
                                        value={month} 
                                        onChange={(e) => setMonth(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '8px', color: themeStyles.textMain, fontSize: '0.9rem', outline: 'none' }}
                                    >
                                        <option value="January">January</option>
                                        <option value="February">February</option>
                                        <option value="March">March</option>
                                        <option value="April">April</option>
                                        <option value="May">May</option>
                                        <option value="June">June</option>
                                        <option value="July">July</option>
                                        <option value="August">August</option>
                                        <option value="September">September</option>
                                        <option value="October">October</option>
                                        <option value="November">November</option>
                                        <option value="December">December</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMuted }}>Audit Year</label>
                                    <select 
                                        value={year} 
                                        onChange={(e) => setYear(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '8px', color: themeStyles.textMain, fontSize: '0.9rem', outline: 'none' }}
                                    >
                                        <option value="2026">2026</option>
                                        <option value="2025">2025</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMuted }}>Executive Summary / Commentary</label>
                                <textarea 
                                    rows={4}
                                    className="login-input"
                                    placeholder="Provide high-level summary of findings, warnings, node errors, or performance recommendations..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    style={{ margin: 0, width: '100%', height: 'auto', background: themeStyles.inputBg, border: themeStyles.inputBorder, color: themeStyles.textMain, padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', color: themeStyles.textMuted }}>Attach Diagnostic Document (.docx, .pdf, .txt, .xlsx)</label>
                                <div style={{ 
                                    border: `2px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, 
                                    borderRadius: '10px', 
                                    padding: '2rem 1.5rem', 
                                    textAlign: 'center',
                                    background: isLight ? '#f8fafc' : 'rgba(0,0,0,0.1)'
                                }}>
                                    <input 
                                        type="file" 
                                        id="report-file" 
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    
                                    {!selectedFile ? (
                                        <label htmlFor="report-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <UploadCloud size={32} style={{ color: '#2563eb' }} />
                                            <span style={{ fontSize: '0.85rem', color: themeStyles.textMain, fontWeight: '600' }}>Click to select a local document</span>
                                            <span style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>PDF, Word, Plain Text, or Excel files accepted</span>
                                        </label>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                                            <FileText style={{ color: '#2563eb' }} size={24} />
                                            <div style={{ textAlign: 'left' }}>
                                                <strong style={{ fontSize: '0.85rem', color: themeStyles.textMain, display: 'block' }}>{selectedFile.name}</strong>
                                                <span style={{ fontSize: '0.7rem', color: themeStyles.textMuted }}>File Size: {selectedFile.size}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedFile(null)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setViewMode('detail')}
                                    style={{ padding: '8px 20px', border: themeStyles.inputBorder, background: 'none', color: themeStyles.textMain, borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    style={{ padding: '8px 24px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    {isLoading ? 'Publishing...' : 'Publish Audit Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>

            {/* HIGH-FIDELITY SECURE IN-BROWSER DOCUMENT VIEWER MODAL */}
            {viewingReport && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    background: 'rgba(0, 0, 0, 0.75)', 
                    backdropFilter: 'blur(10px)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    zIndex: 2000,
                    padding: '2rem'
                }}>
                    <div style={{ 
                        background: themeStyles.modalBg, 
                        border: themeStyles.cardBorder, 
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '1.25rem 1.75rem', borderBottom: themeStyles.tableRowBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <ShieldCheck style={{ color: '#16a34a' }} size={20} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: themeStyles.textMain }}>{viewingReport.title}</h3>
                                    <span style={{ fontSize: '0.7rem', color: themeStyles.textMuted }}>Secure Sandbox Diagnostics Overlay • {viewingReport.file_name}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setViewingReport(null)}
                                style={{ background: 'none', border: 'none', color: themeStyles.textMuted, cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        
                        {/* Modal Reader Frame (Only Original Document File Rendering) */}
                        <div style={{ 
                            padding: '2rem', 
                            overflowY: 'auto', 
                            flex: 1, 
                            background: isLight ? '#f8fafc' : 'rgba(5, 7, 16, 0.95)',
                            fontFamily: 'Inter, sans-serif'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
                                {(() => {
                                    const ext = viewingReport.file_ext || viewingReport.file_name?.split('.').pop().toLowerCase();
                                    if (ext === 'docx') {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                                    <div 
                                                        id="docx-native-container" 
                                                        style={{ 
                                                            width: '100%', 
                                                            maxWidth: '820px', 
                                                            minHeight: '400px', 
                                                            background: 'white', 
                                                            padding: '2.5rem', 
                                                            borderRadius: '12px', 
                                                            border: '1px solid #cbd5e1', 
                                                            overflowX: 'auto',
                                                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    } else if (ext === 'pdf') {
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                <iframe 
                                                    src={viewingReport.blob_url || viewingReport.file_data} 
                                                    title="PDF Document Viewer"
                                                    style={{ 
                                                        width: '100%', 
                                                        maxWidth: '920px', 
                                                        height: '800px', 
                                                        borderRadius: '12px', 
                                                        border: '1px solid #cbd5e1',
                                                        background: '#ffffff',
                                                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
                                                    }}
                                                />
                                            </div>
                                        );
                                    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                <img 
                                                    src={viewingReport.blob_url || viewingReport.file_data} 
                                                    alt="Report Asset preview"
                                                    style={{ 
                                                        maxWidth: '100%', 
                                                        maxHeight: '800px', 
                                                        borderRadius: '12px', 
                                                        border: '1px solid #cbd5e1',
                                                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
                                                    }}
                                                />
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                padding: '4rem 2rem', 
                                                textAlign: 'center', 
                                                gap: '1.5rem',
                                                background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
                                                border: themeStyles.cardBorder,
                                                borderRadius: '16px',
                                                maxWidth: '600px',
                                                width: '100%',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)'
                                            }}>
                                                <div style={{ fontSize: '3rem', margin: 0 }}>📂</div>
                                                <div>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: themeStyles.textMain }}>
                                                        Original Document Native Preview
                                                    </h4>
                                                    <p style={{ fontSize: '0.82rem', color: themeStyles.textMuted, maxWidth: '420px', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
                                                        This file format ({ext ? ext.toUpperCase() : 'UNKNOWN'}) cannot be natively previewed inside the browser sandbox. Please click the <strong>'Download Document'</strong> button below to open the original file with your local native applications.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>

                                                {/* Modal Footer */}
                        <div style={{ padding: '1rem 1.75rem', borderTop: themeStyles.tableRowBorder, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button 
                                onClick={() => handleDownload(viewingReport.id, viewingReport.file_name)}
                                style={{ 
                                    background: '#2563eb', 
                                    border: 'none', 
                                    color: '#fff', 
                                    padding: '7px 18px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.82rem', 
                                    fontWeight: '700', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Download size={14} />
                                <span>Download Document</span>
                            </button>
                            <button 
                                onClick={() => setViewingReport(null)}
                                style={{ 
                                    background: 'none', 
                                    border: themeStyles.inputBorder, 
                                    color: themeStyles.textMain, 
                                    padding: '7px 18px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.82rem', 
                                    fontWeight: '700', 
                                    cursor: 'pointer' 
                                }}
                            >
                                Close Reader
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Document Attachment Share Overlay Modal */}
            {emailShareModalReport && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: themeStyles.modalBg || themeStyles.cardBg,
                        border: themeStyles.cardBorder, borderRadius: '16px',
                        width: '90%', maxWidth: '480px', padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)', position: 'relative',
                        color: themeStyles.textMain
                    }}>
                        <button 
                            onClick={() => setEmailShareModalReport(null)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: themeStyles.textMuted, cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '20px' }}>📧</span>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Email Document File</h3>
                        </div>
                        
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: themeStyles.textMuted }}>
                            The original document file <strong>{emailShareModalReport.file_name}</strong> will be physically attached to the outgoing email.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: themeStyles.textMuted }}>To Recipient</label>
                                <input 
                                    type="email" 
                                    value={emailRecipient} 
                                    onChange={(e) => setEmailRecipient(e.target.value)}
                                    placeholder="recipient@company.com"
                                    style={{ width: '100%', padding: '8px 12px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: themeStyles.textMuted }}>Cc Recipient (Optional)</label>
                                <input 
                                    type="email" 
                                    value={emailCc} 
                                    onChange={(e) => setEmailCc(e.target.value)}
                                    placeholder="cc@company.com"
                                    style={{ width: '100%', padding: '8px 12px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: themeStyles.textMuted }}>Subject</label>
                                <input 
                                    type="text" 
                                    value={emailSubject} 
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    style={{ width: '100%', padding: '8px 12px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', color: themeStyles.textMuted }}>Message Body</label>
                                <textarea 
                                    value={emailBody} 
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={4}
                                    style={{ width: '100%', padding: '8px 12px', background: themeStyles.inputBg, border: themeStyles.inputBorder, borderRadius: '6px', color: themeStyles.textMain, fontSize: '0.78rem', outline: 'none', resize: 'none' }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button 
                                onClick={() => setEmailShareModalReport(null)}
                                style={{ background: 'none', border: themeStyles.inputBorder, color: themeStyles.textMain, padding: '8px 16px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!emailRecipient || !emailRecipient.includes('@')) {
                                        alert("Please enter a valid recipient email address.");
                                        return;
                                    }
                                    setEmailSending(true);
                                    try {
                                        await api.post('/new-features/reports/share/email', {
                                            report_id: emailShareModalReport.id,
                                            to_email: emailRecipient,
                                            cc_email: emailCc,
                                            subject: emailSubject,
                                            body: emailBody
                                        });
                                        alert("Original document file emailed successfully as a secure attachment!");
                                        setEmailShareModalReport(null);
                                    } catch (err) {
                                        console.error("Failed to share report via email:", err);
                                        alert(err.response?.data?.detail || "Failed to transmit secure document attachment.");
                                    } finally {
                                        setEmailSending(false);
                                    }
                                }}
                                disabled={emailSending}
                                style={{
                                    background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: emailSending ? 'not-allowed' : 'pointer', opacity: emailSending ? 0.7 : 1
                                }}
                            >
                                {emailSending ? "Sending Attachment..." : "Send Secure Email"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            

        </div>
    );
};

export default ReportsHub;