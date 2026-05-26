import { DEFAULT_PROTOCOL_SCHEDULE } from '../../context/NeuroFlowContext';

// Parse date: "YYYY-MM-DD" to local Date object
export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Format date: local Date object to "YYYY-MM-DD"
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculate total and individual subject minutes logged for a day
export function getDailySubjectMins(logs) {
  const subjects = { german: 0, sql: 0, python: 0 };
  if (!logs) return subjects;

  const manual = logs.manual_credited_mins || {};
  const timer = logs.timer_logged_mins || {};
  const customSubjects = logs.custom_block_subjects || {};
  const schedule = logs.custom_schedule || DEFAULT_PROTOCOL_SCHEDULE;

  schedule.forEach(block => {
    if (block.type === 'study') {
      const subject = customSubjects[block.id] || block.key;
      const mins = (manual[block.id] || 0) + (timer[block.id] || 0);
      if (subject && subjects[subject] !== undefined) {
        subjects[subject] += mins;
      }
    }
  });

  return subjects;
}

// Calculate streaks, completion rates, and historical details
export function calculateStreaks(historyLogs, activeDateStr, goalMins = 240) {
  const logs = { ...historyLogs };
  
  // Get all dates with actual logged time
  const datesWithLogs = Object.keys(logs).filter(dStr => {
    const dayMins = Object.values(logs[dStr]?.manual_credited_mins || {}).reduce((a, b) => a + b, 0) +
                    Object.values(logs[dStr]?.timer_logged_mins || {}).reduce((a, b) => a + b, 0);
    return dayMins > 0;
  }).sort();

  if (datesWithLogs.length === 0) {
    return { currentStreak: 0, longestStreak: 0, completionRate: 0, totalStudyDays: 0, totalSuccessfulDays: 0 };
  }

  const firstDate = parseDate(datesWithLogs[0]);
  const activeDate = parseDate(activeDateStr);
  
  let longestStreak = 0;
  let runningStreak = 0;
  let totalStudyDays = 0;
  let totalSuccessfulDays = 0;
  
  // Scan chronologically from the first recorded day to today
  let tempDate = new Date(firstDate);
  while (tempDate <= activeDate) {
    const dStr = formatDate(tempDate);
    const dayLogs = logs[dStr];
    
    const dayMins = dayLogs ? (
      Object.values(dayLogs.manual_credited_mins || {}).reduce((a, b) => a + b, 0) +
      Object.values(dayLogs.timer_logged_mins || {}).reduce((a, b) => a + b, 0)
    ) : 0;

    const isGoalMet = dayMins >= goalMins;
    
    if (dayMins > 0) {
      totalStudyDays++;
    }

    if (isGoalMet) {
      runningStreak++;
      totalSuccessfulDays++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      // Don't break streak yet if it's the active simulated today
      if (dStr !== activeDateStr) {
        runningStreak = 0;
      }
    }
    
    tempDate.setDate(tempDate.getDate() + 1);
  }

  return {
    currentStreak: runningStreak,
    longestStreak,
    completionRate: totalStudyDays > 0 ? Math.round((totalSuccessfulDays / totalStudyDays) * 100) : 0,
    totalStudyDays,
    totalSuccessfulDays
  };
}
