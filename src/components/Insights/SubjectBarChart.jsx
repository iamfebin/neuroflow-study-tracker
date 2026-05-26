import React, { useState, useRef } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import { parseDate, formatDate, getDailySubjectMins } from './analyticsUtils';

export default function SubjectBarChart() {
  const { historyLogs, currentDateStr } = useNeuroFlow();
  const [viewMode, setViewMode] = useState('week'); // 'week' (7 days) or 'month' (30 days)
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const containerRef = useRef(null);

  const activeDate = parseDate(currentDateStr);
  const daysCount = viewMode === 'week' ? 7 : 30;

  // Generate the last N days chronologically
  const chartDays = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(activeDate);
    d.setDate(d.getDate() - i);
    chartDays.push(d);
  }

  // Parse hours spent per subject for each day
  const parsedData = chartDays.map(day => {
    const dStr = formatDate(day);
    const dayLogs = historyLogs[dStr];
    const subjects = getDailySubjectMins(dayLogs);
    
    return {
      date: day,
      dateStr: dStr,
      german: subjects.german / 60, // in hours
      sql: subjects.sql / 60,       // in hours
      python: subjects.python / 60, // in hours
      total: (subjects.german + subjects.sql + subjects.python) / 60 // in hours
    };
  });

  // Calculate subject totals for summary card
  const totals = parsedData.reduce((acc, curr) => {
    acc.german += curr.german;
    acc.sql += curr.sql;
    acc.python += curr.python;
    acc.total += curr.total;
    return acc;
  }, { german: 0, sql: 0, python: 0, total: 0 });

  // Grid dimensions
  const height = 180;
  const paddingLeft = 32;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;

  // Max value calculation for scaling y-axis
  const maxHours = Math.max(4, ...parsedData.map(d => d.total));
  const chartMaxHours = Math.ceil(maxHours / 2) * 2; // Round to nearest even number
  const yScale = (height - paddingBottom - paddingTop) / chartMaxHours;

  const handleMouseEnter = (dayData, index, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setHoveredColumn({
      ...dayData,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8
    });
  };

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/40 backdrop-blur w-full space-y-5">
      {/* Header and Toggle Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Hours Distribution</h3>
          <p className="text-[10px] text-mono-500 font-mono">
            Comparing German, SQL & Python study sessions
          </p>
        </div>

        <div className="flex items-center border border-mono-800 rounded p-0.5 bg-black/40 text-[9px] font-mono w-fit">
          <button
            onClick={() => setViewMode('week')}
            className={`px-2 py-0.5 rounded transition uppercase font-bold ${
              viewMode === 'week' ? 'bg-white text-black' : 'text-mono-500 hover:text-mono-300'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-2 py-0.5 rounded transition uppercase font-bold ${
              viewMode === 'month' ? 'bg-white text-black' : 'text-mono-500 hover:text-mono-300'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 text-center select-none border-b border-mono-800/60 pb-4">
        <div className="border border-mono-800/40 rounded p-1.5 bg-black/20">
          <span className="text-[8px] font-mono text-mono-500 uppercase tracking-wide block">German</span>
          <span className="text-xs font-bold font-mono text-white">{totals.german.toFixed(1)}h</span>
        </div>
        <div className="border border-mono-800/40 rounded p-1.5 bg-black/20">
          <span className="text-[8px] font-mono text-mono-500 uppercase tracking-wide block">SQL</span>
          <span className="text-xs font-bold font-mono text-mono-300">{totals.sql.toFixed(1)}h</span>
        </div>
        <div className="border border-mono-800/40 rounded p-1.5 bg-black/20">
          <span className="text-[8px] font-mono text-mono-500 uppercase tracking-wide block">Python</span>
          <span className="text-xs font-bold font-mono text-mono-400">{totals.python.toFixed(1)}h</span>
        </div>
        <div className="border border-mono-800/40 rounded p-1.5 bg-mono-900/60">
          <span className="text-[8px] font-mono text-white uppercase tracking-wide block">Total</span>
          <span className="text-xs font-bold font-mono text-white">{totals.total.toFixed(1)}h</span>
        </div>
      </div>

      {/* SVG Column Chart */}
      <div ref={containerRef} className="relative w-full">
        {/* Tooltip Overlay */}
        {hoveredColumn && (
          <div
            style={{
              position: 'absolute',
              left: `${hoveredColumn.x}px`,
              top: `${hoveredColumn.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
            className="z-50 bg-black border border-mono-800 rounded px-2 py-1.5 shadow-2xl pointer-events-none text-[10px] font-mono text-mono-300 w-32 space-y-1 animate-fadeIn duration-100"
          >
            <div className="text-[8px] text-mono-500 font-bold border-b border-mono-800 pb-0.5 mb-1">
              {hoveredColumn.dateStr}
            </div>
            <div className="flex justify-between font-bold text-white mb-0.5">
              <span>Total:</span>
              <span>{hoveredColumn.total.toFixed(1)}h</span>
            </div>
            {hoveredColumn.german > 0 && (
              <div className="flex justify-between text-mono-300">
                <span>German:</span>
                <span>{hoveredColumn.german.toFixed(1)}h</span>
              </div>
            )}
            {hoveredColumn.sql > 0 && (
              <div className="flex justify-between text-mono-400">
                <span>SQL:</span>
                <span>{hoveredColumn.sql.toFixed(1)}h</span>
              </div>
            )}
            {hoveredColumn.python > 0 && (
              <div className="flex justify-between text-mono-500">
                <span>Python:</span>
                <span>{hoveredColumn.python.toFixed(1)}h</span>
              </div>
            )}
          </div>
        )}

        <svg viewBox={`0 0 500 ${height}`} className="w-full h-auto select-none overflow-visible">
          {/* Y-Axis Gridlines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const labelValue = chartMaxHours * ratio;
            const yPos = height - paddingBottom - labelValue * yScale;
            return (
              <g key={index} className="opacity-80">
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={500 - paddingRight}
                  y2={yPos}
                  stroke="#141414"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  fill="#737373"
                  className="text-[9px] font-mono font-bold leading-none"
                >
                  {labelValue.toFixed(0)}h
                </text>
              </g>
            );
          })}

          {/* Render Stacked Columns for each day */}
          {parsedData.map((d, index) => {
            const chartWidth = 500 - paddingLeft - paddingRight;
            const colWidth = chartWidth / daysCount;
            const barWidth = viewMode === 'week' ? colWidth * 0.45 : colWidth * 0.65;
            
            const xPos = paddingLeft + index * colWidth + (colWidth - barWidth) / 2;
            const bottomY = height - paddingBottom;

            const germanH = d.german * yScale;
            const sqlH = d.sql * yScale;
            const pythonH = d.python * yScale;

            // Stack calculations (bottom to top: Python -> SQL -> German)
            const pythonY = bottomY - pythonH;
            const sqlY = pythonY - sqlH;
            const germanY = sqlY - germanH;

            // X-axis day abbreviation coordinates
            const labelX = xPos + barWidth / 2;
            const labelY = height - 10;
            
            // Format x-axis labels
            let labelText = '';
            if (viewMode === 'week') {
              labelText = d.date.toLocaleDateString(undefined, { weekday: 'short' });
            } else if (index % 5 === 0 || index === daysCount - 1) {
              labelText = d.date.toLocaleDateString(undefined, { day: '2-digit' });
            }

            return (
              <g key={index}>
                {/* Python (Dark Charcoal) */}
                {d.python > 0 && (
                  <rect
                    x={xPos}
                    y={pythonY}
                    width={barWidth}
                    height={pythonH}
                    fill="#404040"
                    className="transition-all duration-300"
                  />
                )}
                {/* SQL (Medium Gray) */}
                {d.sql > 0 && (
                  <rect
                    x={xPos}
                    y={sqlY}
                    width={barWidth}
                    height={sqlH}
                    fill="#a3a3a3"
                    className="transition-all duration-300"
                  />
                )}
                {/* German (Crisp White) */}
                {d.german > 0 && (
                  <rect
                    x={xPos}
                    y={germanY}
                    width={barWidth}
                    height={germanH}
                    fill="#ffffff"
                    className="transition-all duration-300"
                  />
                )}

                {/* Invisible Hover overlay for easy hovering */}
                <rect
                  x={xPos - colWidth * 0.15}
                  y={paddingTop}
                  width={colWidth}
                  height={height - paddingTop - paddingBottom}
                  fill="transparent"
                  className="cursor-crosshair pointer-events-auto"
                  onMouseEnter={(e) => handleMouseEnter(d, index, e)}
                  onMouseLeave={() => setHoveredColumn(null)}
                />

                {/* X-axis Label */}
                {labelText && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    fill="#525252"
                    className="text-[9px] font-mono leading-none font-bold"
                  >
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bottom Solid X-Axis Border */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={500 - paddingRight}
            y2={height - paddingBottom}
            stroke="#262626"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Legend Indicators */}
      <div className="flex items-center justify-center gap-4 text-[9px] font-mono uppercase text-mono-400 pt-2 border-t border-mono-800/30">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-white" />
          <span>German</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-[#a3a3a3]" />
          <span>SQL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-[#404040]" />
          <span>Python</span>
        </div>
      </div>
    </div>
  );
}
