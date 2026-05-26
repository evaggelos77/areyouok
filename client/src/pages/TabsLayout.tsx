import React from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomTabs from '../components/BottomTabs';
import InstallBanner from '../components/InstallBanner';
import OfflineBanner from '../components/OfflineBanner';

export default function TabsLayout() {
  return (
    <div className="page">
      <TopBar />
      <InstallBanner />
      <OfflineBanner />
      <div className="content safe-pad">
        <Outlet />
      </div>
      <BottomTabs />
    </div>
  );
}
