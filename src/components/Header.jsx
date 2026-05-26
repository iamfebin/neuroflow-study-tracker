import React from 'react';
import { useNeuroFlow } from '../context/NeuroFlowContext';

export default function Header({ onToggleSyncModal }) {
  const { liveClock, isFirebaseConnected, getAdjustedDate } = useNeuroFlow();

  const formattedDate = getAdjustedDate().toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });

  return (
    <header className="border-b border-mono-800 bg-black/90 backdrop-blur sticky top-0 z-40 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black font-bold tracking-tighter">
            NF
          </div>
          <h1 className="text-sm font-semibold tracking-wide text-white">NEUROFLOW</h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-mono-500">
          <span>{formattedDate}</span>
          <span className="text-white">{liveClock}</span>
          <button
            onClick={onToggleSyncModal}
            className={`hover:text-white transition uppercase tracking-widest border px-2 py-1 rounded ${
              isFirebaseConnected ? 'text-white border-white' : 'border-mono-700'
            }`}
          >
            {isFirebaseConnected ? 'Synced' : 'Offline'}
          </button>
        </div>
      </div>
    </header>
  );
}
