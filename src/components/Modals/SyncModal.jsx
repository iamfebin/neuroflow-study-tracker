import React, { useState, useEffect } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function SyncModal({ isOpen, onClose }) {
  const {
    firebaseConfigStr,
    handleConnectFirebase,
    handleDisconnectFirebase,
    resetAllData,
    isFirebaseConnected,
    userSettings,
    updateGeminiApiKey,
    isOfflineSandbox,
    exitSandbox,
    clearAllCloudData,
    clearDataDateRange,
    clearSpecificDates
  } = useNeuroFlow();

  const [configInput, setConfigInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [isCleansingOpen, setIsCleansingOpen] = useState(false);

  // Sync state config input from context cache
  useEffect(() => {
    if (firebaseConfigStr) {
      setConfigInput(firebaseConfigStr);
    }
  }, [firebaseConfigStr]);

  // Sync gemini key state when user settings are loaded
  useEffect(() => {
    if (userSettings?.gemini_api_key) {
      setGeminiKeyInput(userSettings.gemini_api_key);
    }
  }, [userSettings?.gemini_api_key]);

  if (!isOpen) return null;

  const handleAction = async (mode) => {
    await handleConnectFirebase(configInput, email, password, mode);
    if (isFirebaseConnected) {
      onClose();
    }
  };

  const handleDisconnect = async () => {
    await handleDisconnectFirebase();
    setEmail("");
    setPassword("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-mono-900 border border-mono-700 rounded-lg p-6 shadow-2xl relative">
        {/* Close Modal Trigger */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-mono-500 hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">
          Firebase Sync
        </h2>

        <div className="space-y-4">
          {/* JSON Credentials Config input */}
          <div>
            <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase">
              Firebase JSON Config
            </label>
            <textarea
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              rows="4"
              className="w-full bg-black border border-mono-700 rounded p-2 text-xs font-mono text-mono-300 focus:outline-none focus:border-mono-500"
              placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
            />
          </div>

          {/* Email / Password Sign-in credentials */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white"
            />
          </div>

          {/* Cloud Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              onClick={() => handleAction('signin')}
              className="flex-grow px-3 py-2 bg-white text-black font-bold rounded text-xs hover:bg-mono-200 transition"
            >
              Sign In
            </button>
            <button
              onClick={() => handleAction('register')}
              className="flex-grow px-3 py-2 bg-mono-800 text-white font-bold rounded text-xs border border-mono-700 hover:bg-mono-700 transition"
            >
              Register
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-2 bg-black border border-mono-700 text-mono-400 hover:text-white rounded text-xs transition"
            >
              Disconnect
            </button>
          </div>

          {/* Secret Vault Configuration Subsection */}
          <div className="pt-4 border-t border-mono-800 space-y-3 mt-4 text-left">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider">
              Secret Vault Configuration
            </h3>
            <div>
              <label className="block text-[9px] font-mono text-mono-500 mb-1 uppercase">
                Gemini Developer API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="flex-grow bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
                />
                <button
                  onClick={() => updateGeminiApiKey(geminiKeyInput)}
                  className="px-3 py-2 bg-white text-black font-bold rounded text-xs hover:bg-mono-200 transition uppercase tracking-wide font-mono"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Data Cleansing Portal Subsection */}
          <div className="pt-4 border-t border-mono-800 space-y-3 mt-4 text-left font-mono">
            <button
              type="button"
              onClick={() => setIsCleansingOpen(prev => !prev)}
              className="flex justify-between items-center w-full text-[10px] font-bold text-white uppercase tracking-wider focus:outline-none"
            >
              <span>Data Cleansing Portal</span>
              <span>{isCleansingOpen ? "▲" : "▼"}</span>
            </button>
            
            {isCleansingOpen && (
              <div className="space-y-4 animate-fadeIn pt-1">
                {/* Erase Specific Date */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] text-mono-500 uppercase font-bold">
                    Erase Specific Day
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                      className="flex-grow bg-black border border-mono-700 text-xs p-1.5 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!specificDate) return;
                        if (confirm(`Are you sure you want to permanently delete records for ${specificDate}?`)) {
                          clearSpecificDates([specificDate]);
                          setSpecificDate("");
                        }
                      }}
                      className="px-3 py-1.5 bg-black border border-mono-700 text-red-500 font-bold rounded text-[9px] hover:bg-red-950/20 transition uppercase font-mono"
                    >
                      Erase Day
                    </button>
                  </div>
                </div>

                {/* Erase Date Range */}
                <div className="space-y-1.5 border-t border-mono-850 pt-3">
                  <label className="block text-[9px] text-mono-500 uppercase font-bold">
                    Erase Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[8px] text-mono-600 block uppercase">Start</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-black border border-mono-700 text-xs p-1.5 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] text-mono-600 block uppercase">End</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-black border border-mono-700 text-xs p-1.5 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!startDate || !endDate) return;
                      if (confirm(`Are you sure you want to permanently delete all records between ${startDate} and ${endDate}?`)) {
                        clearDataDateRange(startDate, endDate);
                        setStartDate("");
                        setEndDate("");
                      }
                    }}
                    className="w-full mt-1.5 py-1.5 bg-black border border-mono-700 text-red-500 font-bold rounded text-[9px] hover:bg-red-950/20 transition uppercase tracking-wide font-mono text-center block"
                  >
                    Erase Date Range
                  </button>
                </div>

                {/* Erase All Cloud & Local Records */}
                <div className="border-t border-mono-850 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("WARNING: This will permanently delete all cloud settings, cumulative baseline profiles, and all local daily logs. THIS ACTION IS DESTRUCTIVE AND CANNOT BE UNDONE.\n\nType 'DELETE' to confirm:")) {
                        const check = prompt("Type 'DELETE' to confirm permanent purge:");
                        if (check === "DELETE") {
                          clearAllCloudData();
                        } else {
                          alert("Deletion aborted.");
                        }
                      }
                    }}
                    className="w-full py-2 bg-red-950/10 border border-red-900/40 text-red-400 hover:bg-red-950/20 font-bold rounded text-[10px] uppercase transition tracking-wide font-mono text-center block"
                  >
                    Purge Cloud & Local Storage
                  </button>
                </div>
              </div>
            )}
          </div>

          {isOfflineSandbox && (
            <div className="bg-black/45 border border-mono-800 rounded p-4 space-y-2 mt-4 text-left animate-fadeIn">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider block font-mono">Local Offline Sandbox</span>
              <p className="text-[9px] text-mono-500 font-mono leading-relaxed">
                You are currently running in local storage sandbox mode. Data is stored strictly on this device.
              </p>
              <button
                type="button"
                onClick={() => {
                  exitSandbox();
                  onClose();
                }}
                className="w-full py-2 bg-mono-800 text-white font-bold rounded text-xs uppercase hover:bg-mono-750 transition tracking-wide font-mono"
              >
                Exit Sandbox & Sign In
              </button>
            </div>
          )}

          {/* Footer Reset Storage Actions */}
          <div className="pt-4 border-t border-mono-800 flex justify-between items-center mt-4 font-mono">
            <span className="text-[10px] text-mono-500">v2.0 Monochrome Minimal</span>
            <button
              onClick={resetAllData}
              className="text-[10px] text-red-500 hover:underline"
            >
              Erase Local Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
