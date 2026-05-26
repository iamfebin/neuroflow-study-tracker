import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function ProtocolItem({ block }) {
  const {
    getAdjustedDate,
    dailyLogs,
    swapBlockSubject,
    manualSplitBlock,
    toggleBlockCompletion,
    launchBlockToTimer
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
    containerClasses = "bg-mono-900/30 border-mono-800 opacity-60";
  }

  return (
    <div className={`p-3 rounded border flex items-center justify-between gap-3 transition-all duration-300 ${containerClasses}`}>
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

      <div className="flex items-center gap-3">
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
  );
}
