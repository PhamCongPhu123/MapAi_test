import { Link } from 'react-router-dom';
import { useNetworkStatus } from '../offline/network';
import OfflineMapPage from '../pages/OfflineMapPage';
import ProtectedRoute from './ProtectedRoute';
import { isNative } from '../config/platform';

export default function MapModeBoundary() {
  const { offline } = useNetworkStatus();
  if (offline) return <OfflineMapPage />;
  if (isNative && !import.meta.env.VITE_API_BASE_URL?.trim()) return <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-5 p-8 text-center">
    <h1 className="text-xl font-bold">Bản đồ online chưa được cấu hình</h1>
    <p>Bản cài demo này có sẵn gói Đà Nẵng để khám phá offline. Cấu hình địa chỉ backend khi build để bật chức năng online.</p>
    <Link to="/offline" className="px-5 py-3 bg-blue-600 rounded-xl">Mở bản đồ offline</Link>
  </main>;
  return <ProtectedRoute />;
}
