import React, { useState } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import ProtocolItem from './ProtocolItem';
import BlockModal from '../Modals/BlockModal';

export default function ProtocolList() {
  const {
    protocolSchedule,
    isTimeSimulated,
    toggleTimeMode,
    applySimulatedTime,
    dailyLogs,
    updateWakeUpMetrics,
    updateSleepMetrics,
    toggleDayCompletion
  } = useNeuroFlow();

  const [inputSimTime, setInputSimTime] = useState("08:00");
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockToEdit, setBlockToEdit] = useState(null);

  const handleApplySimTime = (e) => {
    e.preventDefault();
    applySimulatedTime(inputSimTime);
  };

  const handleOpenAddModal = () => {
    setBlockToEdit(null);
    setIsBlockModalOpen(true);
  };

  const handleOpenEditModal = (block) => {
    setBlockToEdit(block);
    setIsBlockModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Title & Toggle Sim Button */}
      <div className="flex items-center justify-between border-b border-mono-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-mono-400">Daily Protocol</h2>
          <button
            onClick={handleOpenAddModal}
            className="text-[9px] font-mono px-2 py-0.5 rounded border border-mono-750 bg-black text-mono-400 hover:text-white hover:border-white transition uppercase font-bold"
          >
            + Add Block
          </button>
          <button
            onClick={toggleDayCompletion}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border transition uppercase font-bold ${
              dailyLogs?.day_completed
                ? 'bg-white text-black border-white font-bold'
                : 'border-mono-750 bg-black text-mono-400 hover:text-white hover:border-white'
            }`}
          >
            {dailyLogs?.day_completed ? '✓ Completed' : 'Mark Day Complete'}
          </button>
        </div>
        <button
          onClick={toggleTimeMode}
          className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
            isTimeSimulated
              ? 'bg-white text-black font-bold border-white'
              : 'bg-mono-800 text-mono-300 border-mono-700 hover:bg-mono-700'
          }`}
        >
          {isTimeSimulated ? 'SIMULATED' : 'SYS.CLOCK'}
        </button>
      </div>

      {/* Sim Clock Setting Panel */}
      {isTimeSimulated && (
        <div className="flex flex-col gap-2 mb-4 p-3 border border-mono-800 rounded bg-mono-900">
          <label className="text-[10px] uppercase text-mono-500 font-bold">Simulate Time</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={inputSimTime}
              onChange={(e) => setInputSimTime(e.target.value)}
              className="bg-black border border-mono-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-500 w-full"
            />
            <button
              onClick={handleApplySimTime}
              className="px-3 py-1 bg-white text-black font-bold rounded text-xs hover:bg-mono-200 transition"
            >
              SET
            </button>
          </div>
        </div>
      )}

      {/* Timeline Scrollable Stack */}
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        {/* MORNING WAKE-UP TRACKER */}
        <div className="p-4 border border-mono-800 rounded bg-mono-900/40 space-y-3 mb-2 animate-fadeIn text-left">
          <div className="flex items-center justify-between border-b border-mono-800 pb-1.5">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Morning Wake-Up Tracker</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
              dailyLogs.wake_up?.actual_time 
                ? (dailyLogs.wake_up?.on_time ? 'bg-white text-black font-bold' : 'bg-mono-800 text-red-400 border border-mono-750')
                : 'text-mono-500 font-normal'
            }`}>
              {dailyLogs.wake_up?.actual_time ? (dailyLogs.wake_up?.on_time ? 'ON TIME' : 'LATE') : 'PENDING'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-mono-500">Target Wake</label>
              <input
                type="time"
                value={dailyLogs.wake_up?.target_time || "07:00"}
                onChange={(e) => {
                  const current = dailyLogs.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" };
                  const nextWake = { ...current, target_time: e.target.value };
                  if (nextWake.actual_time) {
                    nextWake.on_time = nextWake.actual_time <= nextWake.target_time;
                  }
                  updateWakeUpMetrics(nextWake.target_time, nextWake.actual_time, nextWake.on_time, nextWake.reason);
                }}
                className="bg-black border border-mono-800 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-mono-500">Actual Wake</label>
              <input
                type="time"
                value={dailyLogs.wake_up?.actual_time || ""}
                onChange={(e) => {
                  const current = dailyLogs.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" };
                  const nextWake = { ...current, actual_time: e.target.value };
                  if (nextWake.target_time) {
                    nextWake.on_time = nextWake.actual_time <= nextWake.target_time;
                  }
                  updateWakeUpMetrics(nextWake.target_time, nextWake.actual_time, nextWake.on_time, nextWake.reason);
                }}
                className="bg-black border border-mono-800 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-600"
              />
            </div>
          </div>

          {/* Conditional sliding reflection textarea if wake up is late */}
          {dailyLogs.wake_up?.actual_time && !dailyLogs.wake_up?.on_time && (
            <div className="flex flex-col gap-1 mt-2 transition-all duration-300 animate-slideDown">
              <label className="text-[9px] uppercase font-bold text-mono-500">Why did you sleep past target?</label>
              <textarea
                value={dailyLogs.wake_up?.reason || ""}
                onChange={(e) => {
                  const current = dailyLogs.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" };
                  updateWakeUpMetrics(current.target_time, current.actual_time, current.on_time, e.target.value);
                }}
                rows="2"
                placeholder="Reason (e.g. late screen time, snoozed alarm)..."
                className="w-full bg-black border border-mono-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-mono-600"
              />
            </div>
          )}
        </div>

        {protocolSchedule.map((block) => (
          <ProtocolItem key={block.id} block={block} onEditBlock={handleOpenEditModal} />
        ))}

        {/* SUNSET SLEEP CHECK */}
        <div className="p-4 border border-mono-800 rounded bg-mono-900/40 space-y-3 mt-2 animate-fadeIn text-left">
          <div className="flex items-center justify-between border-b border-mono-800 pb-1.5">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Sunset Sleep Check</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
              dailyLogs.sleep?.actual_time 
                ? (dailyLogs.sleep?.timing_type === 'early' || dailyLogs.sleep?.timing_type === 'on_time' ? 'bg-white text-black font-bold' : 'bg-mono-800 text-mono-450 border border-mono-750')
                : 'text-mono-500 font-normal'
            }`}>
              {dailyLogs.sleep?.actual_time ? dailyLogs.sleep?.timing_type.toUpperCase() : 'PENDING'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-mono-500">Actual Bedtime</label>
              <input
                type="time"
                value={dailyLogs.sleep?.actual_time || ""}
                onChange={(e) => {
                  const current = dailyLogs.sleep || { actual_time: "", timing_type: "on_time", reason: "" };
                  updateSleepMetrics(e.target.value, current.timing_type, current.reason);
                }}
                className="bg-black border border-mono-800 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-mono-500">Evaluation</label>
              <select
                value={dailyLogs.sleep?.timing_type || "on_time"}
                onChange={(e) => {
                  const current = dailyLogs.sleep || { actual_time: "", timing_type: "on_time", reason: "" };
                  updateSleepMetrics(current.actual_time, e.target.value, current.reason);
                }}
                className="bg-black border border-mono-800 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-600"
              >
                <option value="early" className="bg-mono-900 text-mono-300">Early</option>
                <option value="on_time" className="bg-mono-900 text-mono-300">On-Time</option>
                <option value="late" className="bg-mono-900 text-mono-300">Late</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-2">
            <label className="text-[9px] uppercase font-bold text-mono-500">Reflection & Bedtime Notes</label>
            <textarea
              value={dailyLogs.sleep?.reason || ""}
              onChange={(e) => {
                const current = dailyLogs.sleep || { actual_time: "", timing_type: "on_time", reason: "" };
                updateSleepMetrics(current.actual_time, current.timing_type, e.target.value);
              }}
              rows="2"
              placeholder="Night reflection (e.g. screen time habits, winding down)..."
              className="w-full bg-black border border-mono-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-mono-600"
            />
          </div>
        </div>
      </div>

      {/* Global Block Modal (Add & Edit) */}
      <BlockModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        blockToEdit={blockToEdit}
      />
    </div>
  );
}
