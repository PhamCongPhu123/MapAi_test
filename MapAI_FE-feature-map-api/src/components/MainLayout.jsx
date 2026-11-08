import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header />
      <main className="flex-grow pt-16"> 
      
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
