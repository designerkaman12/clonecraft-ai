'use client';
import { useStore } from '@/lib/store';
import LeftPanel from '@/components/LeftPanel';
import CenterPanel from '@/components/CenterPanel';
import RightPanel from '@/components/RightPanel';
import AppHeader from '@/components/AppHeader';
import ToastContainer from '@/components/shared/ToastContainer';

export default function WorkspacePage() {
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
