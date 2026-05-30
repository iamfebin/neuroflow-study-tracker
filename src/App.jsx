import React, { useState } from 'react';
import { NeuroFlowProvider, useNeuroFlow } from './context/NeuroFlowContext';
import Header from './components/Header';
import CatchupBanner from './components/CatchupBanner';
import ProtocolList from './components/Timeline/ProtocolList';
import FocusHub from './components/Timer/FocusHub';
import StatsPanel from './components/Insights/StatsPanel';
import AICoach from './components/Insights/AICoach';
import DashboardPanel from './components/Insights/DashboardPanel';
import SyncModal from './components/Modals/SyncModal';
import DiffuseOverlay from './components/Modals/DiffuseOverlay';
import ToastContainer from './components/UI/ToastContainer';
import Gatekeeper from './components/Gatekeeper';

function MainAppContent({ isSyncModalOpen, setIsSyncModalOpen, activeTab, setActiveTab }) {
  const { currentUser, isOfflineSandbox, isAuthLoading } = useNeuroFlow();

  if (isAuthLoading) {
    return (
      <div className="bg-black text-mono-300 min-h-screen flex flex-col items-center justify-center select-none font-mono">
        <div className="w-8 h-8 rounded-full border border-mono-800 border-t-white animate-spin mb-4" />
        <span className="text-[10px] font-mono tracking-widest text-mono-500 uppercase animate-pulse">
          Initializing NeuroFlow Vault...
        </span>
      </div>
    );
  }

  if (!currentUser && !isOfflineSandbox) {
    return (
      <>
        <Gatekeeper />
        <ToastContainer />
      </>
    );
  }

  const toggleSyncModal = () => {
    setIsSyncModalOpen(prev => !prev);
  };

  return (
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
            <AICoach />
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
  );
}

export default function App() {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' or 'analytics'

  return (
    <NeuroFlowProvider>
      <MainAppContent
        isSyncModalOpen={isSyncModalOpen}
        setIsSyncModalOpen={setIsSyncModalOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </NeuroFlowProvider>
  );
}
