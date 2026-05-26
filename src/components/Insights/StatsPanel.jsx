import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import MinimalPieChart from './MinimalPieChart';

export default function StatsPanel() {
  const { userSettings } = useNeuroFlow();

  const gMin = userSettings.saved_focus_mins.german || 0;
  const sMin = userSettings.saved_focus_mins.sql || 0;
  const pMin = userSettings.saved_focus_mins.python || 0;
  const totalMins = gMin + sMin + pMin;

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/50">
      <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Focus Insights</h3>
      <div className="flex items-center gap-6">
        {/* Pie Chart SVG */}
        <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
          <MinimalPieChart german={gMin} sql={sMin} python={pMin} />
        </div>

        {/* Focus Minutes Text details */}
        <div className="flex-grow space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-mono-400">Total Logged</span>
            <span className="text-white font-bold">{totalMins}m</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-mono-500">
              <span>GERMAN</span>
              <span className="text-mono-300 font-mono">{gMin}m</span>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-mono-500">
              <span>SQL</span>
              <span className="text-mono-300 font-mono">{sMin}m</span>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-mono-500">
              <span>PYTHON</span>
              <span className="text-mono-300 font-mono">{pMin}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
