import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

const AdminLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Manage Users', path: '/admin/users', icon: Users },
    { name: 'Manage Locations', path: '/admin/locations', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tight">Admin Panel</h1>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-blue-600/10 text-blue-500' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-bold">{item.name}</span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                    <div className="text-xs font-bold text-blue-500">
                        {user?.fullName?.charAt(0) || 'A'}
                    </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-white">{user?.fullName || 'Admin User'}</p>
                <p className="text-[10px] text-slate-500 truncate font-medium">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 shrink-0">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-400 hover:text-slate-200"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <span className="ml-4 font-bold">Admin Panel</span>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
