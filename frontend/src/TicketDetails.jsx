import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';
import './TicketDetails.css';

const TicketDetails = ({ userId }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchTicket();
    fetchWorkers();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await axios.get(`${baseURL}/api/tickets/${id}?user_id=${userId}`);
      setTicket(res.data);
      setEditData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await axios.get(`${baseURL}/api/tickets/workers/list?user_id=${userId}`);
      setWorkers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      const updates = {
        status: editData.status,
        priority: editData.priority,
        assigned_to: editData.assigned_to,
        description: editData.description
      };
      
      await axios.put(`${baseURL}/api/tickets/${id}?user_id=${userId}`, updates);
      setTicket(editData);
      setEditing(false);
      alert('Ticket updated successfully');
    } catch (err) {
      console.error(err);
      alert('Failed to update ticket');
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'open': return { bg: '#e7f5ff', color: '#1971c2' };
      case 'in_progress': return { bg: '#fff3bf', color: '#f59f00' };
      case 'resolved': return { bg: '#d3f9d8', color: '#2f9e44' };
      case 'closed': return { bg: '#f1f3f5', color: '#495057' };
      default: return { bg: '#f1f3f5', color: '#495057' };
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

  if (loading) return <div className="ticket-loading">Loading...</div>;
  if (!ticket) return <div className="ticket-not-found">Ticket not found</div>;

  return (
    <div className="ticket-details">
      <div className="details-header">
        <button className="btn-back" onClick={() => navigate('/tickets/list')}>
          <ChevronLeft size={20} /> Back
        </button>
        <button 
          className="btn-edit"
          onClick={() => setEditing(!editing)}
        >
          {editing ? <X size={20} /> : <Edit2 size={20} />}
        </button>
      </div>

      <div className="details-container">
        {/* Main Content */}
        <div className="details-main">
          <div className="ticket-header-section">
            <div className="ticket-title-section">
              <h1>Ticket #{ticket.id}</h1>
              <h2>{ticket.title}</h2>
            </div>
            <div className="ticket-badges">
              <span 
                className="priority-badge"
                style={{ backgroundColor: getPriorityColor(ticket.priority) }}
              >
                {ticket.priority.toUpperCase()}
              </span>
              <span 
                className="status-badge"
                style={{
                  backgroundColor: getStatusBadge(ticket.status).bg,
                  color: getStatusBadge(ticket.status).color
                }}
              >
                {ticket.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="ticket-description">
            {editing ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Description"
              />
            ) : (
              <p>{ticket.description}</p>
            )}
          </div>

          {/* Details Grid */}
          <div className="details-grid">
            <div className="detail-item">
              <label>Client</label>
              <p>{ticket.client_name}</p>
            </div>
            <div className="detail-item">
              <label>Business Unit</label>
              <p>{ticket.business_unit}</p>
            </div>
            <div className="detail-item">
              <label>Created</label>
              <p>{new Date(ticket.created_at).toLocaleDateString()}</p>
            </div>
            <div className="detail-item">
              <label>Assigned Agent</label>
              {editing ? (
                <select
                  value={editData.assigned_to || ''}
                  onChange={(e) => setEditData({ ...editData, assigned_to: parseInt(e.target.value) || null })}
                >
                  <option value="">Unassigned</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              ) : (
                <p>{ticket.assigned_agent || 'Unassigned'}</p>
              )}
            </div>
            <div className="detail-item">
              <label>Status</label>
              {editing ? (
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              ) : (
                <p>{ticket.status.replace('_', ' ')}</p>
              )}
            </div>
            <div className="detail-item">
              <label>Priority</label>
              {editing ? (
                <select
                  value={editData.priority}
                  onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              ) : (
                <p>{ticket.priority}</p>
              )}
            </div>
          </div>

          {editing && (
            <div className="edit-actions">
              <button className="btn-save" onClick={handleSave}>
                <Save size={18} /> Save Changes
              </button>
              <button className="btn-cancel" onClick={() => { setEditing(false); setEditData(ticket); }}>
                <X size={18} /> Cancel
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="details-sidebar">
          <div className="sidebar-section">
            <h3>Quick Info</h3>
            <div className="info-item">
              <span className="label">Ticket ID:</span>
              <span className="value">#{ticket.id}</span>
            </div>
            <div className="info-item">
              <span className="label">Priority:</span>
              <span className="value" style={{ color: getPriorityColor(ticket.priority) }}>
                {ticket.priority}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Status:</span>
              <span className="value" style={{ color: getStatusBadge(ticket.status).color }}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Timeline</h3>
            <div className="timeline-item">
              <span className="timeline-label">Created</span>
              <span className="timeline-date">
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            {ticket.resolved_at && (
              <div className="timeline-item">
                <span className="timeline-label">Resolved</span>
                <span className="timeline-date">
                  {new Date(ticket.resolved_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetails;
