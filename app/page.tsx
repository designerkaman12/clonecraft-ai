'use client';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import AppHeader from '@/components/AppHeader';
import ToastContainer from '@/components/shared/ToastContainer';

export default function HomePage() {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="workspace">
        <LeftPanel />
        <CenterPanel />
        <RightPanel />
      </div>
      <ToastContainer />
    </div>
  );
}
