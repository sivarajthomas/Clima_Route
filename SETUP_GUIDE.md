# ClimaRoute - Complete Setup Guide

This guide covers all dependencies and setup steps for running the ClimaRoute project on a new system.

## Prerequisites

### Required Software
- **Python 3.11+** (for AI Model)
- **.NET 10.0 SDK** (for Backend API)
- **Node.js 20+** and **npm** (for Frontend)
- **Git** (optional, for version control)

---

## 1. Python AI Model Setup

### Navigate to AI_Model folder
```bash
cd AI_Model
```

### Create virtual environment (recommended)
```bash
python -m venv env
```

### Activate virtual environment
**Windows:**
```bash
env\Scripts\activate
```

**Linux/Mac:**
```bash
source env/bin/activate
```

### Install Python packages
```bash
pip install -r requirements.txt
```

### Required Python Packages (see requirements.txt):
- flask==3.1.2
- tensorflow==2.19.0
- pandas==2.2.3
- numpy==2.2.3
- requests==2.32.3
- joblib==1.4.2
- scikit-learn==1.6.1

### Run Python AI Server
```bash
python app.py
```
Server runs on: `http://localhost:5001`

---

## 2. C# Backend API Setup

### Navigate to Backend folder
```bash
cd BACKEND/ClimaRouteAPI
```

### Install .NET SDK 10.0
Download from: https://dotnet.microsoft.com/download/dotnet/10.0

### Restore NuGet packages
```bash
dotnet restore
```

### Required NuGet Packages (auto-installed via .csproj):
- Microsoft.AspNetCore.OpenApi (10.0.0)
- Microsoft.EntityFrameworkCore (10.0.1)
- Microsoft.EntityFrameworkCore.Sqlite (10.0.1)

### Database Setup
The SQLite database (`climaroute.db`) will be created automatically on first run.

### Run Backend API
```bash
dotnet run
```
Server runs on: `http://localhost:5000`

---

## 3. React Frontend Setup

### Navigate to Frontend folder
```bash
cd "climaroute FRONT END"
```

### Install Node.js 20+
Download from: https://nodejs.org/

### Install npm packages
```bash
npm install
```

### Required npm Packages (see package.json):

**Dependencies:**
- react (19.2.0)
- react-dom (19.2.0)
- react-router-dom (7.9.6)
- leaflet (1.9.4)
- react-leaflet (5.0.0)
- react-leaflet-drift-marker (4.0.0)
- recharts (3.5.0)
- lucide-react (0.555.0)
- @google/genai (1.30.0)

**DevDependencies:**
- vite (6.4.1)
- @vitejs/plugin-react (5.0.0)
- typescript (5.8.2)
- @types/leaflet (1.9.21)
- @types/node (22.14.0)

### Run Frontend Development Server
```bash
npm run dev
```
Server runs on: `http://localhost:5173`

---

## 4. Complete Project Startup

### Start all 3 servers in order:

**Terminal 1 - Python AI Model:**
```bash
cd AI_Model
env\Scripts\activate
python app.py
```

**Terminal 2 - C# Backend:**
```bash
cd BACKEND/ClimaRouteAPI
dotnet run
```

**Terminal 3 - React Frontend:**
```bash
cd "climaroute FRONT END"
npm run dev
```

---

## 5. Database Information

### SQLite Database
- **Location:** `BACKEND/ClimaRouteAPI/climaroute.db`
- **Auto-created** on first backend run
- **No manual setup** required

### Default Users (created automatically):
- **Admin:** admin@clima.com / Admin@123
- **Driver:** driver@clima.com / Driver@123

---

## 6. Environment Configuration

### Frontend API URLs (already configured in code):
- Python AI: `http://localhost:5001`
- C# Backend: `http://localhost:5000`

### External APIs Used:
- **OpenStreetMap Nominatim** (geocoding)
- **OSRM** (routing)
- **Open-Meteo** (weather data)

---

## 7. Quick Install Commands

### Full setup from scratch:

```bash
# Python AI Model
cd AI_Model
python -m venv env
env\Scripts\activate
pip install -r requirements.txt

# C# Backend
cd ../BACKEND/ClimaRouteAPI
dotnet restore

# React Frontend
cd "../../climaroute FRONT END"
npm install
```

---

## 8. Troubleshooting

### Python Issues:
- Ensure Python 3.11+ is installed
- Use virtual environment to avoid conflicts
- Install Microsoft Visual C++ if TensorFlow fails

### .NET Issues:
- Verify .NET 10.0 SDK is installed: `dotnet --version`
- Clean and rebuild: `dotnet clean && dotnet build`

### Frontend Issues:
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (should be 20+)

### Port Conflicts:
- Python AI: Change port in `app.py` (line with `app.run()`)
- Backend: Change port in `launchSettings.json`
- Frontend: Change port in `vite.config.ts`

---

## 9. Build for Production

### Frontend Build:
```bash
cd "climaroute FRONT END"
npm run build
```
Output in `dist/` folder

### Backend Publish:
```bash
cd BACKEND/ClimaRouteAPI
dotnet publish -c Release -o ./publish
```

---

## 10. Project Structure

```
Clima_Route/
├── AI_Model/               # Python Flask AI Server
│   ├── app.py
│   ├── rainfall_model.keras
│   ├── scaler.gz
│   └── requirements.txt
├── BACKEND/
│   └── ClimaRouteAPI/      # C# ASP.NET Core API
│       ├── Program.cs
│       ├── climaroute.db   (auto-created)
│       └── ClimaRouteAPI.csproj
└── climaroute FRONT END/   # React + TypeScript
    ├── src/
    ├── package.json
    └── vite.config.ts
```

---

## Support

For issues or questions, refer to:
- Python AI logs in terminal
- Backend API: `http://localhost:5000/swagger`
- Frontend console (F12 in browser)
