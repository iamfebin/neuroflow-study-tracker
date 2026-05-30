import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, collection, getDocs, setDoc, getDoc, deleteDoc } from "firebase/firestore";
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
    custom_schedule: null,
    wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
    sleep: { actual_time: "", timing_type: "on_time", reason: "" },
    session_details: {},
    day_completed: false
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
  const [isOfflineSandbox, setIsOfflineSandbox] = useState(() => {
    return localStorage.getItem(APP_ID + '_sandbox') === 'true';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
        custom_schedule: parsedLogs.custom_schedule || null,
        wake_up: parsedLogs.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
        sleep: parsedLogs.sleep || { actual_time: "", timing_type: "on_time", reason: "" },
        session_details: parsedLogs.session_details || {},
        day_completed: parsedLogs.day_completed || false
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
        custom_schedule: null,
        wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
        sleep: { actual_time: "", timing_type: "on_time", reason: "" },
        session_details: {},
        day_completed: false
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
      syncUserDataToCloud(currentUser.uid, currentDateStr, updatedSettings, logsWithSchedule)
        .catch(err => {
          showToast(`Cloud Sync Failed: ${err.message}`, "error");
        });
    }
  }, [userSettings, dailyLogs, protocolSchedule, currentDateStr, isFirebaseConnected, currentUser, saveStateToLocal, showToast]);

  const updateDailyGoal = useCallback((mins) => {
    const nextSettings = {
      ...userSettings,
      daily_goal_mins: mins
    };
    setUserSettings(nextSettings);
    saveStateAndSync(nextSettings, dailyLogs);
    showToast(`Daily study goal updated to ${mins} minutes.`);
  }, [userSettings, dailyLogs, saveStateAndSync, showToast]);

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

    // Helper: Rename block name according to the new subject prefix (preserving standard focus titles)
    const renameBlockSubjectName = (oldName, newSub) => {
      const subjectNames = {
        german: 'German',
        sql: 'SQL',
        python: 'Python'
      };
      const newSubName = subjectNames[newSub] || newSub.charAt(0).toUpperCase() + newSub.slice(1);
      return oldName.replace(/^(SQL|German|Python)/i, newSubName);
    };

    // Update protocol schedule
    const nextSched = protocolSchedule.map(b => {
      if (b.id === blockId) {
        return { 
          ...b, 
          key: newSubject,
          name: renameBlockSubjectName(b.name, newSubject)
        };
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
        return { 
          ...currentActive, 
          key: newSubject,
          name: renameBlockSubjectName(currentActive.name, newSubject)
        };
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

  // Add a new study or rest block manually
  const addBlock = useCallback((newBlock) => {
    const nextSched = [...protocolSchedule];
    nextSched.push(newBlock);
    nextSched.sort((a, b) => a.start.localeCompare(b.start));

    setProtocolSchedule(nextSched);
    saveStateAndSync(userSettings, dailyLogs, nextSched);
    showToast(`Added block: ${newBlock.name}`);
  }, [protocolSchedule, userSettings, dailyLogs, saveStateAndSync, showToast]);

  // Delete a block and automatically clean up credited hours and completion states
  const deleteBlock = useCallback((blockId) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block) return;

    // Calculate credited minutes for this block
    const manualCredit = dailyLogs.manual_credited_mins[blockId] || 0;
    const timerCredit = dailyLogs.timer_logged_mins[blockId] || 0;
    const creditedMins = manualCredit + timerCredit;

    // Subtract from userSettings if it is a study block with credited minutes
    let nextSettings = userSettings;
    if (block.type === 'study' && block.key && creditedMins > 0) {
      const nextMins = { ...userSettings.saved_focus_mins };
      if (nextMins[block.key] !== undefined) {
        nextMins[block.key] = Math.max(0, nextMins[block.key] - creditedMins);
      }
      nextSettings = {
        ...userSettings,
        saved_focus_mins: nextMins
      };
      setUserSettings(nextSettings);
    }

    // Clean up schedule timeline
    const nextSched = protocolSchedule.filter(b => b.id !== blockId);
    setProtocolSchedule(nextSched);

    // Clean up logs completion and credit maps
    const nextCompleted = dailyLogs.completed_blocks.filter(id => id !== blockId);
    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    delete nextManualMins[blockId];
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };
    delete nextTimerMins[blockId];
    const nextSubjects = { ...dailyLogs.custom_block_subjects };
    delete nextSubjects[blockId];

    const nextLogs = {
      ...dailyLogs,
      completed_blocks: nextCompleted,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins,
      custom_block_subjects: nextSubjects
    };
    setDailyLogs(nextLogs);

    // Sync all states
    saveStateAndSync(nextSettings, nextLogs, nextSched);

    // Synchronize active block selection
    setActiveBlock(currentActive => {
      if (currentActive && currentActive.id === blockId) {
        return null;
      }
      return currentActive;
    });

    showToast(`Deleted block: ${block.name}`);
  }, [protocolSchedule, dailyLogs, userSettings, saveStateAndSync, showToast]);

  // Edit an existing block and recalculate any study credits, duration changes, or type conversions
  const editBlock = useCallback((blockId, updatedFields) => {
    const block = protocolSchedule.find(b => b.id === blockId);
    if (!block) return;

    const wasStudy = block.type === 'study';
    const isStudyNow = updatedFields.type === 'study';
    const prevKey = block.key;
    const newKey = updatedFields.key || prevKey || 'german';

    let nextSettings = userSettings;
    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const prevDuration = getBlockDurationMinutes(block);
    const tempBlock = { ...block, ...updatedFields };
    const newDuration = getBlockDurationMinutes(tempBlock);

    // Case 1: Was study, remains study (standard time change or subject swap)
    if (wasStudy && isStudyNow && prevKey) {
      const origManual = nextManualMins[blockId] || 0;
      const origTimer = nextTimerMins[blockId] || 0;
      const totalCredited = origManual + origTimer;

      if (totalCredited > 0) {
        const nextMins = { ...nextSettings.saved_focus_mins };
        if (nextMins[prevKey] !== undefined) {
          nextMins[prevKey] = Math.max(0, nextMins[prevKey] - totalCredited);
        }

        let newManual = origManual;
        if (prevDuration !== newDuration && origManual > 0) {
          newManual = Math.max(0, newDuration - origTimer);
          if (newManual > 0) {
            nextManualMins[blockId] = newManual;
          } else {
            delete nextManualMins[blockId];
          }
        }

        const newTotalCredited = newManual + origTimer;
        if (nextMins[newKey] !== undefined) {
          nextMins[newKey] = (nextMins[newKey] || 0) + newTotalCredited;
        }

        nextSettings = {
          ...nextSettings,
          saved_focus_mins: nextMins
        };
        setUserSettings(nextSettings);
      }
    }

    // Case 2: Was study, converted to REST (deduct credited minutes)
    if (wasStudy && !isStudyNow && prevKey) {
      const origManual = nextManualMins[blockId] || 0;
      const origTimer = nextTimerMins[blockId] || 0;
      const totalCredited = origManual + origTimer;

      if (totalCredited > 0) {
        const nextMins = { ...nextSettings.saved_focus_mins };
        if (nextMins[prevKey] !== undefined) {
          nextMins[prevKey] = Math.max(0, nextMins[prevKey] - totalCredited);
        }
        nextSettings = {
          ...nextSettings,
          saved_focus_mins: nextMins
        };
        setUserSettings(nextSettings);
      }
      delete nextManualMins[blockId];
      delete nextTimerMins[blockId];
    }

    // Case 3: Was REST, converted to study (credit minutes if block was completed)
    if (!wasStudy && isStudyNow) {
      const wasCompleted = dailyLogs.completed_blocks.includes(blockId);
      if (wasCompleted) {
        const nextMins = { ...nextSettings.saved_focus_mins };
        if (nextMins[newKey] !== undefined) {
          nextMins[newKey] = (nextMins[newKey] || 0) + newDuration;
        }
        nextManualMins[blockId] = newDuration;
        nextSettings = {
          ...nextSettings,
          saved_focus_mins: nextMins
        };
        setUserSettings(nextSettings);
      }
    }

    // Update protocol schedule and cascade adjacent times to maintain contiguity
    const sortedCopy = [...protocolSchedule].sort((a, b) => a.start.localeCompare(b.start));
    const idx = sortedCopy.findIndex(b => b.id === blockId);
    
    if (idx !== -1) {
      const updatedBlock = { ...sortedCopy[idx], ...updatedFields };
      sortedCopy[idx] = updatedBlock;

      const timeToMins = (tStr) => {
        const [h, m] = tStr.split(':').map(Number);
        return h * 60 + m;
      };
      
      const minsToTime = (mins) => {
        const wrapped = (mins + 1440 * 10) % 1440;
        const h = Math.floor(wrapped / 60);
        const m = wrapped % 60;
        return String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0');
      };
      
      const getDuration = (startStr, endStr) => {
        let start = timeToMins(startStr);
        let end = timeToMins(endStr);
        if (end < start) end += 1440;
        return end - start;
      };

      // Forward Cascade: shift succeeding blocks keeping their durations constant
      for (let i = idx + 1; i < sortedCopy.length; i++) {
        const prevBlock = sortedCopy[i - 1];
        const currBlock = sortedCopy[i];
        const dur = getDuration(currBlock.start, currBlock.end);
        const newStart = prevBlock.end;
        const newEnd = minsToTime(timeToMins(newStart) + dur);
        sortedCopy[i] = { ...currBlock, start: newStart, end: newEnd };
      }

      // Backward Cascade: shift preceding blocks keeping their durations constant
      for (let i = idx - 1; i >= 0; i--) {
        const nextBlock = sortedCopy[i + 1];
        const currBlock = sortedCopy[i];
        const dur = getDuration(currBlock.start, currBlock.end);
        const newEnd = nextBlock.start;
        const newStart = minsToTime(timeToMins(newEnd) - dur);
        sortedCopy[i] = { ...currBlock, start: newStart, end: newEnd };
      }
    }

    const nextSched = sortedCopy;
    setProtocolSchedule(nextSched);

    // Keep daily logs custom subjects map in sync
    const nextLogs = {
      ...dailyLogs,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    if (updatedFields.key && updatedFields.key !== prevKey) {
      nextLogs.custom_block_subjects = {
        ...dailyLogs.custom_block_subjects,
        [blockId]: updatedFields.key
      };
    }
    setDailyLogs(nextLogs);

    // Sync all states
    saveStateAndSync(nextSettings, nextLogs, nextSched);

    // Keep active loaded block synchronized
    setActiveBlock(currentActive => {
      if (currentActive && currentActive.id === blockId) {
        return { ...currentActive, ...updatedFields };
      }
      return currentActive;
    });

    showToast(`Updated block: ${block.name}`);
  }, [protocolSchedule, dailyLogs, userSettings, getBlockDurationMinutes, saveStateAndSync, showToast]);

  // Move block up inside schedule and swap start/end times to preserve chronological flow
  const moveBlockUp = useCallback((blockId) => {
    const idx = protocolSchedule.findIndex(b => b.id === blockId);
    if (idx <= 0) return; // Already at the top or not found

    const nextSched = [...protocolSchedule];
    const block1 = nextSched[idx];
    const block2 = nextSched[idx - 1];

    const start1 = block1.start;
    const end1 = block1.end;
    const start2 = block2.start;
    const end2 = block2.end;

    let nextSettings = {
      ...userSettings,
      saved_focus_mins: { ...userSettings.saved_focus_mins }
    };
    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const adjustMins = (block, s, e) => {
      if (block.type !== 'study' || !block.key) return;
      const prevD = getBlockDurationMinutes(block);
      const temp = { ...block, start: s, end: e };
      const newD = getBlockDurationMinutes(temp);
      if (prevD === newD) return;

      const origM = nextManualMins[block.id] || 0;
      const origT = nextTimerMins[block.id] || 0;
      const totalC = origM + origT;

      if (totalC > 0 && origM > 0) {
        nextSettings.saved_focus_mins[block.key] = Math.max(0, nextSettings.saved_focus_mins[block.key] - totalC);
        const newM = Math.max(0, newD - origT);
        if (newM > 0) {
          nextManualMins[block.id] = newM;
        } else {
          delete nextManualMins[block.id];
        }
        nextSettings.saved_focus_mins[block.key] = (nextSettings.saved_focus_mins[block.key] || 0) + (newM + origT);
      }
    };

    adjustMins(block1, start2, end2);
    adjustMins(block2, start1, end1);

    // Swap positions and start/end times
    nextSched[idx] = { ...block2, start: start1, end: end1 };
    nextSched[idx - 1] = { ...block1, start: start2, end: end2 };

    const nextLogs = {
      ...dailyLogs,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    setUserSettings(nextSettings);
    setDailyLogs(nextLogs);
    setProtocolSchedule(nextSched);
    saveStateAndSync(nextSettings, nextLogs, nextSched);
    showToast(`Moved "${block1.name}" up`);
  }, [protocolSchedule, userSettings, dailyLogs, getBlockDurationMinutes, saveStateAndSync, showToast]);

  // Move block down inside schedule and swap start/end times to preserve chronological flow
  const moveBlockDown = useCallback((blockId) => {
    const idx = protocolSchedule.findIndex(b => b.id === blockId);
    if (idx === -1 || idx >= protocolSchedule.length - 1) return; // Already at the bottom or not found

    const nextSched = [...protocolSchedule];
    const block1 = nextSched[idx];
    const block2 = nextSched[idx + 1];

    const start1 = block1.start;
    const end1 = block1.end;
    const start2 = block2.start;
    const end2 = block2.end;

    let nextSettings = {
      ...userSettings,
      saved_focus_mins: { ...userSettings.saved_focus_mins }
    };
    const nextManualMins = { ...dailyLogs.manual_credited_mins };
    const nextTimerMins = { ...dailyLogs.timer_logged_mins };

    const adjustMins = (block, s, e) => {
      if (block.type !== 'study' || !block.key) return;
      const prevD = getBlockDurationMinutes(block);
      const temp = { ...block, start: s, end: e };
      const newD = getBlockDurationMinutes(temp);
      if (prevD === newD) return;

      const origM = nextManualMins[block.id] || 0;
      const origT = nextTimerMins[block.id] || 0;
      const totalC = origM + origT;

      if (totalC > 0 && origM > 0) {
        nextSettings.saved_focus_mins[block.key] = Math.max(0, nextSettings.saved_focus_mins[block.key] - totalC);
        const newM = Math.max(0, newD - origT);
        if (newM > 0) {
          nextManualMins[block.id] = newM;
        } else {
          delete nextManualMins[block.id];
        }
        nextSettings.saved_focus_mins[block.key] = (nextSettings.saved_focus_mins[block.key] || 0) + (newM + origT);
      }
    };

    adjustMins(block1, start2, end2);
    adjustMins(block2, start1, end1);

    // Swap positions and start/end times
    nextSched[idx] = { ...block2, start: start1, end: end1 };
    nextSched[idx + 1] = { ...block1, start: start2, end: end2 };

    const nextLogs = {
      ...dailyLogs,
      manual_credited_mins: nextManualMins,
      timer_logged_mins: nextTimerMins
    };

    setUserSettings(nextSettings);
    setDailyLogs(nextLogs);
    setProtocolSchedule(nextSched);
    saveStateAndSync(nextSettings, nextLogs, nextSched);
    showToast(`Moved "${block1.name}" down`);
  }, [protocolSchedule, userSettings, dailyLogs, getBlockDurationMinutes, saveStateAndSync, showToast]);

  // --- NEW BEHAVIORAL TRACKING & VAULT UPDATERS ---
  const updateWakeUpMetrics = useCallback((targetTime, actualTime, onTime, reason) => {
    setDailyLogs(prev => {
      const nextLogs = {
        ...prev,
        wake_up: { target_time: targetTime, actual_time: actualTime, on_time: onTime, reason }
      };
      saveStateAndSync(userSettings, nextLogs);
      return nextLogs;
    });
  }, [userSettings, saveStateAndSync]);

  const updateSleepMetrics = useCallback((actualTime, timingType, reason) => {
    setDailyLogs(prev => {
      const nextLogs = {
        ...prev,
        sleep: { actual_time: actualTime, timing_type: timingType, reason }
      };
      saveStateAndSync(userSettings, nextLogs);
      return nextLogs;
    });
  }, [userSettings, saveStateAndSync]);

  const updateBlockQualitativeData = useCallback((blockId, goalAchieved, progressNotes) => {
    setDailyLogs(prev => {
      const nextSessionDetails = {
        ...(prev.session_details || {}),
        [blockId]: { goal_achieved: goalAchieved, progress_notes: progressNotes }
      };
      const nextLogs = {
        ...prev,
        session_details: nextSessionDetails
      };
      saveStateAndSync(userSettings, nextLogs);
      return nextLogs;
    });
  }, [userSettings, saveStateAndSync]);

  const updateGeminiApiKey = useCallback((apiKey) => {
    const nextSettings = {
      ...userSettings,
      gemini_api_key: apiKey
    };
    setUserSettings(nextSettings);
    saveStateAndSync(nextSettings, dailyLogs);
    showToast("Gemini API key updated.");
  }, [userSettings, dailyLogs, saveStateAndSync, showToast]);

  const toggleDayCompletion = useCallback(() => {
    setDailyLogs(prev => {
      const nextCompleted = !prev.day_completed;
      const nextLogs = {
        ...prev,
        day_completed: nextCompleted
      };
      saveStateAndSync(userSettings, nextLogs);
      showToast(nextCompleted ? "Day marked as complete." : "Day marked as incomplete.");
      return nextLogs;
    });
  }, [userSettings, saveStateAndSync, showToast]);

  const bypassToSandbox = useCallback(() => {
    setIsOfflineSandbox(true);
    localStorage.setItem(APP_ID + '_sandbox', 'true');
    showToast("Offline sandbox initialized.");
  }, [showToast]);

  const exitSandbox = useCallback(() => {
    setIsOfflineSandbox(false);
    localStorage.removeItem(APP_ID + '_sandbox');
    showToast("Exited local sandbox.");
  }, [showToast]);

  const getHabitProfile = useCallback(async () => {
    if (isFirebaseConnected && currentUser) {
      try {
        const { db } = getFirebaseInstances();
        if (!db) return null;
        const docRef = doc(db, APP_ID, currentUser.uid, "settings", "habit_profile");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data();
        }
      } catch (err) {
        console.error("Error fetching habit profile from Firestore:", err);
      }
    }
    
    // Sandbox / Offline fallback
    const local = localStorage.getItem('local_habit_profile');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Error parsing local habit profile:", e);
      }
    }
    return null;
  }, [isFirebaseConnected, currentUser]);

  const saveHabitProfile = useCallback(async (profile) => {
    if (isFirebaseConnected && currentUser) {
      try {
        const { db } = getFirebaseInstances();
        if (db) {
          const docRef = doc(db, APP_ID, currentUser.uid, "settings", "habit_profile");
          await setDoc(docRef, profile, { merge: true });
        }
      } catch (err) {
        console.error("Error writing habit profile to Firestore:", err);
      }
    }
    
    // Sync to local storage for caching/sandbox
    localStorage.setItem('local_habit_profile', JSON.stringify(profile));
  }, [isFirebaseConnected, currentUser]);

  const clearAllCloudData = useCallback(async () => {
    // 1. Clear locally
    const logKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_ID + '_logs_')) {
        logKeys.push(key);
      }
    }
    logKeys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('local_habit_profile');
    
    // Reset local React states
    setHistoryLogs({});
    setDailyLogs({
      completed_blocks: [],
      manual_credited_mins: {},
      timer_logged_mins: {},
      custom_block_subjects: {},
      custom_schedule: null,
      wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
      sleep: { actual_time: "", timing_type: "on_time", reason: "" },
      session_details: {},
      day_completed: false
    });
    setProtocolSchedule(JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE)));
    
    // 2. Clear cloud if connected
    if (isFirebaseConnected && currentUser) {
      try {
        const { db } = getFirebaseInstances();
        if (db) {
          const dailyLogsCol = collection(db, APP_ID, currentUser.uid, "daily_logs");
          const snapshot = await getDocs(dailyLogsCol);
          
          const deletePromises = [];
          snapshot.forEach(docSnap => {
            const docRef = doc(db, APP_ID, currentUser.uid, "daily_logs", docSnap.id);
            deletePromises.push(deleteDoc(docRef));
          });
          await Promise.all(deletePromises);
          
          const settingsRef = doc(db, APP_ID, currentUser.uid, "settings", "user_settings");
          const profileRef = doc(db, APP_ID, currentUser.uid, "settings", "habit_profile");
          await deleteDoc(settingsRef);
          await deleteDoc(profileRef);
        }
        showToast("All cloud and local data permanently erased.");
      } catch (err) {
        console.error("Error clearing cloud data:", err);
        showToast("Failed to clear some cloud documents.", "error");
      }
    } else {
      showToast("All local sandbox data permanently erased.");
    }
  }, [isFirebaseConnected, currentUser, showToast]);

  const clearDataDateRange = useCallback(async (startDateStr, endDateStr) => {
    if (!startDateStr || !endDateStr) {
      showToast("Please specify both start and end dates.", "error");
      return;
    }
    
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      showToast("Invalid date range input.", "error");
      return;
    }
    
    // Identify all dates in history logs that fall within the range
    const datesToClear = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDate.getDate()).padStart(2, '0');
      datesToClear.push(`${yyyy}-${mm}-${dd}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Delete locally
    datesToClear.forEach(dateStr => {
      localStorage.removeItem(APP_ID + '_logs_' + dateStr);
    });
    
    // Reset active day if within range
    if (datesToClear.includes(currentDateStr)) {
      setDailyLogs({
        completed_blocks: [],
        manual_credited_mins: {},
        timer_logged_mins: {},
        custom_block_subjects: {},
        custom_schedule: null,
        wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
        sleep: { actual_time: "", timing_type: "on_time", reason: "" },
        session_details: {},
        day_completed: false
      });
      setProtocolSchedule(JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE)));
    }
    
    // Update history state
    setHistoryLogs(prev => {
      const next = { ...prev };
      datesToClear.forEach(d => delete next[d]);
      return next;
    });
    
    // Delete from cloud
    if (isFirebaseConnected && currentUser) {
      try {
        const { db } = getFirebaseInstances();
        if (db) {
          const promises = datesToClear.map(dateStr => {
            const docRef = doc(db, APP_ID, currentUser.uid, "daily_logs", dateStr);
            return deleteDoc(docRef);
          });
          await Promise.all(promises);
        }
        showToast(`Cleared daily logs from ${startDateStr} to ${endDateStr} on cloud and local.`);
      } catch (err) {
        console.error("Error clearing cloud date range:", err);
        showToast("Failed to clear some cloud range documents.", "error");
      }
    } else {
      showToast(`Cleared daily logs from ${startDateStr} to ${endDateStr} locally.`);
    }
  }, [currentDateStr, isFirebaseConnected, currentUser, showToast]);

  const clearSpecificDates = useCallback(async (dateStrings) => {
    if (!dateStrings || dateStrings.length === 0) {
      showToast("No specific dates provided for deletion.", "error");
      return;
    }
    
    const validDates = dateStrings.map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (validDates.length === 0) {
      showToast("Invalid date format. Use YYYY-MM-DD.", "error");
      return;
    }
    
    // Delete locally
    validDates.forEach(dateStr => {
      localStorage.removeItem(APP_ID + '_logs_' + dateStr);
    });
    
    // Reset active day if cleared
    if (validDates.includes(currentDateStr)) {
      setDailyLogs({
        completed_blocks: [],
        manual_credited_mins: {},
        timer_logged_mins: {},
        custom_block_subjects: {},
        custom_schedule: null,
        wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
        sleep: { actual_time: "", timing_type: "on_time", reason: "" },
        session_details: {},
        day_completed: false
      });
      setProtocolSchedule(JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE)));
    }
    
    // Update history state
    setHistoryLogs(prev => {
      const next = { ...prev };
      validDates.forEach(d => delete next[d]);
      return next;
    });
    
    // Delete from cloud
    if (isFirebaseConnected && currentUser) {
      try {
        const { db } = getFirebaseInstances();
        if (db) {
          const promises = validDates.map(dateStr => {
            const docRef = doc(db, APP_ID, currentUser.uid, "daily_logs", dateStr);
            return deleteDoc(docRef);
          });
          await Promise.all(promises);
        }
        showToast(`Cleared daily logs for: ${validDates.join(', ')}.`);
      } catch (err) {
        console.error("Error clearing specific cloud dates:", err);
        showToast("Failed to clear some specific cloud documents.", "error");
      }
    } else {
      showToast(`Cleared daily logs for: ${validDates.join(', ')} locally.`);
    }
  }, [currentDateStr, isFirebaseConnected, currentUser, showToast]);

  // Context Bundler for AI RAG History
  const getPast14DaysHistory = useCallback(() => {
    const sortedDates = Object.keys(historyLogs).sort();
    const last14Dates = sortedDates.slice(-14);
    
    return last14Dates.map(date => {
      const log = historyLogs[date];
      
      // Load standard default or daily custom schedule
      let scheduleObj = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
      if (log?.custom_schedule && log.custom_schedule.length > 0) {
        scheduleObj = log.custom_schedule;
      }
      
      // Helper: Rename block name according to the new subject prefix (preserving standard focus titles)
      const renameBlockSubjectName = (oldName, newSub) => {
        const subjectNames = {
          german: 'German',
          sql: 'SQL',
          python: 'Python'
        };
        const newSubName = subjectNames[newSub] || newSub.charAt(0).toUpperCase() + newSub.slice(1);
        return oldName.replace(/^(SQL|German|Python)/i, newSubName);
      };
      
      // Auto-apply custom block subjects to the historical schedule sent to AI
      const resolvedSchedule = scheduleObj.map(b => {
        const customSub = log?.custom_block_subjects?.[b.id];
        if (customSub) {
          return {
            ...b,
            key: customSub,
            name: renameBlockSubjectName(b.name, customSub)
          };
        }
        return b;
      });
      
      const studyBlocksCount = resolvedSchedule.filter(b => b.type === 'study').length;
      const completedStudyBlocksCount = resolvedSchedule.filter(b => b.type === 'study' && log?.completed_blocks?.includes(b.id)).length;
      
      return {
        date,
        study_completed_ratio: studyBlocksCount > 0 ? `${completedStudyBlocksCount}/${studyBlocksCount}` : "0/0",
        wake_up: log?.wake_up || null,
        sleep: log?.sleep || null,
        session_details: log?.session_details || {},
        completed_blocks: log?.completed_blocks || [],
        timer_logged_mins: log?.timer_logged_mins || {},
        manual_credited_mins: log?.manual_credited_mins || {},
        custom_block_subjects: log?.custom_block_subjects || {},
        custom_schedule: resolvedSchedule
      };
    });
  }, [historyLogs]);

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
  const handleConnectFirebase = useCallback(async (rawJson, email, password, mode, geminiKey = "") => {
    try {
      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch (jsonErr) {
        throw new Error("Invalid Firebase configuration format. Please double-check your JSON format.");
      }
      
      if (!parsed.apiKey || !parsed.authDomain || !parsed.projectId) {
        throw new Error("Invalid Firebase configuration format. Please double-check your JSON format.");
      }

      localStorage.setItem(APP_ID + '_firebase_config', rawJson);
      setFirebaseConfigStr(rawJson);
      
      const { auth: loadedAuth } = await initFirebase(parsed);
      
      // Setup connection listener
      loadedAuth.onAuthStateChanged((user) => {
        if (user) {
          setCurrentUser(user);
          setIsFirebaseConnected(true);
          setIsOfflineSandbox(false);
          localStorage.removeItem(APP_ID + '_sandbox');
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
            } else {
              syncUserDataToCloud(uid, currentDateStr, userSettings, dailyLogs)
                .catch(err => {
                  showToast(`Cloud Setup Failed: ${err.message}`, "error");
                });
            }
          });
          
          unsubscribeLogsRef.current = onSnapshot(doc(db, APP_ID, uid, "daily_logs", currentDateStr), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const sanitizedData = {
                ...data,
                completed_blocks: data.completed_blocks || [],
                manual_credited_mins: data.manual_credited_mins || {},
                timer_logged_mins: data.timer_logged_mins || {},
                custom_block_subjects: data.custom_block_subjects || {},
                custom_schedule: data.custom_schedule || null,
                wake_up: data.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
                sleep: data.sleep || { actual_time: "", timing_type: "on_time", reason: "" },
                session_details: data.session_details || {},
                day_completed: data.day_completed || false
              };
              setDailyLogs(sanitizedData);
              
              let sched = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
              if (data.custom_schedule && data.custom_schedule.length > 0) {
                sched = data.custom_schedule;
              }
              
              Object.keys(data.custom_block_subjects || {}).forEach(bId => {
                const b = sched.find(bl => bl.id === bId);
                if (b) b.key = data.custom_block_subjects[bId];
              });
              
              setProtocolSchedule(sched);
              saveStateToLocal(userSettings, sanitizedData, currentDateStr);
            } else {
              syncUserDataToCloud(uid, currentDateStr, userSettings, dailyLogs)
                .catch(err => {
                  showToast(`Cloud Setup Failed: ${err.message}`, "error");
                });
            }
          });

          // Fetch all historical daily logs from cloud
          fetchAllCloudLogs(uid);
          setIsAuthLoading(false);
        } else {
          setCurrentUser(null);
          setIsFirebaseConnected(false);
        }
      });

      // Run action
      if (email && password) {
        if (mode === 'register') {
          const userCred = await registerUser(email, password);
          const user = userCred.user;
          const uid = user.uid;

          // Sequential Account Provisioning Routine
          const initialSettings = {
            daily_goal_mins: 240,
            saved_focus_mins: { german: 0, sql: 0, python: 0 },
            gemini_api_key: geminiKey
          };

          const initialLogs = {
            completed_blocks: [],
            manual_credited_mins: {},
            timer_logged_mins: {},
            custom_block_subjects: {},
            custom_schedule: null,
            wake_up: { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
            sleep: { actual_time: "", timing_type: "on_time", reason: "" },
            session_details: {},
            day_completed: false
          };

          const { db: provisionDb } = getFirebaseInstances();
          await setDoc(doc(provisionDb, APP_ID, uid, "settings", "user_settings"), initialSettings);
          await setDoc(doc(provisionDb, APP_ID, uid, "daily_logs", currentDateStr), initialLogs);
          
          showToast("Registration completed & database provisioned.");
        } else {
          await signInUser(email, password);
        }
      }
    } catch (e) {
      showToast(e.message, "error");
      throw e;
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
      
      setIsOfflineSandbox(false);
      localStorage.removeItem(APP_ID + '_sandbox');
      
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
              setIsOfflineSandbox(false);
              localStorage.removeItem(APP_ID + '_sandbox');
              
              const uid = user.uid;
              const { db } = getFirebaseInstances();
              
              if (unsubscribeSettingsRef.current) unsubscribeSettingsRef.current();
              if (unsubscribeLogsRef.current) unsubscribeLogsRef.current();

              unsubscribeSettingsRef.current = onSnapshot(doc(db, APP_ID, uid, "settings", "user_settings"), (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setUserSettings(data);
                  saveStateToLocal(data, dailyLogs, currentDateStr);
                } else {
                  syncUserDataToCloud(uid, currentDateStr, userSettings, dailyLogs)
                    .catch(err => {
                      showToast(`Cloud Setup Failed: ${err.message}`, "error");
                    });
                }
              });
              
              unsubscribeLogsRef.current = onSnapshot(doc(db, APP_ID, uid, "daily_logs", currentDateStr), (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  const sanitizedData = {
                    ...data,
                    completed_blocks: data.completed_blocks || [],
                    manual_credited_mins: data.manual_credited_mins || {},
                    timer_logged_mins: data.timer_logged_mins || {},
                    custom_block_subjects: data.custom_block_subjects || {},
                    custom_schedule: data.custom_schedule || null,
                    wake_up: data.wake_up || { target_time: "07:00", actual_time: "", on_time: true, reason: "" },
                    sleep: data.sleep || { actual_time: "", timing_type: "on_time", reason: "" },
                    session_details: data.session_details || {},
                    day_completed: data.day_completed || false
                  };
                  setDailyLogs(sanitizedData);
                  
                  let sched = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_SCHEDULE));
                  if (data.custom_schedule && data.custom_schedule.length > 0) {
                    sched = data.custom_schedule;
                  }
                  Object.keys(data.custom_block_subjects || {}).forEach(bId => {
                    const b = sched.find(bl => bl.id === bId);
                    if (b) b.key = data.custom_block_subjects[bId];
                  });
                  setProtocolSchedule(sched);
                  saveStateToLocal(userSettings, sanitizedData, currentDateStr);
                } else {
                  syncUserDataToCloud(uid, currentDateStr, userSettings, dailyLogs)
                    .catch(err => {
                      showToast(`Cloud Setup Failed: ${err.message}`, "error");
                    });
                }
              });

              // Fetch all historical daily logs from cloud
              fetchAllCloudLogs(uid);
            }
            setIsAuthLoading(false);
          });
        }).catch(() => {
          setIsAuthLoading(false);
        });
      } catch (err) {
        setIsAuthLoading(false);
      }
    } else {
      setIsAuthLoading(false);
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
      addBlock,
      deleteBlock,
      editBlock,
      moveBlockUp,
      moveBlockDown,
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
      updateDailyGoal,
      updateWakeUpMetrics,
      updateSleepMetrics,
      updateBlockQualitativeData,
      updateGeminiApiKey,
      getPast14DaysHistory,
      isOfflineSandbox,
      isAuthLoading,
      bypassToSandbox,
      exitSandbox,
      getHabitProfile,
      saveHabitProfile,
      clearAllCloudData,
      clearDataDateRange,
      clearSpecificDates,
      toggleDayCompletion
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
