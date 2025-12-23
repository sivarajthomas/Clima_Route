import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from '../components/Layout';
import { 
    AlertTriangle, Activity, ShieldAlert, Wrench, Truck,
    Clock, Pause, Play, MapPin, Bell, RotateCcw
} from 'lucide-react';
import { apiService } from '../services/apiservice';
import { useSos } from '../contexts/SosContext';

export function SOS() {
  const { 
    sosStatus, 
    idleTimeSeconds, 
    breakModeActive, 
    setBreakModeActive,
    triggerSos: triggerGlobalSos,
    resetIdleTimer,
    resolveActiveAlert
  } = useSos();

  const [isNavigating, setIsNavigating] = useState(false);
  const [lastGpsLocation, setLastGpsLocation] = useState<[number, number] | null>(null);
  const [currentGpsLocation, setCurrentGpsLocation] = useState<[number, number] | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>("GPS Inactive");
  const [loading, setLoading] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [idleNotificationSent, setIdleNotificationSent] = useState(false);
  const [vehicleStopped, setVehicleStopped] = useState(false);
  const [navigationStopped, setNavigationStopped] = useState(false);

  const gpsWatchIdRef = useRef<number | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousPositionRef = useRef<[number, number] | null>(null);
  const stoppedCountRef = useRef<number>(0);

  const IDLE_THRESHOLD = 15 * 60; // 15 minutes in seconds
  const GPS_POLL_INTERVAL = 5000; // Check GPS every 5 seconds
  const DISTANCE_THRESHOLD = 10; // Meters; if moved <10m in 5s, consider stopped
  const STOPPED_CHECKS_REQUIRED = 3; // Need 3 consecutive stopped checks (15 seconds)

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

  // Helper: Get location name from coordinates
  const getLocationName = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      const addr = data.address;
      const city = addr.city || addr.town || addr.village || addr.county;
      const state = addr.state;
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (state) return state;
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (e) {
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  };

  // Sync navigation state and location from ReRouting page
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // Check if navigation is active from ReRouting page
      const navActive = localStorage.getItem('climaRoute_navigation_active') === '1';
      const wasNavigating = isNavigating;
      setIsNavigating(navActive);
      
      // Detect when user clicks "Stop Navigation" button
      if (wasNavigating && !navActive) {
        setNavigationStopped(true);
        setVehicleStopped(true);
      }

      // Get current GPS location from ReRouting page
      const userPosStr = localStorage.getItem('climaRoute_userPosition');
      if (userPosStr) {
        try {
          const pos = JSON.parse(userPosStr);
          const newPos: [number, number] = [pos[0], pos[1]];
          
          // Check if vehicle has stopped (position hasn't changed significantly)
          if (previousPositionRef.current && navActive) {
            const distance = calculateDistance(
              previousPositionRef.current[0], 
              previousPositionRef.current[1],
              newPos[0], 
              newPos[1]
            );
            
            if (distance < DISTANCE_THRESHOLD) {
              stoppedCountRef.current += 1;
              if (stoppedCountRef.current >= STOPPED_CHECKS_REQUIRED) {
                setVehicleStopped(true);
              }
            } else {
              // Vehicle is moving - reset stopped counter
              stoppedCountRef.current = 0;
              setVehicleStopped(false);
            }
          }
          
          previousPositionRef.current = newPos;
          setCurrentGpsLocation(newPos);
          
          // Update location name
          getLocationName(newPos[0], newPos[1]).then(name => setCurrentLocationName(name));
        } catch (e) {
          console.error('Error parsing user position', e);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(syncInterval);
  }, [isNavigating]);

  // Toggle break mode
  const toggleBreakMode = async () => {
    const newBreakMode = !breakModeActive;
    setBreakModeActive(newBreakMode);

    try {
      await apiService.updateSosStatus({
        breakModeActive: newBreakMode,
        location: currentGpsLocation ? `${currentGpsLocation[0]},${currentGpsLocation[1]}` : "Unknown",
        timestamp: new Date().toISOString()
      });

      await apiService.createNotification(
        newBreakMode ? "Break Mode Started" : "Break Mode Ended",
        `Driver ${newBreakMode ? 'started' : 'ended'} break. Idle timer ${newBreakMode ? 'paused' : 'resumed'}.`,
        "Info"
      );
    } catch (err) {
      console.error("Break mode toggle failed:", err);
    }
  };

  // Resume navigation - stop and reset timer
  const handleResume = () => {
    resolveActiveAlert();
    setVehicleStopped(false);
    setNavigationStopped(false);
    stoppedCountRef.current = 0;
  };

  // Send notification when idle > 15 minutes
  useEffect(() => {
    if (idleTimeSeconds >= IDLE_THRESHOLD && !idleNotificationSent && currentLocationName) {
      setIdleNotificationSent(true);
      apiService.createNotification(
        "Vehicle Idle Alert",
        `Vehicle has been stationary for ${Math.round(idleTimeSeconds / 60)} minutes at ${currentLocationName}. Check on driver status.`,
        "Critical"
      ).catch(console.error);
    }
  }, [idleTimeSeconds, idleNotificationSent, currentLocationName]);

  // Trigger SOS alert
  const handleTriggerSOS = async (type: string) => {
    if (!window.confirm(`Are you sure you want to trigger a ${type} alert?`)) return;

    setLoading(true);
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Get current user info
      const userEmail = localStorage.getItem('userEmail') || 'unknown';
      const userName = localStorage.getItem('userName') || 'Driver';
      const tripId = localStorage.getItem('climaRoute_tripId');

      // Create SOS Alert in database (will show in Admin EmergencyAlerts page)
      await apiService.createAlert({
        vehicleId: tripId ? `TRIP-${tripId}` : 'VEHICLE-001',
        driverEmail: userEmail,
        type: type,
        location: currentLocationName
      });

      // Also create notification for admin
      await apiService.createNotification(
        `SOS Alert: ${type}`,
        `${userName} (${userEmail}) triggered ${type} emergency at ${currentLocationName} (${currentGpsLocation ? `${currentGpsLocation[0].toFixed(4)}, ${currentGpsLocation[1].toFixed(4)}` : 'Unknown'}). Time: ${timestamp}`,
        "Emergency"
      );

      await triggerGlobalSos(type);
      setSosActive(true);
      setTimeout(() => setSosActive(false), 5000);
      alert("SOS Signal Sent! Help is on the way.");
    } catch (err) {
      alert("Failed to send SOS signal.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const SOSButton = ({ icon: Icon, label, desc }: any) => (
    <button
      onClick={() => handleTriggerSOS(label)}
      disabled={loading}
      className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-red-300 hover:bg-red-50 transition-all group h-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-200 transition-colors">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">{label}</h3>
      <p className="text-xs text-gray-500 text-center">{desc}</p>
    </button>
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex-shrink-0">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="text-red-600"/> SOS & Vehicle Monitoring
        </h2>
        <p className="text-sm text-slate-500 mt-1">Emergency alerts and real-time vehicle diagnostics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-auto">
        
        {/* LEFT SIDE: Idle Tracking & Break Mode */}
        <Card className="lg:col-span-1 space-y-4 border-l-4 border-red-500 h-fit max-h-full overflow-auto">
          
          {/* Navigation & Vehicle Status - Combined Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Navigation</label>
              <div className={`p-2 rounded-lg flex items-center gap-2 ${isNavigating ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isNavigating ? 'bg-green-600 animate-pulse' : 'bg-gray-600'}`}></span>
                <span className="font-bold text-xs">{isNavigating ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Vehicle</label>
              <div className={`p-2 rounded-lg flex items-center gap-2 ${
                vehicleStopped || navigationStopped 
                  ? 'bg-orange-100 text-orange-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  vehicleStopped || navigationStopped ? 'bg-orange-600' : 'bg-green-600 animate-pulse'
                }`}></span>
                <span className="font-bold text-xs">
                  {navigationStopped ? 'Stopped' : vehicleStopped ? 'Stopped' : 'Moving'}
                </span>
              </div>
            </div>
          </div>

          {/* GPS Location */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <MapPin size={12} className="inline mr-1" /> Location
            </label>
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-bold text-gray-800 truncate">{currentLocationName}</div>
              <div className="text-xs font-mono text-gray-600">
                {currentGpsLocation 
                  ? `${currentGpsLocation[0].toFixed(4)}, ${currentGpsLocation[1].toFixed(4)}`
                  : "GPS Inactive"
                }
              </div>
            </div>
          </div>

          {/* Idle Time Display */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <Clock size={12} className="inline mr-1" /> Idle Duration
            </label>
            <div className={`p-3 rounded-lg text-center font-mono text-2xl font-bold ${
              idleTimeSeconds >= IDLE_THRESHOLD 
                ? 'bg-red-50 text-red-600' 
                : idleTimeSeconds > 0 
                  ? 'bg-orange-50 text-orange-600' 
                  : 'bg-gray-50 text-gray-800'
            }`}>
              {formatTime(idleTimeSeconds)}
            </div>
            {idleTimeSeconds >= IDLE_THRESHOLD && (
              <p className="text-xs text-red-600 font-bold mt-1 text-center animate-pulse">
                ⚠️ Idle timeout exceeded
              </p>
            )}
          </div>

          {/* Resume Button - shows when timer is counting */}
          {(vehicleStopped || navigationStopped) && (
            <button
              onClick={handleResume}
              className="w-full p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 text-sm"
            >
              <RotateCcw size={14} /> Resume / Reset Timer
            </button>
          )}

          {/* Break Mode Toggle */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
              <Pause size={12} className="inline mr-1" /> Break Mode
            </label>
            <button
              onClick={toggleBreakMode}
              className={`w-full p-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                breakModeActive
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-yellow-50'
              }`}
            >
              {breakModeActive ? (
                <>
                  <Pause size={14} /> Break Active
                </>
              ) : (
                <>
                  <Play size={14} /> Start Break
                </>
              )}
            </button>
          </div>
        </Card>

        {/* RIGHT SIDE: SOS Buttons */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 h-fit">
          <SOSButton
            icon={Activity}
            label="Health Issue"
            desc="Driver incapacitated or medical emergency."
          />
          <SOSButton
            icon={ShieldAlert}
            label="Theft/Security"
            desc="Cargo theft or security breach."
          />
          <SOSButton
            icon={Wrench}
            label="Breakdown"
            desc="Engine failure, flat tire, or mechanical issue."
          />
          <SOSButton
            icon={Truck}
            label="Road Accident"
            desc="Collision or vehicle damage."
          />
        </div>
      </div>

      {/* SOS Active Indicator */}
      {sosActive && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse z-50">
          <Bell size={20} />
          <span className="font-bold">SOS Signal Sent!</span>
        </div>
      )}
    </div>
  );
}