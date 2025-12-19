const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const apiService = {
  // LOGIN
  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Password: password })
      });
      if (!response.ok) throw new Error('Invalid credentials');
      return await response.json(); // { token, user }
    } catch (err) {
      console.error('Login Error:', err);
      throw err;
    }
  },

  // SIGNUP
  signup: async (email: string, name: string, password?: string) => {
    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: email, Name: name, Password: password })
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Signup failed');
      }
      return await response.json(); // { token, user }
    } catch (err) {
      console.error('Signup Error:', err);
      throw err;
    }
  },

  // GET USERS (Admin)
  getUsers: async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return await response.json();
    } catch (err) {
      console.error('GetUsers Error:', err);
      throw err;
    }
  },

  // DELETE USER (Admin)
  deleteUser: async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      return await response.json();
    } catch (err) {
      console.error('DeleteUser Error:', err);
      throw err;
    }
  }
  ,

  // UPDATE USER (Admin)
  updateUser: async (id: number, data: { name?: string; email?: string; phone?: string; password?: string; role?: string; status?: string }) => {
    try {
      // Use POST /users/{id}/update as a reliable fallback for environments where PUT may be blocked
      const response = await fetch(`${API_URL}/users/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Failed to update user');
      }
      return await response.json();
    } catch (err) {
      console.error('updateUser Error:', err);
      throw err;
    }
  },

  // DASHBOARD STATS (Admin)
  getDashboardStats: async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`);
      if (!response.ok) throw new Error('Failed to load dashboard stats');
      return await response.json();
    } catch (err) {
      console.error('getDashboardStats Error:', err);
      throw err;
    }
  },

  // GET ALERTS (SOS)
  getAlerts: async () => {
    try {
      const response = await fetch(`${API_URL}/alerts`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return await response.json();
    } catch (err) {
      console.error('getAlerts Error:', err);
      throw err;
    }
  },

  // RESOLVE ALERT
  resolveAlert: async (alertId: number) => {
    try {
      const response = await fetch(`${API_URL}/alerts/${alertId}`, { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to resolve alert');
      return await response.json();
    } catch (err) {
      console.error('resolveAlert Error:', err);
      throw err;
    }
  },

  // CREATE SOS ALERT
  createAlert: async (alertData: { vehicleId?: string; driverEmail?: string; type: string; location: string }) => {
    try {
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          VehicleId: alertData.vehicleId || 'VEHICLE-001',
          DriverEmail: alertData.driverEmail || localStorage.getItem('userEmail') || 'unknown',
          Type: alertData.type,
          Location: alertData.location
        })
      });
      if (!response.ok) throw new Error('Failed to create alert');
      return await response.json();
    } catch (err) {
      console.error('createAlert Error:', err);
      throw err;
    }
  },

  // FLEET MONITORING
  getFleetLocations: async () => {
    try {
      const response = await fetch(`${API_URL}/fleet/locations`);
      if (!response.ok) throw new Error('Failed to fetch fleet locations');
      return await response.json();
    } catch (err) {
      console.error('getFleetLocations Error:', err);
      return []; // Return empty array if offline
    }
  },

  // REAL-TIME FLEET WITH ROUTE GEOMETRY
  getFleetRealtime: async () => {
    try {
      const response = await fetch(`${API_URL}/fleet/realtime`);
      if (!response.ok) throw new Error('Failed to fetch real-time fleet data');
      return await response.json();
    } catch (err) {
      console.error('getFleetRealtime Error:', err);
      return []; // Return empty array if offline
    }
  },

  // UPDATE VEHICLE LOCATION
  updateVehicleLocation: async (tripId: number, latitude: number, longitude: number, speed: number, eta?: string) => {
    try {
      const response = await fetch(`${API_URL}/fleet/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TripId: tripId, Latitude: latitude, Longitude: longitude, Speed: speed, Eta: eta })
      });
      if (!response.ok) throw new Error('Failed to update vehicle location');
      return await response.json();
    } catch (err) {
      console.error('updateVehicleLocation Error:', err);
      return null;
    }
  },

  getFleetRoute: async (routeId: number) => {
    try {
      const response = await fetch(`${API_URL}/fleet/route/${routeId}`);
      if (!response.ok) throw new Error('Failed to fetch route');
      return await response.json();
    } catch (err) {
      console.error('getFleetRoute Error:', err);
      throw err;
    }
  },

  // GET DELIVERY HISTORY (All users)
  getHistory: async () => {
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return await response.json();
    } catch (err) {
      console.error('getHistory Error:', err);
      return [];
    }
  },

  // ALIAS: getDeliveryHistory (same as getHistory)
  getDeliveryHistory: async () => {
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return await response.json();
    } catch (err) {
      console.error('getDeliveryHistory Error:', err);
      return [];
    }
  },

  // SAVE DELIVERY TRIP TO HISTORY
  saveDeliveryTrip: async (tripData: {
    routeId?: string;
    date: string;
    startTime: string;
    endTime: string;
    origin: string;
    destination: string;
    originLat?: number;
    originLon?: number;
    destinationLat?: number;
    destinationLon?: number;
    weather: string;
    weatherCondition: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    rainProbability?: number;
    safetyScore?: string;
    distance: string;
    duration?: number;
    status: string;
    driverEmail: string;
    notes?: string;
    currentLat?: number;
    currentLon?: number;
    eta?: string;
    speed?: number;
  }) => {
    try {
      const response = await fetch(`${API_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData)
      });
      if (!response.ok) throw new Error('Failed to save delivery trip');
      return await response.json();
    } catch (err) {
      console.error('saveDeliveryTrip Error:', err);
      return null;
    }
  },

  // UPDATE EXISTING HISTORY (real-time telemetry)
  updateHistory: async (id: number, data: { currentLat?: number; currentLon?: number; eta?: string; speed?: number; status?: string; endTime?: string; destinationLat?: number; destinationLon?: number }) => {
    try {
      const response = await fetch(`${API_URL}/history/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update history');
      return await response.json();
    } catch (err) {
      console.error('updateHistory Error:', err);
      return null;
    }
  },

  // WEATHER: GET CURRENT FORECAST
  getWeatherForecast: async (lat?: number, lon?: number) => {
    try {
      let url = `${API_URL}/weather`;
      if (typeof lat === 'number' && typeof lon === 'number') url = `${url}?lat=${lat}&lon=${lon}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch weather');
      return await response.json();
    } catch (err) {
      console.error('getWeatherForecast Error:', err);
      return null;
    }
  },

  // WEATHER: SAVE WEATHER DATA TO DB
  saveWeather: async (weatherData: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    rainProbability: number;
    safetyScore: string;
  }) => {
    try {
      const response = await fetch(`${API_URL}/weather/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weatherData)
      });
      if (!response.ok) throw new Error('Failed to save weather');
      return await response.json();
    } catch (err) {
      console.error('saveWeather Error:', err);
      return null;
    }
  },

  // WEATHER: GET HISTORICAL WEATHER DATA
  getWeatherHistory: async () => {
    try {
      const response = await fetch(`${API_URL}/weather/history`);
      if (!response.ok) throw new Error('Failed to fetch weather history');
      return await response.json();
    } catch (err) {
      console.error('getWeatherHistory Error:', err);
      return [];
    }
  },

  // Helper: Get actual road geometry from OSRM (with CORS proxy)
  getOSRMRoute: async (startLat: number, startLon: number, endLat: number, endLon: number) => {
    try {
      // Use CORS proxy to avoid browser blocking
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(osrmUrl)}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) throw new Error('OSRM routing failed');
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // Convert GeoJSON coordinates [lon, lat] to Leaflet format [lat, lon]
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        return {
          geometry: coords,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration
        };
      }
      return null;
    } catch (err) {
      console.error('OSRM Error:', err);
      return null;
    }
  },

  // ROUTE OPTIMIZATION: Find multiple shortest paths with weather & safety
  optimizeRoute: async (origin: string, destination: string) => {
    try {
      const response = await fetch(`${API_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Origin: origin, Destination: destination })
      });
      if (!response.ok) throw new Error('Failed to optimize route');
      const data = await response.json();
      
      console.log('Backend response:', data);
      
      // Enhance routes with real road geometry from OSRM
      if (data && data.startCoords && data.endCoords) {
        console.log('Fetching OSRM route...');
        const osrmRoute = await apiService.getOSRMRoute(
          data.startCoords.lat,
          data.startCoords.lon,
          data.endCoords.lat,
          data.endCoords.lon
        );
        
        console.log('OSRM route:', osrmRoute);
        
        if (osrmRoute && osrmRoute.geometry) {
          console.log('Applying OSRM geometry to routes');
          // Apply real geometry to all routes
          if (data.alternatives && data.alternatives.length > 0) {
            data.alternatives = data.alternatives.map((route: any, index: number) => {
              if (index === 0) {
                // Main route uses exact OSRM geometry
                return {
                  ...route,
                  geometry: osrmRoute.geometry,
                  distance: osrmRoute.distance,
                  duration: osrmRoute.duration
                };
              } else {
                // Alternative routes get slight offset
                return {
                  ...route,
                  geometry: osrmRoute.geometry.map((coord: number[]) => [
                    coord[0] + (index * 0.01),
                    coord[1] + (index * 0.01)
                  ]),
                  distance: osrmRoute.distance,
                  duration: osrmRoute.duration
                };
              }
            });
          } else {
            // No alternatives from backend, create one with OSRM data
            data.alternatives = [{
              id: 1,
              safetyScore: data.safetyScore || 75,
              geometry: osrmRoute.geometry,
              distance: osrmRoute.distance,
              duration: osrmRoute.duration,
              condition: data.condition || 'Clear',
              rainProbability: data.rainProbability || 0
            }];
          }
        } else {
          // OSRM route failed, using backend data (this is normal, not an error)
          console.log('Using backend route data');
        }
      }
      
      return data;
    } catch (err) {
      console.error('optimizeRoute Error:', err);
      throw err;
    }
  },

  // NOTIFICATIONS: Create a notification
  createNotification: async (title: string, description: string, category: string = 'Info') => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          description, 
          category,
          timestamp: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to create notification');
      return await response.json();
    } catch (err) {
      console.error('createNotification Error:', err);
      return null;
    }
  },

  // NOTIFICATIONS: Get all notifications ordered by timestamp
  getNotifications: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return await response.json();
    } catch (err) {
      console.error('getNotifications Error:', err);
      return [];
    }
  },
  
  // USER SETTINGS: get and update by email (no-auth demo)
  getUserSettings: async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return await response.json();
    } catch (err) {
      console.error('getUserSettings Error:', err);
      return null;
    }
  },

  updateUserSettings: async (email: string, settings: { TemperatureUnit?: string; DistanceUnit?: string; TimeFormat?: string; Language?: string }) => {
    try {
      const response = await fetch(`${API_URL}/settings?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return await response.json();
    } catch (err) {
      console.error('updateUserSettings Error:', err);
      return null;
    }
  },

  // SOS: Update vehicle break mode and status
  updateSosStatus: async (data: { breakModeActive: boolean; location: string; timestamp: string }) => {
    try {
      const response = await fetch(`${API_URL}/sos/update-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update SOS status');
      return await response.json();
    } catch (err) {
      console.error('updateSosStatus Error:', err);
      return null;
    }
  },

  // SOS: Track vehicle movement for idle detection
  trackVehicleMovement: async (data: { location: string; timestamp: string; isMoving: boolean }) => {
    try {
      const response = await fetch(`${API_URL}/sos/track-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to track movement');
      return await response.json();
    } catch (err) {
      console.error('trackVehicleMovement Error:', err);
      return null;
    }
  },

  // REST POINTS: Find nearby rest points (coffee shops, gas stations, toll plazas)
  getRestPoints: async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`${API_URL}/rest-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Latitude: latitude, Longitude: longitude })
      });
      if (!response.ok) throw new Error('Failed to fetch rest points');
      return await response.json();
    } catch (err) {
      console.error('getRestPoints Error:', err);
      return { restPoints: [] };
    }
  }
};