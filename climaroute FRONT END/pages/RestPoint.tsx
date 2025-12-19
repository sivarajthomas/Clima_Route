import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Select } from '../components/Layout';
import { 
    MapPin, Coffee, Fuel, Navigation, Loader, 
    AlertTriangle, Phone, Info
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import { apiService } from '../services/apiservice';
import { useSettings } from '../contexts/SettingsContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet Icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const restPointIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function FitBounds({ coords }: { coords: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.setView(coords, 12);
        }
    }, [coords, map]);
    return null;
}

export function RestPoint() {
    const { settings } = useSettings();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [userLocationName, setUserLocationName] = useState<string>("Fetching...");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedRestPoint, setSelectedRestPoint] = useState<any>(null);
    const [navigatingTo, setNavigatingTo] = useState<any>(null);
    const [navigationRoute, setNavigationRoute] = useState<any>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const gpsWatchIdRef = useRef<number | null>(null);

    // Helper: Get location name from coordinates
    const getLocationName = async (lat: number, lon: number): Promise<string> => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            const addr = data.address;
            
            // Build a friendly location name
            const city = addr.city || addr.town || addr.village || addr.county;
            const state = addr.state;
            const country = addr.country;
            
            if (city && state) {
                return `${city}, ${state}`;
            } else if (city) {
                return city;
            } else if (state) {
                return state;
            } else if (country) {
                return country;
            } else {
                return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        } catch (e) {
            console.error("Reverse geocoding failed:", e);
            return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
    };

    // Get user's current location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setUserLocation(coords);
                    
                    // Get location name
                    const locationName = await getLocationName(coords[0], coords[1]);
                    setUserLocationName(locationName);
                },
                (err) => {
                    // Suppress GPS error spam, use fallback
                    if (err.code === 1) {
                        setUserLocationName("Location Denied - Using Default");
                    } else {
                        setUserLocationName("GPS Unavailable - Using Default");
                    }
                    // Fallback to Chennai default location
                    const defaultCoords: [number, number] = [13.0827, 80.2707];
                    setUserLocation(defaultCoords);
                    getLocationName(defaultCoords[0], defaultCoords[1]).then(setUserLocationName);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
        } else {
            setUserLocationName("GPS not supported");
            // Fallback location
            setUserLocation([13.0827, 80.2707]);
        }
    }, []);

    // Search for rest points based on current location
    const handleSearch = async () => {
        if (!userLocation) {
            alert("Please enable GPS to find nearby rest points");
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            // Call backend to find real rest points
            const data = await apiService.getRestPoints(userLocation[0], userLocation[1]);
            if (data && data.restPoints) {
                // Sort by distance
                const sorted = data.restPoints.sort((a: any, b: any) => a.distance - b.distance);
                setResults(sorted);
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error("Failed to load rest points", err);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Start real-time navigation to a rest point
    const handleNavigate = async (restPoint: any) => {
        if (!userLocation) return;

        setNavigatingTo(restPoint);
        setIsNavigating(true);

        try {
            // Get route from user location to rest point
            const data = await apiService.optimizeRoute(
                `${userLocation[0]},${userLocation[1]}`,
                `${restPoint.lat},${restPoint.lon}`
            );

            if (data?.alternatives && data.alternatives.length > 0) {
                setNavigationRoute(data.alternatives[0]); // Use first route
            }

            // Start GPS tracking for live navigation
            if (navigator.geolocation) {
                gpsWatchIdRef.current = navigator.geolocation.watchPosition(
                    (pos) => {
                        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                    },
                    (err) => console.log("GPS Error:", err),
                    { enableHighAccuracy: true, maximumAge: 0 }
                );
            }
        } catch (err) {
            console.error("Navigation failed:", err);
            setIsNavigating(false);
        }
    };

    // Stop navigation
    const handleStopNavigation = () => {
        setIsNavigating(false);
        setNavigatingTo(null);
        setNavigationRoute(null);
        if (gpsWatchIdRef.current) {
            navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Weather-Aware Rest Points</h2>
                <p className="text-sm text-slate-500 mt-1">Smart rest stop suggestions based on real-time weather conditions</p>
            </div>

            {/* TOP: Map Section */}
            <div className="h-1/2 bg-gray-200 rounded-xl relative overflow-hidden shadow-inner border border-gray-300">
                {userLocation ? (
                    <MapContainer center={userLocation} zoom={12} style={{ height: "100%", width: "100%" }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FitBounds coords={userLocation} />
                        
                        {/* User Location Marker */}
                        <Marker position={userLocation} icon={userIcon}>
                            <Popup>Your Location</Popup>
                        </Marker>

                        {/* Rest Points on Map */}
                        {results.map((point: any, idx: number) => (
                            <Marker 
                                key={idx} 
                                position={[point.lat, point.lon]} 
                                icon={restPointIcon}
                                eventHandlers={{
                                    click: () => setSelectedRestPoint(point),
                                }}
                            >
                                <Popup>
                                    <div className="text-center">
                                        <h4 className="font-bold text-gray-800">{point.name}</h4>
                                        <p className="text-sm text-gray-600">{point.type}</p>
                                        <p className="text-xs text-blue-600 mt-1">{settings.distanceUnit === 'km' ? point.distance.toFixed(1) : (point.distance * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'} away</p>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* Navigation Route */}
                        {navigationRoute && navigationRoute.geometry && (
                            <Polyline 
                                positions={navigationRoute.geometry} 
                                pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8 }}
                            />
                        )}
                    </MapContainer>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Loader size={48} className="animate-spin opacity-40" />
                    </div>
                )}
            </div>

            {/* BOTTOM: Controls & Results */}
            <div className="h-1/2 flex flex-col gap-4 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* LEFT: Search Controls */}
                    <Card className="lg:col-span-1 h-fit">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                                    <MapPin size={12} className="inline mr-1" /> Your Location
                                </label>
                                <div className="p-2 bg-blue-50 rounded border border-blue-200 text-sm text-gray-700">
                                    <div className="font-semibold">{userLocationName}</div>
                                    {userLocation && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Rest Point Type</label>
                                <Select disabled>
                                    <option>All Types (Coffee Shop, Petrol Pump, Toll Plaza)</option>
                                </Select>
                            </div>

                            {!isNavigating ? (
                                <Button 
                                    className="w-full" 
                                    onClick={handleSearch} 
                                    disabled={loading || !userLocation}
                                >
                                    {loading ? 'Searching...' : 'Find Rest Points'}
                                </Button>
                            ) : (
                                <Button 
                                    className="w-full bg-red-600 hover:bg-red-700" 
                                    onClick={handleStopNavigation}
                                >
                                    Stop Navigation
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* RIGHT: Results List */}
                    <div className="lg:col-span-2 overflow-y-auto">
                        {!hasSearched ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                <Coffee size={48} className="mb-4 opacity-50" />
                                <p className="font-bold">Click "Find Rest Points" to search</p>
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader size={32} className="animate-spin text-blue-600" />
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-3">
                                {results.map((spot: any, idx: number) => (
                                    <div 
                                        key={idx} 
                                        className={`p-4 cursor-pointer transition-all border-2 rounded-lg ${selectedRestPoint?.id === spot.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-blue-300'}`}
                                        onClick={() => setSelectedRestPoint(spot)}
                                    >
                                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                                                        {spot.type?.includes('Coffee') ? <Coffee size={20} /> : <Fuel size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{spot.name}</h4>
                                                        <p className="text-xs text-gray-500">{spot.type}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                                    <span>📍 {settings.distanceUnit === 'km' ? spot.distance.toFixed(1) : (spot.distance * 0.621371).toFixed(1)} {settings.distanceUnit === 'km' ? 'km' : 'mi'} away</span>
                                                    <span>⏱️ {spot.duration ? `${(spot.duration/60).toFixed(0)} min` : 'N/A'}</span>
                                                </div>
                                            </div>
                                            <Button 
                                                className="min-w-[140px]"
                                                onClick={() => {
                                                    handleNavigate(spot);
                                                }}
                                                disabled={isNavigating}
                                            >
                                                <Navigation size={16} className="mr-2" />
                                                {isNavigating && navigatingTo?.id === spot.id ? 'Navigating...' : 'Navigate'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                <AlertTriangle size={48} className="mb-4 opacity-50" />
                                <p>No rest points found nearby</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Live Navigation Status */}
            {isNavigating && navigatingTo && (
                <div className="fixed bottom-4 left-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse">
                    <Navigation size={20} />
                    <span className="font-bold">Live Navigation to {navigatingTo.name}</span>
                </div>
            )}
        </div>
    );
}