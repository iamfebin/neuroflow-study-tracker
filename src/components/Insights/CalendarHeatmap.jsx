import React, { useState, useRef } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import { parseDate, formatDate, getDailySubjectMins } from './analyticsUtils';

export default function CalendarHeatmap() {
  const { historyLogs, currentDateStr, userSettings } = useNeuroFlow();
  const goalMins = userSettings.daily_goal_mins || 240;

  const [hoveredDay, setHoveredDay] = useState(null);
  const containerRef = useRef(null);

  // Generate rolling 24 weeks grid
  const activeDate = parseDate(currentDateStr);
  const startDate = new Date(activeDate);
  startDate.setDate(startDate.getDate() - 23 * 7); // Go back 23 weeks
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start on Sunday of that week

  const dayGrid = [];
  const tempDate = new Date(startDate);
  const endDate = new Date(activeDate);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday of the current week

  while (tempDate <= endDate) {
    dayGrid.push(new Date(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Chunk into weeks (7 days each)
  const weeks = [];
  for (let i = 0; i < dayGrid.length; i += 7) {
    weeks.push(dayGrid.slice(i, i + 7));
  }

  // Determine intensity color of a day based on total study minutes
  const getIntensityClass = (mins) => {
    if (mins === 0) return 'bg-mono-900 border border-mono-800/60 hover:border-mono-600';
    if (mins < 60) return 'bg-mono-800 border border-transparent hover:border-mono-600';
    if (mins < 120) return 'bg-mono-700 border border-transparent hover:border-mono-500';
    if (mins < 240) return 'bg-mono-400 border border-transparent hover:border-mono-300';
    return 'bg-white border border-transparent shadow-[0_0_6px_rgba(255,255,255,0.4)] hover:shadow-[0_0_10px_rgba(255,255,255,0.7)]';
  };

  const handleMouseEnter = (date, event) => {
    const dStr = formatDate(date);
    const dayLogs = historyLogs[dStr];
    const subjects = getDailySubjectMins(dayLogs);
    const totalMins = Object.values(subjects).reduce((a, b) => a + b, 0);

    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setHoveredDay({
      dateStr: dStr,
      totalMins,
      subjects,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/40 backdrop-blur w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Study Calendar</h3>
        
        {/* Heatmap Legend */}
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-mono-500 uppercase">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-mono-900 border border-mono-800" />
          <div className="w-2.5 h-2.5 rounded-sm bg-mono-800" />
          <div className="w-2.5 h-2.5 rounded-sm bg-mono-700" />
          <div className="w-2.5 h-2.5 rounded-sm bg-mono-400" />
          <div className="w-2.5 h-2.5 rounded-sm bg-white" />
          <span>More</span>
        </div>
      </div>

      <div ref={containerRef} className="relative overflow-x-auto pb-2 scrollbar-thin">
        {/* Tooltip Overlay */}
        {hoveredDay && (
          <div
            style={{
              position: 'absolute',
              left: `${hoveredDay.x}px`,
              top: `${hoveredDay.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
            className="z-50 bg-black border border-mono-800 rounded px-2.5 py-1.5 shadow-2xl pointer-events-none text-[10px] font-mono text-mono-300 w-36 space-y-1 animate-fadeIn duration-100"
          >
            <div className="text-[9px] text-mono-500 font-bold border-b border-mono-800 pb-1 mb-1">
              {hoveredDay.dateStr === currentDateStr ? 'TODAY' : hoveredDay.dateStr}
            </div>
            <div className="flex justify-between">
              <span className="text-white font-bold">Total:</span>
              <span className="text-white font-bold font-mono">
                {Math.floor(hoveredDay.totalMins / 60)}h {hoveredDay.totalMins % 60}m
              </span>
            </div>
            {hoveredDay.totalMins > 0 && (
              <div className="space-y-0.5 pt-1 text-mono-400">
                {hoveredDay.subjects.german > 0 && (
                  <div className="flex justify-between">
                    <span>German:</span>
                    <span>{hoveredDay.subjects.german}m</span>
                  </div>
                )}
                {hoveredDay.subjects.sql > 0 && (
                  <div className="flex justify-between">
                    <span>SQL:</span>
                    <span>{hoveredDay.subjects.sql}m</span>
                  </div>
                )}
                {hoveredDay.subjects.python > 0 && (
                  <div className="flex justify-between">
                    <span>Python:</span>
                    <span>{hoveredDay.subjects.python}m</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-[580px]">
          {/* Month Labels row */}
          <div className="flex text-[9px] font-mono text-mono-500 h-4 pl-8 select-none">
            {weeks.map((week, idx) => {
              const firstDay = week[0];
              // Render month label if start of a month, or first week
              if (firstDay.getDate() <= 7 || idx === 0) {
                const month = firstDay.toLocaleDateString(undefined, { month: 'short' });
                return (
                  <div key={idx} className="w-[17px] flex-shrink-0 text-left">
                    {month}
                  </div>
                );
              }
              return <div key={idx} className="w-[17px] flex-shrink-0" />;
            })}
          </div>

          {/* Weekday Row Header + Contribution Matrix */}
          <div className="flex gap-1.5">
            {/* Weekday indicator column */}
            <div className="flex flex-col justify-between text-[9px] font-mono text-mono-600 h-[105px] w-6 select-none leading-none pr-1">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>

            {/* Grid of Weeks */}
            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((day, dIdx) => {
                    const dStr = formatDate(day);
                    const dayLogs = historyLogs[dStr];
                    const subjects = getDailySubjectMins(dayLogs);
                    const totalMins = Object.values(subjects).reduce((a, b) => a + b, 0);
                    
                    const isFuture = day > activeDate;

                    return (
                      <button
                        key={dIdx}
                        disabled={isFuture}
                        onMouseEnter={(e) => handleMouseEnter(day, e)}
                        onMouseLeave={handleMouseLeave}
                        className={`w-3.5 h-3.5 rounded-sm transition-all duration-150 relative ${
                          isFuture 
                            ? 'bg-mono-900/20 border border-mono-900/10 cursor-not-allowed opacity-20' 
                            : getIntensityClass(totalMins)
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-mono-500 font-mono text-center">
        Hover over daily grid nodes to inspect session summaries. Highlighted white nodes indicate goal accomplishment.
      </p>
    </div>
  );
}
