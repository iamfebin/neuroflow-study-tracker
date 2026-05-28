import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { initFirebase, signOutUser, syncUserDataToCloud, APP_ID, getFirebaseInstances, signInUser, registerUser } from '../services/firebase';

const NeuroFlowContext = createContext(null);

export const DEFAULT_PROTOCOL_SCHEDULE = [
  { id: 'wake_prep', name: 'Wake & Prep', start: '07:00', end: '08:00', type: 'rest', format: 'Recovery' },
  { id: 'sql_block_1', name: 'SQL Focus 1', start: '08:00', end: '10:30', type: 'study', key: 'sql', format: 'Pomodoro' },
  { id: 'diffuse_break_1', name: 'Diffuse Break', start: '10:30', end: '11:00', type: 'rest', format: 'Diffuse Mode' },
  { id: 'german_block_1', name: 'German Active', start: '11:00', end: '13:00', type: 'study', key: 'german', format: 'Pomodoro' },
  { id: 'lunch', name: 'Lunch', start: '13:00', end: '14:00', type: 'rest', format: 'Recovery' },
  { id: 'sql_block_2', name: 'SQL Applied', start: '14:00', end: '16:30', type: 'study', key: 'sql', format: 'Flowtime' },
  { id: 'physical_reset', name: 'Physical Reset', start: '16:30', end: '18:00', type: 'rest', format: 'Recovery' },
  { id: 'german_block_2', name: 'German Immersion', start: '18:00', end: '20:00', type: 'study', key: 'german', format: 'Flowtime' },
  { id: 'dinner', name: 'Dinner', start: '20:00', end: '21:00', type: 'rest', format: 'Recovery' },
  { id: 'leisure', name: 'Leisure', start: '21:00', end: '23:00', type: 'rest', format: 'Recovery' }
];

function getFormattedDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function NeuroFlowProvider({ children }) {
  // --- TOAST STATE ---
  const [toasts, setToasts] = useState([]);
  
  const showToast = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3300);
  }, []);

  // --- TIME SIMULATION STATE ---
  const [isTimeSimulated, setIsTimeSimulated] = useState(false);
  const [simTimeOffset, setSimTimeOffset] = useState(0);
  const [currentDateStr, setCurrentDateStr] = useState(() => getFormattedDateStr(new Date()));
  const [liveClock, setLiveClock] = useState("00:00:00");
  
  // Calculate simulated date based on current simulated time state
  const getAdjustedDate = useCallback(() => {
    return isTimeSimulated ? new Date(Date.now() + simTimeOffset) : new Date();
  }, [isTimeSimulated, simTimeOffset]);

  // --- APP USER SETTINGS & LOGS ---
  const [userSettings, setUserSettings] = useState({
    saved_focus_mins: { german: 0, sql: 0, python: 0 },
    daily_goal_mins: 240
  });

  const [historyLogs, setHistoryLogs] = useState({});

  const loadAllLocalLogs = useCallback(() => {
    const localLogs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_ID + '_logs_')) {
        const dateStr = key.replace(APP_ID + '_logs_', '');
        try {
          const val = localStorage.getItem(key);
          if (val) {
            localLogs[dateStr] = JSON.parse(val);
          }
        } catch (e) {
          console.error("Error parsing cached logs for key:", key, e);
        }
      }
    }
    setHistoryLogs(localLogs);
  }, []);

  const fetchAllCloudLogs = useCallback(async (uid) => {
    try {
      const { db } = getFirebaseInstances();
      if (!db) return;
      const dailyLogsCol = collection(db, APP_ID, uid, "daily_logs");
      const snapshot = await getDocs(dailyLogsCol);
      const cloudLogs = {};
      snapshot.forEach(docSnap => {
        cloudLogs[docSnap.id] = docSnap.data();
        localStorage.setItem(APP_ID + '_logs_' + docSnap.id, JSON.stringify(docSnap.data()));
      });
      setHistoryLogs(prev => ({
        ...prev,
        ...cloudLogs
      }));
    } catch (e) {
      console.error("Error fetching historical logs from Firestore:", e);
    }
  }, []);
  
  const [dailyLogs, setDailyLogs] = useState({
    completed_blocks: [],
    manual_credited_mins: {},
    timer_logged_mins: {},
    custom_block_subjects: {},
    custom_schedule: null
  });

  const [protocolSchedule, setProtocolSchedule] = useState(() => {
    return JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
  });

  // --- FOCUS TIMER STATE ---
  const [timerState, setTimerState] = useState({
    isRunning: false,
    mode: "idle", // 'idle', 'focus', 'break', 'flow'
    currentSeconds: 0,
    targetSeconds: 0,
    elapsedSeconds: 0
  });

  const [activeBlock, setActiveBlock] = useState(null);
  const timerIntervalIdRef = useRef(null);

  // --- FIREBASE CLOUD SYNC STATE ---
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Unsubscribe listeners
  const unsubscribeSettingsRef = useRef(null);
  const unsubscribeLogsRef = useRef(null);

  // Helper: Get duration of a block in minutes
  const getBlockDurationMinutes = useCallback((block) => {
    if (!block) return 0;
    const [sh, sm] = block.start.split(':').map(Number);
    const [eh, em] = block.end.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < startMins) endMins += 24 * 60; // handle overnight blocks
    return endMins - startMins;
  }, []);

  // Helper: Get remaining minutes in block based on simulated/real time
  const getBlockRemainingMinutes = useCallback((block) => {
    if (!block) return 0;
    const now = getAdjustedDate();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const [eh, em] = block.end.split(':').map(Number);
    const endMin = eh * 60 + em;
    return endMin - currentMin;
  }, [getAdjustedDate]);

  // --- PERSISTENCE: LOCAL FALLBACKS ---
  const loadLocalState = useCallback((targetDateStr) => {
    const storedState = localStorage.getItem(APP_ID + '_state');
    if (storedState) {
      const parsed = JSON.parse(storedState);
      if (parsed.user_settings) {
        setUserSettings(parsed.user_settings);
      }
    }
    
    const cachedLogs = localStorage.getItem(APP_ID + '_logs_' + targetDateStr);
    if (cachedLogs) {
      const parsedLogs = JSON.parse(cachedLogs);
      const sanitLogs = {
        completed_blocks: parsedLogs.completed_blocks || [],
        manual_credited_mins: parsedLogs.manual_credited_mins || {},
        timer_logged_mins: parsedLogs.timer_logged_mins || {},
        custom_block_subjects: parsedLogs.custom_block_subjects || {},
        custom_schedule: parsedLogs.custom_schedule || null
      };
      setDailyLogs(sanitLogs);
      
      let schedule = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
      if (sanitLogs.custom_schedule && sanitLogs.custom_schedule.length > 0) {
        schedule = sanitLogs.custom_schedule;
      }
      
      // Apply custom subjects
      Object.keys(sanitLogs.custom_block_subjects).forEach(blockId => {
        const bl = schedule.find(b => b.id === blockId);
        if (bl) bl.key = sanitLogs.custom_block_subjects[blockId];
      });
      setProtocolSchedule(schedule);
    } else {
      // Clear current logs if no cache for target date
      setDailyLogs({
        completed_blocks: [],
        manual_credited_mins: {},
        timer_logged_mins: {},
        custom_block_subjects: {},
        custom_schedule: null
      });
      setProtocolSchedule(JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE)));
    }
  }, []);

  const saveStateToLocal = useCallback((newSettings, newLogs, dateStr) => {
    localStorage.setItem(APP_ID + '_state', JSON.stringify({ user_settings: newSettings }));
    localStorage.setItem(APP_ID + '_logs_' + dateStr, JSON.stringify(newLogs));
  }, []);

  const saveStateAndSync = useCallback((updatedSettings = userSettings, updatedLogs = dailyLogs, currentSched = protocolSchedule) => {
    const logsWithSchedule = {
      ...updatedLogs,
      custom_schedule: currentSched
    };
    setDailyLogs(logsWithSchedule);
    saveStateToLocal(updatedSettings, logsWithSchedule, currentDateStr);

    setHistoryLogs(prev => ({
      ...prev,
      [currentDateStr]: logsWithSchedule
    }));

    if (isFirebaseConnected && currentUser) {
      syncUserDataToCloud(currentUser.uid, currentDateStr, updatedSettings, logsWithSchedule);
    }
  }, [userSettings, dailyLogs, protocolSchedule, currentDateStr, isFirebaseConnected, currentUser, saveStateToLocal]);

  const updateDailyGoal = useCallback((mins) => {
    setUserSettings(prev => {
      const nextSettings = {
        ...prev,
        daily_goal_mins: mins
      };
      saveStateAndSync(nextSettings, dailyLogs);
      return nextSettings;
    });
    showToast(`Daily study goal updated to ${mins} minutes.`);
  }, [dailyLogs, saveStateAndSync, showToast]);

  // Handle Date String alignment
  useEffect(() => {
    const now = getAdjustedDate();
    const dStr = getFormattedDateStr(now);
    if (dStr !== currentDateStr) {
      setCurrentDateStr(dStr);
      loadLocalState(dStr);
    }
  }, [liveClock, isTimeSimulated, simTimeOffset, currentDateStr, getAdjustedDate, loadLocalState]);

  // Load local settings on initial mount
  useEffect(() => {
    const todayStr = getFormattedDateStr(getAdjustedDate());
    loadLocalState(todayStr);
    loadAllLocalLogs();
  }, []);

  // --- CORE FOCUS INSIGHT LOGS MATH ---
  const logCompletedSessionData = useCallback((seconds, isManualSkip = false) => {
    if (!activeBlock || seconds < 10) return;
    let minutesTracked = Math.round(seconds / 60);
    if (minutesTracked === 0 && seconds >= 10) minutesTracked = 1;
    if (minutesTracked === 0) return;

    const prevGerman = userSettings.saved_focus_mins.german || 0;
    const prevTech = (userSettings.saved_focus_mins.sql || 0) + (userSettings.saved_focus_mins.python || 0);

    const subjectKey = activeBlock.key;
    const updatedFocusMins = { ...userSettings.saved_focus_mins };

    if (subjectKey && updatedFocusMins[subjectKey] !== undefined) {
      updatedFocusMins[subjectKey] += minutesTracked;
    }

    const nextSettings = {
      ...userSettings,
      saved_focus_mins: updatedFocusMins
    };

    const currGerman = updatedFocusMins.german || 0;
    const currTech = (updatedFocusMins.sql || 0) + (updatedFocusMins.python || 0);

    if (prevGerman < 300 && currGerman >= 300) {
      showToast("Target reached for German! Switch to your other subject.", "info");
    }
    if (prevTech < 240 && currTech >= 240) {
      showToast("Target reached for Technical! Switch to your other subject.", "info");
    }

    const nextTimerMins = { ...dailyLogs.timer_logged_mins };
    nextTimerMins[activeBlock.id] = (nextTimerMins[activeBlock.id] || 0) + minutesTracked;

    let nextCompleted = [...dailyLogs.completed_blocks];
    if (!isManualSkip && !nextCompleted.includes(activeBlock.id)) {
      nextCompleted.push(activeBlock.id);
    }

    const nextLogs = {
      ...dailyLogs,
      timer_logged_mins: nextTimerMins,
      completed_blocks: nextCompleted
    };

    setUserSettings(nextSettings);
    setDailyLogs(nextLogs);
    saveStateAndSync(nextSettings, nextLogs);

    showToast(`Logged ${minutesTracked}m of focus.`);
  }, [activeBlock, userSettings, dailyLogs, showToast, saveStateAndSync]);

  // --- COUNTDOWN / COUNTER TIMER TICKER LOGIC ---
  const triggerIntervalAlert = useCallback((isManualSkip = false) => {
    if (timerIntervalIdRef.current) {
      clearInterval(timerIntervalIdRef.current);
      timerIntervalIdRef.current = null;
    }

    setTimerState(prev => {
      const mode = prev.mode;
      const elapsed = prev.elapsedSeconds;
      
      let nextMode = "idle";
      let nextSecs = 0;
      
      if (mode === 'focus') {
        logCompletedSessionData(elapsed, isManualSkip);
        if (!isManualSkip) {
          nextMode = "break";
          nextSecs = 10 * 60; // 10 minutes break
        }
      } else if (mode === 'break') {
        // Break ends, go idle
        nextMode = "idle";
      } else if (mode === 'flow') {
        logCompletedSessionData(elapsed, isManualSkip);
        nextMode = "idle";
      }

      return {
        isRunning: false,
        mode: nextMode,
        currentSeconds: nextSecs,
        targetSeconds: nextSecs,
        elapsedSeconds: 0
      };
    });
  }, [logCompletedSessionData]);

  // Toggle Play / Pause Timer
  const toggleTimer = useCallback(() => {
    setTimerState(prev => {
      const isRunning = !prev.isRunning;
      
      if (timerIntervalIdRef.current) {
        clearInterval(timerIntervalIdRef.current);
        timerIntervalIdRef.current = null;
      }

      if (isRunning) {
        timerIntervalIdRef.current = setInterval(() => {
          setTimerState(current => {
            let nextSecs = current.currentSeconds;
            let nextElapsed = current.elapsedSeconds + 1;

            if (current.mode === 'focus' || current.mode === 'break') {
              if (current.currentSeconds > 0) {
                nextSecs = current.currentSeconds - 1;
              } else {
                // Ticks down to 0, trigger alert in a microtask or clean interval
                setTimeout(() => triggerIntervalAlert(false), 0);
                return current;
              }
            } else if (current.mode === 'flow') {
              nextSecs = current.currentSeconds + 1;
            }

            return {
              ...current,
              currentSeconds: nextSecs,
              elapsedSeconds: nextElapsed
            };
          });
        }, 1000);
      }

      return {
        ...prev,
        isRunning
      };
    });
  }, [triggerIntervalAlert]);

  // Reset active loaded block in timer
  const resetTimer = useCallback(() => {
    if (timerIntervalIdRef.current) {
      clearInterval(timerIntervalIdRef.current);
      timerIntervalIdRef.current = null;
    }

    setTimerState({
      isRunning: false,
      mode: "idle",
      currentSeconds: 0,
      targetSeconds: 0,
      elapsedSeconds: 0
    });

    if (activeBlock) {
      // Re-load parameters
      if (activeBlock.format === 'Pomodoro') {
        setTimerState({
          isRunning: false,
          mode: "focus",
          currentSeconds: 50 * 60,
          targetSeconds: 50 * 60,
          elapsedSeconds: 0
        });
      } else {
        setTimerState({
          isRunning: false,
          mode: "flow",
          currentSeconds: 0,
          targetSeconds: 0,
          elapsedSeconds: 0
        });
      }
    }
  }, [activeBlock]);

  // Skip active interval (focus session or diffuse break)
  const skipTimerInterval = useCallback(() => {
    triggerIntervalAlert(true);
  }, [triggerIntervalAlert]);

  // Load a block into the timer
  const launchBlockToTimer = useCallback((blockId) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block) return;
    
    if (timerIntervalIdRef.current) {
      clearInterval(timerIntervalIdRef.current);
      timerIntervalIdRef.current = null;
    }

    setActiveBlock(block);

    const isStudy = block.type === 'study';
    let initMode = "idle";
    let secs = 0;

    if (isStudy) {
      if (block.format === 'Pomodoro') {
        initMode = "focus";
        secs = 50 * 60;
      } else {
        initMode = "flow";
        secs = 0;
      }
    }

    setTimerState({
      isRunning: false,
      mode: initMode,
      currentSeconds: secs,
      targetSeconds: secs,
      elapsedSeconds: 0
    });
  }, [protocolSchedule]);

  // --- TIMELINE BLOCK MUTATIONS ---

  // Swap study block subject key (german, sql, python)
  const swapBlockSubject = useCallback((blockId, newSubject) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block || block.type !== 'study') return;

    const prevSubject = block.key;
    if (prevSubject === newSubject) return;

    // Calculate credited minutes for this block
    const manualCredit = dailyLogs.manual_credited_mins[blockId] || 0;
    const timerCredit = dailyLogs.timer_logged_mins[blockId] || 0;
    const creditedMins = manualCredit + timerCredit;

    // Update settings if there were any credited minutes
    let nextSettings = userSettings;
    if (creditedMins > 0) {
      const nextMins = { ...userSettings.saved_focus_mins };
      if (prevSubject && nextMins[prevSubject] !== undefined) {
        nextMins[prevSubject] = Math.max(0, nextMins[prevSubject] - creditedMins);
      }
      if (newSubject && nextMins[newSubject] !== undefined) {
        nextMins[newSubject] = (nextMins[newSubject] || 0) + creditedMins;
      }
      nextSettings = {
        ...userSettings,
        saved_focus_mins: nextMins
      };
      setUserSettings(nextSettings);
    }

    // Update protocol schedule
    const nextSched = protocolSchedule.map(b => {
      if (b.id === blockId) {
        return { ...b, key: newSubject };
      }
      return b;
    });
    setProtocolSchedule(nextSched);

    // Update daily logs custom block subjects
    const nextSubjects = { ...dailyLogs.custom_block_subjects, [blockId]: newSubject };
    const nextLogs = {
      ...dailyLogs,
      custom_block_subjects: nextSubjects
    };
    setDailyLogs(nextLogs);

    // Sync all states
    saveStateAndSync(nextSettings, nextLogs, nextSched);

    // Keep active loaded block synchronized if swapped
    setActiveBlock(currentActive => {
      if (currentActive && currentActive.id === blockId) {
        return { ...currentActive, key: newSubject };
      }
      return currentActive;
    });

    showToast(`Swapped block to ${newSubject.toUpperCase()}`);
  }, [protocolSchedule, dailyLogs, userSettings, saveStateAndSync, showToast]);

  // Toggle Block Completion (Mark / Unmark)
  const toggleBlockCompletion = useCallback((blockId) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block) return;

    const duration = getBlockDurationMinutes(block);
    const subjectKey = block.key;

    const nextMins = { ...userSettings.saved_focus_mins };
    const nextCompleted = [...dailyLogs.completed_blocks];
    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const completedIndex = nextCompleted.indexOf(blockId);

    const prevGerman = userSettings.saved_focus_mins.german || 0;
    const prevTech = (userSettings.saved_focus_mins.sql || 0) + (userSettings.saved_focus_mins.python || 0);

    if (completedIndex > -1) {
      // UNMARK COMPLETION
      nextCompleted.splice(completedIndex, 1);

      // Subtract manual credits
      const manualCredit = nextManualMins[blockId] || 0;
      if (block.type === 'study' && subjectKey && nextMins[subjectKey] !== undefined) {
        nextMins[subjectKey] = Math.max(0, nextMins[subjectKey] - manualCredit);
      }
      delete nextManualMins[blockId];

      // Subtract timer credits
      const timerCredit = nextTimerMins[blockId] || 0;
      if (block.type === 'study' && subjectKey && nextMins[subjectKey] !== undefined) {
        nextMins[subjectKey] = Math.max(0, nextMins[subjectKey] - timerCredit);
      }
      delete nextTimerMins[blockId];

      showToast("Removed completed status.");
    } else {
      // MARK AS COMPLETED
      nextCompleted.push(blockId);

      const timerLogged = nextTimerMins[blockId] || 0;
      const creditToGive = Math.max(0, duration - timerLogged);

      if (block.type === 'study' && subjectKey && nextMins[subjectKey] !== undefined) {
        nextMins[subjectKey] += creditToGive;
        nextManualMins[blockId] = creditToGive;
      }
      showToast(`Marked as completed. Logged remaining ${creditToGive}m.`);
    }

    const nextSettings = { ...userSettings, saved_focus_mins: nextMins };
    
    const currGerman = nextMins.german || 0;
    const currTech = (nextMins.sql || 0) + (nextMins.python || 0);

    if (prevGerman < 300 && currGerman >= 300) {
      showToast("Target reached for German! Switch to your other subject.", "info");
    }
    if (prevTech < 240 && currTech >= 240) {
      showToast("Target reached for Technical! Switch to your other subject.", "info");
    }

    const nextLogs = {
      ...dailyLogs,
      completed_blocks: nextCompleted,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    setUserSettings(nextSettings);
    setDailyLogs(nextLogs);
    saveStateAndSync(nextSettings, nextLogs);
  }, [protocolSchedule, userSettings, dailyLogs, getBlockDurationMinutes, showToast, saveStateAndSync]);

  // ID generator for block splitting
  const generateSplitId = useCallback((originalId, schedule) => {
    let suffixCode = 'b';
    let candidateId = `${originalId}_${suffixCode}`;
    while (schedule.some(b => b.id === candidateId)) {
      suffixCode = String.fromCharCode(suffixCode.charCodeAt(0) + 1);
      candidateId = `${originalId}_${suffixCode}`;
    }
    return candidateId;
  }, []);

  // Split Active Block at current simulated/real time
  const splitActiveBlock = useCallback(() => {
    if (!activeBlock || activeBlock.type !== 'study') return;

    const now = getAdjustedDate();
    const currentMinStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    const remainingMins = getBlockRemainingMinutes(activeBlock);

    if (remainingMins < 5) {
      showToast("Cannot split block: less than 5 minutes remaining.", "error");
      return;
    }

    const originalEnd = activeBlock.end;
    const newId = generateSplitId(activeBlock.id, protocolSchedule);

    // 1. Calculate next schedule
    const activeIndex = protocolSchedule.findIndex(b => b.id === activeBlock.id);
    if (activeIndex === -1) return;

    const updatedActive = { ...protocolSchedule[activeIndex], end: currentMinStr };
    const newBlock = {
      id: newId,
      name: `${activeBlock.name} (Part 2)`,
      start: currentMinStr,
      end: originalEnd,
      type: 'study',
      key: activeBlock.key,
      format: 'Flowtime'
    };

    const nextSched = [...protocolSchedule];
    nextSched[activeIndex] = updatedActive;
    nextSched.splice(activeIndex + 1, 0, newBlock);

    // 2. Proportional split calculation for logs
    const D_original = getBlockDurationMinutes(activeBlock);
    const D_updated = getBlockDurationMinutes(updatedActive);
    const D_new = getBlockDurationMinutes(newBlock);

    const wasCompleted = dailyLogs.completed_blocks.includes(activeBlock.id);
    const nextCompleted = [...dailyLogs.completed_blocks];
    if (wasCompleted && !nextCompleted.includes(newId)) {
      nextCompleted.push(newId);
    }

    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const origManual = nextManualMins[activeBlock.id] || 0;
    const origTimer = nextTimerMins[activeBlock.id] || 0;

    if (origManual > 0 || origTimer > 0) {
      // Split manual minutes
      const newManualOrig = Math.round(origManual * (D_updated / D_original));
      const newManualNew = origManual - newManualOrig;
      if (newManualOrig > 0) {
        nextManualMins[activeBlock.id] = newManualOrig;
      } else {
        delete nextManualMins[activeBlock.id];
      }
      if (newManualNew > 0) {
        nextManualMins[newId] = newManualNew;
      }

      // Split timer minutes
      const newTimerOrig = Math.round(origTimer * (D_updated / D_original));
      const newTimerNew = origTimer - newTimerOrig;
      if (newTimerOrig > 0) {
        nextTimerMins[activeBlock.id] = newTimerOrig;
      } else {
        delete nextTimerMins[activeBlock.id];
      }
      if (newTimerNew > 0) {
        nextTimerMins[newId] = newTimerNew;
      }
    }

    const nextLogs = {
      ...dailyLogs,
      completed_blocks: nextCompleted,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    // 3. Stop running timer and update states
    if (timerIntervalIdRef.current) {
      clearInterval(timerIntervalIdRef.current);
      timerIntervalIdRef.current = null;
    }

    setTimerState({
      isRunning: false,
      mode: "flow",
      currentSeconds: 0,
      targetSeconds: 0,
      elapsedSeconds: 0
    });

    setActiveBlock(newBlock);
    setProtocolSchedule(nextSched);
    setDailyLogs(nextLogs);
    saveStateAndSync(userSettings, nextLogs, nextSched);

    showToast("Session split successfully!");
  }, [activeBlock, getAdjustedDate, getBlockRemainingMinutes, getBlockDurationMinutes, generateSplitId, protocolSchedule, userSettings, dailyLogs, showToast, saveStateAndSync]);

  // Manual block split at custom typed HH:MM
  const manualSplitBlock = useCallback((blockId) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block || block.type !== 'study') return;

    const now = getAdjustedDate();
    const currentMinStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

    let defaultTime = block.start;
    if (currentMinStr >= block.start && currentMinStr <= block.end) {
      defaultTime = currentMinStr;
    }

    const inputTime = prompt(`Enter split time (HH:MM) between ${block.start} and ${block.end}:`, defaultTime);
    if (!inputTime) return;

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(inputTime)) {
      alert("Invalid time format. Please use HH:MM.");
      return;
    }

    const [h, m] = inputTime.split(':');
    const paddedTime = String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0');

    if (paddedTime <= block.start || paddedTime >= block.end) {
      alert(`Split time must fall strictly between ${block.start} and ${block.end}.`);
      return;
    }

    const originalEnd = block.end;
    const newId = generateSplitId(block.id, protocolSchedule);

    // 1. Calculate next schedule
    const idx = protocolSchedule.findIndex(b => b.id === blockId);
    if (idx === -1) return;

    const updatedOriginal = { ...protocolSchedule[idx], end: paddedTime };
    const newBlock = {
      id: newId,
      name: `${block.name} (Part 2)`,
      start: paddedTime,
      end: originalEnd,
      type: 'study',
      key: block.key,
      format: 'Flowtime'
    };

    const nextSched = [...protocolSchedule];
    nextSched[idx] = updatedOriginal;
    nextSched.splice(idx + 1, 0, newBlock);

    // 2. Proportional split calculation for logs
    const D_original = getBlockDurationMinutes(block);
    const D_updated = getBlockDurationMinutes(updatedOriginal);
    const D_new = getBlockDurationMinutes(newBlock);

    const wasCompleted = dailyLogs.completed_blocks.includes(blockId);
    const nextCompleted = [...dailyLogs.completed_blocks];
    if (wasCompleted && !nextCompleted.includes(newId)) {
      nextCompleted.push(newId);
    }

    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const origManual = nextManualMins[blockId] || 0;
    const origTimer = nextTimerMins[blockId] || 0;

    if (origManual > 0 || origTimer > 0) {
      // Split manual minutes
      const newManualOrig = Math.round(origManual * (D_updated / D_original));
      const newManualNew = origManual - newManualOrig;
      if (newManualOrig > 0) {
        nextManualMins[blockId] = newManualOrig;
      } else {
        delete nextManualMins[blockId];
      }
      if (newManualNew > 0) {
        nextManualMins[newId] = newManualNew;
      }

      // Split timer minutes
      const newTimerOrig = Math.round(origTimer * (D_updated / D_original));
      const newTimerNew = origTimer - newTimerOrig;
      if (newTimerOrig > 0) {
        nextTimerMins[blockId] = newTimerOrig;
      } else {
        delete nextTimerMins[blockId];
      }
      if (newTimerNew > 0) {
        nextTimerMins[newId] = newTimerNew;
      }
    }

    const nextLogs = {
      ...dailyLogs,
      completed_blocks: nextCompleted,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    // 3. Reset loaded timer if active split target was running
    if (activeBlock && activeBlock.id === blockId) {
      if (timerIntervalIdRef.current) {
        clearInterval(timerIntervalIdRef.current);
        timerIntervalIdRef.current = null;
      }

      setTimerState({
        isRunning: false,
        mode: "idle",
        currentSeconds: 0,
        targetSeconds: 0,
        elapsedSeconds: 0
      });
      setActiveBlock(updatedOriginal);
    }

    setProtocolSchedule(nextSched);
    setDailyLogs(nextLogs);
    saveStateAndSync(userSettings, nextLogs, nextSched);

    showToast("Block split successfully!");
  }, [protocolSchedule, activeBlock, getAdjustedDate, getBlockDurationMinutes, generateSplitId, userSettings, dailyLogs, showToast, saveStateAndSync]);

  // --- AUTOMATIC ACTIVE BLOCK SNIFFER ---
  const checkActiveBlock = useCallback((now) => {
    const currentMinStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    let foundActive = null;

    for (let block of protocolSchedule) {
      if (currentMinStr >= block.start && currentMinStr < block.end) {
        foundActive = block;
        break;
      }
    }

    if (foundActive && (!activeBlock || activeBlock.id !== foundActive.id)) {
      // If timer is not running or idle, auto-load next block
      if (timerState.mode === 'idle' || !timerState.isRunning) {
        setActiveBlock(foundActive);
        
        const isStudy = foundActive.type === 'study';
        let initMode = "idle";
        let secs = 0;

        if (isStudy) {
          if (foundActive.format === 'Pomodoro') {
            initMode = "focus";
            secs = 50 * 60;
          } else {
            initMode = "flow";
            secs = 0;
          }
        }

        setTimerState({
          isRunning: false,
          mode: initMode,
          currentSeconds: secs,
          targetSeconds: secs,
          elapsedSeconds: 0
        });
      }
    }
  }, [protocolSchedule, activeBlock, timerState.mode, timerState.isRunning]);

  // --- TIME TICK LOOP ---
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = getAdjustedDate();
      setLiveClock(now.toTimeString().split(' ')[0]);
      checkActiveBlock(now);
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [getAdjustedDate, checkActiveBlock]);

  // --- TIME MODE TOGGLES ---
  const toggleTimeMode = useCallback(() => {
    setIsTimeSimulated(prev => {
      const next = !prev;
      if (!next) {
        setSimTimeOffset(0);
        showToast("System Clock active");
      } else {
        showToast("Simulation mode ready");
      }
      return next;
    });
  }, [showToast]);

  const applySimulatedTime = useCallback((timeValue) => {
    if (!timeValue) return;
    setIsTimeSimulated(true);
    const [hours, minutes] = timeValue.split(':');
    const targetDate = new Date();
    targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const offset = targetDate.getTime() - new Date().getTime();
    setSimTimeOffset(offset);
    showToast("Time simulation active");
  }, [showToast]);

  // --- CLOUD SYNC SAVERS & LOADER CONNECTORS ---
  const handleConnectFirebase = useCallback(async (rawJson, email, password, mode) => {
    try {
      const parsed = JSON.parse(rawJson);
      localStorage.setItem(APP_ID + '_firebase_config', rawJson);
      setFirebaseConfigStr(rawJson);
      
      const { auth: loadedAuth } = await initFirebase(parsed);
      
      // Setup connection listener
      loadedAuth.onAuthStateChanged((user) => {
        if (user) {
          setCurrentUser(user);
          setIsFirebaseConnected(true);
          showToast("Sync authenticated.");
          
          // Setup real-time document streams
          if (unsubscribeSettingsRef.current) unsubscribeSettingsRef.current();
          if (unsubscribeLogsRef.current) unsubscribeLogsRef.current();
          
          const uid = user.uid;
          const { db } = getFirebaseInstances();
          
          unsubscribeSettingsRef.current = onSnapshot(doc(db, APP_ID, uid, "settings", "user_settings"), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserSettings(data);
              saveStateToLocal(data, dailyLogs, currentDateStr);
            }
          });
          
          unsubscribeLogsRef.current = onSnapshot(doc(db, APP_ID, uid, "daily_logs", currentDateStr), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setDailyLogs(data);
              
              let sched = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
              if (data.custom_schedule && data.custom_schedule.length > 0) {
                sched = data.custom_schedule;
              }
              
              Object.keys(data.custom_block_subjects || {}).forEach(bId => {
                const b = sched.find(bl => bl.id === bId);
                if (b) b.key = data.custom_block_subjects[bId];
              });
              
              setProtocolSchedule(sched);
              saveStateToLocal(userSettings, data, currentDateStr);
            }
          });

          // Fetch all historical daily logs from cloud
          fetchAllCloudLogs(uid);

        } else {
          setCurrentUser(null);
          setIsFirebaseConnected(false);
        }
      });

      // Run action
      if (email && password) {
        if (mode === 'register') {
          await registerUser(email, password);
        } else {
          await signInUser(email, password);
        }
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [currentDateStr, dailyLogs, userSettings, saveStateToLocal, showToast]);

  const handleDisconnectFirebase = useCallback(async () => {
    try {
      if (unsubscribeSettingsRef.current) unsubscribeSettingsRef.current();
      if (unsubscribeLogsRef.current) unsubscribeLogsRef.current();
      
      await signOutUser();
      
      localStorage.removeItem(APP_ID + '_firebase_config');
      setFirebaseConfigStr("");
      setCurrentUser(null);
      setIsFirebaseConnected(false);
      showToast("Disconnected from cloud.");
    } catch (e) {
      showToast(e.message, "error");
    }
  }, [showToast]);

  // Load firebase credentials if cached
  useEffect(() => {
    const cachedConfig = localStorage.getItem(APP_ID + '_firebase_config');
    if (cachedConfig) {
      setFirebaseConfigStr(cachedConfig);
      // Auto reconnect
      try {
        const parsed = JSON.parse(cachedConfig);
        initFirebase(parsed).then(({ auth }) => {
          auth.onAuthStateChanged((user) => {
            if (user) {
              setCurrentUser(user);
              setIsFirebaseConnected(true);
              
              const uid = user.uid;
              const { db } = getFirebaseInstances();
              
              if (unsubscribeSettingsRef.current) unsubscribeSettingsRef.current();
              if (unsubscribeLogsRef.current) unsubscribeLogsRef.current();

              unsubscribeSettingsRef.current = onSnapshot(doc(db, APP_ID, uid, "settings", "user_settings"), (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setUserSettings(data);
                }
              });
              
              unsubscribeLogsRef.current = onSnapshot(doc(db, APP_ID, uid, "daily_logs", currentDateStr), (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setDailyLogs(data);
                  
                  let sched = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
                  if (data.custom_schedule && data.custom_schedule.length > 0) {
                    sched = data.custom_schedule;
                  }
                  Object.keys(data.custom_block_subjects || {}).forEach(bId => {
                    const b = sched.find(bl => bl.id === bId);
                    if (b) b.key = data.custom_block_subjects[bId];
                  });
                  setProtocolSchedule(sched);
                }
              });

              // Fetch all historical daily logs from cloud
              fetchAllCloudLogs(uid);
            }
          });
        }).catch(() => {});
      } catch (err) {}
    }

    return () => {
      if (unsubscribeSettingsRef.current) unsubscribeSettingsRef.current();
      if (unsubscribeLogsRef.current) unsubscribeLogsRef.current();
    };
  }, [currentDateStr]);

  // Erase all local state
  const resetAllData = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  return (
    <NeuroFlowContext.Provider value={{
      toasts,
      showToast,
      isTimeSimulated,
      simTimeOffset,
      currentDateStr,
      liveClock,
      toggleTimeMode,
      applySimulatedTime,
      userSettings,
      dailyLogs,
      protocolSchedule,
      timerState,
      activeBlock,
      launchBlockToTimer,
      toggleTimer,
      resetTimer,
      skipTimerInterval,
      splitActiveBlock,
      manualSplitBlock,
      swapBlockSubject,
      toggleBlockCompletion,
      isFirebaseConnected,
      firebaseConfigStr,
      currentUser,
      handleConnectFirebase,
      handleDisconnectFirebase,
      resetAllData,
      getBlockDurationMinutes,
      getBlockRemainingMinutes,
      getAdjustedDate,
      historyLogs,
      updateDailyGoal
    }}>
      {children}
    </NeuroFlowContext.Provider>
  );
}

// Custom hook to access everything safely
export function useNeuroFlow() {
  const context = useContext(NeuroFlowContext);
  if (!context) {
    throw new Error("useNeuroFlow must be used within a NeuroFlowProvider");
  }
  return context;
}

// No-op utility since getFirebaseInstances is now imported using standard ESM at the top of the file
