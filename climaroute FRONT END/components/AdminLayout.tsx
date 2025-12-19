import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Map, FileText, AlertTriangle, LogOut, ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminSidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-6 py-3 transition-all duration-200 border-l-4
      ${isActive ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
    }
  >
    <Icon size={20} />
    <span>{label}</span>
  </NavLink>
);

export const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-xl flex flex-col fixed h-full z-20">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><ShieldCheck size={24}/></div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-tight">ClimaRoute</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wider">ADMIN PANEL</p>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
          <AdminSidebarItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <AdminSidebarItem to="/admin/fleet" icon={Map} label="Live Fleet Monitor" />
          <AdminSidebarItem to="/admin/alerts" icon={AlertTriangle} label="SOS Alerts" />
          <AdminSidebarItem to="/admin/logs" icon={FileText} label="Delivery History" />
          <AdminSidebarItem to="/admin/users" icon={Users} label="User Management" />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              {user?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-2 justify-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-transparent">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};