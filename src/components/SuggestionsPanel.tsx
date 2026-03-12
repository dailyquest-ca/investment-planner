import type { Suggestion } from '../lib/suggestions';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
}

const kindStyles: Record<Suggestion['kind'], string> = {
  warning: 'border-amber-500/50 bg-amber-500/5',
  tip: 'border-sky-500/50 bg-sky-500/5',
  success: 'border-emerald-500/50 bg-emerald-500/5',
};

const kindIcon: Record<Suggestion['kind'], string> = {
  warning: '⚠',
  tip: '💡',
  success: '✓',
};

export function SuggestionsPanel({ suggestions }: SuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-4 shadow-lg">
        <h2 className="font-display text-sm font-semibold text-slate-100 mb-1">Optimization tips</h2>
        <p className="text-slate-500 text-xs">No tips yet — try adjusting your assumptions.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 overflow-hidden shadow-lg">
      <div className="px-3 py-2 border-b border-slate-700/80">
        <h2 className="font-display text-sm font-semibold text-slate-100">Optimization tips</h2>
        <p className="text-slate-500 text-[11px]">Adjust inputs on the left to see how these change</p>
      </div>
      <ul className="divide-y divide-slate-700/60">
        {suggestions.map((s, i) => (
          <li key={i} className={`px-3 py-2 ${kindStyles[s.kind]} border-l-4`}>
            <div className="flex gap-2">
              <span className="text-base leading-none shrink-0" aria-hidden>{kindIcon[s.kind]}</span>
              <div className="min-w-0">
                <p className="font-medium text-slate-200 text-sm">{s.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                {s.action && (
                  <p className="text-xs text-slate-500 mt-1 italic">{s.action}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
