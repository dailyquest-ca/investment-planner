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
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-6 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-2">Suggestions</h2>
        <p className="text-slate-500 text-sm">No suggestions right now. Adjust inputs to see optimization tips.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="font-display text-lg font-semibold text-slate-100">Suggestions</h2>
        <p className="text-slate-500 text-xs mt-0.5">Ways to improve your net worth outcome</p>
      </div>
      <ul className="divide-y divide-slate-700/80">
        {suggestions.map((s, i) => (
          <li key={i} className={`px-4 py-3 ${kindStyles[s.kind]} border-l-4`}>
            <div className="flex gap-2">
              <span className="text-lg leading-none" aria-hidden>{kindIcon[s.kind]}</span>
              <div>
                <p className="font-medium text-slate-200">{s.title}</p>
                <p className="text-sm text-slate-400 mt-0.5">{s.description}</p>
                {s.action && (
                  <p className="text-sm text-slate-500 mt-1.5 italic">{s.action}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
