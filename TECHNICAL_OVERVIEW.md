# NeuroFlow Study Tracker: Technical Specification and Overview

## 1. Project Overview
**NeuroFlow** is a study tracker and cognitive routine tracking application designed to help users structure their daily activities, manage focus periods, and maintain study targets. The application enforces a dual-focus curriculum—balancing language acquisition (German) with technical skills (SQL/Python)—within a structured daily protocol schedule. 

### Core Objectives
*   **Dual-Focus Protocol:** Track daily focus goals of 5 hours (300 minutes) for German language learning and 4 hours (240 minutes) for technical skills (SQL and Python).
*   **Dynamic Time Allocation:** Balance Pomodoro and Flowtime timer formats to accommodate structured intervals (50 minutes focus / 10 minutes break) or open-ended focus sessions.
*   **Routine Tracking & Adjustments:** Facilitate chronological schedule management, in-place subject swapping, manual or automatic block splitting, and drag-and-drop chronological reordering.
*   **System Simulation Mode:** Allow full dry-running of daily schedules and logs using simulated system clocks to verify protocol transitions, alerts, and streak metrics across days.

---

## 2. Complete Tech Stack
The application is built entirely with a decoupled, static frontend architecture optimized for low-latency updates and serverless data synchronization.

*   **Core UI Library:** React 19 (`react` v19.2.6, `react-dom` v19.2.6) leveraging functional components, state hooks (`useState`, `useRef`), performance hooks (`useCallback`, `useEffect`), and Context API (`NeuroFlowContext`).
*   **Build Tool & Dev Server:** Vite 8 (`vite` v8.0.12) configured for Hot Module Replacement (HMR) and ES modules compilation.
*   **Styling Engine:** TailwindCSS v3.4 (`tailwindcss` v3.4.19) with PostCSS (`postcss` v8.5.15) and Autoprefixer (`autoprefixer` v10.5.0) for a responsive, monochromatic dark-theme grid system.
*   **Database & Sync Engine:** Firebase Client SDK v12.13.0, specifically utilizing:
    *   **Cloud Firestore:** Real-time Document and collection streams.
    *   **Firebase Authentication:** Email and password registration, authentication state listeners, and secure data scoping.
*   **Hosting:** Configured for high-speed static hosting platforms (such as GitHub Pages or Vercel). The app separates code hosting from database credentials by dynamically loading user-supplied Firebase config JSON files.

---

## 3. Feature Roadmap & Current Architecture

### Current Architecture
The application runs around a central React Context (`NeuroFlowContext.jsx`) which functions as the global state orchestrator. Sub-components communicate via custom hooks to read reactive parameters or dispatch routine updates.

```mermaid
graph TD
    App[App.jsx] --> Provider[NeuroFlowProvider]
    Provider --> FirebaseSvc[firebase.js Services]
    Provider --> LocalStorage[Local Storage Fallbacks]
    
    Provider -.-> ContextState[Global State: Settings, Daily Logs, Timers]
    
    subgraph UI Components
        Header[Header.jsx]
        Banner[CatchupBanner.jsx]
        ProtocolList[ProtocolList.jsx]
        FocusHub[FocusHub.jsx]
        Dashboard[DashboardPanel.jsx]
    end
    
    ProtocolList --> ProtocolItem[ProtocolItem.jsx]
    Dashboard --> Heatmap[CalendarHeatmap.jsx]
    Dashboard --> Streak[StreakTracker.jsx]
    Dashboard --> Chart[SubjectBarChart.jsx]
    
    UI Components --- ContextState
```

### Existing Features
1.  **Chronological Protocol Timeline:** Displays a chronological vertical schedule. Users can:
    *   Reorder blocks up and down (which swaps start/end times automatically to maintain schedule continuity).
    *   Swap study subjects directly from a dropdown context.
    *   Mark/unmark blocks as completed, which automatically credits corresponding focus minutes.
    *   Add, edit, or delete blocks, which triggers proportional study credit adjustments.
