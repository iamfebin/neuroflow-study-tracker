import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function ProtocolItem({ block, onEditBlock }) {
  const {
    getAdjustedDate,
    dailyLogs,
    swapBlockSubject,
    manualSplitBlock,
    toggleBlockCompletion,
    launchBlockToTimer,
    moveBlockUp,
    moveBlockDown,
    updateBlockQualitativeData
  } = useNeuroFlow();

  const now = getAdjustedDate();
  const currentMinStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

  const isCurrent = currentMinStr >= block.start && currentMinStr < block.end;
  const isLogged = dailyLogs.completed_blocks.includes(block.id);
  const isStudy = block.type === 'study';

  let dynamicName = block.name;
  if (isStudy) {
    const subjectDisplay = (block.key || '').toUpperCase();
    dynamicName = block.name.replace(/SQL|German|Python/i, subjectDisplay);
  }

  // Determine row CSS
  let containerClasses = "bg-transparent border-mono-800";
  if (isCurrent) {
    containerClasses = "bg-mono-900 border-white ring-1 ring-white/20";
  } else if (isLogged) {
    containerClasses = "bg-mono-900/30 border-mono-800 opacity-80";
  }

  return (
    <div className={`p-3 rounded border flex flex-col gap-2 transition-all duration-300 ${containerClasses}`}>
      {/* Top Flex Row (Core Block Information) */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 flex-grow">
          {/* Reorder Arrow Buttons */}
          <div className="flex flex-col items-center justify-center -space-y-1 select-none pr-1.5 flex-shrink-0">
            <button 
              onClick={() => moveBlockUp(block.id)}
              className="text-[10px] text-mono-600 hover:text-white transition-colors duration-200 p-0.5"
              title="Move Up"
            >
              ▲
            </button>
            <button 
              onClick={() => moveBlockDown(block.id)}
              className="text-[10px] text-mono-600 hover:text-white transition-colors duration-200 p-0.5"
              title="Move Down"
            >
              ▼
            </button>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isCurrent ? 'text-white' : 'text-mono-300'}`}>
                {dynamicName}
              </span>
              {isStudy && (
                <select
                  value={block.key || 'german'}
                  onChange={(e) => swapBlockSubject(block.id, e.target.value)}
                  className="text-[9px] bg-transparent text-mono-400 font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <option value="german" className="bg-mono-900 text-mono-300">GERMAN</option>
                  <option value="sql" className="bg-mono-900 text-mono-300">SQL</option>
                  <option value="python" className="bg-mono-900 text-mono-300">PYTHON</option>
                </select>
              )}
            </div>
            <span className="text-[10px] font-mono text-mono-500">
              {block.start} - {block.end}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onEditBlock(block)}
            className="text-[10px] uppercase font-bold tracking-widest text-mono-500 hover:text-white transition"
          >
            Edit
          </button>
          {isStudy && (
            <button
              onClick={() => manualSplitBlock(block.id)}
              className="text-[10px] uppercase font-bold tracking-widest text-mono-500 hover:text-white transition"
            >
              Split
            </button>
          )}
          <button
            onClick={() => toggleBlockCompletion(block.id)}
            className={`text-[10px] uppercase font-bold tracking-widest hover:text-white transition ${
              isLogged ? 'text-white' : 'text-mono-500'
            }`}
          >
            {isLogged ? 'Done' : 'Mark'}
          </button>
          <button
            onClick={() => launchBlockToTimer(block.id)}
            className="w-6 h-6 flex items-center justify-center rounded bg-mono-800 hover:bg-white hover:text-black transition text-xs text-white"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Collapsible Qualitative Assessment (For every study block on the timeline) */}
      {isStudy && (
        <div className="mt-2 pt-2 border-t border-mono-800 space-y-2 text-left animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-mono-400 uppercase font-bold">Goal Achieved?</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const currentData = dailyLogs.session_details?.[block.id] || { goal_achieved: true, progress_notes: "", notes: "" };
                  updateBlockQualitativeData(block.id, true, currentData.progress_notes || currentData.notes || "");
                }}
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase transition ${
                  (dailyLogs.session_details?.[block.id]?.goal_achieved === true || dailyLogs.session_details?.[block.id]?.goal_achieved === undefined)
                    ? 'bg-white text-black font-bold'
                    : 'bg-mono-800 text-mono-500 hover:text-white'
                }`}
              >
                Goal Met
              </button>
              <button
                onClick={() => {
                  const currentData = dailyLogs.session_details?.[block.id] || { goal_achieved: false, progress_notes: "", notes: "" };
                  updateBlockQualitativeData(block.id, false, currentData.progress_notes || currentData.notes || "");
                }}
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase transition ${
                  (dailyLogs.session_details?.[block.id]?.goal_achieved === false)
                    ? 'bg-white text-black font-bold'
                    : 'bg-mono-800 text-mono-500 hover:text-white'
                }`}
              >
                Failed
              </button>
              <button
                onClick={() => {
                  const currentData = dailyLogs.session_details?.[block.id] || { goal_achieved: "unattempted", progress_notes: "", notes: "" };
                  updateBlockQualitativeData(block.id, "unattempted", currentData.progress_notes || currentData.notes || "");
                }}
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase transition ${
                  (dailyLogs.session_details?.[block.id]?.goal_achieved === "unattempted")
                    ? 'bg-white text-black font-bold'
                    : 'bg-mono-800 text-mono-500 hover:text-white'
                }`}
              >
                Unattempted
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-mono-500 uppercase font-bold mb-1 font-mono">
              {dailyLogs.session_details?.[block.id]?.goal_achieved === "unattempted"
                ? "Reason for not attempting"
                : "Progress Notes / Friction Points"
              }
            </label>
            <textarea
              value={dailyLogs.session_details?.[block.id]?.progress_notes ?? dailyLogs.session_details?.[block.id]?.notes ?? ""}
              onChange={(e) => {
                const currentGoal = dailyLogs.session_details?.[block.id]?.goal_achieved ?? true;
                updateBlockQualitativeData(block.id, currentGoal, e.target.value);
              }}
              rows="2"
              className="w-full bg-black border border-mono-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-mono-600"
              placeholder={
                (dailyLogs.session_details?.[block.id]?.goal_achieved === "unattempted")
                  ? "Why was this study block not attempted?"
                  : (dailyLogs.session_details?.[block.id]?.goal_achieved === false)
                    ? "What distracted you or made this focus block difficult?"
                    : "What did you build or learn during this focus block?"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
