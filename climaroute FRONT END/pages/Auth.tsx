import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card } from '../components/Layout';
import { Truck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
// import { apiService } from '../services/apiservice'; // Commented out for local-only mode

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const userObj = await login(email, password);
      navigate(userObj.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      console.error(err);
      setError('Login failed. Check credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 md:p-12 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-4">
             <Truck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ClimaRoute</h1>
          <p className="text-gray-500">Welcome to ClimaRoute System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
              <Input 
                type="text" 
                placeholder="admin@climaroute.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input 
                type="password" 
                placeholder="1234" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Button className="w-full py-3 text-lg shadow-lg shadow-blue-200" disabled={loading}>
              {loading ? "Verifying..." : "Log In"}
            </Button>
            <div className="text-center">
              <span className="text-gray-500 text-sm">New to fleet? </span>
              <Link to="/signup" className="text-blue-600 text-sm font-semibold hover:underline">Sign Up</Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}