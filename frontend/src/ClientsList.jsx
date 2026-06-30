import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';
import './ClientsList.css';

const ClientsList = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const userId = localStorage.getItem('userId');
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${baseURL}/api/reports/clients/user/${userId}`
      );
      setClients(response.data);
      setFilteredClients(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    const filtered = clients.filter(
      client =>
        client.name.toLowerCase().includes(value.toLowerCase()) ||
        client.database_type.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredClients(filtered);
  };

  const handleClientClick = (clientId) => {
    navigate(`/reports/client/${clientId}`);
  };

  if (loading) {
    return <div className="clients-loading">Loading clients...</div>;
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <h1>All Clients</h1>
        <p>Select a client to view and manage reports</p>
      </div>

      <div className="search-container">
        <Search size={20} />
        <input
          type="text"
          placeholder="Search by client name or database type..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {filteredClients.length === 0 ? (
        <div className="no-clients">
          <p>No clients found. Please check your access permissions.</p>
        </div>
      ) : (
        <div className="clients-grid">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={`client-card ${!client.is_active ? 'inactive' : ''}`}
              onClick={() => handleClientClick(client.id)}
            >
              <div className="client-card-header">
                <h3>{client.name}</h3>
                {!client.is_active && <span className="inactive-badge">Not Active</span>}
              </div>
              <div className="client-card-body">
                <p className="db-type">{client.database_type}</p>
              </div>
              <button className="client-card-btn">
                View Reports →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientsList;
