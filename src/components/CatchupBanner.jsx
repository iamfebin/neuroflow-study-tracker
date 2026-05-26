import React from 'react';
import { useNeuroFlow } from '../context/NeuroFlowContext';

export default function CatchupBanner() {
  const { userSettings, getAdjustedDate } = useNeuroFlow();

  const germanMins = userSettings.saved_focus_mins.german || 0;
  const techMins = (userSettings.saved_focus_mins.sql || 0) + (userSettings.saved_focus_mins.python || 0);

  const isGermanComplete = germanMins >= 300;
  const isTechComplete = techMins >= 240;

  const showBanner = (isGermanComplete && techMins === 0) || (isTechComplete && germanMins === 0);

  if (!showBanner) return null;

  const now = getAdjustedDate();
  const targetTime = new Date(now);
  targetTime.setHours(21, 0, 0, 0);

  let diffMs = targetTime.getTime() - now.getTime();
  if (diffMs < 0) diffMs = 0;

  const diffMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  let text = "";
  if (isGermanComplete && techMins === 0) {
    text = `⚠️ German target complete! You have ${hrs}h ${mins}m remaining until 9:00 PM to complete your Tech target.`;
  } else if (isTechComplete && germanMins === 0) {
    text = `⚠️ Tech target complete! You have ${hrs}h ${mins}m remaining until 9:00 PM to complete your German target.`;
  }

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 mt-4">
      <div className="bg-mono-900 border border-mono-800 text-xs px-4 py-3 rounded flex items-center justify-between text-mono-300">
        <span className="font-mono">{text}</span>
      </div>
    </div>
  );
}
