import React from 'react';
import { useNeuroFlow } from '../context/NeuroFlowContext';

export default function Header({ onToggleSyncModal, activeTab, onTabChange }) {
  const { liveClock, isFirebaseConnected, isOfflineSandbox, getAdjustedDate } = useNeuroFlow();

  const formattedDate = getAdjustedDate().toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });

  return (
    <header className="border-b border-mono-800 bg-black/90 backdrop-blur sticky top-0 z-40 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black font-bold tracking-tighter">
            NF
          </div>
          <h1 className="text-sm font-semibold tracking-wide text-white">NEUROFLOW</h1>
        </div>

        {/* Minimalist Tab Switcher */}
        <div className="flex items-center gap-1 border border-mono-800 rounded p-1 bg-black text-[10px] font-mono">
          <button
            onClick={() => onTabChange('tracker')}
            className={`px-3 py-1 rounded transition-all duration-200 uppercase tracking-widest font-bold ${
              activeTab === 'tracker'
                ? 'bg-white text-black'
                : 'text-mono-500 hover:text-mono-300'
            }`}
          >
            Tracker
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`px-3 py-1 rounded transition-all duration-200 uppercase tracking-widest font-bold ${
              activeTab === 'analytics'
                ? 'bg-white text-black'
                : 'text-mono-500 hover:text-mono-300'
            }`}
          >
            Analytics
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-mono-500">
          <span>{formattedDate}</span>
          <span className="text-white">{liveClock}</span>
          <button
            onClick={onToggleSyncModal}
            className={`hover:text-white transition uppercase tracking-widest border px-2 py-1 rounded ${
              isFirebaseConnected ? 'text-white border-white' : (isOfflineSandbox ? 'text-mono-300 border-mono-800' : 'border-mono-700')
            }`}
          >
            {isFirebaseConnected ? 'Synced' : (isOfflineSandbox ? 'Sandbox' : 'Offline')}
          </button>
        </div>
      </div>
    </header>
  );
}
