import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, Download, ChevronLeft } from 'lucide-react';
import './ClientDetails.css';

const ClientDetails = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [clientInfo, setClientInfo] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = localStorage.getItem('userId');
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      
      // Fetch all clients to get current client info
      const clientsRes = await axios.get(
        `${baseURL}/api/reports/clients/user/${userId}`
      );
      const client = clientsRes.data.find(c => c.id === parseInt(clientId));
      setClientInfo(client);

      // Fetch client reports
      const reportsRes = await axios.get(
        `${baseURL}/api/reports/client/${clientId}/reports?user_id=${userId}`
      );
      setReports(reportsRes.data);
      setError('');
    } catch (err) {
      setError('Failed to load client data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    navigate(`/reports/client/${clientId}/upload`);
  };

  const handleDownloadClick = () => {
    navigate(`/reports/client/${clientId}/download`);
  };

  if (loading) {
    return <div className="client-details-loading">Loading...</div>;
  }

  if (!clientInfo) {
    return <div className="client-details-error">Client not found</div>;
  }

  return (
    <div className="client-details-container">
      <button className="back-btn" onClick={() => navigate('/reports/clients')}>
        <ChevronLeft size={20} /> Back to Clients
      </button>

      <div className="client-details-header">
        <h1>{clientInfo.name}</h1>
        <p className="db-type-badge">{clientInfo.database_type}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="client-details-grid">
        {/* Upload Grid Box */}
        <div className="details-grid-box upload-box" onClick={handleUploadClick}>
          <div className="grid-icon">
            <Upload size={64} />
          </div>
          <h2>Upload Report</h2>
          <p>Upload a new report for this client</p>
          <button className="details-btn">Upload Report</button>
        </div>

        {/* Download Grid Box */}
        <div className="details-grid-box download-box" onClick={handleDownloadClick}>
          <div className="grid-icon">
            <Download size={64} />
          </div>
          <h2>Download Report</h2>
          <p>View and download existing reports</p>
          <button className="details-btn">View Reports</button>
        </div>
      </div>

      {/* Recent Reports Summary */}
      {reports.length > 0 && (
        <div className="recent-reports-section">
          <h3>Recent Uploads ({reports.length})</h3>
          <div className="reports-list">
            {reports.slice(0, 5).map((report) => (
              <div key={report.id} className="report-item">
                <span className="report-name">{report.file_name}</span>
                <span className="report-date">{new Date(report.upload_date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetails;
