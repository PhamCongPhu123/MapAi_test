import { NavLink } from 'react-router-dom';
import { Home, Compass, Map, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function MobileNavigation() {
  const { user } = useAuth();
  const items = [
    { to: '/', label: 'Trang chủ', icon: Home },
    { to: '/explore', label: 'Khám phá', icon: Compass },
    { to: '/map', label: 'Bản đồ', icon: Map },
    { to: user ? '/profile' : '/login', label: user ? 'Tài khoản' : 'Đăng nhập', icon: User },
  ];

  return (
    <nav aria-label="Điều hướng chính" className="mobile-navigation fixed bottom-0 inset-x-0 z-50 grid grid-cols-4 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl lg:hidden">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
          <Icon size={21} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