2.  **Focus Hub (Multi-Mode Timer):** Includes a monochromatic SV-graphical countdown clock.
    *   *Pomodoro Mode:* Enforces a 50-minute countdown followed by a 10-minute restorative "Diffuse Mode" screen.
    *   *Flowtime Mode:* Functions as a progressive stopwatch that tracks focus minutes with no upper limit.
    *   *Dynamic Session Splitting:* Allows splitting the active block at the current system/simulated time, partitioning the remaining block and allocating accrued timer minutes proportionally.
    *   *Manual Session Splitting:* Prompts users for a custom `HH:MM` split target between the start and end boundaries of a block.
3.  **Insights Panel & Streak Tracker:**
    *   Provides high-resolution streak calculation based on the completion of daily target focus minutes.
    *   Displays a dynamic SVG Calendar Heatmap tracking longitudinal consistency.
    *   Implements customizable focus target settings (e.g., sliding goals) with a breakdown of SQL, Python, and German ratios using minimalist charts.
4.  **Flexible Firebase Synchronizer:** Connects to cloud infrastructure dynamically. The user pastes their Firebase config JSON and signs in. If connection fails, the app falls back seamlessly to `localStorage`.

---

## 4. Database Schema
Firestore is structured around a single collection to maintain scalability and enforce user isolation. The collection paths are derived from the root `APP_ID` (`neuroflow-minimal`).

### Collection Architecture

```
neuroflow-minimal/ (Root Collection)
  └── {userId}/ (Document representing individual user UID)
        ├── settings/ (Sub-collection)
        │     └── user_settings (Document containing user goals & study parameters)
        └── daily_logs/ (Sub-collection)
              └── {YYYY-MM-DD} (Document containing logs & schedule details for each date)
```

### Document Specifications

#### 1. User Settings Document
*   **Path:** `neuroflow-minimal/{userId}/settings/user_settings`
*   **Fields:**
    *   `saved_focus_mins` (Map): Focus minutes totals cached globally for user.
        *   `german` (Number): Total accumulated German study minutes.
        *   `sql` (Number): Total accumulated SQL study minutes.
        *   `python` (Number): Total accumulated Python study minutes.
    *   `daily_goal_mins` (Number): The daily focus requirement in minutes. Default is `240` (4 hours).

```json
{
  "saved_focus_mins": {
    "german": 1200,
    "sql": 480,
    "python": 360
  },
  "daily_goal_mins": 240
}
```

#### 2. Daily Log Document
*   **Path:** `neuroflow-minimal/{userId}/daily_logs/{YYYY-MM-DD}`
*   **Fields:**
    *   `completed_blocks` (Array of Strings): Identifiers of all blocks marked or timed as complete on this day.
    *   `manual_credited_mins` (Map of Numbers): Manual minutes credited for each block ID (keyed by block ID string).
    *   `timer_logged_mins` (Map of Numbers): Timer-accrued focus minutes for each block ID (keyed by block ID string).
    *   `custom_block_subjects` (Map of Strings): Custom overridden subjects mapped to specific block IDs (e.g. `{"study_block_1": "python"}`).
    *   `custom_schedule` (Array of Objects): The complete daily timeline. Each block object contains:
        *   `id` (String): Unique identifier.
        *   `name` (String): Display name of the block.
        *   `start` (String): Start time in HH:MM.
        *   `end` (String): End time in HH:MM.
        *   `type` (String): `'study'` or `'rest'`.
        *   `key` (String, optional): `'german'`, `'sql'`, or `'python'`.
        *   `format` (String): `'Pomodoro'`, `'Flowtime'`, or `'Recovery'`.

```json
{
  "completed_blocks": ["wake_prep", "sql_block_1", "german_block_1"],
  "manual_credited_mins": {
    "sql_block_1": 60
  },
  "timer_logged_mins": {
    "german_block_1": 120
  },
  "custom_block_subjects": {
    "sql_block_1": "python"
  },
  "custom_schedule": [
    {
      "id": "wake_prep",
      "name": "Wake & Prep",
      "start": "07:00",
      "end": "08:00",
      "type": "rest",
      "format": "Recovery"
    },
    {
      "id": "sql_block_1",
      "name": "SQL Focus 1",
      "start": "08:00",
      "end": "10:30",
      "type": "study",
      "key": "sql",
      "format": "Pomodoro"
    }
  ]
}
```

