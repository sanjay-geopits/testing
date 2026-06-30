import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Fix named import if default is missing, otherwise default

// Setup a global axios instance
export const api = axios.create({
    baseURL: '/api'
});

// Request interceptor to dynamically inject the token on every call to prevent race conditions
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const getInitialToken = () => {
        let savedToken = localStorage.getItem('token');
        const hash = window.location.hash;
        if (hash && hash.includes('token=')) {
            let oauthToken = null;
            const qIdx = hash.indexOf('?');
            if (qIdx !== -1) {
                const params = new URLSearchParams(hash.substring(qIdx));
                oauthToken = params.get('token');
            }
            if (!oauthToken) {
                const tokenMatch = hash.match(/token=([^&]*)/);
                if (tokenMatch && tokenMatch[1]) {
                    oauthToken = tokenMatch[1];
                }
            }
            if (oauthToken) {
                localStorage.setItem('token', oauthToken);
                savedToken = oauthToken;
                window.location.hash = '#/';
            }
        }
        return savedToken || null;
    };

    const [user, setUser] = useState(null);
    const [token, setToken] = useState(getInitialToken);
    const [loading, setLoading] = useState(true);
    const [logoUrl, setLogoUrl] = useState('/static/applogo.svg');

    const refreshLogo = () => {
        api.get('/new-features/settings/logo')
            .then(res => {
                if (res.data && res.data.logo) {
                    setLogoUrl(res.data.logo);
                }
            })
            .catch(err => console.error("Logo fetch error:", err));
    };

    useEffect(() => {
        refreshLogo();
    }, []);

    useEffect(() => {
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            const fetchProfile = () => {
                try {
                    const decoded = jwtDecode(token);
                    api.get('/me').then(res => {
                        setUser({
                            username: decoded.sub,
                            fullName: res.data.full_name || res.data.fullName,
                            profilePic: res.data.profile_pic || res.data.profilePic,
                            email: res.data.email,
                            role: res.data.role,
                            isAdmin: res.data.isAdmin, // Trust backend flag
                            isClientUser: res.data.isClientUser,
                            clientAccessDisabled: res.data.clientAccessDisabled
                        });
                    }).catch(err => {
                        console.error("Profile fetch error:", err);
                        if (!user) setUser({ username: decoded.sub });
                    }).finally(() => {
                        setLoading(false);
                    });
                } catch (err) {
                    console.error("Invalid token on load:", err);
                    logout();
                    setLoading(false);
                }
            };

            fetchProfile();
            
            // Heartbeat: update role and active status every 30 seconds for real-time promotion
            const hbInterval = setInterval(fetchProfile, 30 * 1000);
            return () => clearInterval(hbInterval);
            
        } else {
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const login = async (username, password) => {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await axios.post('/api/login', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = response.data.access_token;
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    };

    // Add interceptor to handle 401s globally
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    console.warn("Unauthorized! Logging out...");
                    logout();
                }
                return Promise.reject(error);
            }
        );
        return () => api.interceptors.response.eject(interceptor);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading, logoUrl, refreshLogo }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
