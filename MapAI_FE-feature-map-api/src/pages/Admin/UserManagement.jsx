import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminService';
import { 
  UserX, 
  UserCheck, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck,
  Search,
  AlertTriangle,
  X,
  Info
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';

// Custom Confirmation Modal Component
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, type = 'danger', confirmText = 'Confirm' }) => {
  if (!isOpen) return null;

  const themes = {
    danger: {
      icon: <Trash2 className="w-6 h-6 text-rose-500" />,
      button: "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20",
      accent: "border-rose-500/20 bg-rose-500/5",
      iconBg: "bg-rose-500/10"
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-orange-500" />,
      button: "bg-orange-600 hover:bg-orange-500 shadow-orange-600/20",
      accent: "border-orange-500/20 bg-orange-500/5",
      iconBg: "bg-orange-500/10"
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-500" />,
      button: "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20",
      accent: "border-blue-500/20 bg-blue-500/5",
      iconBg: "bg-blue-500/10"
    }
  };

  const theme = themes[type];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-card w-full max-w-md rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden relative"
      >
        <div className="scanline"></div>
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${theme.iconBg}`}>
              {theme.icon}
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Security Confirmation</p>
            </div>
            <button onClick={onClose} className="ml-auto p-2 text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className={`p-4 rounded-2xl border ${theme.accent} mb-8`}>
            <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 hover:bg-white/10 transition-all"
            >
              CANCEL
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 ${theme.button} text-white rounded-xl text-[10px] font-black shadow-xl transition-all`}
            >
              {confirmText.toUpperCase()}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    confirmText: '',
    action: null
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openConfirmModal = (config) => {
    setModalConfig({ ...config, isOpen: true });
  };

  const closeConfirmModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleToggleStatus = async (userId, isCurrentlyBlocked) => {
    const action = async () => {
      try {
        await adminApi.toggleUserStatus(userId);
        addToast(`User ${isCurrentlyBlocked ? 'unblocked' : 'blocked'} successfully`, 'success');
        setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: !u.isBlocked } : u));
        closeConfirmModal();
      } catch (error) {
        addToast(error.message, 'error');
      }
    };

    openConfirmModal({
      type: isCurrentlyBlocked ? 'info' : 'warning',
      title: isCurrentlyBlocked ? 'Unblock User' : 'Block User',
      message: `Are you sure you want to ${isCurrentlyBlocked ? 'restore access for' : 'restrict access for'} this user? They will ${isCurrentlyBlocked ? 'be able' : 'no longer be able'} to login to the system.`,
      confirmText: isCurrentlyBlocked ? 'Unblock' : 'Block User',
      action
    });
  };

  const handleChangeRole = async (userId, currentRole) => {
    const isAdmin = currentRole === 'Admin' || currentRole == 0;
    const newRole = isAdmin ? 1 : 0; // 0: Admin, 1: User
    
    const action = async () => {
      try {
        await adminApi.changeUserRole(userId, newRole);
        addToast('User role updated successfully', 'success');
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole === 0 ? 'Admin' : 'User' } : u));
        closeConfirmModal();
      } catch (error) {
        addToast(error.message, 'error');
      }
    };

    openConfirmModal({
      type: 'warning',
      title: 'Change Authorization',
      message: `You are about to change this user's role to ${isAdmin ? 'REGULAR USER' : 'ADMINISTRATOR'}. This will change their system permissions.`,
      confirmText: 'Change Role',
      action
    });
  };

  const handleDeleteUser = async (userId) => {
    const action = async () => {
      try {
        await adminApi.deleteUser(userId);
        addToast('User deleted successfully', 'success');
        setUsers(users.filter(u => u.id !== userId));
        closeConfirmModal();
      } catch (error) {
        addToast(error.message, 'error');
      }
    };

    openConfirmModal({
      type: 'danger',
      title: 'Delete User Account',
      message: 'This action is PERMANENT. All user data, including their profile and system records, will be erased from the neural database.',
      confirmText: 'Delete Permanently',
      action
    });
  };

  const filteredUsers = users.filter(user => 
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 text-[8px] font-black uppercase">Sync</div>
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">Retrieving User Directory...</p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Manage Users</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Directory Control Panel</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text"
            placeholder="Search users..."
            className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700 text-white shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="scanline"></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse relative z-10">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Identity</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Authorization</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Directives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-blue-500/50 transition-all shadow-lg">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-blue-500 text-[10px] font-black">{user.fullName?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors">{user.fullName}</div>
                        <div className="text-[9px] text-slate-500 font-bold tracking-tight">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <button 
                      onClick={() => handleChangeRole(user.id, user.role)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all ${
                        user.role === 'Admin' || user.role == 0
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      } hover:brightness-125`}
                    >
                      {user.role === 'Admin' || user.role == 0 ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                      {(user.role === 'Admin' || user.role == 0) ? 'ADMIN' : 'USER'}
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${
                      user.isBlocked 
                        ? 'bg-rose-500/10 text-rose-400' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${user.isBlocked ? 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]'}`} />
                      {user.isBlocked ? 'DENIED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggleStatus(user.id, user.isBlocked)}
                        title={user.isBlocked ? "Restore Access" : "Restrict Access"}
                        className={`p-1.5 rounded-lg transition-all ${
                          user.isBlocked 
                            ? 'text-emerald-400 hover:bg-emerald-500/10 hover:scale-110' 
                            : 'text-orange-400 hover:bg-orange-500/10 hover:scale-110'
                        }`}
                      >
                        {user.isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        title="Delete Permanently"
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all hover:scale-110"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-600 italic text-[10px] font-bold">
                    NO USER RECORDS MATCHING QUERY
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {modalConfig.isOpen && (
          <ConfirmationModal 
            {...modalConfig} 
            onClose={closeConfirmModal}
            onConfirm={modalConfig.action}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UserManagement;
