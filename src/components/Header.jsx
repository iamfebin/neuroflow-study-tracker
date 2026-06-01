import React from 'react';
import { useNeuroFlow } from '../context/NeuroFlowContext';

export default function Header({ onToggleSyncModal, activeTab, onTabChange }) {
  const {
    liveClock,
    isFirebaseConnected,
    isOfflineSandbox,
    getAdjustedDate,
    currentDateStr,
    changeViewDate,
    getFormattedDateStr
  } = useNeuroFlow();

  const todayStr = getFormattedDateStr(getAdjustedDate());
  const isViewingToday = currentDateStr === todayStr;

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
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={currentDateStr}
              onChange={(e) => changeViewDate(e.target.value)}
              className="bg-black border border-mono-800 text-mono-300 text-xs px-2 py-1 rounded focus:outline-none focus:border-mono-500 font-mono cursor-pointer transition hover:border-mono-750"
            />
            {!isViewingToday && (
              <button
                onClick={() => changeViewDate(todayStr)}
                className="text-[9px] font-mono px-1.5 py-1 rounded border border-mono-800 hover:border-white hover:text-white transition uppercase font-bold text-mono-450 bg-mono-900/40"
                title="Jump to Today"
              >
                Today
              </button>
            )}
          </div>
          <span className="text-white font-bold">{liveClock}</span>
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
