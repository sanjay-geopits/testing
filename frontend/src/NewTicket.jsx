import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ChevronLeft } from 'lucide-react';
import axios from 'axios';
import './NewTicket.css';

const NewTicket = ({ userId }) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    business_unit: '',
    priority: 'medium',
    assigned_to: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const businessUnits = ['MySQL', 'PostgreSQL', 'MongoDB', 'MSSQL', 'Oracle'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const clientsRes = await axios.get(`${baseURL}/api/reports/clients?user_id=${userId}`);
      const workersRes = await axios.get(`${baseURL}/api/tickets/workers/list?user_id=${userId}`);
      
      setClients(clientsRes.data || []);
      setWorkers(workersRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.client_id || !formData.business_unit) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        client_id: parseInt(formData.client_id),
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null
      };

      const res = await axios.post(
        `${baseURL}/api/tickets/create?user_id=${userId}`,
        payload
      );

      alert('Ticket created successfully');
      navigate(`/tickets/${res.data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="new-ticket-loading">Loading...</div>;

  return (
    <div className="new-ticket">
      <div className="form-header">
        <button className="btn-back" onClick={() => navigate('/tickets/home')}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1>Create New Ticket</h1>
      </div>

      <form onSubmit={handleSubmit} className="ticket-form">
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="title">Ticket Title *</label>
            <input
              id="title"
              type="text"
              name="title"
              placeholder="Enter ticket title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              placeholder="Enter detailed description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="client_id">Company/Client *</label>
            <select
              id="client_id"
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="business_unit">Business Unit *</label>
            <select
              id="business_unit"
              name="business_unit"
              value={formData.business_unit}
              onChange={handleChange}
              required
            >
              <option value="">Select Business Unit</option>
              {businessUnits.map(unit => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="assigned_to">Assign to Agent</label>
            <select
              id="assigned_to"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              {workers.map(worker => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-submit"
            disabled={submitting}
          >
            <Send size={18} /> {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
          <button 
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/tickets/home')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewTicket;
