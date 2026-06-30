import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download, Eye, ChevronLeft, Calendar } from 'lucide-react';
import './ReportDownload.css';

const ReportDownload = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');

  const userId = localStorage.getItem('userId');
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchReports();
  }, [clientId]);

  useEffect(() => {
    if (selectedMonth) {
      const filtered = reports.filter(report => {
        const reportMonth = new Date(report.report_month).toISOString().slice(0, 7);
        return reportMonth === selectedMonth;
      });
      setFilteredReports(filtered);
    } else {
      // Show latest reports by default
      const latestReports = {};
      reports.forEach(report => {
        const month = new Date(report.report_month).toISOString().slice(0, 7);
        if (!latestReports[month]) {
          latestReports[month] = report;
        }
      });
      setFilteredReports(Object.values(latestReports).sort((a, b) =>
        new Date(b.upload_date) - new Date(a.upload_date)
      ));
    }
  }, [selectedMonth, reports]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      // Fetch client info
      const clientsRes = await axios.get(
        `${baseURL}/api/reports/clients/user/${userId}`
      );
      const client = clientsRes.data.find(c => c.id === parseInt(clientId));
      setClientName(client?.name || '');

      // Fetch reports
      const reportsRes = await axios.get(
        `${baseURL}/api/reports/client/${clientId}/reports?user_id=${userId}`
      );
      setReports(reportsRes.data);
      setError('');
    } catch (err) {
      setError('Failed to load reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      const response = await axios.get(
        `${baseURL}/api/reports/download/${report.id}?user_id=${userId}`
      );

      // In production, use the file path from response
      // For now, create a download link simulation
      const link = document.createElement('a');
      link.href = response.data.file_path;
      link.download = response.data.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to download file');
      console.error(err);
    }
  };

  const handleView = (report) => {
    // In production, open the file in a viewer or new tab
    alert(`View ${report.file_name}\n\nFile path: ${report.file_path}`);
  };

  const getUniqueMonths = () => {
    const months = new Set();
    reports.forEach(report => {
      const month = new Date(report.report_month).toISOString().slice(0, 7);
      months.add(month);
    });
    return Array.from(months).sort().reverse();
  };

  if (loading) {
    return <div className="download-loading">Loading reports...</div>;
  }

  return (
    <div className="download-container">
      <button className="back-btn" onClick={() => navigate(`/reports/client/${clientId}`)}>
        <ChevronLeft size={20} /> Back
      </button>

      <div className="download-header">
        <h1>Download Reports</h1>
        <p>{clientName}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {reports.length > 0 && (
        <div className="month-filter">
          <div className="filter-header">
            <Calendar size={20} />
            <label>Filter by Month:</label>
          </div>
          <div className="month-buttons">
            <button
              className={`month-btn ${!selectedMonth ? 'active' : ''}`}
              onClick={() => setSelectedMonth('')}
            >
              All / Latest
            </button>
            {getUniqueMonths().map(month => (
              <button
                key={month}
                className={`month-btn ${selectedMonth === month ? 'active' : ''}`}
                onClick={() => setSelectedMonth(month)}
              >
                {new Date(month + '-01').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long'
                })}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="no-reports">
          <p>No reports found {selectedMonth ? 'for this month' : ''}</p>
          <button
            onClick={() => navigate(`/reports/client/${clientId}/upload`)}
            className="upload-link-btn"
          >
            Upload a Report
          </button>
        </div>
      ) : (
        <div className="reports-container">
          <div className="reports-count">
            Showing {filteredReports.length} report(s)
          </div>

          <div className="reports-table">
            <div className="table-header">
              <div className="col-name">File Name</div>
              <div className="col-month">Month</div>
              <div className="col-date">Upload Date</div>
              <div className="col-actions">Actions</div>
            </div>

            {filteredReports.map((report) => (
              <div key={report.id} className="table-row">
                <div className="col-name">
                  <span className="file-icon">📄</span>
                  {report.file_name}
                </div>
                <div className="col-month">
                  {new Date(report.report_month).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </div>
                <div className="col-date">
                  {new Date(report.upload_date).toLocaleDateString('en-US')}
                </div>
                <div className="col-actions">
                  <button
                    className="action-btn view-btn"
                    onClick={() => handleView(report)}
                    title="View Report"
                  >
                    <Eye size={18} />
                    View
                  </button>
                  <button
                    className="action-btn download-btn"
                    onClick={() => handleDownload(report)}
                    title="Download Report"
                  >
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDownload;
