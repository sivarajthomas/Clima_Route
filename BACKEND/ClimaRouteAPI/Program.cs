using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);

// 1. SETUP SERVICES
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite("Data Source=climaroute.db"));
builder.Services.AddCors(options => {
    options.AddPolicy("AllowReact", policy => 
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
builder.Services.AddHttpClient(); 

var app = builder.Build();
app.UseCors("AllowReact");

// 2. DATABASE INIT - CLEAR ALL DATA AND RESEED
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // DELETE existing database and recreate fresh
    db.Database.EnsureDeleted();
    db.Database.EnsureCreated();
    
    // Clear all tables (in case EnsureDeleted doesn't work on some systems)
    db.Histories.RemoveRange(db.Histories);
    db.SosAlerts.RemoveRange(db.SosAlerts);
    db.Notifications.RemoveRange(db.Notifications);
    db.Weathers.RemoveRange(db.Weathers);
    db.UserSettings.RemoveRange(db.UserSettings);
    db.Users.RemoveRange(db.Users);
    db.SaveChanges();
    
    // Seed fresh users with new credentials
    var adminPwd = "admin";
    var driverPwd = "driver";

    var adminUser = new User { 
        Email = "admin@gmail.com", 
        Name = "Administrator", 
        Phone = "+91-9876543210", 
        Password = HashPassword(adminPwd), 
        PlainPassword = adminPwd, 
        Role = "admin", 
        Status = "Active" 
    };
    
    var driverUser = new User { 
        Email = "driver@gmail.com", 
        Name = "Driver", 
        Phone = "+91-8765432109", 
        Password = HashPassword(driverPwd), 
        PlainPassword = driverPwd, 
        Role = "user", 
        Status = "Active" 
    };
    
    db.Users.Add(adminUser);
    db.Users.Add(driverUser);
    db.SaveChanges();
    
    Console.WriteLine("===========================================");
    Console.WriteLine("DATABASE CLEARED AND RESEEDED!");
    Console.WriteLine("===========================================");
    Console.WriteLine("Admin:  admin@gmail.com / admin");
    Console.WriteLine("Driver: driver@gmail.com / driver");
    Console.WriteLine("===========================================");

    // Note: Delivery history data is created live when users start/complete deliveries.
    // No dummy seed data for histories to ensure real-time accuracy.

    // Note: SOS alerts are created live when drivers trigger them.
    // No dummy seed data to ensure real-time accuracy.
}

// 3. API ENDPOINTS

// --- WEATHER (REAL-TIME VIA PYTHON) ---
app.MapGet("/api/weather", async (HttpRequest req, IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();

    // Accept optional lat & lon as query parameters (e.g. /api/weather?lat=13.08&lon=80.27)
    double lat = 13.0827, lon = 80.2707; // defaults (Chennai)
    try {
        if (req.Query.ContainsKey("lat") && double.TryParse(req.Query["lat"], out var qlat)) lat = qlat;
        if (req.Query.ContainsKey("lon") && double.TryParse(req.Query["lon"], out var qlon)) lon = qlon;
    } catch {
        // ignore and use defaults
    }

    var payload = new { latitude = lat, longitude = lon };
    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    try {
        // Call Python Microservice
        var response = await http.PostAsync("http://127.0.0.1:5001/weather_details", content);

        if (response.IsSuccessStatusCode) {
            // Pass Python's JSON directly to Frontend
            var json = await response.Content.ReadAsStringAsync();
            return Results.Content(json, "application/json");
        }
    } catch {
        Console.WriteLine("Python Service 5001 Not Reachable");
    }

    // Fallback if Python is offline
    return Results.Ok(new {
        current = new { temperature = 0, condition = "Service Offline", humidity = 0, wind_speed = 0 },
        prediction = new { status = "Unknown", message = "AI Model is offline.", rain_prob = 0.0 }
    });
});

// --- ROUTE OPTIMIZATION ---
app.MapPost("/api/optimize", async (RouteRequest req, IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();
    http.DefaultRequestHeaders.Add("User-Agent", "ClimaRouteApp/1.0");

    async Task<Coord?> Geocode(string q) {
        try {
            if (q.Contains(",")) {
                var parts = q.Split(',');
                if (parts.Length >= 2) {
                    var latStr = parts[0].Trim();
                    var lonStr = parts[1].Trim();
                    if (double.TryParse(latStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lat) &&
                        double.TryParse(lonStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lon))
                        return new Coord { Lat = lat, Lon = lon };
                }
            }
            var json = await http.GetStringAsync($"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(q)}&format=json&limit=1");
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.GetArrayLength() > 0) {
                var item = doc.RootElement[0];
                return new Coord { Lat = double.Parse(item.GetProperty("lat").GetString()!, System.Globalization.CultureInfo.InvariantCulture), Lon = double.Parse(item.GetProperty("lon").GetString()!, System.Globalization.CultureInfo.InvariantCulture) };
            }
            return null;
        } catch { return null; }
    }

    double HaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371; // km
        double dLat = (lat2 - lat1) * Math.PI / 180;
        double dLon = (lon2 - lon1) * Math.PI / 180;
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        double c = 2 * Math.Asin(Math.Sqrt(a));
        return R * c; // km
    }

    var start = await Geocode(req.Origin);
    var end = await Geocode(req.Destination);
    if (start == null || end == null) return Results.BadRequest("Location not found.");

    string url = $"http://router.project-osrm.org/route/v1/driving/{start.Lon},{start.Lat};{end.Lon},{end.Lat}?alternatives=true&overview=full&geometries=geojson";
    var response = await http.GetAsync(url);

    var alternatives = new List<object>();
    int idCounter = 0;

    if (response.IsSuccessStatusCode) {
        var osrmData = JsonSerializer.Deserialize<OsrmResponse>(await response.Content.ReadAsStringAsync());
        if (osrmData?.routes != null) {
            foreach (var route in osrmData.routes) {
                double score = 80;
                double rainProb = 0;
                string condition = "Unknown";
                var midIndex = route.geometry.coordinates.Count / 2;
                var midPoint = route.geometry.coordinates[midIndex]; 

                try {
                    var payload = new { latitude = midPoint[1], longitude = midPoint[0] };
                    var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    var aiRes = await http.PostAsync("http://127.0.0.1:5001/predict_score", content);
                    if (aiRes.IsSuccessStatusCode) {
                        var aiData = JsonSerializer.Deserialize<PythonResponse>(await aiRes.Content.ReadAsStringAsync());
                        score = aiData?.safety_score ?? 80;
                        rainProb = aiData?.rain_prob ?? 0;
                        condition = aiData?.condition ?? "Clear";
                    }
                } catch { }

                var roadPath = new List<double[]>();
                foreach (var p in route.geometry.coordinates) roadPath.Add(new double[] { p[1], p[0] });

                alternatives.Add(new {
                    id = idCounter++,
                    geometry = roadPath,
                    duration = route.duration,
                    distance = route.distance,
                    safetyScore = score,
                    rainProbability = rainProb,
                    condition = condition
                });
            }
        }
    }

    // Fallback if OSRM failed or returned nothing
    if (!alternatives.Any()) {
        double distanceMeters = HaversineDistance(start.Lat, start.Lon, end.Lat, end.Lon) * 1000;
        var straightLine = new List<double[]>() { new double[] { start.Lat, start.Lon }, new double[] { end.Lat, end.Lon } };
        alternatives.Add(new {
            id = idCounter++,
            geometry = straightLine,
            duration = distanceMeters / 15000 * 3600, // assume 15 km/h fallback
            distance = distanceMeters,
            safetyScore = 70,
            rainProbability = 0,
            condition = "Clear"
        });
    }

    return Results.Ok(new { startCoords = start, endCoords = end, alternatives = alternatives });
});

