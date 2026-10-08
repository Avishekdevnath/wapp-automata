import React from 'react';
import { Trash2 } from 'lucide-react';

interface StreamClearanceCardProps {
  onOpenDeleteStreamModal: () => void;
}

export const StreamClearanceCard: React.FC<StreamClearanceCardProps> = ({
  onOpenDeleteStreamModal,
}) => {
  return (
    <div className="glass-card p-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 shadow-md dark:shadow-xl space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-rose-900 dark:text-rose-300 leading-tight">
                Emergency Stream Clearance
              </h3>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
                Delete raw messages from live stream without clearing database
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            In-Memory
          </span>
        </div>

        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          Permanently clear captured raw WhatsApp messages from the active feed view without resetting the
          WhatsApp connection, session credentials, or SQLite database structure.
        </p>
      </div>

      <div className="pt-2">
        <button
          onClick={onOpenDeleteStreamModal}
          className="btn btn-danger btn-sm text-xs font-semibold flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Live WhatsApp Messages</span>
        </button>
      </div>
    </div>
  );
};
