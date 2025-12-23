import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Layout';
import { Map, AlertTriangle, FileText, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiService } from '../../services/apiservice';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">System Offline</div>;

  // The 4 Feature Boxes
  const features = [
    { label: 'Live Monitoring', icon: Map, path: '/admin/fleet', color: 'bg-blue-100 text-blue-600' },
    { label: 'Alerts', icon: AlertTriangle, path: '/admin/alerts', color: 'bg-red-100 text-red-600' },
    { label: 'Delivery History', icon: FileText, path: '/admin/logs', color: 'bg-green-100 text-green-600' },
    { label: 'User Management', icon: Users, path: '/admin/users', color: 'bg-purple-100 text-purple-600' },
  ];

  // Stats boxes displaying numeric metrics
  const statsBoxes = [
    { label: 'Active Fleet', value: stats.activeFleet, color: 'bg-blue-100 text-blue-600', icon: Map, path: '/admin/fleet' },
    { label: 'Active Alerts', value: stats.activeAlerts, color: 'bg-red-100 text-red-600', icon: AlertTriangle, path: '/admin/alerts' },
    { label: 'Total Drivers', value: stats.totalDrivers, color: 'bg-purple-100 text-purple-600', icon: Users, path: '/admin/users' },
    { label: 'Manage Users', value: stats.totalUsers, color: 'bg-green-100 text-green-600', icon: Users, path: '/admin/users' },
  ];

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <h2 className="text-2xl font-bold text-gray-800 shrink-0">Admin Overview</h2>

      <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
        
        {/* Main: Bar Chart - Deliveries by User */}
        <Card title="Completed Deliveries by User" className="w-full flex flex-col">
          <div className="flex-1 min-h-0">
            {stats.weeklyVolume && stats.weeklyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyVolume}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="user" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} label={{ value: 'Deliveries', angle: -90, position: 'insideLeft' }} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px'}} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No delivery data available yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* STATS BOXES BELOW CHART */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {statsBoxes.map((box) => (
          <div key={box.label} onClick={() => box.path && navigate(box.path)} className="cursor-pointer">
            <Card className="flex flex-col items-center justify-center h-full hover:shadow-lg transition-all">
              <div className={`p-3 rounded-full mb-3 ${box.color}`}>
                <box.icon size={24} />
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase">{box.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{box.value}</p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}