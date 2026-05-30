NeuroFlow: Roadmap for UI, Database, and RAG Agent Integration

This technical integration blueprint details how to update your current NeuroFlow codebase (built with React 19, Tailwind, and Firebase Client SDK) to accommodate your new behavioral tracking metrics and the dynamic client-side Gemini RAG engine.

Step 1: Database Schema Integration

To fit these features seamlessly into your existing Firestore schema, you will extend the daily_logs document structure and your global user_settings configuration.

1. Daily Log Documents (neuroflow-minimal/{userId}/daily_logs/{YYYY-MM-DD})

Incorporate the new wakeUp, sleep, and session_details qualitative objects directly into the existing daily log document structure alongside the custom_schedule array:

{
  "completed_blocks": ["wake_prep", "sql_block_1"],
  "manual_credited_mins": { "sql_block_1": 60 },
  "timer_logged_mins": { "german_block_1": 120 },
  "custom_schedule": [ /* ... your existing array ... */ ],
  
  // --- NEW BEHAVIORAL PARAMETERS ---
  "wake_up": {
    "target_time": "06:00",
    "actual_time": "06:45",
    "on_time": false,
    "reason": "Slept through alarm due to late-night screen time."
  },
  "sleep": {
    "actual_time": "23:45",
    "timing_type": "late",
    "reason": "Wanted to push through one more coding bug."
  },
  "session_details": {
    "sql_block_1": {
      "goal_achieved": true,
      "notes": "Finished learning SQL Window functions. Understood PARTITION BY."
    },
    "german_block_1": {
      "goal_achieved": false,
      "notes": "Struggled with Akkusativ prepositions. Highly distracted by my phone."
    }
  }
}


2. Private Settings Configuration (neuroflow-minimal/{userId}/settings/user_settings)

Add an optional property to hold your encrypted Gemini API key at the user-profile level. This allows the key to follow your account to any device seamlessly.

{
  "daily_goal_mins": 240,
  "saved_focus_mins": { "german": 1200, "sql": 480, "python": 360 },
  "gemini_api_key": "AIzaSy..." 
}


Step 2: Context State Expansion (NeuroFlowContext.jsx)

Your central React Context acts as the global state orchestrator. You need to update this provider to manage the new fields reactively:

State Modifications:

Extend the initialization state for the active day's log to include default objects for wake_up, sleep, and session_details.

Handlers to Add:

updateWakeUpMetrics(actualTime, onTime, reason): Modifies the current day's wake-up tracking node.

updateSleepMetrics(actualTime, timingType, reason): Modifies the bedtime/night reflection node.

updateBlockQualitativeData(blockId, goalAchieved, notes): Updates the specific key inside the session_details map for the selected block.

Database Sync Integration:

Update the internal save routine inside your context to include these new fields when pushing the local daily state to Firestore (setDoc with { merge: true }).

Step 3: UI Component Enhancements

Integrate your tracking panels directly into your chronological layout so that inputs feel intuitive and flow chronologically.

1. Timeline Head and Tail Components (ProtocolList.jsx)

Your chronological timeline currently maps over blocks. You should anchor the new checks at the top and bottom of this list:

Timeline Header (Wake-Up): Place this directly above the timeline. Render a simple morning dashboard containing input fields for target wake time vs. actual wake time. If on_time evaluates to false, dynamically slide open a textarea to log the reason.

Timeline Footer (Sleep-Check): Place this directly below the timeline. When completing the final routine block, render a "Sunset Sleep Check" asking for bedtime, a dropdown selection for schedule evaluation (Early/On-time/Late), and a reflection textarea.

2. Qualitative Block Adjustments (ProtocolItem.jsx or FocusHub.jsx)

Incorporate goals and notes inside either your timeline block layout or your active timer completion screen:

Render a minimalist toggle: [ Achieved Goals: Yes / No ].

Underneath the toggle, display a compact textarea: "Did you do anything meaningful during this block?"

Pass these values back to your global state handler updateBlockQualitativeData on change.

Step 4: Secure Dynamic AI Agent Implementation

Because NeuroFlow is designed to run securely on static platforms like GitHub Pages, the RAG (Retrieval-Augmented Generation) pipeline must operate entirely in the client-side runtime environment.

[UI Trigger] ──> Fetch past 14 days of Daily Logs ──> Retrieve Gemini Key from Context
                                                               │
                                                               ▼
[Generate Feed] <── Direct Fetch Call over HTTPS <── Send Logs + Prompt to Gemini


1. Context Bundler

Create a utility function inside your application to fetch and serialize your historical study trends:

Query the user's daily_logs sub-collection, sorting the documents chronologically by date.

Isolate and take the last 14 completed documents.

Format this history into a compact JSON array containing target completion ratios, wake-up trends, slept-late logs, and qualitative block comments.

2. Safe API Gateway Call (Exponential Backoff)

Instead of importing heavy SDKs, implement a lightweight fetch function that communicates directly with Google's public developer endpoint:

[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=$){userApiKey}


Retry Guardrail: Program the fetch wrapper with exponential backoff retries (up to 5 attempts, doubling the delay: 1s, 2s, 4s, 8s, 16s) to ensure smooth operations on fluctuating cellular networks.

3. Prompt System Formulation

When sending the payload to the Gemini API, supply the system instruction to structure the RAG model's output. Enforce the exact five distinct Markdown sections you requested:

Daily Validation & Encouragement: Acknowledge consistency, focus durations, and streaks.

Next-Day Study Recommendations: Detail logical tomorrow-goals based on subjects skipped today.

Daily Progress Breakdown: An objective summary of hours spent vs. target hours.

Insults & Reality Check: Deliver a blunt, sarcastic roast analyzing recurring excuses, bedtime slip-ups, and late wake-up patterns.

Habit Strategy: Present an actionable micro-habit shift to prevent failure loops.

Step 5: Secure Vault Config Panel (SyncModal.jsx or Settings Panel)

To allow key portability without ever writing secrets into your GitHub source code:

Add a Secret Vault Configuration subsection to your settings or sync modal.

Create an <input type="password"> field for the Gemini Developer API Key.

On form submission, write this key directly to the user's secure private settings document: /neuroflow-minimal/{userId}/settings/user_settings.

On app initialization, retrieve this key in your authentication state change listener (onAuthStateChanged) and set it to a secure, local React state. This makes your custom AI coach instantly accessible from any mobile or desktop web browser.