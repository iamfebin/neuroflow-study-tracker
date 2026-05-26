import React, { useState, useEffect } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function SyncModal({ isOpen, onClose }) {
  const {
    firebaseConfigStr,
    handleConnectFirebase,
    handleDisconnectFirebase,
    resetAllData,
    isFirebaseConnected
  } = useNeuroFlow();

  const [configInput, setConfigInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sync state config input from context cache
  useEffect(() => {
    if (firebaseConfigStr) {
      setConfigInput(firebaseConfigStr);
    }
  }, [firebaseConfigStr]);

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

          {/* Footer Reset Storage Actions */}
          <div className="pt-4 border-t border-mono-800 flex justify-between items-center mt-4">
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
