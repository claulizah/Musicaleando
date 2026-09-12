'use client';

import { useState, useTransition } from 'react';
import { syncFromLastfm } from './actions';

export function SyncButton({ moodId, suggestedTag }: { moodId: string; suggestedTag: string }) {
  const [tag, setTag] = useState(suggestedTag);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await syncFromLastfm(moodId, tag);
              if (result.error) {
                setMessage(`Error: ${result.error}`);
              } else {
                setMessage(`+${result.added} nuevos, ${result.skipped} ya existían.`);
              }
            });
          }}
          className="rounded-md border border-gray-400 px-2 py-1 text-xs disabled:opacity-50"
        >
          {pending ? 'Sincronizando…' : 'Traer de Last.fm'}
        </button>
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}
