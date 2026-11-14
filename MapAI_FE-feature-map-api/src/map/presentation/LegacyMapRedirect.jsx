import { Navigate, useLocation } from 'react-router-dom';

export default function LegacyMapRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: '/map', search, hash }} replace />;
}
