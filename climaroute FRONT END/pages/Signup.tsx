import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card } from '../components/Layout';
import { Truck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiservice'; // IMPORT REAL SERVICE

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.name.trim()) return 'Full Name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (formData.password.length < 6) return 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // Call backend via AuthContext (which wraps apiService)
      const userObj = await signup(formData.email, formData.name, formData.password);
      navigate(userObj.role === 'admin' ? '/admin/dashboard' : '/dashboard');
    } catch (err) {
      console.error(err);
      setError('Signup failed. Email might already be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 md:p-12 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 mb-4">
             <Truck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ClimaRoute</h1>
          <p className="text-gray-500">Create your account to join the fleet</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <Input name="name" placeholder="Alex Driver" value={formData.name} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <Input name="email" type="email" placeholder="driver@climaroute.com" value={formData.email} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <Input name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} />
          </div>

          <div className="space-y-4 pt-2">
            <Button className="w-full py-3 text-lg shadow-lg shadow-blue-200" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
            <div className="text-center">
              <span className="text-gray-500 text-sm">Already have an account? </span>
              <Link to="/" className="text-blue-600 text-sm font-semibold hover:underline">Log In</Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}