import React, { useEffect, useState } from 'react';
import { BarChart3, Users, FileText, Activity, Clock, TrendingUp } from 'lucide-react';
import axios from 'axios';
import './AdminMonitoring.css';

const AdminMonitoring = ({ userId, isAdmin }) => {
  const [metrics, setMetrics] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [clientEngagement, setClientEngagement] = useState([]);
  const [userTimeSpent, setUserTimeSpent] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminData();
  }, [isAdmin, userId]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError('');

      // Verify admin access
      await axios.get(`${baseURL}/api/admin/verify-admin?user_id=${userId}`);

      // Fetch all metrics in parallel
      const [metricsRes, activityRes, clientRes, timeRes, recentRes] = await Promise.all([
        axios.get(`${baseURL}/api/admin/dashboard/metrics?user_id=${userId}`),
        axios.get(`${baseURL}/api/admin/dashboard/user-activity?user_id=${userId}`),
        axios.get(`${baseURL}/api/admin/dashboard/client-engagement?user_id=${userId}`),
        axios.get(`${baseURL}/api/admin/dashboard/user-time-spent?user_id=${userId}`),
        axios.get(`${baseURL}/api/admin/dashboard/recent-activity?user_id=${userId}&days=7`)
      ]);

      setMetrics(metricsRes.data);
      setUserActivity(activityRes.data);
      setClientEngagement(clientRes.data);
      setUserTimeSpent(timeRes.data);
      setRecentActivity(recentRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load admin data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return <div className="admin-loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-monitoring">
      <div className="admin-header">
        <div className="admin-title">
          <BarChart3 size={32} />
          <h2>Admin Monitoring Dashboard</h2>
        </div>
        <button onClick={fetchAdminData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Metrics Cards */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon clients">
              <FileText size={28} />
            </div>
            <div className="metric-content">
              <p className="metric-label">Total Clients</p>
              <p className="metric-value">{metrics.total_clients}</p>
              <p className="metric-subtext">{metrics.active_clients} active</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon reports">
              <TrendingUp size={28} />
            </div>
            <div className="metric-content">
              <p className="metric-label">Total Reports</p>
              <p className="metric-value">{metrics.total_reports}</p>
              <p className="metric-subtext">Avg {metrics.avg_reports_per_client} per client</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon users">
              <Users size={28} />
            </div>
            <div className="metric-content">
              <p className="metric-label">Active Users</p>
              <p className="metric-value">{metrics.total_users}</p>
              <p className="metric-subtext">Accessing reports</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon activity">
              <Activity size={28} />
            </div>
            <div className="metric-content">
              <p className="metric-label">Activities (30d)</p>
              <p className="metric-value">{metrics.total_activities_last_30_days}</p>
              <p className="metric-subtext">Last 30 days</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Activity
        </button>
        <button
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          Client Engagement
        </button>
        <button
          className={`tab-btn ${activeTab === 'time' ? 'active' : ''}`}
          onClick={() => setActiveTab('time')}
        >
          Time Spent
        </button>
        <button
          className={`tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h3>System Overview</h3>
            <p>Monitor all system activities and metrics</p>
            <div className="overview-cards">
              <div className="overview-item">
                <span className="label">Total Clients:</span>
                <span className="value">{metrics?.total_clients}</span>
              </div>
              <div className="overview-item">
                <span className="label">Active Clients:</span>
                <span className="value">{metrics?.active_clients}</span>
              </div>
              <div className="overview-item">
                <span className="label">Total Reports:</span>
                <span className="value">{metrics?.total_reports}</span>
              </div>
              <div className="overview-item">
                <span className="label">Total Users:</span>
                <span className="value">{metrics?.total_users}</span>
              </div>
              <div className="overview-item">
                <span className="label">Activities (30d):</span>
                <span className="value">{metrics?.total_activities_last_30_days}</span>
              </div>
              <div className="overview-item">
                <span className="label">Avg Reports/Client:</span>
                <span className="value">{metrics?.avg_reports_per_client}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="data-section">
            <h3>User Activity Report</h3>
            {userActivity.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Uploads</th>
                      <th>Downloads</th>
                      <th>Most Active Client</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivity.map((user, idx) => (
                      <tr key={idx}>
                        <td className="bold">{user.username}</td>
                        <td className="upload">📤 {user.total_uploads}</td>
                        <td className="download">📥 {user.total_downloads}</td>
                        <td>{user.most_active_client || '-'}</td>
                        <td className="date">
                          {user.last_activity
                            ? new Date(user.last_activity).toLocaleDateString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">No user activity data</p>
            )}
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="data-section">
            <h3>Client Engagement Metrics</h3>
            {clientEngagement.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Database Type</th>
                      <th>Total Reports</th>
                      <th>Users Accessing</th>
                      <th>Last Report Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientEngagement.map((client, idx) => (
                      <tr key={idx}>
                        <td className="bold">{client.client_name}</td>
                        <td className="db-type">{client.database_type}</td>
                        <td className="count">{client.total_reports}</td>
                        <td className="count">{client.total_users_accessing}</td>
                        <td className="date">
                          {client.last_report_date
                            ? new Date(client.last_report_date).toLocaleDateString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">No client engagement data</p>
            )}
          </div>
        )}

        {activeTab === 'time' && (
          <div className="data-section">
            <h3>User Time Spent on Clients</h3>
            {userTimeSpent.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Client Name</th>
                      <th>Time Spent (Hours)</th>
                      <th>Reports Accessed</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userTimeSpent.map((item, idx) => (
                      <tr key={idx}>
                        <td className="bold">{item.username}</td>
                        <td>{item.client_name}</td>
                        <td className="time">
                          <Clock size={16} /> {item.time_spent_hours}h
                        </td>
                        <td className="count">{item.reports_accessed}</td>
                        <td className="date">
                          {new Date(item.last_activity).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">No time tracking data</p>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="data-section">
            <h3>Recent Activity (Last 7 Days)</h3>
            {recentActivity.length > 0 ? (
              <div className="activity-list">
                {recentActivity.map((item, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="activity-badge">
                      {item.action === 'upload' ? '📤' : '📥'}
                    </div>
                    <div className="activity-details">
                      <p className="activity-main">
                        <strong>{item.username}</strong>
                        {item.action === 'upload' ? ' uploaded ' : ' downloaded '}
                        <strong>{item.file_name}</strong>
                      </p>
                      <p className="activity-sub">
                        Client: <strong>{item.client_name}</strong> • 
                        Date: {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No recent activity</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;
