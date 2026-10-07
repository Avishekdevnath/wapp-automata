import React, { useState } from 'react';
import { FlaskConical, Play, CheckCircle2 } from 'lucide-react';
import { simulatePing } from '../../api/client';

interface DevViewProps {
  onRefreshMessages: () => void;
}

export const DevView: React.FC<DevViewProps> = ({ onRefreshMessages }) => {
  const [text, setText] = useState(
    '🔥 HOT BUYING OFFER - VOICE WHOLESALE 🔥\nBD Mobile 88017 / 88019: $0.0215 (ACD 4+, ASR 45%)\nUK Mobile 447: $0.0125 Direct Pure CLI\nUSA CC Flat: $0.0068\nPayment: Weekly USDT or Wire. Send stats now!'
  );
  const [phone, setPhone] = useState('+44 7700 900142');
  const [name, setName] = useState('Apex Telecom Global');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setStatus(null);
    try {
      const ok = await simulatePing({
        text,
        sender_phone: phone,
        sender_name: name,
        chat_type: 'group',
        chat_name: 'Wholesale Voice Traders BD & UK',
      });
      if (ok) {
        setStatus('Message simulated and persisted to local SQLite queue!');
        onRefreshMessages();
      } else {
        setStatus('Failed to simulate message.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="view-dev" className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-dark-700/80 space-y-4 shadow-xl bg-white/80 dark:bg-dark-950/40 transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Simulate Inbound Telecom Message</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Simulate a real carrier WhatsApp rate post to test the real-time extraction pipeline.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste telecom message (e.g. Colombia CC CLI 1/1 at $0.0055)..."
              required
              className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Sender Phone (+123456789)"
                className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sender Name (Apex Telecom)"
                className="bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 transition-all self-start sm:self-auto shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{loading ? 'Ingesting...' : 'Test Ingest'}</span>
            </button>
          </div>
        </form>

        {status && (
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{status}</span>
          </div>
        )}
      </div>
    </div>
  );
};
