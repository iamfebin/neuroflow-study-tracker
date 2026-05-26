import React, { useEffect, useState } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

function ToastItem({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger transition immediately after mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const baseClass = "px-4 py-2 rounded text-xs font-medium shadow-lg transform transition-all duration-300 pointer-events-auto border";
  
  // Monochromatic themes
  const themeClass = toast.type === 'error'
    ? "bg-mono-800 border-mono-600 text-white"
    : "bg-white border-white text-black font-semibold";

  const animateClass = visible
    ? "translate-y-0 opacity-100"
    : "translate-y-4 opacity-0";

  return (
    <div className={`${baseClass} ${themeClass} ${animateClass}`}>
      {toast.msg}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useNeuroFlow();

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-50 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
