import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api, useAuth } from '../AuthContext';

const PageTracker = ({ children }) => {
    const location = useLocation();
    const { token, user } = useAuth();
    const activePath = useRef(location.pathname);
    const startTime = useRef(Date.now());

    const sendTelemetry = (path, durationMs) => {
        if (!token || !user || durationMs < 1000) return;
        const durationSec = Math.round(durationMs / 1000);
        
        api.post('/new-features/monitoring/page-time', {
            page_path: path,
            duration_seconds: durationSec
        }).catch(err => {
            console.error("Telemetry failed:", err);
        });
    };

    useEffect(() => {
        // When location changes
        const prevPath = activePath.current;
        const prevStart = startTime.current;
        
        activePath.current = location.pathname;
        startTime.current = Date.now();

        // Send telemetry for previous page
        const elapsed = Date.now() - prevStart;
        sendTelemetry(prevPath, elapsed);

        // Periodically ping for active page every 15 seconds to capture ongoing time spent
        const interval = setInterval(() => {
            const currentElapsed = Date.now() - startTime.current;
            sendTelemetry(activePath.current, currentElapsed);
            startTime.current = Date.now(); // Reset baseline for next interval
        }, 15000);

        return () => {
            clearInterval(interval);
            // Final dispatch on unmount
            const finalElapsed = Date.now() - startTime.current;
            sendTelemetry(activePath.current, finalElapsed);
        };
    }, [location.pathname, token, user]);

    // Handle browser close or refresh tab
    useEffect(() => {
        const handleBeforeUnload = () => {
            const elapsed = Date.now() - startTime.current;
            sendTelemetry(activePath.current, elapsed);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [token, user]);

    return <>{children}</>;
};

export default PageTracker;
