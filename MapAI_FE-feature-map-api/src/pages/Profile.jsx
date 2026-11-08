import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  MapPin, 
  Edit3, 
  LogOut, 
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/userService';
import { useToast } from '../hooks/useToast';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { addToast, removeToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.fullName || user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
  });

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await userApi.updateInfo(formData);
      await refreshUser();
      setIsEditing(false);
      addToast("Cập nhật thông tin thành công!", "success");
    } catch (error) {
      addToast(error.message || "Cập nhật thất bại", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (e.g., 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast("Kích thước ảnh không được vượt quá 5MB", "error");
      return;
    }

    const formDataObj = new FormData();
    formDataObj.append('file', file);

    setIsUploading(true);
    const loadingToastId = addToast("Đang tải ảnh lên...", "loading", Infinity);

    try {
      await userApi.updateAvatar(formDataObj);
      await refreshUser();
      removeToast(loadingToastId);
      addToast("Cập nhật ảnh đại diện thành công!", "success");
    } catch (error) {
      removeToast(loadingToastId);
      addToast(error.message || "Tải ảnh lên thất bại", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pt-24 pb-12 px-4 selection:bg-blue-500/30 overflow-hidden relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*"
      />

      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <div className="p-2 bg-white/5 rounded-xl border border-white/10 group-hover:bg-blue-600 group-hover:border-blue-500 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">Quay lại</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest rounded-full">
              Hệ thống Neural v2.0
            </span>
          </div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Profile Hero Card */}
          <motion.div 
            variants={itemVariants}
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            <div className="h-32 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            </div>
            
            <div className="px-8 pb-8 -mt-16 relative">
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="relative group self-start md:self-auto">
                  <div className="w-32 h-32 bg-slate-950 rounded-[2rem] border-4 border-slate-900 overflow-hidden shadow-2xl relative">
                    {isUploading && (
                      <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                    {user.avatarUrl || user.avatar ? (
                      <img src={user.avatarUrl || user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <User size={48} className="text-white/80" />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleAvatarClick}
                    disabled={isUploading}
                    className="absolute bottom-2 right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform border border-blue-400/50 disabled:opacity-50 disabled:scale-100"
                  >
                    <Camera size={16} />
                  </button>
                </div>

                <div className="flex-grow pt-4">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">{user.fullName || user.name}</h1>
                    <CheckCircle size={20} className="text-blue-500" />
                  </div>
                  <p className="text-slate-400 font-bold flex items-center gap-2 mt-1">
                    <Mail size={14} className="text-blue-400" /> {user.email}
                  </p>
                </div>

                <div className="flex gap-3 mt-4 md:mt-0">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (isEditing) {
                        setFormData({
                          fullName: user?.fullName || user?.name || '',
                          phoneNumber: user?.phoneNumber || '',
                          dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
                        });
                      }
                      setIsEditing(!isEditing);
                    }}
                    className={`flex items-center gap-2 px-6 py-3 ${isEditing ? 'bg-slate-800 text-white' : 'bg-white text-slate-950'} font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-white/5 hover:opacity-90 transition-all`}
                  >
                    {isEditing ? <><X size={14} /> Hủy</> : <><Edit3 size={14} /> Chỉnh sửa</>}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <LogOut size={18} />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Information Card */}
            <motion.div 
              variants={itemVariants}
              className="md:col-span-2 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                  <Shield size={16} className="text-blue-500" /> Thông tin tài khoản
                </h2>
                {isEditing && (
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full animate-pulse">
                    Chế độ chỉnh sửa
                  </span>
                )}
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ và tên</label>
                    <div className={`flex items-center gap-3 p-4 bg-slate-950/50 border ${isEditing ? 'border-blue-500/30' : 'border-white/5'} rounded-2xl transition-all`}>
                      <User size={16} className="text-blue-400" />
                      {isEditing ? (
                        <input 
                          type="text" name="fullName" value={formData.fullName} onChange={handleInputChange}
                          className="w-full bg-transparent border-none outline-none text-sm font-bold text-white placeholder:text-white/20"
                          placeholder="Nhập họ tên..." required
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-200">{user.fullName || user.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Địa chỉ Email</label>
                    <div className="flex items-center gap-3 p-4 bg-slate-950/20 border border-white/5 rounded-2xl opacity-60">
                      <Mail size={16} className="text-indigo-400" />
                      <span className="text-sm font-bold text-slate-400">{user.email}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Số điện thoại</label>
                    <div className={`flex items-center gap-3 p-4 bg-slate-950/50 border ${isEditing ? 'border-blue-500/30' : 'border-white/5'} rounded-2xl transition-all`}>
                      <Phone size={16} className="text-emerald-400" />
                      {isEditing ? (
                        <input 
                          type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange}
                          className="w-full bg-transparent border-none outline-none text-sm font-bold text-white placeholder:text-white/20"
                          placeholder="Nhập số điện thoại..."
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-200">{user.phoneNumber || 'Chưa cập nhật'}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ngày sinh</label>
                    <div className={`flex items-center gap-3 p-4 bg-slate-950/50 border ${isEditing ? 'border-blue-500/30' : 'border-white/5'} rounded-2xl transition-all`}>
                      <Calendar size={16} className="text-purple-400" />
                      {isEditing ? (
                        <input 
                          type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange}
                          className="w-full bg-transparent border-none outline-none text-sm font-bold text-white [color-scheme:dark]"
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-200">{formatDate(user.dateOfBirth)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quyền hạn hệ thống</label>
                  <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <Shield size={16} className="text-blue-500" />
                    <span className="text-sm font-black text-blue-400 uppercase tracking-widest">
                      {user.role === 1 || user.role === 'Admin' ? 'Administrator' : 'Standard User'}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {isEditing && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-4"
                    >
                      <button 
                        type="submit"
                        disabled={isUpdating}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                        Lưu thay đổi
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>

            {/* Sidebar Stats/Activity */}
            <motion.div 
              variants={itemVariants}
              className="space-y-6"
            >
              <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                  <MapPin size={16} className="text-indigo-500" /> Hoạt động
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase">0 Địa điểm</p>
                      <p className="text-[9px] text-slate-500 font-bold">Đã lưu trong MapAI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase">{new Date().toLocaleDateString('vi-VN')}</p>
                      <p className="text-[9px] text-slate-500 font-bold">Lần cuối truy cập</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                <h3 className="text-xl font-black text-white mb-2 italic">Nâng cấp Pro</h3>
                <p className="text-white/70 text-[10px] font-bold leading-relaxed mb-6">Mở khóa tính năng dẫn đường 3D không giới hạn và AI cao cấp.</p>
                <button className="w-full py-3 bg-white text-slate-950 text-[11px] font-black rounded-xl uppercase tracking-widest hover:scale-105 transition-transform">
                  Tìm hiểu ngay
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
