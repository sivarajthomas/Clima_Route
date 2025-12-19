# Quick Start Commands

## Install All Dependencies

### 1. Python AI Model
```bash
cd AI_Model
python -m venv env
env\Scripts\activate
pip install flask tensorflow pandas numpy requests joblib scikit-learn
```

### 2. C# Backend
```bash
cd BACKEND/ClimaRouteAPI
dotnet restore
```

### 3. React Frontend
```bash
cd "climaroute FRONT END"
npm install
```

## Run All Servers

**Terminal 1:**
```bash
cd AI_Model
env\Scripts\activate
python app.py
```

**Terminal 2:**
```bash
cd BACKEND/ClimaRouteAPI
dotnet run
```

**Terminal 3:**
```bash
cd "climaroute FRONT END"
npm run dev
```

## Access Application
Open browser: `http://localhost:5173`
