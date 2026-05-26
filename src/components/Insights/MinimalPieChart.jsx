import React from 'react';

export default function MinimalPieChart({ german = 0, sql = 0, python = 0 }) {
  const total = german + sql + python;

  if (total === 0) {
    return (
      <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
        <circle cx="40" cy="40" r="32" fill="transparent" stroke="#262626" strokeWidth="8" />
      </svg>
    );
  }

  const slices = [
    { val: german, color: '#ffffff' }, // White
    { val: sql, color: '#a3a3a3' },    // Gray 400
    { val: python, color: '#404040' }   // Gray 600
  ];

  let accumulatedPercent = 0;

  return (
    <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
      {slices.map((slice, index) => {
        if (slice.val === 0) return null;
        const pct = slice.val / total;
        const strokeDash = pct * 201; // 2 * PI * 32 ~= 201
        const offset = 201 - strokeDash + (accumulatedPercent * 201);
        accumulatedPercent -= pct;

        return (
          <circle
            key={index}
            cx="40"
            cy="40"
            r="32"
            fill="transparent"
            stroke={slice.color}
            strokeWidth="8"
            strokeDasharray="201"
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        );
      })}
    </svg>
  );
}
