import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiservice';

type SosStatus = 'Normal' | 'Abnormal';

interface SosContextType {
  sosStatus: SosStatus;
  idleTimeSeconds: number;
  breakModeActive: boolean;
  setBreakModeActive: (active: boolean) => void;
  triggerSos: (type: string) => Promise<void>;
  resetIdleTimer: () => void;
  resolveActiveAlert: () => Promise<void>;
}

const SosContext = createContext<SosContextType | undefined>(undefined);

export const SosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sosStatus, setSosStatus] = useState<SosStatus>('Normal');
  const [idleTimeSeconds, setIdleTimeSeconds] = useState(0);
  const [breakModeActive, setBreakModeActive] = useState(false);
  const [isSosTriggered, setIsSosTriggered] = useState(false);
  
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const IDLE_THRESHOLD = 15 * 60; // 15 minutes

  // Load initial state from localStorage
  useEffect(() => {
    const savedBreakMode = localStorage.getItem('climaRoute_breakMode') === 'true';
    setBreakModeActive(savedBreakMode);
    
    const savedSosTriggered = localStorage.getItem('climaRoute_sosTriggered') === 'true';
    setIsSosTriggered(savedSosTriggered);
  }, []);

  // Idle tracking logic
  useEffect(() => {
    const checkIdle = () => {
      const navActive = localStorage.getItem('climaRoute_navigation_active') === '1';
      const userPosStr = localStorage.getItem('climaRoute_userPosition');
      
      let vehicleStopped = false;
      if (userPosStr) {
        try {
          const pos = JSON.parse(userPosStr);
          const lastPosStr = localStorage.getItem('climaRoute_lastUserPosition');
          if (lastPosStr) {
            const lastPos = JSON.parse(lastPosStr);
            const distance = calculateDistance(pos[0], pos[1], lastPos[0], lastPos[1]);
            if (distance < 10) { // 10 meters threshold
              vehicleStopped = true;
            }
          }
          localStorage.setItem('climaRoute_lastUserPosition', userPosStr);
        } catch (e) {}
      }

      // If navigation is active but vehicle is stopped, or if navigation is inactive
      // and we are not in break mode, we count idle.
      const shouldCount = !breakModeActive && (vehicleStopped || !navActive);
      
      if (shouldCount) {
        setIdleTimeSeconds(prev => {
          const next = prev + 1;
          return next;
        });
      } else {
        setIdleTimeSeconds(0);
      }
    };

    const interval = setInterval(checkIdle, 1000);
    return () => clearInterval(interval);
  }, [breakModeActive]);

  // Helper: Calculate distance between two coordinates (Haversine)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Update status based on SOS or Idle
  useEffect(() => {
    if (isSosTriggered || idleTimeSeconds >= IDLE_THRESHOLD) {
      setSosStatus('Abnormal');
    } else {
      setSosStatus('Normal');
    }
  }, [isSosTriggered, idleTimeSeconds]);

  // Poll backend to see if Admin resolved the alert
  useEffect(() => {
    const checkAlertStatus = async () => {
      try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) return;

        const alerts = await apiService.getAlerts();
        const hasActiveAlert = alerts.some((a: any) => 
          a.isActive && a.driverEmail?.toLowerCase() === userEmail.toLowerCase()
        );

        // If we thought it was triggered but DB says no active alerts, reset local state
        if (isSosTriggered && !hasActiveAlert) {
          setIsSosTriggered(false);
          localStorage.removeItem('climaRoute_sosTriggered');
        }
        
        // If DB says there IS an active alert but we didn't know, sync it
        if (!isSosTriggered && hasActiveAlert) {
          setIsSosTriggered(true);
          localStorage.setItem('climaRoute_sosTriggered', 'true');
        }
      } catch (err) {
        console.error("Failed to sync alert status", err);
      }
    };

    const interval = setInterval(checkAlertStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [isSosTriggered]);

  const triggerSos = async (type: string) => {
    setIsSosTriggered(true);
    localStorage.setItem('climaRoute_sosTriggered', 'true');
    // The actual API call will still be in Sos.tsx or here
  };

  const resetIdleTimer = () => {
    setIdleTimeSeconds(0);
    setSosStatus('Normal');
    setIsSosTriggered(false);
    localStorage.removeItem('climaRoute_sosTriggered');
  };

  const resolveActiveAlert = async () => {
    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) return;

      // 1. Fetch all alerts
      const alerts = await apiService.getAlerts();
      
      // 2. Find active alerts for this driver
      const activeAlerts = alerts.filter((a: any) => 
        a.isActive && a.driverEmail?.toLowerCase() === userEmail.toLowerCase()
      );

      // 3. Resolve them in DB
      for (const alert of activeAlerts) {
        await apiService.resolveAlert(alert.id);
      }

      // 4. Reset local state
      resetIdleTimer();
    } catch (err) {
      console.error("Failed to resolve alerts:", err);
    }
  };

  const handleSetBreakModeActive = (active: boolean) => {
    setBreakModeActive(active);
    localStorage.setItem('climaRoute_breakMode', active.toString());
    if (active) {
      setIdleTimeSeconds(0);
    }
  };

  return (
    <SosContext.Provider value={{ 
      sosStatus, 
      idleTimeSeconds, 
      breakModeActive, 
      setBreakModeActive: handleSetBreakModeActive,
      triggerSos,
      resetIdleTimer,
      resolveActiveAlert
    }}>
      {children}
    </SosContext.Provider>
  );
};

export const useSos = () => {
  const context = useContext(SosContext);
  if (!context) throw new Error('useSos must be used within SosProvider');
  return context;
};
