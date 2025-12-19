using Microsoft.AspNetCore.Mvc;

namespace ClimaRouteAPI.Controllers
{
    // Local lightweight models used only by this controller (prevents dependency on other model namespaces)
    public class VehiclePositionLocal { public string Id { get; set; } = ""; public double Lat { get; set; } public double Lon { get; set; } public string Status { get; set; } = ""; public string Heading { get; set; } = ""; }
    public class SosAlertLocal { public string Id { get; set; } = ""; public string VehicleId { get; set; } = ""; public string Type { get; set; } = ""; public string Location { get; set; } = ""; public string Time { get; set; } = ""; public bool IsActive { get; set; } }
    public class NotificationItemLocal { public string Id { get; set; } = ""; public string Category { get; set; } = ""; public string Title { get; set; } = ""; public string Description { get; set; } = ""; public string Timestamp { get; set; } = ""; public bool Read { get; set; } }
    public class RestPointItemLocal { public string Id { get; set; } = ""; public string Name { get; set; } = ""; public string Type { get; set; } = ""; public string Distance { get; set; } = ""; public string SafetyRating { get; set; } = ""; public List<string> Facilities { get; set; } = new(); }
    public class SpeedDataLocal { public string SegmentName { get; set; } = ""; public int CurrentSpeed { get; set; } public int RecommendedSpeed { get; set; } public string RiskLevel { get; set; } = ""; }

    [ApiController]
    [Route("api/[controller]")]
    public class FleetController : ControllerBase
    {
        // --- IN-MEMORY DATABASES (local demo data) ---
        public static List<VehiclePositionLocal> VehiclesDB = new List<VehiclePositionLocal>
        {
            new VehiclePositionLocal { Id = "Trk-8843", Lat = 47.6062, Lon = -122.3321, Status = "Moving", Heading = "North" },
            new VehiclePositionLocal { Id = "Trk-9921", Lat = 45.5152, Lon = -122.6784, Status = "Idle", Heading = "South" },
            new VehiclePositionLocal { Id = "Trk-SOS1", Lat = 46.2, Lon = -122.5, Status = "SOS", Heading = "Stopped" }
        };

        public static List<SosAlertLocal> AlertsDB = new List<SosAlertLocal>
        {
            new SosAlertLocal { Id = "SOS-101", VehicleId = "Trk-SOS1", Type = "Medical", Location = "Sector 7G", Time = "10:45 AM", IsActive = true },
            new SosAlertLocal { Id = "SOS-102", VehicleId = "Trk-8843", Type = "Mechanical", Location = "Hwy 101", Time = "09:30 AM", IsActive = true }
        };

        // 1. LIVE MAP DATA
        [HttpGet("locations")]
        public IActionResult GetFleetLocations()
        {
            return Ok(VehiclesDB);
        }

        // 2. SOS ALERTS (Matched to your requirement: Fleet ID, Location, Type, Time)
        [HttpGet("alerts")]
        public IActionResult GetActiveAlerts()
        {
            return Ok(AlertsDB);
        }

        [HttpPost("sos")]
        public IActionResult TriggerSOS([FromBody] SosAlertLocal alert)
        {
            alert.Id = "SOS-" + (AlertsDB.Count + 1);
            alert.Time = DateTime.Now.ToString("t"); // Current time like "10:30 AM"
            AlertsDB.Add(alert);
            return Ok(new { message = "Alert Received" });
        }

        // 3. NOTIFICATIONS
        [HttpGet("notifications")]
        public IActionResult GetNotifications()
        {
            var notifs = new List<NotificationItemLocal>
            {
                new NotificationItemLocal { Id = "1", Category = "Critical", Title = "Storm Warning", Description = "Heavy rain in Sector 4", Timestamp = "Now", Read = false },
                new NotificationItemLocal { Id = "2", Category = "System", Title = "Maintenance", Description = "Server update at 2 AM", Timestamp = "1h ago", Read = true }
            };
            return Ok(notifs);
        }

        // 4. REST POINTS
        [HttpGet("restpoints")]
        public IActionResult GetRestPoints()
        {
            var points = new List<RestPointItemLocal>
            {
                new RestPointItemLocal { Id = "RP1", Name = "Pilot Travel Center", Type = "Truck Stop", Distance = "12 mi", SafetyRating = "High", Facilities = new List<string>{"Fuel", "Showers"} },
                new RestPointItemLocal { Id = "RP2", Name = "Joe's Diner", Type = "Diner", Distance = "5 mi", SafetyRating = "Medium", Facilities = new List<string>{"Food"} }
            };
            return Ok(points);
        }

        // 5. ADAPTIVE SPEED
        [HttpGet("adaptivespeed")]
        public IActionResult GetAdaptiveSpeed()
        {
            return Ok(new 
            {
                CurrentRec = 45, Reason = "Heavy Rain",
                Segments = new List<SpeedDataLocal> {
                    new SpeedDataLocal { SegmentName = "I-5 North", CurrentSpeed = 55, RecommendedSpeed = 45, RiskLevel = "High" }
                }
            });
        }
    }
}