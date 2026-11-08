import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminService';
import { motion } from 'framer-motion';
import { 
  Users, 
  MapPin, 
  Activity, 
  Shield, 
  UserCheck, 
  UserX,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Zap,
  Globe
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

// Mock data for charts
const userTrendData = [
  { name: 'Mon', users: 400 },
  { name: 'Tue', users: 300 },
  { name: 'Wed', users: 520 },
  { name: 'Thu', users: 450 },
  { name: 'Fri', users: 680 },
  { name: 'Sat', users: 900 },
  { name: 'Sun', users: 850 },
];

const categoryData = [
  { name: 'Restaurant', value: 400, color: '#3b82f6' },
  { name: 'Hotel', value: 300, color: '#a855f7' },
  { name: 'Tourist Attraction', value: 300, color: '#ec4899' },
  { name: 'Other', value: 200, color: '#10b981' },
];

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLocations: 0,
    activeUsers: 0,
    blockedUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const users = await adminApi.getUsers();
        setStats({
          totalUsers: users.length,
          totalLocations: 124,
          activeUsers: users.filter(u => !u.isBlocked).length,
          blockedUsers: users.filter(u => u.isBlocked).length,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card glow-${color} p-5 rounded-3xl border-l-4 border-${color}-500 relative overflow-hidden group hover:bg-slate-800/40 transition-all duration-500`}
    >
      <div className="scanline"></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
          <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-emerald-400 text-[9px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
              <TrendingUp size={9} /> {trend}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={18} />
        </div>
      </div>
      {/* Decorative background element */}
      <div className={`absolute -right-4 -bottom-4 w-20 h-20 bg-${color}-500/5 rounded-full blur-2xl group-hover:bg-${color}-500/10 transition-all`}></div>
    </motion.div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin"></div>
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 w-4 h-4 animate-pulse" />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">Initializing Neural Engine...</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header section with high-tech feel */}
      <div className="relative p-8 rounded-[2rem] bg-gradient-to-br from-blue-900/40 via-slate-900/60 to-slate-950 border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Globe className="w-48 h-48 text-blue-500 animate-[spin_60s_linear_infinite]" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
             <div className="h-0.5 w-10 bg-blue-500 rounded-full"></div>
             <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400">Platform Control Center</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-3">MapAI <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Intelligence</span> Dashboard</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
               <Clock className="w-3.5 h-3.5 text-blue-400" />
               <span className="text-[10px] font-bold text-slate-300">System Uptime: 99.98%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
               <Activity className="w-3.5 h-3.5 text-emerald-400" />
               <span className="text-[10px] font-bold text-slate-300">Network Latency: 24ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="blue" trend="+12.5% vs last month" />
        <StatCard title="Active Users" value={stats.activeUsers} icon={UserCheck} color="emerald" trend="+8.2% vs yesterday" />
        <StatCard title="Blocked Users" value={stats.blockedUsers} icon={UserX} color="rose" />
        <StatCard title="Total Locations" value={stats.totalLocations} icon={MapPin} color="purple" trend="+3 new today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card p-6 rounded-[2rem] border border-white/5 relative cyber-border"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="text-blue-500" size={18} />
                User Engagement Growth
              </h3>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Real-time traffic data visualization.</p>
            </div>
            <button className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all">
              <ArrowUpRight size={16} />
            </button>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userTrendData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Distribution */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 rounded-[2rem] border border-white/5 relative cyber-border"
        >
          <h3 className="text-lg font-black text-white tracking-tight mb-6">Location Diversity</h3>
          <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={6}
                  dataKey="value"
                  animationDuration={2000}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '9px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
               <p className="text-xl font-black text-white">124</p>
               <p className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Points</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] font-bold text-slate-400">{item.name}</span>
                </div>
                <span className="text-[10px] font-black text-white">{((item.value / 1200) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health / Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 rounded-[2rem] border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Shield className="text-emerald-500" size={18} />
              System Core Health
            </h3>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">Optimal</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             {[
               { label: 'Neural Engine', status: 'Active', value: 98, color: 'blue' },
               { label: 'Database Mesh', status: 'Stable', value: 94, color: 'purple' },
               { label: 'API Gateway', status: 'Fast', value: 99, color: 'emerald' },
               { label: 'Storage Cluster', status: 'Healthy', value: 82, color: 'indigo' },
             ].map((item, idx) => (
               <div key={idx} className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                    <span className={`text-[8px] font-bold text-${item.color}-400`}>{item.status}</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 2, delay: 0.5 + (idx * 0.1) }}
                      className={`h-full bg-${item.color}-500 rounded-full`}
                    />
                  </div>
                  <div className="mt-1 text-right">
                    <span className="text-[8px] font-black text-slate-300">{item.value}%</span>
                  </div>
               </div>
             ))}
          </div>
        </motion.div>

        {/* Audit Log / Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 rounded-[2rem] border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Activity className="text-blue-500" size={18} />
              Recent System Events
            </h3>
            <button className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest">View All Logs</button>
          </div>
          
          <div className="space-y-3">
            {[
              { event: 'User Authorization', detail: 'New admin role assigned', time: '14m ago', icon: Shield, color: 'blue' },
              { event: 'Geo-index Updated', detail: 'Re-indexed 45 points', time: '1h ago', icon: MapPin, color: 'purple' },
              { event: 'Storage Sync', detail: 'Avatar assets synchronized', time: '3h ago', icon: Globe, color: 'indigo' },
              { event: 'Security Alert', detail: 'Unauthorized attempt blocked', time: '5h ago', icon: UserX, color: 'rose' },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3 p-3 hover:bg-white/5 rounded-xl transition-all cursor-pointer group">
                <div className={`p-2 rounded-lg bg-${item.color}-500/10 text-${item.color}-500 group-hover:scale-110 transition-transform`}>
                  <item.icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black text-white">{item.event}</p>
                    <span className="text-[7px] font-bold text-slate-600 uppercase whitespace-nowrap">{item.time}</span>
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold truncate mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
