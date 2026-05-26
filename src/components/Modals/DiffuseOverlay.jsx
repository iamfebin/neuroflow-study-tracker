import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function DiffuseOverlay() {
  const { timerState, skipTimerInterval } = useNeuroFlow();

  const isBreak = timerState.mode === 'break';

  if (!isBreak) return null;

  const mins = Math.floor(timerState.currentSeconds / 60);
  const secs = timerState.currentSeconds % 60;
  const formattedTime = String(mins).padStart(2, '0') + ":" + String(secs).padStart(2, '0');

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-2">
          Diffuse Break
        </h2>
        <p className="text-xs text-mono-400 mb-8">
          Step away. Let the brain reorganize.
        </p>
        <div className="text-6xl font-mono font-light text-white tracking-tighter mb-8">
          {formattedTime}
        </div>
        <button
          onClick={skipTimerInterval}
          className="px-6 py-2 border border-mono-700 text-mono-300 font-medium rounded text-xs hover:bg-white hover:text-black transition uppercase tracking-widest"
        >
          Skip Break
        </button>
      </div>
    </div>
  );
}
