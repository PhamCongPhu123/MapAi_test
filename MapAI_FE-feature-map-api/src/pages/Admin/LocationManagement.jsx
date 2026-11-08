import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Upload, 
  X, 
  ExternalLink,
  Globe,
  Phone,
  Tag,
  Loader2,
  Info,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { adminApi } from '../../services/adminService';
import { getAllLocations } from '../../services/locationService';
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

const LocationManagement = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    confirmText: '',
    action: null
  });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    description: '',
    latitude: '',
    longitude: '',
    thumbnail: '',
    images: [],
    category: 'Tourist attraction',
    tags: '',
    phoneNumber: '',
    website: '',
    googleMapsUrl: ''
  });

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await getAllLocations();
      setLocations(data);
    } catch (error) {
      addToast('Failed to load locations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openConfirmModal = (config) => {
    setConfirmModal({ ...config, isOpen: true });
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleOpenModal = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        title: location.name || location.title || '',
        address: location.address || '',
        description: location.description || '',
        latitude: location.lat || location.latitude || '',
        longitude: location.lng || location.longitude || '',
        thumbnail: location.image || location.thumbnail || '',
        images: location.images || [],
        category: location.type || location.category || 'Tourist attraction',
        tags: Array.isArray(location.tags) ? location.tags.join(', ') : (location.tags || ''),
        phoneNumber: location.phone || location.phoneNumber || '',
        website: location.website || '',
        googleMapsUrl: location.googleMapsUrl || ''
      });
    } else {
      setEditingLocation(null);
      setFormData({
        title: '',
        address: '',
        description: '',
        latitude: '',
        longitude: '',
        thumbnail: '',
        images: [],
        category: 'Tourist attraction',
        tags: '',
        phoneNumber: '',
        website: '',
        googleMapsUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLocation(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const result = await adminApi.uploadLocationImage(file);
      setFormData(prev => ({ ...prev, thumbnail: result.url }));
      addToast('Image uploaded successfully', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      };

      if (editingLocation) {
        await adminApi.updateLocation(editingLocation.id, payload);
        addToast('Location updated successfully', 'success');
      } else {
        await adminApi.createLocation(payload);
        addToast('Location created successfully', 'success');
      }
      handleCloseModal();
      fetchLocations();
    } catch (error) {
      addToast(error.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const action = async () => {
      try {
        await adminApi.deleteLocation(id);
        addToast('Location deleted successfully', 'success');
        setLocations(locations.filter(loc => loc.id !== id));
        closeConfirmModal();
      } catch (error) {
        addToast(error.message, 'error');
      }
    };

    openConfirmModal({
      type: 'danger',
      title: 'Remove Geospatial Asset',
      message: 'You are about to permanently delete this location from the neural mapping system. This action cannot be reversed.',
      confirmText: 'Execute Deletion',
      action
    });
  };

  const filteredLocations = locations.filter(loc => 
    (loc.name || loc.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (loc.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Manage Locations</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Geospatial Asset Control</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
              type="text"
              placeholder="Search locations..."
              className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs font-bold focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700 text-white shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>
      </div>

      <div className="glass-card border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative min-h-[400px]">
        <div className="scanline"></div>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Querying Spatial Database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse relative z-10">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Location</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Coordinates</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Category</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Directives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLocations.length > 0 ? filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-white/5 transition-all group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-blue-500/50 transition-all shadow-lg shrink-0">
                          {loc.image ? (
                            <img src={loc.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="text-slate-600 w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors truncate">{loc.name}</div>
                          <div className="text-[9px] text-slate-500 font-bold tracking-tight truncate max-w-[200px]">{loc.address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[9px] font-black text-slate-400 flex items-center gap-1">
                          <span className="text-blue-500/50">LAT</span> {loc.lat?.toFixed(4)}
                        </div>
                        <div className="text-[9px] font-black text-slate-400 flex items-center gap-1">
                          <span className="text-blue-500/50">LNG</span> {loc.lng?.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-tighter">
                        {loc.type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(loc)}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all hover:scale-110"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(loc.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all hover:scale-110"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-600 italic text-[10px] font-bold uppercase tracking-widest">
                      No geospatial records found matching query
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto py-10 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden relative"
            >
              <div className="scanline"></div>
              
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {editingLocation ? 'Modify Spatial Asset' : 'Register New Location'}
                  </h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Core Database Entry</p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Location Title *</label>
                      <input 
                        name="title"
                        required
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="e.g. Dragon Bridge"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Category</label>
                      <select 
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all appearance-none"
                      >
                        <option value="Tourist attraction">Tourist attraction</option>
                        <option value="Restaurant">Restaurant</option>
                        <option value="Hotel">Hotel</option>
                        <option value="Cafe">Cafe</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Address</label>
                      <textarea 
                        name="address"
                        rows="2"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                        placeholder="Full physical address"
                      />
                    </div>
                  </div>

                  {/* Geospatial Data */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Latitude</label>
                        <input 
                          name="latitude"
                          type="number"
                          step="any"
                          required
                          value={formData.latitude}
                          onChange={handleInputChange}
                          className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="0.0000"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Longitude</label>
                        <input 
                          name="longitude"
                          type="number"
                          step="any"
                          required
                          value={formData.longitude}
                          onChange={handleInputChange}
                          className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="0.0000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Thumbnail Image</label>
                      <div className="flex gap-2">
                        <input 
                          name="thumbnail"
                          value={formData.thumbnail}
                          onChange={handleInputChange}
                          className="flex-1 bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="URL or use upload button"
                        />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current.click()}
                          className="p-2.5 bg-blue-600/10 border border-blue-600/20 text-blue-400 rounded-xl hover:bg-blue-600/20 transition-all shrink-0"
                          disabled={isUploading}
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </button>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </div>
                      {formData.thumbnail && (
                        <div className="mt-2 w-full h-24 rounded-xl border border-white/5 overflow-hidden">
                          <img src={formData.thumbnail} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Full Description</label>
                    <textarea 
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                      placeholder="Detailed information about the location..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                          <input 
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleInputChange}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="0123 456 789"
                          />
                        </div>
                     </div>
                     <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Website</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                          <input 
                            name="website"
                            value={formData.website}
                            onChange={handleInputChange}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="https://..."
                          />
                        </div>
                     </div>
                   </div>
                   <div className="space-y-4">
                     <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Tags (Comma separated)</label>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                          <input 
                            name="tags"
                            value={formData.tags}
                            onChange={handleInputChange}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="bridge, icon, da nang"
                          />
                        </div>
                     </div>
                     <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Google Maps URL</label>
                        <div className="relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                          <input 
                            name="googleMapsUrl"
                            value={formData.googleMapsUrl}
                            onChange={handleInputChange}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-blue-500/50 transition-all"
                            placeholder="https://maps.google.com/..."
                          />
                        </div>
                     </div>
                   </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-6 py-3 bg-white/5 border border-white/5 rounded-2xl text-[11px] font-black text-slate-400 hover:bg-white/10 transition-all"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[11px] font-black shadow-xl shadow-blue-600/20 transition-all"
                  >
                    {editingLocation ? 'SYNCHRONIZE CHANGES' : 'EXECUTE REGISTRATION'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <ConfirmationModal 
            {...confirmModal} 
            onClose={closeConfirmModal}
            onConfirm={confirmModal.action}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LocationManagement;
