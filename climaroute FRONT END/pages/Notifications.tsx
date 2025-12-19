import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/Layout';
import { 
    Cloud, Sun, CloudRain, Wind, Droplets, MapPin, 
    Bell, AlertCircle, Info, CheckCircle, 
    Clock, Calculator, 
    Coffee, Anchor, Truck, 
    AlertTriangle, Phone, ShieldAlert, Wrench, Activity, 
    CloudFog, CloudLightning, Calendar, // Added new icons here
    Croissant
} from 'lucide-react';
import { apiService } from '../services/apiservice';
// --- Notification System Page (Updated with Auto-Weather Trigger) ---
export function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Fetch BOTH Notifications and Live Weather
        const [notifsData, weatherData] = await Promise.all([
            apiService.getNotifications(),
            apiService.getWeatherForecast()
        ]);

        // Backend returns most-recent-first by default. Clone the array.
        let allNotifications = Array.isArray(notifsData) ? [...notifsData] : [];

        // --- 2. AUTOMATIC TRIGGER LOGIC ---
        
        // A. Weather Trigger (Storm / Heavy Rain)
        if (weatherData && weatherData.current) {
            const condition = weatherData.current.condition.toLowerCase();
            const isSevere = condition.includes('storm') || condition.includes('heavy rain') || condition.includes('thunder');
            
            if (isSevere) {
              const weatherAlert = {
                id: 'auto-weather-alert',
                category: 'Critical', // Red Alert
                title: '⚠️ Severe Weather Warning',
                description: `Dangerous conditions detected: ${weatherData.current.condition}. Visibility is low. Pull over if necessary.`,
                // prefer ISO timestamp when possible for sorting; fall back to readable
                timestamp: (new Date()).toISOString(),
                auto: true
              };
              // Only add if not present already (avoid duplication)
              if (!allNotifications.some(n => n.id === weatherAlert.id)) {
                allNotifications.unshift(weatherAlert);
              }
            }
        }

        // B. Health/Fatigue Trigger (Mock Example - "If driving > 8 hours")
        // In a real app, this would come from ELD/Telematics data
        const drivingHours = 8.5; // Mock data
        if (drivingHours > 8) {
             allNotifications.push({
                id: 'auto-fatigue-alert',
                category: 'System',
                title: 'Driver Fatigue Risk',
                description: 'You have been active for over 8 hours. Please schedule a Rest Stop soon.',
                timestamp: 'System Auto-Check'
             });
        }

        // Ensure notifications are sorted by timestamp if ISO strings available, otherwise keep backend order
        try {
          const parsed = allNotifications.map(n => ({ n, t: Date.parse(n.timestamp) }));
          if (parsed.every(p => !isNaN(p.t))) {
            parsed.sort((a, b) => b.t - a.t);
            setNotifications(parsed.map(p => p.n));
          } else {
            setNotifications(allNotifications);
          }
        } catch {
          setNotifications(allNotifications);
        }

      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Polling: refresh notifications every 60 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const data = await apiService.getNotifications();
        if (Array.isArray(data)) setNotifications(data);
      } catch (e) {
        // ignore polling errors
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const NotificationCard: React.FC<{ notif: any }> = ({ notif }) => {
    const styles: any = {
      Critical: "border-l-4 border-red-500 bg-red-50",
      Route: "border-l-4 border-blue-500 bg-blue-50",
      Status: "border-l-4 border-green-500 bg-green-50",
      System: "border-l-4 border-gray-400 bg-gray-50",
      General: "border-l-4 border-gray-200 bg-white"
    };
    
    const getIcon = (cat: string) => {
        if (cat === 'Critical') return <AlertTriangle className="text-red-500" />;
        if (cat === 'Route') return <MapPin className="text-blue-500" />;
        if (cat === 'Status') return <CheckCircle className="text-green-500" />;
        if (cat === 'System') return <Wrench className="text-gray-500" />;
        return <Bell className="text-gray-500" />;
    };

    return (
      <div className={`p-4 rounded-lg shadow-sm mb-4 transition-all hover:shadow-md ${styles[notif.category] || styles.General} flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2`}>
        <div className="mt-1">{getIcon(notif.category)}</div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-gray-800">{notif.title}</h4>
            <span className="text-xs text-gray-500 font-medium">{formatTimestamp(notif.timestamp)}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{notif.description}</p>
        </div>
      </div>
    );
  };

  // Helper: format timestamp string (ISO preferred) to relative time like 'Just now' or '5m ago'
  function formatTimestamp(ts: string | undefined) {
    if (!ts) return '';
    const d = Date.parse(ts);
    if (isNaN(d)) return ts;
    const diff = Date.now() - d;
    const sec = Math.floor(diff / 1000);
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800">Notification System</h2>
        <p className="text-sm text-slate-500 mt-1">View all alerts and notifications</p>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-gray-500 animate-pulse">Checking for alerts...</div>
      ) : (
        <div className="space-y-6">
          {['Critical', 'Route', 'Status', 'System', 'General'].map(cat => {
            const items = notifications.filter(n => n.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className={`text-sm font-bold uppercase mb-3 ${cat === 'Critical' ? 'text-red-600' : 'text-gray-500'}`}>
                    {cat} Alerts
                </h3>
                {items.map(n => <NotificationCard key={n.id} notif={n} />)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}