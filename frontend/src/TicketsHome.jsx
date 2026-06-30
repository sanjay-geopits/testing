import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Plus, TrendingUp } from 'lucide-react';
import axios from 'axios';
import './TicketsHome.css';

const TicketsHome = ({ userId }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, ticketsRes] = await Promise.all([
        axios.get(`${baseURL}/api/tickets/statistics/overview?user_id=${userId}`),
        axios.get(`${baseURL}/api/tickets/list?user_id=${userId}`)
      ]);

      setStats(statsRes.data);
      setRecentTickets(ticketsRes.data?.slice(0, 5) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffa94d';
      case 'low': return '#69db7c';
      default: return '#868e96';
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'open': return { bg: '#e7f5ff', color: '#1971c2', text: 'Open' };
      case 'in_progress': return { bg: '#fff3bf', color: '#f59f00', text: 'In Progress' };
      case 'resolved': return { bg: '#d3f9d8', color: '#2f9e44', text: 'Resolved' };
      case 'closed': return { bg: '#f1f3f5', color: '#495057', text: 'Closed' };
      default: return { bg: '#f1f3f5', color: '#495057', text: status };
    }
  };

  if (loading) {
    return <div className="tickets-loading">Loading tickets...</div>;
  }

  return (
    <div className="tickets-home">
      <div className="tickets-header">
        <div className="tickets-title">
          <Ticket size={32} />
          <div>
            <h1>Support Tickets</h1>
            <p>Manage and track support requests</p>
          </div>
        </div>
        <button className="btn-new-ticket" onClick={() => navigate('/tickets/new')}>
          <Plus size={20} /> New Ticket
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card open">
            <div className="stat-number">{stats.open_tickets}</div>
            <div className="stat-label">Open</div>
          </div>
          <div className="stat-card progress">
            <div className="stat-number">{stats.in_progress_tickets}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-number">{stats.pending_tickets}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-number">{stats.resolved_tickets}</div>
            <div className="stat-label">Resolved</div>
          </div>
          <div className="stat-card total">
            <div className="stat-number">{stats.total_tickets}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
      )}

      {/* Recent Tickets */}
      <div className="recent-tickets-section">
        <div className="section-header">
          <h2>Recent Tickets</h2>
          <button className="btn-link" onClick={() => navigate('/tickets/list')}>
            View All →
          </button>
        </div>

        <div className="tickets-grid">
          {recentTickets.length > 0 ? (
            recentTickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="ticket-card"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <div className="ticket-header">
                  <div className="ticket-id">#{ticket.id}</div>
                  <div 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                  >
                    {ticket.priority}
                  </div>
                </div>

                <h3 className="ticket-title">{ticket.title}</h3>
                <p className="ticket-client">{ticket.client_name}</p>

                <div className="ticket-meta">
                  <div className="meta-item">
                    <span className="label">Business Unit:</span>
                    <span className="value">{ticket.business_unit}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Agent:</span>
                    <span className="value">{ticket.assigned_agent || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="ticket-footer">
                  <span 
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusBadge(ticket.status).bg,
                      color: getStatusBadge(ticket.status).color
                    }}
                  >
                    {getStatusBadge(ticket.status).text}
                  </span>
                  <span className="ticket-date">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-tickets">
              <Ticket size={48} />
              <p>No tickets yet</p>
              <button className="btn-primary" onClick={() => navigate('/tickets/new')}>
                Create First Ticket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsHome;
