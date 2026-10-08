import React, { useState } from 'react';
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import type { BackendVendorItem } from '../../api/client';

interface DeleteVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  vendor?: BackendVendorItem | null;
}

export const DeleteVendorModal: React.FC<DeleteVendorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  vendor,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const isSingle = Boolean(vendor);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const ok = await onConfirm();
      if (ok) onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-2xl shadow-2xl overflow-hidden select-text transition-colors flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between bg-slate-50 dark:bg-dark-950">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
            <Trash2 className="w-4 h-4 pointer-events-none" />
            <span>{isSingle ? 'Delete Carrier Partner' : 'Clean All Carrier Data'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
            <div className="space-y-1">
              <p className="font-semibold">
                {isSingle
                  ? `Delete ${vendor?.name || 'this carrier'}?`
                  : 'Permanently wipe all carrier records?'}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {isSingle
                  ? `This will remove ${vendor?.name} (${vendor?.phone}) and all their associated route quotes from the SQLite database.`
                  : 'This will delete all registered carriers and associated route offers from SQLite. This cannot be undone.'}
              </p>
            </div>
          </div>

          {isSingle && vendor && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-950/60 border border-slate-200 dark:border-dark-800 text-xs space-y-1 font-mono text-slate-700 dark:text-slate-300">
              <div><strong>Name:</strong> {vendor.name}</div>
              {vendor.company && <div><strong>Company:</strong> {vendor.company}</div>}
              <div><strong>Phone:</strong> {vendor.phone}</div>
              <div><strong>Offers:</strong> {vendor.offersCount}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-800 flex items-center justify-end gap-2.5 bg-slate-50 dark:bg-dark-950">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn btn-secondary btn-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSingle ? 'Delete Carrier' : 'Delete All Data'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
