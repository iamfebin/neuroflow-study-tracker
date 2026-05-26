import React from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function FocusHub() {
  const {
    timerState,
    activeBlock,
    toggleTimer,
    resetTimer,
    skipTimerInterval,
    splitActiveBlock,
    getBlockRemainingMinutes
  } = useNeuroFlow();

  const isStudy = activeBlock?.type === 'study';
  const hasActive = !!activeBlock;
  const isRunning = timerState.isRunning;

  // Format active block title replacing placeholder subject name
  let displayTitle = "Select a Session";
  let displaySubtitle = "Load a block from the timeline to begin.";
  let badgeText = "IDLE";

  if (hasActive) {
    badgeText = activeBlock.format;
    displaySubtitle = `${activeBlock.start} - ${activeBlock.end}`;
    displayTitle = activeBlock.name;
    if (isStudy) {
      const subjectDisplay = (activeBlock.key || '').toUpperCase();
      displayTitle = activeBlock.name.replace(/SQL|German|Python/i, subjectDisplay);
    }
  }

  // Calculate timer display digits
  const mins = Math.floor(timerState.currentSeconds / 60);
  const secs = timerState.currentSeconds % 60;
  const formattedTime = String(mins).padStart(2, '0') + ":" + String(secs).padStart(2, '0');

  // SVG math
  let strokeOffset = 0;
  if (timerState.mode === 'focus' || timerState.mode === 'break') {
    const fraction = timerState.targetSeconds > 0 ? (timerState.currentSeconds / timerState.targetSeconds) : 1;
    strokeOffset = 553 * (1 - fraction);
  }

  // Split Session Button state
  const remainingMins = getBlockRemainingMinutes(activeBlock);
  const isSplitDisabled = !(isRunning && isStudy && remainingMins >= 5);

  // Styling for Play/Pause
  const primaryBtnClass = isRunning
    ? "flex-grow max-w-[160px] px-4 py-3 bg-mono-800 text-white font-bold rounded hover:bg-mono-700 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs tracking-wide border border-mono-700"
    : "flex-grow max-w-[160px] px-4 py-3 bg-white text-black font-bold rounded hover:bg-mono-200 disabled:opacity-20 disabled:cursor-not-allowed transition text-xs tracking-wide";

  const primaryBtnText = isRunning ? "PAUSE" : (timerState.elapsedSeconds > 0 ? "RESUME" : "START");

  return (
    <div className="border border-mono-800 rounded-lg p-6 bg-mono-900/50 flex flex-col items-center justify-center relative shadow-2xl">
      <div className="text-center w-full max-w-sm">
        {/* Active Badge */}
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-mono-800 text-mono-400 border border-mono-700 mb-4 inline-block">
          {badgeText}
        </span>

        {/* Title & Time Interval */}
        <h3 className="text-white font-medium text-lg mb-1 tracking-tight">
          {displayTitle}
        </h3>
        <p className="text-xs text-mono-500 mb-8">
          {displaySubtitle}
        </p>

        {/* Monochromatic Timer Circle */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center mb-8">
          <svg className="w-full h-full transform -rotate-90 drop-shadow-md">
            <circle cx="96" cy="96" r="88" strokeWidth="2" stroke="#262626" fill="transparent" />
            <circle
              cx="96"
              cy="96"
              r="88"
              strokeWidth="4"
              stroke="#ffffff"
              fill="transparent"
              strokeDasharray="553"
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-light tracking-tighter font-mono text-white">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleTimer}
            disabled={!hasActive}
            className={primaryBtnClass}
          >
            {primaryBtnText}
          </button>
          <button
            onClick={resetTimer}
            disabled={!hasActive}
            className="px-4 py-3 bg-mono-800 border border-mono-700 text-white font-medium rounded text-xs hover:bg-mono-700 disabled:opacity-20 disabled:cursor-not-allowed transition"
          >
            RESET
          </button>
          <button
            onClick={skipTimerInterval}
            disabled={!hasActive}
            className="px-4 py-3 bg-mono-800 border border-mono-700 text-mono-400 font-medium rounded text-xs hover:bg-mono-700 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition"
          >
            SKIP
          </button>
        </div>

        {/* Split Study block */}
        <button
          onClick={splitActiveBlock}
          disabled={isSplitDisabled}
          className="w-full mt-3 px-4 py-2.5 bg-black border border-mono-700 text-mono-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition text-xs tracking-wider uppercase font-bold"
        >
          Split Session
        </button>
      </div>
    </div>
  );
}