// --- AUTH, HISTORY, NOTIFICATIONS ---
// Signup endpoint: create user (role optional, defaults to 'user')
app.MapPost("/api/signup", async (AppDbContext db, UserCreate req) => {
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Name))
        return Results.BadRequest("Name and Email required");

    var exists = await db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower());
    if (exists) return Results.Conflict("Email already registered");

    var pwd = req.Password;
    if (string.IsNullOrWhiteSpace(pwd)) {
        // generate a short random password and return it to caller
        pwd = Guid.NewGuid().ToString().Replace("-", "").Substring(0, 8);
    }

    var user = new User { Email = req.Email, Name = req.Name, Password = HashPassword(pwd), PlainPassword = pwd, Role = string.IsNullOrWhiteSpace(req.Role) ? "user" : req.Role };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { token = "fake-jwt", user = new { email = user.Email, name = user.Name, role = user.Role } });
});

app.MapPost("/api/login", async (AppDbContext db, LoginRequest req) => {
    var hashed = HashPassword(req.Password ?? "");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower() && u.Password == hashed);
    if (user == null) return Results.Unauthorized();
    return Results.Ok(new { token = "fake-jwt", user = new { user.Email, user.Name, user.Role } });
});

app.MapGet("/api/notifications", async (AppDbContext db) => Results.Ok(await db.Notifications.OrderByDescending(x => x.Id).Take(50).ToListAsync()));
app.MapPost("/api/notifications", async (AppDbContext db, Notification n) => { n.Timestamp = DateTime.UtcNow.ToString("o"); db.Notifications.Add(n); await db.SaveChangesAsync(); return Results.Ok(n); });

// --- USER SETTINGS ---
app.MapGet("/api/settings", async (AppDbContext db, HttpRequest req) => {
    if (!req.Query.ContainsKey("email")) return Results.BadRequest("email query required");
    var email = req.Query["email"].ToString();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
    if (user == null) return Results.NotFound();
    var s = await db.UserSettings.FirstOrDefaultAsync(u => u.UserId == user.Id);
    if (s == null) return Results.Ok(new { TemperatureUnit = "C", DistanceUnit = "km", TimeFormat = "24", Language = "en-US" });
    return Results.Ok(s);
});

