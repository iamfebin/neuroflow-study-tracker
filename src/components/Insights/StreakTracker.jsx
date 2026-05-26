import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import { calculateStreaks } from './analyticsUtils';

export default function StreakTracker() {
  const { historyLogs, currentDateStr, userSettings } = useNeuroFlow();
  const goalMins = userSettings.daily_goal_mins || 240;

  const {
    currentStreak,
    longestStreak,
    completionRate,
    totalSuccessfulDays
  } = calculateStreaks(historyLogs, currentDateStr, goalMins);

  // SVG parameters for circular completion rate indicator
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/40 backdrop-blur flex flex-col md:flex-row items-center gap-6 justify-between w-full">
      <div className="space-y-4 flex-grow">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Streak Metrics</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-mono-800/80 rounded p-3 bg-black/40">
            <span className="text-[9px] font-mono text-mono-500 uppercase tracking-wider block mb-1">
              Active Streak
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-white tracking-tighter">
                {currentStreak}
              </span>
              <span className="text-xs text-mono-400 font-mono">days</span>
            </div>
            <span className="text-[9px] text-mono-500 font-mono block mt-1">
              Goal: {Math.round(goalMins / 60)}h/day
            </span>
          </div>

          <div className="border border-mono-800/80 rounded p-3 bg-black/40">
            <span className="text-[9px] font-mono text-mono-500 uppercase tracking-wider block mb-1">
              Longest Streak
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-mono-400 tracking-tighter">
                {longestStreak}
              </span>
              <span className="text-xs text-mono-500 font-mono">days</span>
            </div>
            <span className="text-[9px] text-mono-500 font-mono block mt-1">
              All-time record
            </span>
          </div>
        </div>
      </div>

      {/* Circular Completion Rate indicator */}
      <div className="flex flex-col items-center justify-center border border-mono-800/80 rounded-lg p-4 bg-black/40 w-full md:w-36 flex-shrink-0">
        <span className="text-[9px] font-mono text-mono-500 uppercase tracking-wider mb-2 block">
          Completion Rate
        </span>
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Circle */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="transparent"
              stroke="#141414"
              strokeWidth="6"
            />
            {/* Foreground Progress Circle */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="transparent"
              stroke="#ffffff"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-base font-bold font-mono text-white">{completionRate}%</span>
          </div>
        </div>
        <span className="text-[9px] text-mono-400 font-mono mt-2 block text-center">
          {totalSuccessfulDays} successful days
        </span>
      </div>
    </div>
  );
}
