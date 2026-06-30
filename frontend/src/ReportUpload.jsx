import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, ChevronLeft, AlertCircle } from 'lucide-react';
import './ReportUpload.css';

const ReportUpload = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    reportMonth: '',
    reportType: 'general',
    file: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');

  const userId = localStorage.getItem('userId');
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      setFormData(prev => ({
        ...prev,
        file: file
      }));
      setFileName(file.name);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.reportMonth || !formData.file) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const uploadFormData = new FormData();
      uploadFormData.append('client_id', clientId);
      uploadFormData.append('report_month', formData.reportMonth);
      uploadFormData.append('report_type', formData.reportType);
      uploadFormData.append('user_id', userId);
      uploadFormData.append('file', formData.file);

      const response = await axios.post(
        `${baseURL}/api/reports/upload`,
        uploadFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setSuccess('Report uploaded successfully!');
      setFormData({
        reportMonth: '',
        reportType: 'general',
        file: null
      });
      setFileName('');

      // Redirect to download page after 2 seconds
      setTimeout(() => {
        navigate(`/reports/client/${clientId}/download`);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <button className="back-btn" onClick={() => navigate(`/reports/client/${clientId}`)}>
        <ChevronLeft size={20} /> Back
      </button>

      <div className="upload-wrapper">
        <div className="upload-header">
          <div className="upload-icon">
            <Upload size={48} />
          </div>
          <h1>Upload Report</h1>
          <p>Upload a new report file for this client</p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {error && (
            <div className="form-alert error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="form-alert success">
              <span>✓ {success}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reportMonth" className="required">Report Month</label>
            <input
              type="month"
              id="reportMonth"
              name="reportMonth"
              value={formData.reportMonth}
              onChange={handleInputChange}
              required
              className="form-input"
            />
            <small>Select the month for this report</small>
          </div>

          <div className="form-group">
            <label htmlFor="reportType">Report Type</label>
            <select
              id="reportType"
              name="reportType"
              value={formData.reportType}
              onChange={handleInputChange}
              className="form-input"
            >
              <option value="general">General Report</option>
              <option value="summary">Summary Report</option>
              <option value="detailed">Detailed Report</option>
              <option value="audit">Audit Report</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="file-upload-group">
            <label htmlFor="file" className="required">Upload File</label>
            <div className="file-upload-area">
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                required
                className="file-input"
                accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.txt"
              />
              <div className="upload-placeholder">
                <Upload size={40} />
                <p>Drag and drop your file here</p>
                <p className="file-formats">or click to select (PDF, Excel, Word, CSV, TXT)</p>
                {fileName && <p className="selected-file">✓ {fileName}</p>}
              </div>
            </div>
            <small>Maximum file size: 50MB</small>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(`/reports/client/${clientId}`)}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-submit"
            >
              {loading ? 'Uploading...' : 'Upload Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportUpload;