app.MapPut("/api/settings", async (AppDbContext db, HttpRequest req, SettingsRequest body) => {
    if (!req.Query.ContainsKey("email")) return Results.BadRequest("email query required");
    var email = req.Query["email"].ToString();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
    if (user == null) return Results.NotFound();
    var s = await db.UserSettings.FirstOrDefaultAsync(u => u.UserId == user.Id);
    if (s == null) {
        s = new UserSettings { UserId = user.Id, TemperatureUnit = body.TemperatureUnit ?? "C", DistanceUnit = body.DistanceUnit ?? "km", TimeFormat = body.TimeFormat ?? "24", Language = body.Language ?? "en-US", UpdatedAt = DateTime.UtcNow };
        db.UserSettings.Add(s);
    } else {
        s.TemperatureUnit = body.TemperatureUnit ?? s.TemperatureUnit;
        s.DistanceUnit = body.DistanceUnit ?? s.DistanceUnit;
        s.TimeFormat = body.TimeFormat ?? s.TimeFormat;
        s.Language = body.Language ?? s.Language;
        s.UpdatedAt = DateTime.UtcNow;
    }
    await db.SaveChangesAsync();
    return Results.Ok(s);
});

app.MapGet("/api/history", async (AppDbContext db) => {
    // First load users into memory for case-insensitive lookup
    var users = await db.Users.ToListAsync();
    var histories = await db.Histories.OrderByDescending(h => h.Id).ToListAsync();
    
    var list = histories.Select(h => {
        // Case-insensitive email lookup
        var user = users.FirstOrDefault(u => u.Email.ToLower() == (h.DriverEmail ?? "").ToLower());
        return new {
            id = h.Id,
            routeId = h.RouteId,
            date = h.Date,
            startTime = h.StartTime,
            endTime = h.EndTime,
            origin = h.Origin,
            destination = h.Destination,
            driverName = user?.Name ?? h.DriverEmail ?? "Unknown",
            weather = h.Weather,
            weatherCondition = h.WeatherCondition,
            distance = h.Distance,
            duration = h.Duration,
            status = h.Status,
            driverEmail = h.DriverEmail,
            originLat = h.OriginLat,
            originLon = h.OriginLon,
            destinationLat = h.DestinationLat,
            destinationLon = h.DestinationLon,
            currentLat = h.CurrentLat,
            currentLon = h.CurrentLon,
            eta = h.Eta,
            speed = h.Speed,
            temperature = h.Temperature,
            humidity = h.Humidity,
            windSpeed = h.WindSpeed,
            rainProbability = h.RainProbability,
            safetyScore = h.SafetyScore,
            notes = h.Notes,
            createdAt = h.CreatedAt
        };
    }).ToList();

    return Results.Ok(list);
});
app.MapPost("/api/history", async (AppDbContext db, SaveDeliveryHistoryRequest req) => { 
    try {
        var trip = new DeliveryHistory {
            RouteId = req.RouteId,
            Date = req.Date,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            Origin = req.Origin,
            Destination = req.Destination,
            OriginLat = req.OriginLat,
            OriginLon = req.OriginLon,
            DestinationLat = req.DestinationLat,
            DestinationLon = req.DestinationLon,
            CurrentLat = req.OriginLat,
            CurrentLon = req.OriginLon,
            Eta = req.Eta,
            Speed = req.Speed,
            Weather = req.Weather,
            WeatherCondition = req.WeatherCondition,
            Temperature = req.Temperature,
            Humidity = req.Humidity,
            WindSpeed = req.WindSpeed,
            RainProbability = req.RainProbability,
            SafetyScore = req.SafetyScore,
            Distance = req.Distance,
            Duration = req.Duration,
            Status = req.Status,
            DriverEmail = req.DriverEmail,
            Notes = req.Notes,
            CreatedAt = DateTime.Now
        };
        db.Histories.Add(trip); 
        await db.SaveChangesAsync(); 
        return Results.Ok(new { success = true, tripId = trip.Id }); 
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Update an existing history (e.g., real-time location/status updates)
app.MapPut("/api/history/{id}", async (AppDbContext db, int id, JsonElement body) => {
    var trip = await db.Histories.FindAsync(id);
    if (trip == null) return Results.NotFound();
    try {
        if (body.TryGetProperty("currentLat", out var cl)) trip.CurrentLat = cl.GetDouble();
        if (body.TryGetProperty("currentLon", out var co)) trip.CurrentLon = co.GetDouble();
        if (body.TryGetProperty("eta", out var e)) trip.Eta = e.GetString();
        if (body.TryGetProperty("speed", out var s)) trip.Speed = s.GetDouble();
        if (body.TryGetProperty("status", out var st)) trip.Status = st.GetString() ?? trip.Status;
        if (body.TryGetProperty("endTime", out var et)) trip.EndTime = et.GetString() ?? trip.EndTime;
        if (body.TryGetProperty("destinationLat", out var dl)) trip.DestinationLat = dl.GetDouble();
        if (body.TryGetProperty("destinationLon", out var dlon)) trip.DestinationLon = dlon.GetDouble();
        if (body.TryGetProperty("weather", out var w)) trip.Weather = w.GetString() ?? trip.Weather;
        if (body.TryGetProperty("weatherCondition", out var wc)) trip.WeatherCondition = wc.GetString() ?? trip.WeatherCondition;
        if (body.TryGetProperty("temperature", out var t)) trip.Temperature = t.GetDouble();
        if (body.TryGetProperty("humidity", out var h)) trip.Humidity = h.ValueKind == JsonValueKind.Number ? h.GetInt32() : trip.Humidity;
        if (body.TryGetProperty("windSpeed", out var ws)) trip.WindSpeed = ws.GetDouble();
        if (body.TryGetProperty("rainProbability", out var rp)) trip.RainProbability = rp.GetDouble();
        if (body.TryGetProperty("safetyScore", out var ss)) trip.SafetyScore = ss.GetString() ?? trip.SafetyScore;
        await db.SaveChangesAsync();
        return Results.Ok(new { success = true });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- USERS (Admin) ---
app.MapGet("/api/users", async (AppDbContext db) => {
    var list = await db.Users.Select(u => new { id = u.Id, email = u.Email, name = u.Name, phone = u.Phone ?? "", role = u.Role, status = (string.IsNullOrEmpty(u.Status) ? "Active" : u.Status), password = u.PlainPassword }).ToListAsync();
    return Results.Ok(list);
});

app.MapDelete("/api/users/{id}", async (AppDbContext db, int id) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { success = true });
});

// Update user (Admin)
app.MapPut("/api/users/{id}", async (AppDbContext db, int id, System.Text.Json.JsonElement body) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (body.TryGetProperty("email", out var e) || body.TryGetProperty("Email", out e)) user.Email = e.GetString() ?? user.Email;
    if (body.TryGetProperty("name", out var n) || body.TryGetProperty("Name", out n)) user.Name = n.GetString() ?? user.Name;
    if (body.TryGetProperty("phone", out var p) || body.TryGetProperty("Phone", out p)) user.Phone = p.GetString() ?? user.Phone;
    if (body.TryGetProperty("password", out var pwd) || body.TryGetProperty("Password", out pwd)) {
        var newPwd = pwd.GetString();
        if (!string.IsNullOrWhiteSpace(newPwd)) {
            user.Password = HashPassword(newPwd);
            user.PlainPassword = newPwd;
        }
    }
    if (body.TryGetProperty("role", out var r) || body.TryGetProperty("Role", out r)) user.Role = r.GetString() ?? user.Role;
    if (body.TryGetProperty("status", out var s) || body.TryGetProperty("Status", out s)) user.Status = s.GetString() ?? user.Status;

    await db.SaveChangesAsync();
    return Results.Ok(new { success = true, user = new { id = user.Id, email = user.Email, name = user.Name, phone = user.Phone, role = user.Role, status = user.Status } });
});

// Fallback update endpoint using POST to avoid verb routing conflicts in some environments
app.MapPost("/api/users/{id}/update", async (AppDbContext db, int id, System.Text.Json.JsonElement body) => {
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (body.TryGetProperty("email", out var e) || body.TryGetProperty("Email", out e)) user.Email = e.GetString() ?? user.Email;
    if (body.TryGetProperty("name", out var n) || body.TryGetProperty("Name", out n)) user.Name = n.GetString() ?? user.Name;
    if (body.TryGetProperty("phone", out var p) || body.TryGetProperty("Phone", out p)) user.Phone = p.GetString() ?? user.Phone;
    if (body.TryGetProperty("password", out var pwd) || body.TryGetProperty("Password", out pwd)) {
        var newPwd = pwd.GetString();
        if (!string.IsNullOrWhiteSpace(newPwd)) {
            user.Password = HashPassword(newPwd);
            user.PlainPassword = newPwd;
        }
    }
    if (body.TryGetProperty("role", out var r) || body.TryGetProperty("Role", out r)) user.Role = r.GetString() ?? user.Role;
    if (body.TryGetProperty("status", out var s) || body.TryGetProperty("Status", out s)) user.Status = s.GetString() ?? user.Status;

    await db.SaveChangesAsync();
    return Results.Ok(new { success = true, user = new { id = user.Id, email = user.Email, name = user.Name, phone = user.Phone, role = user.Role, status = user.Status } });
});

// --- ADMIN DASHBOARD STATS ---
app.MapGet("/api/admin/stats", async (AppDbContext db) => {
    try {
        // Load data into memory for flexible processing
        var users = await db.Users.ToListAsync();
        var histories = await db.Histories.ToListAsync();

        // Delivery count grouped by user (driver email)
        var userDeliveries = histories
            .Where(h => h.Status?.ToLower() == "completed" && !string.IsNullOrEmpty(h.DriverEmail))
            .GroupBy(h => h.DriverEmail)
            .Select(g => {
                var user = users.FirstOrDefault(u => u.Email.ToLower() == g.Key.ToLower());
                return new {
                    user = user?.Name ?? g.Key,
                    email = g.Key,
                    count = g.Count()
                };
            })
            .OrderByDescending(x => x.count)
            .ToList();

        // Active fleet = count of distinct drivers with IN PROGRESS (not completed) deliveries
        var activeFleet = histories
            .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() != "completed" && !string.IsNullOrEmpty(h.DriverEmail))
            .Select(h => h.DriverEmail)
            .Distinct()
            .Count();

        // Active alerts = count of SOS alerts that are currently active (IsActive == true)
        var activeAlerts = await db.SosAlerts.CountAsync(a => a.IsActive);

        var totalDrivers = users.Count(u => u.Role == "user");
        var systemHealth = (histories.Count > 0) ? "Good" : "No Data";

        return Results.Ok(new {
            activeFleet,
            activeAlerts,
            totalDrivers,
            systemHealth,
            weeklyVolume = userDeliveries // Return user-based delivery counts instead of daily
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine("/api/admin/stats error: " + ex.ToString());
        // Return empty/safe data
        return Results.Ok(new {
            activeFleet = 0,
            activeAlerts = 0,
            totalDrivers = 0,
            systemHealth = "Error",
            weeklyVolume = new List<object>()
        });
    }
});

// --- SOS ALERTS ---
app.MapGet("/api/alerts", async (AppDbContext db) => {
    var alerts = await db.SosAlerts.OrderByDescending(a => a.Id).ToListAsync();
    var users = await db.Users.ToListAsync();
    
    var result = alerts.Select(a => {
        // Look up driver name from users table
        var user = users.FirstOrDefault(u => u.Email.ToLower() == (a.DriverEmail ?? "").ToLower());
        var driverName = user?.Name ?? a.DriverEmail ?? "Unknown";
        
        // Format time if it's ISO format
        string formattedTime = a.Time;
        if (!string.IsNullOrEmpty(a.Time) && (a.Time.Contains("T") || a.Time.Contains("-"))) {
            if (DateTime.TryParse(a.Time, out var dt)) {
                formattedTime = dt.ToString("dd MMM yyyy, hh:mm tt");
            }
        }
        
        return new {
            id = a.Id,
            vehicleId = a.VehicleId,
            driverEmail = a.DriverEmail,
            driverName = driverName,
            type = a.Type,
            location = a.Location,
            time = formattedTime,
            isActive = a.IsActive
        };
    }).ToList();
    return Results.Ok(result);
});

app.MapPost("/api/alerts", async (AppDbContext db, SosAlert req) => {
    req.Time = DateTime.Now.ToString("HH:mm");
    req.IsActive = true;
    db.SosAlerts.Add(req);
    await db.SaveChangesAsync();
    return Results.Ok(new { id = req.Id, message = "Alert triggered" });
});

app.MapPut("/api/alerts/{id}", async (AppDbContext db, int id) => {
    var alert = await db.SosAlerts.FindAsync(id);
    if (alert == null) return Results.NotFound();
    alert.IsActive = false;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Alert closed" });
});

// --- FLEET MONITORING ---
app.MapGet("/api/fleet/locations", async (AppDbContext db) => {
    // Return active in-progress histories using recorded current location if present
    var activeRoutes = await db.Histories
        .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() != "completed")
        .ToListAsync();

    var userIds = activeRoutes.Select(h => h.DriverEmail).Where(e => e != null).Distinct().ToList();
    var userLookup = await db.Users.Where(u => userIds.Contains(u.Email)).ToDictionaryAsync(u => u.Email, u => u.Name);

    var vehicles = activeRoutes.Select((h, idx) => new {
        id = h.Id.ToString(),
        vehicleId = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : (string.IsNullOrEmpty(h.RouteId) ? $"FLT-{1000 + idx}" : h.RouteId),
        driverEmail = h.DriverEmail,
        driverName = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : h.DriverEmail,
        lat = h.CurrentLat ?? (h.OriginLat ?? 13.0827) ,
        lon = h.CurrentLon ?? (h.OriginLon ?? 80.2707) ,
        heading = (idx % 4) switch { 0 => "North", 1 => "East", 2 => "South", _ => "West" },
        status = string.IsNullOrEmpty(h.Status) ? "Moving" : h.Status,
        origin = h.Origin,
        destination = h.Destination,
        distance = h.Distance,
        eta = h.Eta ?? "--"
    }).ToList();

    return Results.Ok(vehicles);
});

app.MapGet("/api/fleet/route/{id}", async (AppDbContext db, int id) => {
    var route = await db.Histories.FindAsync(id);
    if (route == null) return Results.NotFound();
    
    return Results.Ok(new {
        id = route.Id,
        routeId = route.RouteId,
        driverEmail = route.DriverEmail,
        origin = route.Origin,
        destination = route.Destination,
        distance = route.Distance,
        status = route.Status,
        startTime = route.StartTime,
        eta = route.Eta ?? "--",
        currentLocation = new { lat = route.CurrentLat ?? route.OriginLat ?? 13.0827, lon = route.CurrentLon ?? route.OriginLon ?? 80.2707 }
    });
});

// --- REAL-TIME FLEET MONITORING WITH ROUTE GEOMETRY ---
app.MapGet("/api/fleet/realtime", async (AppDbContext db, IHttpClientFactory clientFactory) => {
    var http = clientFactory.CreateClient();
    http.DefaultRequestHeaders.Add("User-Agent", "ClimaRouteApp/1.0");
    
    // Get active in-progress trips
    var activeRoutes = await db.Histories
        .Where(h => !string.IsNullOrEmpty(h.Status) && h.Status.ToLower() != "completed")
        .ToListAsync();

    var userIds = activeRoutes.Select(h => h.DriverEmail).Where(e => e != null).Distinct().ToList();
    var userLookup = await db.Users.Where(u => userIds.Contains(u.Email)).ToDictionaryAsync(u => u.Email, u => u.Name);

    var vehicles = new List<object>();
    
    foreach (var (h, idx) in activeRoutes.Select((h, idx) => (h, idx))) {
        var currentLat = h.CurrentLat ?? h.OriginLat ?? 13.0827;
        var currentLon = h.CurrentLon ?? h.OriginLon ?? 80.2707;
        var destLat = h.DestinationLat ?? 13.1;
        var destLon = h.DestinationLon ?? 80.3;
        
        // Fetch route geometry from OSRM
        List<double[]>? routeGeometry = null;
        try {
            var osrmUrl = $"http://router.project-osrm.org/route/v1/driving/{currentLon},{currentLat};{destLon},{destLat}?overview=full&geometries=geojson";
            var osrmResponse = await http.GetAsync(osrmUrl);
            if (osrmResponse.IsSuccessStatusCode) {
                var osrmData = await osrmResponse.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(osrmData);
                var routes = doc.RootElement.GetProperty("routes");
                if (routes.GetArrayLength() > 0) {
                    var coords = routes[0].GetProperty("geometry").GetProperty("coordinates");
                    routeGeometry = new List<double[]>();
                    foreach (var coord in coords.EnumerateArray()) {
                        var lon = coord[0].GetDouble();
                        var lat = coord[1].GetDouble();
                        routeGeometry.Add(new double[] { lat, lon });
                    }
                }
            }
        } catch (Exception ex) {
            Console.WriteLine($"OSRM Error for vehicle {h.Id}: {ex.Message}");
        }
        
        // Fallback to straight line if OSRM fails
        if (routeGeometry == null || routeGeometry.Count == 0) {
            routeGeometry = new List<double[]> {
                new double[] { currentLat, currentLon },
                new double[] { destLat, destLon }
            };
        }
        
        vehicles.Add(new {
            id = h.Id,
            vehicleId = h.RouteId ?? $"FLT-{1000 + idx}",
            driverEmail = h.DriverEmail,
            driverName = (h.DriverEmail != null && userLookup.ContainsKey(h.DriverEmail)) ? userLookup[h.DriverEmail] : h.DriverEmail,
            lat = currentLat,
            lon = currentLon,
            originLat = h.OriginLat ?? currentLat,
            originLon = h.OriginLon ?? currentLon,
            destLat = destLat,
            destLon = destLon,
            heading = (idx % 4) switch { 0 => "North", 1 => "East", 2 => "South", _ => "West" },
            status = string.IsNullOrEmpty(h.Status) ? "Moving" : h.Status,
            origin = h.Origin,
            destination = h.Destination,
            distance = h.Distance,
            eta = h.Eta ?? "--",
            speed = h.Speed ?? 0,
            routeGeometry = routeGeometry
        });
    }

    return Results.Ok(vehicles);
});

// --- UPDATE VEHICLE LOCATION (for real-time tracking) ---
app.MapPost("/api/fleet/update-location", async (AppDbContext db, UpdateLocationRequest req) => {
    try {
        var trip = await db.Histories.FindAsync(req.TripId);
        if (trip == null) return Results.NotFound(new { error = "Trip not found" });
        
        trip.CurrentLat = req.Latitude;
        trip.CurrentLon = req.Longitude;
        trip.Speed = req.Speed;
        if (!string.IsNullOrEmpty(req.Eta)) trip.Eta = req.Eta;
        
        await db.SaveChangesAsync();
        return Results.Ok(new { success = true });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- WEATHER STORAGE & HISTORY ---
app.MapPost("/api/weather/save", async (AppDbContext db, SaveWeatherRequest req) => {
    var weather = new Weather 
    { 
        Temperature = req.Temperature, 
        Condition = req.Condition, 
        Humidity = req.Humidity, 
        WindSpeed = req.WindSpeed,
        RainProbability = req.RainProbability,
        SafetyScore = req.SafetyScore,
        RecordedAt = DateTime.Now
    };
    db.Weathers.Add(weather);
    await db.SaveChangesAsync();
    return Results.Ok(new { success = true, id = weather.Id });
});

app.MapGet("/api/weather/history", async (AppDbContext db) => {
    var records = await db.Weathers
        .OrderByDescending(w => w.RecordedAt)
        .Take(168) // Last 7 days * 24 hours
        .ToListAsync();
    return Results.Ok(records.Select(w => new {
        w.Id,
        w.Temperature,
        w.Condition,
        w.Humidity,
        w.WindSpeed,
        w.RainProbability,
        w.SafetyScore,
        recordedAt = w.RecordedAt.ToString("yyyy-MM-dd HH:mm:ss")
    }).ToList());
});

// --- SOS TRACKING & BREAK MODE ---
app.MapPost("/api/sos/track-movement", async (AppDbContext db, SosTrackingRequest req) => {
    // Log vehicle movement for idle detection
    // In production, you'd save this to a separate tracking table
    // For now, this can be used to update the last SOS alert's location
    try {
        var lastAlert = await db.SosAlerts.OrderByDescending(s => s.Id).FirstOrDefaultAsync();
        if (lastAlert != null) {
            lastAlert.Location = req.Location;
            lastAlert.Time = req.Timestamp;
            await db.SaveChangesAsync();
        }
        return Results.Ok(new { success = true });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapPut("/api/sos/update-status", async (AppDbContext db, SosStatusRequest req) => {
    // Update driver break mode and current location
    // Create a notification record if break mode changes
    try {
        var alert = new SosAlert {
            VehicleId = "CURRENT-VEHICLE",
            DriverEmail = "user@gami.com", // In real app, get from auth context
            Type = req.BreakModeActive ? "BreakModeOn" : "BreakModeOff",
            Location = req.Location,
            Time = req.Timestamp,
            IsActive = req.BreakModeActive
        };
        db.SosAlerts.Add(alert);
        await db.SaveChangesAsync();
        return Results.Ok(new { success = true, sosAlertId = alert.Id });
    } catch (Exception ex) {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// --- REST POINTS (Real nearby amenities using Overpass API) ---
app.MapPost("/api/rest-points", async (IHttpClientFactory clientFactory, RestPointRequest req) => {
    var http = clientFactory.CreateClient();
    
    try {
        // Use Overpass API to find real nearby amenities (cafes, gas stations, parking, tolls)
        // This searches within a 5km radius
        var radius = 5000; // 5km in meters
        var query = $@"[bbox:{req.Latitude - 0.045},{req.Longitude - 0.045},{req.Latitude + 0.045},{req.Longitude + 0.045}];
            (
                node[amenity=cafe](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=fuel](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=parking](around:{radius},{req.Latitude},{req.Longitude});
                node[amenity=restaurant](around:{radius},{req.Latitude},{req.Longitude});
            );
            out center;";

        var overpassUrl = $"https://overpass-api.de/api/interpreter?data={Uri.EscapeDataString(query)}";
        var response = await http.GetAsync(overpassUrl);
        
        if (!response.IsSuccessStatusCode) {
            return Results.Ok(new { restPoints = new List<object>() });
        }

        var xmlContent = await response.Content.ReadAsStringAsync();
        
        // Parse Overpass XML response manually (simple extraction)
        var restPoints = new List<dynamic>();
        
        // Extract nodes using simple regex (in production, use proper XML parser)
        var nodePattern = @"<node id=""(\d+)"" lat=""([^""]+)"" lon=""([^""]+)"">";
        var namePattern = @"<tag k=""name"" v=""([^""]+)""/>";
        var amenityPattern = @"<tag k=""amenity"" v=""([^""]+)""/>";
        
        var nodes = System.Text.RegularExpressions.Regex.Matches(xmlContent, nodePattern);
        
        foreach (System.Text.RegularExpressions.Match nodeMatch in nodes) {
            try {
                var lat = double.Parse(nodeMatch.Groups[2].Value);
                var lon = double.Parse(nodeMatch.Groups[3].Value);
                
                // Extract name and amenity type
                var nodeXml = System.Text.RegularExpressions.Regex.Match(xmlContent, 
                    $@"<node id=""{nodeMatch.Groups[1].Value}""[^>]*>.*?</node>", 
                    System.Text.RegularExpressions.RegexOptions.Singleline);
                
                var nameMatch = System.Text.RegularExpressions.Regex.Match(nodeXml.Value, namePattern);
                var amenityMatch = System.Text.RegularExpressions.Regex.Match(nodeXml.Value, amenityPattern);
                
                var name = nameMatch.Success ? nameMatch.Groups[1].Value : "Rest Point";
                var amenityType = amenityMatch.Success ? amenityMatch.Groups[1].Value : "facility";
                
                // Calculate distance using Haversine formula
                var distance = CalculateDistance(req.Latitude, req.Longitude, lat, lon);
                
                // Only include points within 5km
                if (distance <= 5) {
                    var restPoint = new {
                        id = nodeMatch.Groups[1].Value,
                        name = name,
                        type = MapAmenityType(amenityType),
                        lat = lat,
                        lon = lon,
                        distance = distance,
                        duration = (int)(distance * 60 / 80) // Estimate: 80 km/h average speed
                    };
                    restPoints.Add(restPoint);
                }
            } catch { }
        }
        
        // Sort by distance
        restPoints = restPoints.OrderBy(p => p.distance).ToList();
        
        return Results.Ok(new { restPoints = restPoints });
    } catch (Exception ex) {
        Console.WriteLine($"Rest Points Error: {ex.Message}");
        return Results.Ok(new { restPoints = new List<object>() });
    }
});

app.Run("http://localhost:5000");

// Utility: Calculate distance between two coordinates (Haversine formula)
static double CalculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371; // Earth's radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
            Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
    var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    return R * c;
}

// Utility: Map OpenStreetMap amenity types to user-friendly names
static string MapAmenityType(string amenityType) {
    return amenityType switch {
        "cafe" => "Coffee Shop",
        "restaurant" => "Restaurant",
        "fuel" => "Petrol Pump",
        "parking" => "Parking Area",
        "hospital" => "Hospital",
        "pharmacy" => "Pharmacy",
        _ => "Rest Point"
    };
}

// Utility: simple SHA256 password hashing (not a full auth solution, but better than plaintext)
static string HashPassword(string pwd)
{
    if (string.IsNullOrEmpty(pwd)) return "";
    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(pwd));
    return Convert.ToHexString(bytes);
}

// --- MODELS ---
class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions options) : base(options) { }
    public DbSet<User> Users => Set<User>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<Weather> Weathers => Set<Weather>();
    public DbSet<DeliveryHistory> Histories => Set<DeliveryHistory>();
    public DbSet<SosAlert> SosAlerts => Set<SosAlert>();
}

class User { public int Id { get; set; } public string Email { get; set; } = ""; public string Password { get; set; } = ""; public string PlainPassword { get; set; } = ""; public string Name { get; set; } = ""; public string Phone { get; set; } = ""; public string Role { get; set; } = "user"; public string Status { get; set; } = "Active"; }
class LoginRequest { public string Email { get; set; } = ""; public string Password { get; set; } = ""; }
class UserCreate { public string Email { get; set; } = ""; public string Name { get; set; } = ""; public string Password { get; set; } = ""; public string Role { get; set; } = ""; }
class DeliveryHistory { 
    public int Id { get; set; } 
    public string RouteId { get; set; } = ""; 
    public string Date { get; set; } = ""; 
    public string StartTime { get; set; } = ""; 
    public string EndTime { get; set; } = ""; 
    public string Origin { get; set; } = ""; 
    public string Destination { get; set; } = ""; 
    public string Weather { get; set; } = ""; 
    public string Distance { get; set; } = ""; 
    public string Status { get; set; } = ""; 
    public string DriverEmail { get; set; } = "";
    // Extended fields for real-time tracking
    public double? OriginLat { get; set; }
    public double? OriginLon { get; set; }
    public double? DestinationLat { get; set; }
    public double? DestinationLon { get; set; }
    public double? CurrentLat { get; set; }
    public double? CurrentLon { get; set; }
    public string? Eta { get; set; }
    public double? Speed { get; set; }
    public double? Temperature { get; set; }
    public int? Humidity { get; set; }
    public double? WindSpeed { get; set; }
    public double? RainProbability { get; set; }
    public string SafetyScore { get; set; } = "Safe";
    public string WeatherCondition { get; set; } = "";
    public double? Duration { get; set; } // in minutes
    public string Notes { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
class Notification { public int Id { get; set; } public string Category { get; set; } = ""; public string Title { get; set; } = ""; public string Description { get; set; } = ""; public string Timestamp { get; set; } = ""; }
class Weather { public int Id { get; set; } public double Temperature { get; set; } public string Condition { get; set; } = ""; public int Humidity { get; set; } public double WindSpeed { get; set; } public double RainProbability { get; set; } public string SafetyScore { get; set; } = "Safe"; public DateTime RecordedAt { get; set; } = DateTime.Now; }
class SosAlert { public int Id { get; set; } public string VehicleId { get; set; } = ""; public string DriverEmail { get; set; } = ""; public string Type { get; set; } = ""; public string Location { get; set; } = ""; public string Time { get; set; } = ""; public bool IsActive { get; set; } }

// User-specific settings stored in DB
class UserSettings {
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TemperatureUnit { get; set; } = "C"; // "C" or "F"
    public string DistanceUnit { get; set; } = "km"; // "km" or "mi"
    public string TimeFormat { get; set; } = "24"; // "12" or "24"
    public string Language { get; set; } = "en-US";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SettingsRequest { public string? TemperatureUnit { get; set; } public string? DistanceUnit { get; set; } public string? TimeFormat { get; set; } public string? Language { get; set; } }

public class RouteRequest { public string Origin { get; set; } = ""; public string Destination { get; set; } = ""; }
public class SaveWeatherRequest { public double Temperature { get; set; } public string Condition { get; set; } = ""; public int Humidity { get; set; } public double WindSpeed { get; set; } public double RainProbability { get; set; } public string SafetyScore { get; set; } = "Safe"; }
public class SosTrackingRequest { public string Location { get; set; } = ""; public string Timestamp { get; set; } = ""; public bool IsMoving { get; set; } }
public class SosStatusRequest { public bool BreakModeActive { get; set; } public string Location { get; set; } = ""; public string Timestamp { get; set; } = ""; }
public class RestPointRequest { public double Latitude { get; set; } public double Longitude { get; set; } }
public class SaveDeliveryHistoryRequest { 
    public string RouteId { get; set; } = ""; 
    public string Date { get; set; } = ""; 
    public string StartTime { get; set; } = ""; 
    public string EndTime { get; set; } = ""; 
    public string Origin { get; set; } = ""; 
    public string Destination { get; set; } = ""; 
    public double? OriginLat { get; set; }
    public double? OriginLon { get; set; }
    public double? DestinationLat { get; set; }
    public double? DestinationLon { get; set; }
    public string Weather { get; set; } = "";
    public string WeatherCondition { get; set; } = "";
    public double? Temperature { get; set; }
    public int? Humidity { get; set; }
    public double? WindSpeed { get; set; }
    public double? RainProbability { get; set; }
    public string SafetyScore { get; set; } = "Safe";
    public string Distance { get; set; } = "";
    public double? Duration { get; set; }
    public string Status { get; set; } = "Completed";
    public string DriverEmail { get; set; } = "";
    public string Notes { get; set; } = "";
    // Optional real-time telemetry
    public double? CurrentLat { get; set; }
    public double? CurrentLon { get; set; }
    public string? Eta { get; set; }
    public double? Speed { get; set; }
}
public class Coord { public double Lat { get; set; } public double Lon { get; set; } }
public class PythonResponse { public double safety_score { get; set; } public double rain_prob { get; set; } public string condition { get; set; } = ""; }
public class OsrmResponse { public List<RouteItem> routes { get; set; } = new(); }
public class RouteItem { public OsrmGeometry geometry { get; set; } = new(); public double duration { get; set; } public double distance { get; set; } }
public class OsrmGeometry { public List<List<double>> coordinates { get; set; } = new(); }
public class UpdateLocationRequest { public int TripId { get; set; } public double Latitude { get; set; } public double Longitude { get; set; } public double Speed { get; set; } public string? Eta { get; set; } }