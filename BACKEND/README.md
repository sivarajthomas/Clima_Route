# Clima Route - Backend

## Running the Backend

The backend is a .NET Core API that runs on `http://localhost:5000`

### Start Backend:
```bash
cd ClimaRouteAPI
dotnet run
```

The backend will:
- Initialize the SQLite database
- Start the API server on port 5000
- Load default data

### Available Endpoints:
- `GET /api/fleet` - Get fleet data
- `POST /api/users/login` - User login
- And more fleet management endpoints...

---

## Frontend Setup

To add a frontend alongside this backend:

### Option 1: Create a React Frontend
```bash
cd ..
npx create-react-app frontend
cd frontend
npm start
```

### Option 2: Create a Vue Frontend
```bash
cd ..
npm create vite@latest frontend -- --template vue
cd frontend
npm install
npm run dev
```

### Proxy Configuration
In your frontend's `.env` or proxy settings:
```
REACT_APP_API_URL=http://localhost:5000
```

---

## Project Structure
```
Clima_Route/
├── BACKEND/
│   ├── ClimaRouteAPI/          # .NET Core API
│   ├── package.json            # Node dependencies (if needed)
│   └── README.md
├── frontend/                   # (To be created)
│   ├── src/
│   ├── public/
│   └── package.json
```

---

## Communication Between Frontend & Backend

The frontend will communicate with the backend API:
- Base URL: `http://localhost:5000`
- Example: `http://localhost:5000/api/fleet`

Make sure CORS is properly configured in `Program.cs`.
