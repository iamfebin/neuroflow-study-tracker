import React, { useState, useEffect } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';

export default function BlockModal({ isOpen, onClose, blockToEdit }) {
  const { addBlock, editBlock, deleteBlock } = useNeuroFlow();

  const [name, setName] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [type, setType] = useState("study");
  const [subject, setSubject] = useState("german");
  const [format, setFormat] = useState("Pomodoro");

  useEffect(() => {
    if (blockToEdit) {
      setName(blockToEdit.name || "");
      setStart(blockToEdit.start || "08:00");
      setEnd(blockToEdit.end || "09:00");
      setType(blockToEdit.type || "study");
      setSubject(blockToEdit.key || "german");
      setFormat(blockToEdit.format || "Pomodoro");
    } else {
      setName("");
      setStart("08:00");
      setEnd("09:00");
      setType("study");
      setSubject("german");
      setFormat("Pomodoro");
    }
  }, [blockToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter a block name.");
      return;
    }

    const payload = {
      name: name.trim(),
      start,
      end,
      type,
      ...(type === 'study' ? { key: subject, format } : { format: 'Recovery' })
    };

    if (blockToEdit) {
      editBlock(blockToEdit.id, payload);
    } else {
      const newId = `${type}_block_${Date.now()}`;
      addBlock({ id: newId, ...payload });
    }
    onClose();
  };

  const handleDelete = () => {
    if (blockToEdit && window.confirm(`Are you sure you want to delete "${blockToEdit.name}"?`)) {
      deleteBlock(blockToEdit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-mono-900 border border-mono-800 rounded-lg p-6 shadow-2xl relative animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-mono-500 hover:text-white transition-colors"
        >
          ✕
        </button>

        <h2 className="text-xs font-bold text-white mb-5 uppercase tracking-widest">
          {blockToEdit ? 'Edit Schedule Block' : 'Add Schedule Block'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Block Name */}
          <div>
            <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
              Block Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SQL Applied, Afternoon Jog"
              className="w-full bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white font-sans"
            />
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                Start Time
              </label>
              <input
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                End Time
              </label>
              <input
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white font-mono"
              />
            </div>
          </div>

          {/* Block Type selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                Block Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white uppercase font-bold tracking-wide"
              >
                <option value="study">Study Focus</option>
                <option value="rest">Rest / Restorative</option>
              </select>
            </div>

            {/* Timer Format or Recovery Format display */}
            {type === 'study' ? (
              <div>
                <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                  Timer Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-black border border-mono-700 text-xs p-2 rounded focus:outline-none focus:border-mono-500 text-white uppercase font-bold tracking-wide"
                >
                  <option value="Pomodoro">Pomodoro</option>
                  <option value="Flowtime">Flowtime</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                  Break Format
                </label>
                <input
                  type="text"
                  disabled
                  value="Recovery / Rest"
                  className="w-full bg-mono-800 border border-mono-800 text-mono-500 text-xs p-2 rounded cursor-not-allowed font-semibold"
                />
              </div>
            )}
          </div>

          {/* Subject key selection (if type is study) */}
          {type === 'study' && (
            <div>
              <label className="block text-[10px] font-bold text-mono-400 mb-1 uppercase tracking-wider">
                Focus Subject
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['german', 'sql', 'python'].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubject(sub)}
                    className={`py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      subject === sub
                        ? 'bg-white text-black border-white'
                        : 'bg-black text-mono-400 border-mono-700 hover:border-mono-500'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-mono-800/60 mt-4">
            {blockToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 bg-red-950/20 text-red-500 font-bold border border-red-900/40 hover:bg-red-900/30 rounded text-xs transition"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              className="flex-grow px-3 py-2 bg-white text-black font-bold rounded text-xs hover:bg-mono-200 transition"
            >
              {blockToEdit ? 'Save Changes' : 'Create Block'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-black border border-mono-700 text-mono-400 hover:text-white rounded text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
