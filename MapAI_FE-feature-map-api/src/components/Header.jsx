import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth';

import { 
  Map, 
  LogIn, 
  Search, 
  Bell, 
  Compass, 
  Zap, 
  MapIcon, 
  ChevronDown,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react'
import { useState } from 'react'

const Header = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    logout()
    navigate("/login")
    setShowUserMenu(false)
  }

  const getRoleLabel = (role) => {
    if (role === 'Admin' || role == 0) return 'Admin';
    return 'User';
  };

  const isAdmin = user?.role === 'Admin' || user?.role == 0;

  return (
    <motion.header 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="app-header fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/5 px-4 md:px-10 flex justify-between items-center transition-all duration-300"
    >
      {/* Left: Logo & Brand */}
      <div className="flex items-center gap-8">
        <div 
          className="flex items-center gap-2.5 cursor-pointer group/logo" 
          onClick={() => navigate("/")}
        >
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"
          >
            <Map className="text-white w-5 h-5" />
          </motion.div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tighter text-white group-hover/logo:text-blue-400 transition-colors">
                MapAI
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[7px] font-black text-blue-400 uppercase tracking-widest">Beta</span>
            </div>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] -mt-0.5">Neural Navigation</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {[
            { name: 'Khám phá', icon: Compass, path: '/explore' },
            { name: 'Tính năng', icon: Zap, path: '/#features' },
            { name: 'Bản đồ', icon: MapIcon, path: '/map' },
          ].map((item) => (
            <button 
              key={item.name}
              onClick={() => {
                if (item.path.startsWith('/#')) {
                  const id = item.path.split('#')[1];
                  const element = document.getElementById(id);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    navigate('/');
                    setTimeout(() => {
                      const el = document.getElementById(id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }
                } else {
                  navigate(item.path);
                }
              }}
              className="flex items-center gap-2 text-[12px] font-bold text-slate-400 hover:text-white transition-all group cursor-pointer bg-transparent border-none outline-none"
            >
              <item.icon size={14} className="group-hover:text-blue-500 transition-colors" />
              {item.name}
              <ChevronDown size={10} className="opacity-30 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </nav>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden md:flex items-center gap-2 border-r border-white/5 pr-5">
          <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <Search size={16} />
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all relative">
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-600 rounded-full border border-slate-950"></span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <button 
                onClick={() => navigate("/login")}
                className="hidden sm:flex items-center gap-2 text-[12px] font-bold text-slate-300 hover:text-blue-400 transition-colors"
              >
                <LogIn size={15} /> Đăng nhập
              </button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/register")}
                className="px-5 py-2 bg-white text-slate-950 text-[12px] font-black rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-white/5"
              >
                Bắt đầu
              </motion.button>
            </>
          ) : (
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 pl-3 pr-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group"
              >
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[10px] font-black text-white leading-none">{user.fullName || user.name}</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{getRoleLabel(user.role)}</span>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center border border-white/20 shadow-lg group-hover:scale-105 transition-transform">
                  <User size={14} className="text-white" />
                </div>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-48 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden backdrop-blur-xl"
                  >
                    <div className="px-4 py-3 border-b border-white/5 sm:hidden">
                      <p className="text-[12px] font-black text-white">{user.fullName || user.name}</p>
                      <p className="text-[10px] text-slate-500">{user.email}</p>
                    </div>

                    {isAdmin && (
                      <button 
                        onClick={() => { navigate("/admin/dashboard"); setShowUserMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-[12px] font-black text-blue-400 hover:bg-blue-400/10 flex items-center gap-2.5 transition-colors"
                      >
                        <ShieldCheck size={14} /> Dashboard Admin
                      </button>
                    )}

                    <button 
                      onClick={() => { navigate("/profile"); setShowUserMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <User size={14} className="text-blue-500" /> Hồ sơ cá nhân
                    </button>
                    <button className="w-full px-4 py-2.5 text-left text-[12px] font-bold text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors">
                      <MapIcon size={14} className="text-indigo-500" /> Bản đồ của tôi
                    </button>
                    <div className="h-[1px] bg-white/5 my-1"></div>
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 text-left text-[12px] font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut size={14} /> Đăng xuất
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
        </div>
      </div>
    </motion.header>
  )
}

export default Header
