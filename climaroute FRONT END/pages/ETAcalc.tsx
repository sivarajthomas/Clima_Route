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
import { useSettings } from '../contexts/SettingsContext';

// --- ETA Calculation Page (Exact Time + Live Weather Sync) ---
export function ETACalculator() {
    const { settings } = useSettings();
    const [origin, setOrigin] = useState("");
    const [dest, setDest] = useState("");
    const [weatherCondition, setWeatherCondition] = useState("Clear Sky");
    const [eta, setEta] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isWeatherSynced, setIsWeatherSynced] = useState(false);
    const [vehicleType, setVehicleType] = useState('Van');
    const [loadKg, setLoadKg] = useState<number | ''>('');
    const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
    const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
    const [etaDetails, setEtaDetails] = useState<any>(null);

  // --- 1. AUTO-LOAD ROUTE DATA & WEATHER FROM ACTIVE NAVIGATION ---
  useEffect(() => {
    const loadDataFromActiveRoute = async () => {
        // Load origin and destination from ReRouting page (localStorage)
        const savedOrigin = localStorage.getItem('climaRoute_originAddress') || localStorage.getItem('climaRoute_origin');
        const savedDest = localStorage.getItem('climaRoute_destAddress') || localStorage.getItem('climaRoute_dest');
        
        if (savedOrigin) setOrigin(savedOrigin);
        if (savedDest) setDest(savedDest);
        
        // Load route data to get coordinates
        const routeDataStr = localStorage.getItem('climaRoute_data');
        if (routeDataStr) {
            try {
                const routeData = JSON.parse(routeDataStr);
                if (routeData.startCoords) {
                    setStartCoords([routeData.startCoords.lat, routeData.startCoords.lon]);
                }
                if (routeData.endCoords) {
                    setEndCoords([routeData.endCoords.lat, routeData.endCoords.lon]);
                }
                
                // Get weather for start location
                if (routeData.startCoords) {
                    await fetchLiveWeather(routeData.startCoords.lat, routeData.startCoords.lon);
                }
            } catch (e) {
                console.error("Error parsing route data", e);
            }
        }
        
        // Also check if we have weather data stored
        const weatherStr = localStorage.getItem('climaRoute_weather');
        if (weatherStr) {
            try {
                const weather = JSON.parse(weatherStr);
                const cond = (weather.condition || weather.condition_text || '').toLowerCase();
                
                if (cond.includes("rain") || cond.includes("drizzle") || cond.includes("thunder")) {
                    setWeatherCondition("Rain");
                } else if (cond.includes("snow") || cond.includes("ice") || cond.includes("blizzard")) {
                    setWeatherCondition("Snow");
                } else {
                    setWeatherCondition("Clear Sky");
                }
                setIsWeatherSynced(true);
            } catch (e) {
                console.error("Error parsing weather", e);
            }
        }
    };
    
    const fetchLiveWeather = async (lat: number, lon: number) => {
        try {
            // Fetch from Python AI model for accurate weather
            const response = await fetch('http://localhost:5001/predict_score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: lat,
                    longitude: lon
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const cond = (data.condition || '').toLowerCase();
                const rainProb = data.rain_prob || 0;
                
                // Smart Logic: Map AI model prediction to dropdown
                if (rainProb >= 60 || cond.includes("rain") || cond.includes("storm")) {
                    setWeatherCondition("Rain");
                } else if (cond.includes("snow") || cond.includes("ice")) {
                    setWeatherCondition("Snow");
                } else {
                    setWeatherCondition("Clear Sky");
                }
                setIsWeatherSynced(true);
            } else {
                // Fallback to backend weather API
                const weatherData = await apiService.getWeatherForecast(lat as any, lon as any);
                if (weatherData && weatherData.current) {
                    const cond = (weatherData.current.condition || weatherData.current.condition_text || '').toLowerCase();
                    
                    if (cond.includes("rain") || cond.includes("drizzle") || cond.includes("thunder")) {
                        setWeatherCondition("Rain");
                    } else if (cond.includes("snow") || cond.includes("ice") || cond.includes("blizzard")) {
                        setWeatherCondition("Snow");
                    } else {
                        setWeatherCondition("Clear Sky");
                    }
                    setIsWeatherSynced(true);
                }
            }
        } catch (e) {
            console.error("Could not sync weather", e);
        }
    };
    
    loadDataFromActiveRoute();
  }, []);

  const handleCalculate = async () => {
    if (!origin || !dest) {
        alert("Please enter an Origin and Destination.");
        return;
    }

    setLoading(true);
    try {
      // 1. Get Base Route Data (Distance & Standard Duration)
      const data = await apiService.optimizeRoute(origin, dest);

      if (data && (data.bestRoute || (data.alternatives && data.alternatives[0]))) {
          // prefer bestRoute, otherwise first alternative (safest route)
          let route = data.bestRoute;
          
          // If no bestRoute, select the one with highest safety score
          if (!route && data.alternatives && data.alternatives.length > 0) {
              let maxSafety = -1;
              data.alternatives.forEach((r: any) => {
                  if (r.safetyScore > maxSafety) {
                      maxSafety = r.safetyScore;
                      route = r;
                  }
              });
          }
          
          // Base duration in seconds
          let totalSeconds = route.duration;
          const distanceKm = route.distance / 1000;

          // --- IMPROVED ETA FORMULA ---
          // Base multiplier starts at 1.0
          let multiplier = 1.0;
          
          // 1. Weather Impact (Most significant)
          if (weatherCondition === "Rain") {
              multiplier *= 1.25; // 25% slower in rain
          } else if (weatherCondition === "Snow") {
              multiplier *= 1.50; // 50% slower in heavy rain/snow
          }

          // 2. Vehicle Type Impact
          if (vehicleType === 'Heavy Truck (Class 8)') {
              multiplier *= 1.08; // 8% slower for heavy trucks
          } else if (vehicleType === 'Refrigerated Truck') {
              multiplier *= 1.05; // 5% slower for refrigerated (careful driving)
          } else if (vehicleType === 'Van') {
              multiplier *= 1.0; // No penalty for vans
          }

          // 3. Load Weight Impact (affects acceleration and braking)
          const loadVal = typeof loadKg === 'number' ? loadKg : 0;
          if (loadVal > 2000) {
              // Every 1000kg above 2000kg adds 2% time
              const excessTons = (loadVal - 2000) / 1000;
              multiplier *= 1 + (excessTons * 0.02);
          } else if (loadVal > 5000) {
              // Heavy loads (>5000kg) add additional 5% penalty
              multiplier *= 1.05;
          }

          // 4. AI Weather Prediction Impact (from route data)
          if (route.rainProbability) {
              if (route.rainProbability >= 80) {
                  multiplier *= 1.20; // High rain probability: +20%
              } else if (route.rainProbability >= 60) {
                  multiplier *= 1.10; // Moderate rain probability: +10%
              } else if (route.rainProbability >= 40) {
                  multiplier *= 1.05; // Low rain probability: +5%
              }
          }

          // 5. Safety Score Impact (lower safety = more cautious driving)
          if (route.safetyScore < 50) {
              multiplier *= 1.15; // Very unsafe: +15%
          } else if (route.safetyScore < 70) {
              multiplier *= 1.08; // Moderately unsafe: +8%
          }

          // Calculate final adjusted time
          const adjustedSeconds = Math.round(totalSeconds * multiplier);

          // Build human-friendly ETA and absolute arrival time
          const now = new Date();
          const arrival = new Date(now.getTime() + adjustedSeconds * 1000);
          const hours = Math.floor(adjustedSeconds / 3600);
          const minutes = Math.floor((adjustedSeconds % 3600) / 60);
          let timeString = "";
          if (hours > 0) timeString += `${hours} hr `;
          timeString += `${minutes} min`;

          setEta(timeString);
          setEtaDetails({ 
              baseSeconds: totalSeconds, 
              multiplier: multiplier.toFixed(2), 
              adjustedSeconds, 
              arrival: arrival.toLocaleString(),
              distance: route.distance || 0,
              safetyScore: route.safetyScore || 'N/A',
              rainProbability: route.rainProbability || 0
          });
      } else {
          setEta("Route not found");
      }
    } catch (err) {
      console.error(err);
      setEta("Error calculating route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
         <h2 className="text-2xl font-bold text-slate-800">Estimate Delivery Time</h2>
         <p className="text-sm text-slate-500 mt-1">Calculate delivery time based on weather and traffic</p>
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Route Details">
             <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Origin</label>
                    <Input 
                        placeholder="Origin Address" 
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Destination</label>
                    <Input 
                        placeholder="Destination Address" 
                        value={dest}
                        onChange={(e) => setDest(e.target.value)}
                    />
                </div>
             </div>
          </Card>

          <Card title="Vehicle & Load">
             <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Vehicle Type</label>
                    <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                        <option>Heavy Truck (Class 8)</option>
                        <option>Van</option>
                        <option>Refrigerated Truck</option>
                    </Select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Load Weight</label>
                    <Input placeholder="e.g. 5000 (kg)" value={loadKg as any} onChange={(e) => {
                        const v = e.target.value;
                        const n = parseFloat(v);
                        setLoadKg(isNaN(n) ? '' : n);
                    }} />
                </div>
             </div>
          </Card>

          <Card title="Environmental Factors">
             <div className="space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-gray-400 uppercase">Weather Condition</label>
                        {isWeatherSynced && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                Live Synced
                            </span>
                        )}
                    </div>
                    <Select 
                        value={weatherCondition} 
                        onChange={(e) => setWeatherCondition(e.target.value)}
                    >
                        <option value="Clear Sky">Clear Sky/Cloud (Optimal)</option>
                        <option value="Rain">Rain (+25% Time)</option>
                        <option value="Snow">Heavy Rain (+50% Time)</option>
                    </Select>
                </div>
                <div className={`text-sm p-3 rounded border-l-4 flex items-start gap-2 ${
                    weatherCondition !== "Clear Sky" 
                        ? "bg-yellow-50 border-yellow-400 text-yellow-800" 
                        : "bg-gray-50 border-gray-300 text-gray-500"
                }`}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                        {weatherCondition === "Clear Sky" 
                            ? "Standard routing speed applied." 
                            : `Caution: ${weatherCondition} detected. Safety buffer added to ETA.`}
                    </span>
                </div>
             </div>
          </Card>
       </div>

       <div className="flex flex-col items-center justify-center pt-4 gap-3">
          <Button 
            className="px-8 py-2 text-sm font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-1 transition-all"
            onClick={handleCalculate}
            disabled={loading}
          >
             {loading ? "Calculating..." : "Calculate ETA"}
          </Button>

          {eta && (
              <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <span className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Estimated Arrival</span>
                  <div className="text-3xl font-black text-blue-600 bg-blue-50 px-6 py-3 rounded-xl border border-blue-100 shadow-sm">
                      {eta}
                  </div>
                                    {etaDetails && (
                                        <div className="mt-3 text-xs text-gray-600 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200 max-w-md">
                                            <div className="flex justify-between">
                                                <span>Route Distance:</span>
                                                <strong>{settings.distanceUnit === 'km' ? (etaDetails.distance / 1000).toFixed(1) : (etaDetails.distance / 1000 * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Base Time (Ideal):</span>
                                                <strong>{Math.round((etaDetails.baseSeconds||0)/60)} min</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Time Multiplier:</span>
                                                <strong className="text-orange-600">{etaDetails.multiplier}x</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Safety Score:</span>
                                                <strong className={etaDetails.safetyScore >= 70 ? 'text-green-600' : 'text-orange-600'}>{etaDetails.safetyScore}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Rain Probability:</span>
                                                <strong className="text-blue-600">{etaDetails.rainProbability?.toFixed(1)}%</strong>
                                            </div>
                                            <div className="pt-2 mt-2 border-t border-gray-300 flex justify-between">
                                                <span className="font-semibold">Arrival Time:</span>
                                                <strong className="text-blue-600">{etaDetails.arrival}</strong>
                                            </div>
                                        </div>
                                    )}
              </div>
          )}
       </div>
    </div>
  );
}
