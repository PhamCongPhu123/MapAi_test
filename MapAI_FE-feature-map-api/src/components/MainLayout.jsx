import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileNavigation from './MobileNavigation';

const MainLayout = () => {
  return (
    <div className="main-layout min-h-dvh flex flex-col bg-slate-950">
      <Header />
      <main className="main-content flex-grow">
      
        <Outlet />
      </main>
      <Footer />
      <MobileNavigation />
    </div>
  );
};

export default MainLayout;
