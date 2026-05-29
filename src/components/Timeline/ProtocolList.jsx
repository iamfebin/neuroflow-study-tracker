import React, { useState } from 'react';
import { useNeuroFlow } from '../../context/NeuroFlowContext';
import ProtocolItem from './ProtocolItem';
import BlockModal from '../Modals/BlockModal';

export default function ProtocolList() {
  const {
    protocolSchedule,
    isTimeSimulated,
    toggleTimeMode,
    applySimulatedTime
  } = useNeuroFlow();

  const [inputSimTime, setInputSimTime] = useState("08:00");
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockToEdit, setBlockToEdit] = useState(null);

  const handleApplySimTime = (e) => {
    e.preventDefault();
    applySimulatedTime(inputSimTime);
  };

  const handleOpenAddModal = () => {
    setBlockToEdit(null);
    setIsBlockModalOpen(true);
  };

  const handleOpenEditModal = (block) => {
    setBlockToEdit(block);
    setIsBlockModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Title & Toggle Sim Button */}
      <div className="flex items-center justify-between border-b border-mono-800 pb-2 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-mono-400">Daily Protocol</h2>
          <button
            onClick={handleOpenAddModal}
            className="text-[9px] font-mono px-2 py-0.5 rounded border border-mono-750 bg-black text-mono-400 hover:text-white hover:border-white transition uppercase font-bold"
          >
            + Add Block
          </button>
        </div>
        <button
          onClick={toggleTimeMode}
          className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
            isTimeSimulated
              ? 'bg-white text-black font-bold border-white'
              : 'bg-mono-800 text-mono-300 border-mono-700 hover:bg-mono-700'
          }`}
        >
          {isTimeSimulated ? 'SIMULATED' : 'SYS.CLOCK'}
        </button>
      </div>

      {/* Sim Clock Setting Panel */}
      {isTimeSimulated && (
        <div className="flex flex-col gap-2 mb-4 p-3 border border-mono-800 rounded bg-mono-900">
          <label className="text-[10px] uppercase text-mono-500 font-bold">Simulate Time</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={inputSimTime}
              onChange={(e) => setInputSimTime(e.target.value)}
              className="bg-black border border-mono-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-mono-500 w-full"
            />
            <button
              onClick={handleApplySimTime}
              className="px-3 py-1 bg-white text-black font-bold rounded text-xs hover:bg-mono-200 transition"
            >
              SET
            </button>
          </div>
        </div>
      )}

      {/* Timeline Scrollable Stack */}
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
        {protocolSchedule.map((block) => (
          <ProtocolItem key={block.id} block={block} onEditBlock={handleOpenEditModal} />
        ))}
      </div>

      {/* Global Block Modal (Add & Edit) */}
      <BlockModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        blockToEdit={blockToEdit}
      />
    </div>
  );
}
