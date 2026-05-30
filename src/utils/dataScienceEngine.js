import { DEFAULT_PROTOCOL_SCHEDULE } from '../context/NeuroFlowContext';

// Helper to determine if two date strings represent consecutive days
function areConsecutiveDates(d1Str, d2Str) {
  const d1 = new Date(d1Str + 'T00:00:00');
  const d2 = new Date(d2Str + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

// Convert a time string HH:MM to minutes relative to midnight
function timeToMidnightMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  const mins = h * 60 + m;
  return h >= 12 ? mins - 1440 : mins;
}

// Convert actual and target times to wake delay minutes (actual - target)
function calculateWakeDelay(targetStr, actualStr) {
  if (!targetStr || !actualStr) return null;
  const tParts = targetStr.split(':');
  const aParts = actualStr.split(':');
  if (tParts.length !== 2 || aParts.length !== 2) return null;
  const th = parseInt(tParts[0], 10);
  const tm = parseInt(tParts[1], 10);
  const ah = parseInt(aParts[0], 10);
  const am = parseInt(aParts[1], 10);
  if (isNaN(th) || isNaN(tm) || isNaN(ah) || isNaN(am)) return null;
  
  const targetTotal = th * 60 + tm;
  const actualTotal = ah * 60 + am;
  return actualTotal - targetTotal;
}

/**
 * Clean and aggregate firestore logs into daily summary objects
 */
export function getDailyAggregatedData(logs) {
  if (!logs) return [];
  const logArray = Array.isArray(logs)
    ? logs
    : Object.keys(logs).map(date => ({ ...logs[date], date }));
    
  return logArray.map(log => {
    const date = log.date;
    const bedtime_minutes = timeToMidnightMinutes(log.sleep?.actual_time);
    const wake_delay_minutes = calculateWakeDelay(log.wake_up?.target_time, log.wake_up?.actual_time);
    
    let german_mins = 0;
    let sql_mins = 0;
    let python_mins = 0;
    let german_failed = false;
    
    const schedule = log.custom_schedule || DEFAULT_PROTOCOL_SCHEDULE;
    if (schedule && Array.isArray(schedule)) {
      schedule.forEach(block => {
        if (block.type !== 'study') return;
        const customSubject = log.custom_block_subjects?.[block.id];
        const subjectKey = customSubject || block.key;
        
        const timerMins = log.timer_logged_mins?.[block.id] || 0;
        const manualMins = log.manual_credited_mins?.[block.id] || 0;
        const totalBlockMins = timerMins + manualMins;
        
        if (subjectKey === 'german') {
          german_mins += totalBlockMins;
          const detail = log.session_details?.[block.id];
          if (detail && (detail.goal_achieved === false || detail.goal_achieved === "unattempted")) {
            german_failed = true;
          }
        } else if (subjectKey === 'sql') {
          sql_mins += totalBlockMins;
        } else if (subjectKey === 'python') {
          python_mins += totalBlockMins;
        }
      });
    }
    
    return {
      date,
      bedtime_minutes,
      wake_delay_minutes,
      german_mins,
      sql_mins,
      python_mins,
      german_failed
    };
  });
}

/**
 * Bedtime-to-Wakeup correlation (Pearson r) between bedtime Day N and wake delay Day N+1
 */
export function bedtimeToWakeUpCorrelation(aggregatedDays) {
  if (!aggregatedDays || aggregatedDays.length === 0) {
    return { r: null, label: "Insufficient Data (Warm-up Phase)" };
  }
  
  // Chronological sort
  const sortedDays = [...aggregatedDays].sort((a, b) => a.date.localeCompare(b.date));
  
  const pairs = [];
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const dayN = sortedDays[i];
    const dayNPlus1 = sortedDays[i + 1];
    
    if (!areConsecutiveDates(dayN.date, dayNPlus1.date)) continue;
    
    if (dayN.bedtime_minutes !== null && dayNPlus1.wake_delay_minutes !== null) {
      pairs.push({ x: dayN.bedtime_minutes, y: dayNPlus1.wake_delay_minutes });
    }
  }
  
  const n = pairs.length;
  if (n < 3) {
    return { r: null, label: "Insufficient Data (Warm-up Phase)" };
  }
  
  const meanX = pairs.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = pairs.reduce((sum, p) => sum + p.y, 0) / n;
  
  const varX = pairs.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0) / n;
  const varY = pairs.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0) / n;
  
  if (varX < 1e-9 || varY < 1e-9) {
    return { r: "0.00", label: "Constant Schedule (Zero Deviation)" };
  }
  
  const stdDevX = Math.sqrt(varX);
  const stdDevY = Math.sqrt(varY);
  
  const covariance = pairs.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0) / n;
  const r = covariance / (stdDevX * stdDevY);
  const clampedR = Math.max(-1, Math.min(1, r));
  
  const absR = Math.abs(clampedR);
  let label = "";
  if (absR >= 0.7) {
    label = "Strong Correlation";
  } else if (absR >= 0.4) {
    label = "Moderate Correlation";
  } else if (absR >= 0.1) {
    label = "Weak Correlation";
  } else {
    label = "Negligible/No Correlation";
  }
  
  return { r: clampedR.toFixed(2), label };
}

/**
 * Computes mean, standard deviation, and labeling scale of subject focus totals
 */
export function calculateStudyVolatility(aggregatedDays, subjectKey) {
  if (!aggregatedDays || aggregatedDays.length < 3) {
    return { mean: "0.0", stdDev: "0.0", label: "Warm-up Phase" };
  }
  
  const key = `${subjectKey}_mins`;
  const values = aggregatedDays.map(d => d[key] || 0);
  const n = values.length;
  
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  let label = "";
  if (stdDev < 15) {
    label = "Machine-Like Consistency";
  } else if (stdDev < 45) {
    label = "Healthy Adaptability";
  } else {
    label = "Highly Unstable / Reactive Routine";
  }
  
  return { mean: mean.toFixed(1), stdDev: stdDev.toFixed(1), label };
}

/**
 * Computes conditional fail percentage of German goals during tech study overruns
 */
export function calculateTransitionFailProbability(aggregatedDays) {
  if (!aggregatedDays || aggregatedDays.length === 0) {
    return "0%";
  }
  
  const qualifyingDays = aggregatedDays.filter(day => (day.sql_mins + day.python_mins) >= 240);
  
  if (qualifyingDays.length === 0) {
    return "0%";
  }
  
  const failedGermanDays = qualifyingDays.filter(day => day.german_failed === true);
  const percentage = (failedGermanDays.length / qualifyingDays.length) * 100;
  return `${Math.round(percentage)}%`;
}
