'use client';

import { useState } from 'react';
import { getSyncCode, applySyncCode } from '../lib/sync';

interface SyncPanelProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export function SyncPanel({ status }: SyncPanelProps) {
  const [showCode, setShowCode] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [copied, setCopied] = useState(false);

  const code = getSyncCode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  const handleImport = () => {
    const trimmed = importValue.trim();
    if (trimmed && trimmed.length >= 10) {
      applySyncCode(trimmed);
      window.location.reload();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowCode((v) => !v)}
        className="flex items-center gap-1 text-xs"
        title="Sync settings"
      >
        {status === 'saving' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {status === 'saved' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        {status === 'error' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />}
        {status === 'idle' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />}
        <span className="text-slate-500 hover:text-slate-300">Sync</span>
      </button>

      {showCode && (
        <div className="absolute top-6 right-0 z-50 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Your sync code</p>
            <div className="flex items-center gap-1">
              <code className="flex-1 text-[11px] text-slate-300 bg-slate-900 rounded px-2 py-1 font-mono truncate select-all">
                {code}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 shrink-0"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Use this code on another device to load your data.</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Import sync code</p>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                placeholder="Paste code here"
                className="flex-1 text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={handleImport}
                className="text-[10px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white shrink-0"
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
