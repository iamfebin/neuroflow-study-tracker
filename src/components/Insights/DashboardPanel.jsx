import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import StreakTracker from './StreakTracker';
import CalendarHeatmap from './CalendarHeatmap';
import SubjectBarChart from './SubjectBarChart';

export default function DashboardPanel() {
  const { userSettings, updateDailyGoal } = useNeuroFlow();
  const goalMins = userSettings.daily_goal_mins || 240;

  const handleAdjustGoal = (amount) => {
    const nextGoal = Math.max(30, Math.min(1440, goalMins + amount));
    updateDailyGoal(nextGoal);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full animate-fadeIn select-none">
      {/* Page Title Header */}
      <div className="border-b border-mono-800 pb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-0">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Performance Analytics</h2>
        <span className="text-[10px] font-mono text-mono-500">
          Aggregating cloud and offline sessions
        </span>
      </div>

      {/* Top Grid: Streaks and Daily Goal Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Streak Tracker (Span 2 Columns) */}
        <div className="lg:col-span-2 w-full">
          <StreakTracker />
        </div>

        {/* Goal Settings Panel (Span 1 Column) */}
        <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/40 backdrop-blur w-full space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Target Settings</h3>
          
          <div className="space-y-3">
            <span className="text-[9px] font-mono text-mono-500 uppercase tracking-wider block">
              Daily Study Goal
            </span>
            
            <div className="flex items-center justify-between border border-mono-800/80 rounded p-3 bg-black/40">
              <button
                onClick={() => handleAdjustGoal(-15)}
                className="w-8 h-8 rounded border border-mono-700 hover:border-white text-mono-400 hover:text-white transition flex items-center justify-center font-bold font-mono text-sm active:bg-mono-850 select-none"
                title="Decrease by 15m"
              >
                -
              </button>
              
              <div className="text-center">
                <span className="text-2xl font-bold font-mono text-white block tracking-tighter">
                  {(goalMins / 60).toFixed(1)}
                </span>
                <span className="text-[9px] font-mono text-mono-400 uppercase tracking-widest">
                  Hours / Day
                </span>
              </div>
              
              <button
                onClick={() => handleAdjustGoal(15)}
                className="w-8 h-8 rounded border border-mono-700 hover:border-white text-mono-400 hover:text-white transition flex items-center justify-center font-bold font-mono text-sm active:bg-mono-850 select-none"
                title="Increase by 15m"
              >
                +
              </button>
            </div>
          </div>
          
          <p className="text-[9px] text-mono-500 font-mono leading-relaxed">
            Adjusting this threshold immediately updates your study streaks. Consecutive days meeting this target will trigger positive streak logs.
          </p>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <CalendarHeatmap />

      {/* Bar Chart Distribution */}
      <SubjectBarChart />
    </div>
  );
}
