import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, LayoutDashboard, BarChart3 } from 'lucide-react';
import './ReportHome.css';

const ReportHome = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole') || 'user';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleReportsClick = () => {
    navigate('/reports/clients');
  };

  const handleAdminMonitoringClick = () => {
    navigate('/admin/monitoring');
  };

  return (
    <div className="report-home-container">
      <div className="report-home-header">
        <h1>Welcome to Report Management</h1>
        <p>Manage your reports and client data</p>
        {isAdmin && <span className="admin-badge">👑 Admin</span>}
      </div>

      <div className="report-home-grid">
        {/* Dashboard Grid Box */}
        <div className="report-grid-box dashboard-box" onClick={handleDashboardClick}>
          <div className="grid-box-icon">
            <LayoutDashboard size={64} />
          </div>
          <h2>Current Dashboard</h2>
          <p>View main analytics and logs</p>
          <button className="grid-box-btn">View Dashboard</button>
        </div>

        {/* Reports Grid Box */}
        <div className="report-grid-box reports-box" onClick={handleReportsClick}>
          <div className="grid-box-icon">
            <FileText size={64} />
          </div>
          <h2>All Reports</h2>
          <p>Access client reports and downloads</p>
          <button className="grid-box-btn">View Reports</button>
        </div>

        {/* Admin Monitoring Grid Box (Admin Only) */}
        {isAdmin && (
          <div className="report-grid-box admin-box" onClick={handleAdminMonitoringClick}>
            <div className="grid-box-icon">
              <BarChart3 size={64} />
            </div>
            <h2>Admin Monitoring</h2>
            <p>Track user activity and system metrics</p>
            <button className="grid-box-btn">View Monitoring</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportHome;
