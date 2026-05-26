import React, { useState } from 'react';
import { NeuroFlowProvider } from './context/NeuroFlowContext';
import Header from './components/Header';
import CatchupBanner from './components/CatchupBanner';
import ProtocolList from './components/Timeline/ProtocolList';
import FocusHub from './components/Timer/FocusHub';
import StatsPanel from './components/Insights/StatsPanel';
import DashboardPanel from './components/Insights/DashboardPanel';
import SyncModal from './components/Modals/SyncModal';
import DiffuseOverlay from './components/Modals/DiffuseOverlay';
import ToastContainer from './components/UI/ToastContainer';

export default function App() {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' or 'analytics'

  const toggleSyncModal = () => {
    setIsSyncModalOpen(prev => !prev);
  };

  return (
    <NeuroFlowProvider>
      <div className="bg-black text-mono-300 min-h-screen flex flex-col selection:bg-white selection:text-black">
        {/* Top Header Navigation */}
        <Header
          onToggleSyncModal={toggleSyncModal}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Dynamic Warning Alert Banner */}
        <CatchupBanner />

        {/* Conditional View Rendering */}
        {activeTab === 'tracker' ? (
          <main className="flex-grow max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start animate-fadeIn">
            {/* Left Column: timelines, schedules, splits */}
            <ProtocolList />

            {/* Right Column: focus hubs, insights, pie charts */}
            <div className="flex flex-col gap-8 w-full lg:sticky lg:top-24">
              <FocusHub />
              <StatsPanel />
            </div>
          </main>
        ) : (
          <main className="flex-grow max-w-6xl w-full mx-auto p-4 md:p-8 animate-fadeIn">
            <DashboardPanel />
          </main>
        )}

        {/* Global Floating Modals & Overlays */}
        <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
        <DiffuseOverlay />
        <ToastContainer />
      </div>
    </NeuroFlowProvider>
  );
}