---

### AI Integration & Embeddings Future-Proofing
To prepare the database for cognitive analyses, progress indexing, or semantic AI recommendations, the Firestore schema can be extended directly within the `daily_logs` document structure.

#### Proposed Extension Schema for Notes and Text Logs
Add a `session_details` Map to the Daily Log document to record qualitative data:

```json
{
  "session_details": {
    "german_block_1": {
      "note_text": "Completed active German grammar practice focusing on prepositional relative clauses. Found the accusative/dative shifts difficult but improved speed by the end of the second Pomodoro.",
      "focus_rating": 4,
      "distraction_frequency": "low",
      "mental_fatigue": 2,
      "last_updated": "2026-05-30T13:00:00Z"
    }
  }
}
```

#### Vector Embeddings Representation
To run semantic search, sentiment classification, or clustering on user journals:
1.  Add a `vector_embeddings` sub-collection or fields nested inside `session_details` documents.
2.  Maintain a `vector` array of high-dimensional numbers (e.g., 1536 float elements if using standard LLM embedding models):

```json
{
  "session_details": {
    "german_block_1": {
      "note_text": "...",
      "vector_embedding": [
        0.00241, -0.01524, 0.08420, -0.00392, 0.02103
      ]
    }
  }
}
```

3.  **Pipeline Implementation:** A Firestore Cloud Trigger (Cloud Function) fires on changes to `session_details.*.note_text`. It requests a vector embedding from Google Vertex AI or a similar API, and updates the `vector_embedding` field back in the user's daily log document in Firestore.

---

## 5. Security Configuration

### Security Risks in Public Repositories (GitHub Pages)
Hosting the application publicly on GitHub Pages exposes client-side source code, configuration methods, and dependencies. If database credentials or administrative security rules are exposed, an attacker could access, modify, or delete the database unless strict server-side access controls are enforced.

### Security Architecture

```
                                  [ PUBLIC INTERNET ]
                                           │
                                  GitHub Pages Hosting
                            (Exposes Client Code and Scripts)
                                           │
                  ┌────────────────────────┴────────────────────────┐
                  ▼                                                 ▼
        User Configures Client                            Client Direct Connection
        (Enters Firebase JSON)                           (Attempts Auth and Data Sync)
                  │                                                 │
                  ▼                                                 ▼
          Firebase Auth Engine                              Cloud Firestore Engine
         (Isolates users by UID)                        (Enforces Server-Side Rules)
                  │                                                 │
                  └────────────────────────┬────────────────────────┘
                                           ▼
                                 [ FIRESTORE DOCUMENTS ]
                         allow read, write: if request.auth != null 
                             && request.auth.uid == userId;
```

To secure this architecture, NeuroFlow combines three key mechanisms:

#### 1. Decoupled Credentials Strategy
*   Firebase keys are never checked into git.
*   Client code initializes Firebase dynamically using configuration JSONs provided inside the UI (`SyncModal.jsx`).
*   Config credentials are saved only to the user's browser `localStorage`, bypassing standard server repository threats.

#### 2. User Authentication Scoping
*   Authentication is handled using Firebase Auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`).
*   Every CRUD request sent to Cloud Firestore is stamped with the verified user's unique `uid` (`request.auth.uid`).

#### 3. Firestore Security Rules
Access is gated at the database layer using strict Firestore Security Rules. Rules are configured to check that the path variables match the user's verified token before granting read or write permissions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Scopes permissions strictly to the authenticated user's individual directory path
    match /neuroflow-minimal/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Explicitly denys access to root configurations or other users' collections
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

*   **Authentication Check (`request.auth != null`):** Blocks all unauthenticated public clients from querying the database.
*   **Authorization Lock (`request.auth.uid == userId`):** Evaluates if the `userId` parent namespace in Firestore matches the user's validated auth credentials. Users can never list, read, update, or delete other users' documents.
