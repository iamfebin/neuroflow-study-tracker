import React, { useState, useEffect } from 'react';
import { useNeuroFlow } from '../context/NeuroFlowContext';

export default function Gatekeeper() {
  const { handleConnectFirebase, bypassToSandbox, showToast } = useNeuroFlow();
  const [view, setView] = useState("signin"); // 'signin' or 'register'
  
  // State variables
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firebaseConfig, setFirebaseConfig] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [authStep, setAuthStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isSandboxPreferred, setIsSandboxPreferred] = useState(false);

  // Check if config exists in localStorage to determine if we hide configuration inputs by default
  const hasCachedConfig = !!localStorage.getItem('neuroflow-minimal_firebase_config');

  useEffect(() => {
    const cached = localStorage.getItem('neuroflow-minimal_firebase_config');
    if (cached) {
      setFirebaseConfig(cached);
    }
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (isSandboxPreferred) {
      bypassToSandbox();
      return;
    }

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    let configToUse = firebaseConfig;
    if (!hasCachedConfig && !configToUse) {
      setErrorMessage("Firebase JSON configuration is required to establish cloud sync. Alternatively, toggle offline memory.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setAuthStep("Initializing connection...");

    try {
      setAuthStep("Authenticating credentials...");
      await handleConnectFirebase(configToUse, email, password, "signin");
    } catch (err) {
      setErrorMessage(err.message || "Failed to unlock dashboard. Please check your config and credentials.");
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Email and Password are required fields.");
      return;
    }

    if (!firebaseConfig) {
      setErrorMessage("Firebase JSON configuration is required to register and setup sync.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    
    try {
      setAuthStep("Establishing secure connection...");
      setAuthStep("Provisioning cloud profile credentials...");
      await handleConnectFirebase(firebaseConfig, email, password, "register", geminiKey);
      setAuthStep("Ready");
    } catch (err) {
      setErrorMessage(err.message || "Failed to complete account registration. Double-check your JSON format.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle floating glow overlay */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-mono-900/10 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-mono-900/40 border border-mono-800 rounded-lg p-8 shadow-2xl relative backdrop-blur-md animate-fadeIn z-10 text-left">
        
        {/* Monochromatic Logo Header */}
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-black font-light text-xl tracking-tighter mb-3 shadow-md">
            NF
          </div>
          <h1 className="text-sm font-bold uppercase tracking-widest text-white">NeuroFlow Gatekeeper</h1>
          <p className="text-[10px] font-mono text-mono-500 mt-1 uppercase">Secure Auth & Sandbox Gateway</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-900/40 rounded text-red-400 text-xs font-mono leading-relaxed transition-all duration-300">
            {errorMessage}
          </div>
        )}

        {/* LOADING PROGRESS SEQUENCE OVERLAY */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-fadeIn">
            <div className="w-10 h-10 rounded-full border-2 border-mono-800 border-t-white animate-spin" />
            <div className="text-center space-y-1">
              <span className="text-xs font-mono text-white block uppercase tracking-wider">
                Unlocking Vault
              </span>
              <span className="text-[9px] font-mono text-mono-450 uppercase animate-pulse block">
                {authStep}
              </span>
            </div>
          </div>
        ) : (
          /* AUTH FORMS */
          view === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Email Address</label>
                <input
                  type="email"
                  required={!isSandboxPreferred}
                  disabled={isSandboxPreferred}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full bg-black border border-mono-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-mono-500 disabled:opacity-20 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Secret Password</label>
                <input
                  type="password"
                  required={!isSandboxPreferred}
                  disabled={isSandboxPreferred}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black border border-mono-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-mono-500 disabled:opacity-20 transition"
                />
              </div>

              {/* COLLAPSIBLE CLOUD CONFIG FOR SIGN IN */}
              {!hasCachedConfig && (
                <div className="border border-mono-850 rounded bg-black/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowConfig(!showConfig)}
                      className="text-[9px] font-mono uppercase font-bold text-mono-400 hover:text-white transition flex items-center gap-1 focus:outline-none"
                    >
                      <span className={`transform transition-transform ${showConfig ? 'rotate-90' : ''}`}>▶</span>
                      Firebase Connection Setup
                    </button>
                    <span className="text-[8px] font-mono text-mono-500 uppercase">Required for cloud</span>
                  </div>

                  {showConfig && !isSandboxPreferred && (
                    <div className="space-y-1.5 pt-2 animate-fadeIn">
                      <textarea
                        rows="4"
                        value={firebaseConfig}
                        onChange={(e) => setFirebaseConfig(e.target.value)}
                        placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
                        className="w-full bg-black border border-mono-850 rounded p-2 text-[10px] font-mono text-mono-300 focus:outline-none focus:border-mono-600"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* OFFLINE SANDBOX PREFERENCE TOGGLE */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sandbox"
                  checked={isSandboxPreferred}
                  onChange={(e) => setIsSandboxPreferred(e.target.checked)}
                  className="rounded border-mono-800 bg-black text-white focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                />
                <label htmlFor="sandbox" className="text-[10px] font-mono text-mono-400 uppercase tracking-wide cursor-pointer hover:text-white transition">
                  I want to use local offline memory instead
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-white text-black font-bold rounded text-xs uppercase tracking-widest hover:bg-mono-200 transition shadow-md font-mono"
                >
                  {isSandboxPreferred ? "Launch Offline Sandbox" : "Unlock NeuroFlow"}
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setView("register"); setErrorMessage(""); }}
                  className="text-[9px] uppercase font-bold text-mono-450 hover:text-white transition tracking-wider"
                >
                  New to NeuroFlow? Create an Account
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER ACCOUNT FORM */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full bg-black border border-mono-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-mono-500 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Secure Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black border border-mono-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-mono-500 transition"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Firebase JSON Config *</label>
                  <span className="text-[8px] font-mono text-mono-500">Required</span>
                </div>
                <textarea
                  rows="4"
                  required
                  value={firebaseConfig}
                  onChange={(e) => setFirebaseConfig(e.target.value)}
                  placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
                  className="w-full bg-black border border-mono-800 rounded p-2 text-[10px] font-mono text-mono-300 focus:outline-none focus:border-mono-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="text-[9px] uppercase font-bold text-mono-400 font-mono">Gemini Developer API Key</label>
                  <span className="text-[8px] font-mono text-mono-500">Optional but recommended</span>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black border border-mono-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-mono-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-white text-black font-bold rounded text-xs uppercase tracking-widest hover:bg-mono-200 transition shadow-md font-mono"
                >
                  Register & Initialize
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setView("signin"); setErrorMessage(""); }}
                  className="text-[9px] uppercase font-bold text-mono-450 hover:text-white transition tracking-wider"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          )
        )}
      </div>

      <span className="absolute bottom-4 text-[9px] font-mono text-mono-600 uppercase tracking-widest">
        NeuroFlow v2.5.0 Monochromatic Security Shield
      </span>
    </div>
  );
}
