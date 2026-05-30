import React, { useState, useEffect } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import {
  getDailyAggregatedData,
  bedtimeToWakeUpCorrelation,
  calculateStudyVolatility,
  calculateTransitionFailProbability
} from '../../utils/dataScienceEngine';

function parseInlineMarkdown(text) {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('###')) {
      return (
        <h4 key={idx} className="text-xs font-bold text-white uppercase tracking-wider mt-4 mb-2 border-b border-mono-800 pb-1 font-mono">
          {trimmed.replace(/^###\s*/, '')}
        </h4>
      );
    }
    if (trimmed.startsWith('##')) {
      return (
        <h3 key={idx} className="text-sm font-bold text-white uppercase tracking-widest mt-6 mb-3 border-b border-mono-700 pb-1.5 font-mono">
          {trimmed.replace(/^##\s*/, '')}
        </h3>
      );
    }
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      return (
        <li key={idx} className="list-disc list-inside text-mono-300 pl-2 text-xs font-mono my-0.5">
          {parseInlineMarkdown(trimmed.replace(/^[-*]\s*/, ''))}
        </li>
      );
    }
    if (trimmed.startsWith('>')) {
      return (
        <blockquote key={idx} className="border-l-2 border-white pl-3 py-1 my-2 bg-mono-955/40 text-mono-400 italic text-xs font-mono">
          {parseInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
    }
    if (!trimmed) {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="text-xs text-mono-300 font-mono leading-relaxed my-1">
        {parseInlineMarkdown(line)}
      </p>
    );
  });
}

const DEFAULT_HABIT_PROFILE = {
  all_time_stats: { "total_logged_days": 0, "wake_up_on_time_rate": 1.0, "german_completion_rate": 1.0, "sql_completion_rate": 1.0, "python_completion_rate": 1.0 },
  identified_behavioral_loops: [],
  ai_coach_personality_notes: { "recurring_excuses": [], "best_days_trigger": "None identified yet." },
  last_profile_sync: ""
};

export default function AICoach() {
  const { userSettings, updateGeminiApiKey, getPast14DaysHistory, getHabitProfile, saveHabitProfile, currentDateStr } = useNeuroFlow();
  const [isLoading, setIsLoading] = useState(false);
  const [ragStep, setRagStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [inlineKey, setInlineKey] = useState("");

  const hasKey = !!userSettings?.gemini_api_key;

  // Load cached feedback on mount
  useEffect(() => {
    const cached = localStorage.getItem('neuroflow_ai_coach_feedback');
    if (cached) {
      setCoachFeedback(cached);
    }
  }, []);

  // Fetch rolling anomaly stream (last 14 days)
  const historyData = getPast14DaysHistory();
  const historyCount = historyData.length;

  // Clean and aggregate daily summary records
  const aggregatedDays = getDailyAggregatedData(historyData);

  // Deterministic math fact calculations
  const bedtimeStats = bedtimeToWakeUpCorrelation(aggregatedDays);
  const germanStats = calculateStudyVolatility(aggregatedDays, 'german');
  const pythonStats = calculateStudyVolatility(aggregatedDays, 'python');
  const sqlStats = calculateStudyVolatility(aggregatedDays, 'sql');
  const conditionalProb = calculateTransitionFailProbability(aggregatedDays);

  const handleInlineKeySubmit = (e) => {
    e.preventDefault();
    if (inlineKey.trim()) {
      updateGeminiApiKey(inlineKey.trim());
      setInlineKey("");
    }
  };

  const generateFeedback = async () => {
    const apiKey = userSettings?.gemini_api_key;
    if (!apiKey) {
      setErrorMessage("Please configure a Gemini API key first.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setCoachFeedback("");

    // Phase A: Fetch Cumulative Habit Profile
    setRagStep("Fetching historical trends & baseline...");
    let habitProfile = null;
    try {
      habitProfile = await getHabitProfile();
    } catch (err) {
      console.error("Error reading habit profile", err);
    }
    if (!habitProfile) {
      habitProfile = { ...DEFAULT_HABIT_PROFILE };
    }

    const isAlreadySynced = habitProfile?.last_profile_sync === currentDateStr;
    const syncInstruction = isAlreadySynced
      ? `NOTE: Today's logs (date: ${currentDateStr}) have ALREADY been integrated into this cumulative profile. 
Therefore, in the PART 2 JSON block:
- DO NOT increment 'total_logged_days' (leave it at the current value of ${habitProfile?.all_time_stats?.total_logged_days || 0}).
- DO NOT factor today's logs into the moving averages again (keep 'wake_up_on_time_rate', 'german_completion_rate', 'sql_completion_rate', and 'python_completion_rate' at their current values).
- Keep 'last_profile_sync' as '${currentDateStr}'.
- You may still update 'identified_behavioral_loops' or append excuses to 'recurring_excuses' if you notice new loops from the 14-day stream.`
      : `NOTE: Today's logs (date: ${currentDateStr}) have NOT yet been integrated into this cumulative profile. 
Therefore, in the PART 2 JSON block:
- Increment 'total_logged_days' by 1.
- Recalculate 'wake_up_on_time_rate', 'german_completion_rate', 'sql_completion_rate', and 'python_completion_rate' (moving averages factoring in today's logs).
- Append today's excuses to 'recurring_excuses'.
- Set 'last_profile_sync' to '${currentDateStr}'.`;

    // Phase B: Dual-Context System Prompt Overhaul
    setRagStep("Analyzing recent anomaly stream...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const isWarmUp = historyCount < 3;
    let systemInstruction = "";
    let prompt = "";

    if (isWarmUp) {
      systemInstruction = `You are the NeuroFlow AI Coach, a blunt, high-context personal performance assistant. 
- BLOCK SUBJECT SWAPPING: Users can dynamically swap the subject of any timeline study block. For example, if a block ID is 'sql_block_1' but its mapped subject key in the schedule is 'german' (and its name is renamed to 'German Focus 1'), this means the user intentionally swapped that block to German. This is a fully supported and expected feature. DO NOT treat this as a schedule misalignment, block mismatch, or data noise. Evaluate it as a successfully completed German block.

Your analysis must have EXACTLY two parts:

PART 1: The Monochromatic Markdown Coaching Report
Format this part in beautiful Markdown with exactly these five distinct sections:
### 1. Daily Validation & Encouragement
### 2. Next-Day Study Recommendations
### 3. Daily Progress Breakdown
### 4. Insults & Reality Check
### 5. Habit Strategy

PART 2: Cumulative Profile Update (JSON)
At the very end of your response, write a single JSON block wrapped strictly inside \`\`\`json and \`\`\`. 
This JSON must represent the updated cumulative habit profile. 
${syncInstruction}

Ensure the JSON matches the schema of the Long-Term Habit Baseline exactly. Output no other text after the JSON block.`;

      prompt = `The user is currently in their 'Onboarding Warm-up Phase' (less than 3 days of tracking). Do not calculate math. Provide an exceptionally encouraging welcome message, outline immediate planning guidelines, and explain that once they hit 3 logged days, their data will undergo a mathematical behavioral audit.

--- LONG-TERM HABIT BASELINE (TIER 2 MEMORY) ---
${JSON.stringify(habitProfile, null, 2)}

--- RECENT BEHAVIORAL ANOMALY STREAM (TIER 1 MEMORY) ---
${JSON.stringify(historyData, null, 2)}`;
    } else {
      systemInstruction = `You are the NeuroFlow AI Coach, a blunt, high-context personal performance assistant. 
You will evaluate the user's study metrics and habit records.
- BLOCK SUBJECT SWAPPING: Users can dynamically swap the subject of any timeline study block. For example, if a block ID is 'sql_block_1' but its mapped subject key in the schedule is 'german' (and its name is renamed to 'German Focus 1'), this means the user intentionally swapped that block to German. This is a fully supported and expected feature. DO NOT treat this as a schedule misalignment, block mismatch, or data noise. Evaluate it as a successfully completed German block.

You are supplied with two sources of context:
1. Long-Term Habit Baseline: A cumulative habit profile tracking all-time statistics, identified loops, and recurring excuses.
2. Recent Behavioral Anomaly Stream: A rolling JSON log of the last 14 days of daily studies, wake-ups, bedtimes, and qualitative block comments.

Your analysis must have EXACTLY two parts:

PART 1: The Monochromatic Markdown Coaching Report
Format this part in beautiful Markdown with exactly these five distinct sections:
### 1. Daily Validation & Encouragement
Acknowledge consistency, focus durations, and streaks with a supportive yet direct tone.

### 2. Next-Day Study Recommendations
Provide a concrete and logical list of goals for tomorrow based on what subjects were skipped or completed today.

### 3. Daily Progress Breakdown
Give an objective, structured summary of hours logged vs. target hours.

### 4. Insults & Reality Check
Deliver a blunt, highly sarcastic roast of recurring excuses, bedtime slip-ups, or late wake-ups. Do not sugarcoat.

### 5. Habit Strategy
Give them a clear, actionable micro-habit shift to prevent their current failure loops.

PART 2: Cumulative Profile Update (JSON)
At the very end of your response, write a single JSON block wrapped strictly inside \`\`\`json and \`\`\`. 
This JSON must represent the updated cumulative habit profile. 
${syncInstruction}

Ensure the JSON matches the schema of the Long-Term Habit Baseline exactly. Output no other text after the JSON block.`;

      const rValue = bedtimeStats.r === null ? "N/A" : bedtimeStats.r;
      const rLabel = bedtimeStats.label;
      const germanMean = germanStats.mean;
      const germanStdDev = germanStats.stdDev;
      const germanLabel = germanStats.label;
      const pythonMean = pythonStats.mean;
      const pythonStdDev = pythonStats.stdDev;
      const pythonLabel = pythonStats.label;
      const sqlMean = sqlStats.mean;
      const sqlStdDev = sqlStats.stdDev;
      const sqlLabel = sqlStats.label;

      prompt = `--- LONG-TERM HABIT BASELINE (TIER 2 MEMORY) ---
${JSON.stringify(habitProfile, null, 2)}

--- RECENT BEHAVIORAL ANOMALY STREAM (TIER 1 MEMORY) ---
${JSON.stringify(historyData, null, 2)}

### DETERMINISTIC BEHAVIORAL STATISTICS (DO NOT HALLUCINATE OR RECALCULATE)
- Bedtime-to-Wakeup Correlation (Pearson r): ${rValue} (Assessment: ${rLabel})
- German Daily Study Volatility: Mean = ${germanMean}m, StdDev = ${germanStdDev}m (Assessment: ${germanLabel})
- Python Daily Study Volatility: Mean = ${pythonMean}m, StdDev = ${pythonStdDev}m (Assessment: ${pythonLabel})
- SQL Daily Study Volatility: Mean = ${sqlMean}m, StdDev = ${sqlStdDev}m (Assessment: ${sqlLabel})
- Conditional Probability P(German Fail | Tech Overrun): ${conditionalProb}

Use these calculated statistical facts as your mathematical ground truth. If the correlation is strong, address the exact causation of their late bedtimes on morning schedules. If volatility is high, address their lack of procedural discipline. Do not attempt to compute your own numbers; write your clinical analysis and roasts based entirely on this mathematical audit.

Provide your performance analysis.`;
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
    };

    let attempt = 0;
    let delay = 1000;

    while (attempt < 5) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Gemini API Error (HTTP ${response.status})`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Empty candidate payload returned from Gemini.");
        }

        // Phase C: Response Parsing & JSON Extraction
        setRagStep("Consolidating multi-horizon memory...");
        let markdownText = text;
        let jsonBlockText = "";

        const parts = text.split("```json");
        if (parts.length > 1) {
          markdownText = parts[0].trim();
          jsonBlockText = parts[1].split("```")[0].trim();
        }

        setCoachFeedback(markdownText);
        localStorage.setItem('neuroflow_ai_coach_feedback', markdownText);

        // Phase D: Robust JSON write-back
        if (jsonBlockText) {
          setRagStep("Syncing cumulative baseline...");
          try {
            const parsedProfile = JSON.parse(jsonBlockText);
            await saveHabitProfile(parsedProfile);
          } catch (jsonErr) {
            console.warn("Malformed JSON block returned from RAG Coach:", jsonErr);
          }
        }

        setIsLoading(false);
        return;
      } catch (err) {
        attempt++;
        if (attempt >= 5) {
          setErrorMessage(err.message || "Failed to generate AI feedback after 5 retries.");
          setIsLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  return (
    <div className="border border-mono-800 rounded-lg p-5 bg-mono-900/50 flex flex-col text-left space-y-4">
      <div className="flex items-center justify-between border-b border-mono-800 pb-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest">AI Performance Coach</h3>
        <span className="text-[9px] font-mono text-mono-500 uppercase">RAG Engine</span>
      </div>

      {!hasKey && (
        <div className="bg-black/40 border border-mono-800 rounded p-4 space-y-3">
          <p className="text-[10px] text-mono-400 font-mono leading-relaxed">
            API key missing. The AI Coach requires a Google Gemini Developer API key to run client-side queries securely.
          </p>
          <form onSubmit={handleInlineKeySubmit} className="flex gap-2">
            <input
              type="password"
              placeholder="Enter Gemini API Key..."
              value={inlineKey}
              onChange={(e) => setInlineKey(e.target.value)}
              className="flex-grow bg-black border border-mono-750 text-[10px] p-2 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-white text-black font-bold rounded text-[10px] hover:bg-mono-200 transition uppercase font-mono"
            >
              Set Key
            </button>
          </form>
        </div>
      )}

      {hasKey && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-mono-400 font-mono">
              {historyCount < 3
                ? "Onboarding Phase (< 3 logs tracked)."
                : "Deterministic behavioral audit loaded."
              }
            </span>
            <button
              onClick={generateFeedback}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white text-black font-bold rounded text-[10px] hover:bg-mono-200 disabled:opacity-30 transition uppercase font-mono tracking-wider"
            >
              {isLoading ? "ANALYZING..." : "GENERATE FEED"}
            </button>
          </div>

          {historyCount >= 3 && (
            <div className="border border-mono-800 rounded p-4 bg-black/20 space-y-3 font-mono text-[10px]">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-mono-800 pb-1.5">
                Deterministic Behavioral Audit
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-mono-400">
                <div className="space-y-1">
                  <div>
                    <span className="text-mono-300">Sleep Correlation:</span>{" "}
                    <span className="text-white">{bedtimeStats.r !== null ? bedtimeStats.r : "N/A"}</span>
                  </div>
                  <div className="text-[9px] text-mono-500">
                    Assessment: {bedtimeStats.label}
                  </div>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-mono-300">German Volatility:</span>{" "}
                    <span className="text-white">Mean = {germanStats.mean}m, StdDev = {germanStats.stdDev}m</span>
                  </div>
                  <div className="text-[9px] text-mono-500">
                    Assessment: {germanStats.label}
                  </div>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-mono-300">Python Volatility:</span>{" "}
                    <span className="text-white">Mean = {pythonStats.mean}m, StdDev = {pythonStats.stdDev}m</span>
                  </div>
                  <div className="text-[9px] text-mono-500">
                    Assessment: {pythonStats.label}
                  </div>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-mono-300">SQL Volatility:</span>{" "}
                    <span className="text-white">Mean = {sqlStats.mean}m, StdDev = {sqlStats.stdDev}m</span>
                  </div>
                  <div className="text-[9px] text-mono-500">
                    Assessment: {sqlStats.label}
                  </div>
                </div>
                <div className="space-y-1 md:col-span-2 border-t border-mono-850 pt-2 text-left">
                  <div>
                    <span className="text-mono-300">P(German Fail | Tech Overrun):</span>{" "}
                    <span className="text-white">{conditionalProb}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <div className="w-8 h-8 rounded-full border border-mono-700 border-t-white animate-spin" />
              <span className="text-[10px] font-mono text-mono-450 animate-pulse text-center block max-w-[250px] leading-relaxed">
                {ragStep}
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded text-red-400 text-[10px] font-mono leading-relaxed">
              {errorMessage}
            </div>
          )}

          {coachFeedback && !isLoading && (
            <div className="bg-black/30 border border-mono-800 rounded p-4 max-h-[450px] overflow-y-auto space-y-4 select-text">
              {renderMarkdown(coachFeedback)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
