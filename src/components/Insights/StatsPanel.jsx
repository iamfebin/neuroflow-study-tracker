import React, { useState } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import MinimalPieChart from './MinimalPieChart';

export default function StatsPanel() {
  const { userSettings } = useNeuroFlow();
  const [isTechExpanded, setIsTechExpanded] = useState(false);

  const gMin = userSettings.saved_focus_mins.german || 0;
  const sMin = userSettings.saved_focus_mins.sql || 0;
  const pMin = userSettings.saved_focus_mins.python || 0;
  const totalMins = gMin + sMin + pMin;

  const formatHours = (mins) => {
    const hrs = mins / 60;
    return Math.round(hrs * 10) / 10;
  };

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/50">
      <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Focus Insights</h3>
      <div className="flex items-start gap-6">
        {/* Pie Chart SVG */}
        <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center mt-1">
          <MinimalPieChart german={gMin} sql={sMin} python={pMin} />
        </div>

        {/* Focus Minutes Text details */}
        <div className="flex-grow space-y-4">
          <div className="flex items-center justify-between text-xs font-mono border-b border-mono-800/40 pb-2">
            <span className="text-mono-400">Total Logged</span>
            <span className="text-white font-bold">{formatHours(totalMins)}h ({totalMins}m)</span>
          </div>

          <div className="space-y-3">
            {/* German Progress Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-mono-500">
                <span>GERMAN</span>
                <span className="text-mono-300 font-mono">{formatHours(gMin)}/5 hours</span>
              </div>
              <div className="w-full bg-mono-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-white h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${Math.min(100, (gMin / 300) * 100)}%` }}
                />
              </div>
            </div>

            {/* Python & SQL Progress Section */}
            <div className="space-y-1">
              <button 
                onClick={() => setIsTechExpanded(!isTechExpanded)}
                className="w-full flex items-center justify-between text-[10px] uppercase font-bold text-mono-500 hover:text-white transition-colors duration-200 cursor-pointer select-none group text-left outline-none"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`text-[8px] transform transition-transform duration-200 inline-block ${isTechExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  PYTHON / SQL
                </span>
                <span className="text-mono-300 font-mono group-hover:text-white transition-colors duration-200">
                  {formatHours(pMin + sMin)}/4 hours
                </span>
              </button>
              
              <div className="w-full bg-mono-800 h-1.5 rounded-full overflow-hidden cursor-pointer" onClick={() => setIsTechExpanded(!isTechExpanded)}>
                <div 
                  className="bg-gradient-to-r from-mono-600 to-mono-400 h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${Math.min(100, ((pMin + sMin) / 240) * 100)}%` }}
                />
              </div>

              {/* Collapsible Details */}
              {isTechExpanded && (
                <div className="pl-3.5 space-y-2.5 mt-2.5 border-l border-mono-800 animate-fadeIn">
                  {/* Python Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] uppercase font-semibold text-mono-500">
                      <span>Python</span>
                      <span className="text-mono-400 font-mono">{formatHours(pMin)} hours ({pMin}m)</span>
                    </div>
                    <div className="w-full bg-mono-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-mono-600 h-full transition-all duration-500 rounded-full" 
                        style={{ width: `${Math.min(100, (pMin / 120) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* SQL Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] uppercase font-semibold text-mono-500">
                      <span>SQL</span>
                      <span className="text-mono-400 font-mono">{formatHours(sMin)} hours ({sMin}m)</span>
                    </div>
                    <div className="w-full bg-mono-900 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-mono-450 h-full transition-all duration-500 rounded-full bg-mono-400" 
                        style={{ width: `${Math.min(100, (sMin / 120) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
