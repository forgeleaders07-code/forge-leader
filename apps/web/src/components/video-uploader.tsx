'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type UploadState =
  | { step: 'idle' }
  | { step: 'preparing' }
  | { step: 'uploading'; percent: number }
  | { step: 'processing' }
  | { step: 'ready'; durationSeconds: number | null }
  | { step: 'error'; message: string };

const MAX_BASIC_UPLOAD_BYTES = 200 * 1024 * 1024; // limite upload simple Cloudflare

/**
 * Téléversement direct d'une vidéo vers le fournisseur de streaming :
 * 1. l'API délivre une URL d'upload à usage unique (droits vérifiés) ;
 * 2. le NAVIGATEUR envoie le fichier directement au fournisseur ;
 * 3. on suit l'encodage jusqu'à « prêt » (durée persistée côté API).
 */
export function VideoUploader({ lessonId, courseId }: { lessonId: string; courseId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<UploadState>({ step: 'idle' });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollStatus() {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api<{ ready: boolean; durationSeconds: number | null }>(
          `/admin/lessons/${lessonId}/video-status`,
        );
        if (status.ready) {
          if (pollRef.current) clearInterval(pollRef.current);
          setState({ step: 'ready', durationSeconds: status.durationSeconds });
          void queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
        }
      } catch {
        // erreur transitoire de polling : on retentera au tick suivant
      }
    }, 3000);
  }

  async function onFileSelected(file: File) {
    if (file.size > MAX_BASIC_UPLOAD_BYTES) {
      setState({
        step: 'error',
        message: 'Fichier > 200 Mo — compressez la vidéo ou découpez-la (support des gros fichiers à venir).',
      });
      return;
    }

    setState({ step: 'preparing' });
    try {
      const { uploadUrl } = await api<{ uploadUrl: string; videoId: string }>(
        `/admin/lessons/${lessonId}/video-upload`,
        { method: 'POST' },
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({ step: 'uploading', percent: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Téléversement refusé (HTTP ${xhr.status})`));
        xhr.onerror = () => reject(new Error('Erreur réseau pendant le téléversement'));
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
      });

      setState({ step: 'processing' });
      pollStatus();
    } catch (e) {
      setState({ step: 'error', message: e instanceof Error ? e.message : 'Échec du téléversement' });
    }
  }

  const busy = state.step === 'preparing' || state.step === 'uploading' || state.step === 'processing';

  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFileSelected(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-forge-700 px-3 py-1.5 transition hover:border-ember-600 disabled:opacity-50"
      >
        📤 Téléverser une vidéo
      </button>

      {state.step === 'preparing' && <span className="text-forge-300">Préparation…</span>}
      {state.step === 'uploading' && (
        <span className="flex items-center gap-2 text-forge-300">
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-forge-700">
            <span
              className="block h-full rounded-full bg-ember-500 transition-all"
              style={{ width: `${state.percent}%` }}
            />
          </span>
          {state.percent}%
        </span>
      )}
      {state.step === 'processing' && (
        <span className="text-forge-300">Encodage en cours chez le fournisseur…</span>
      )}
      {state.step === 'ready' && (
        <span className="text-emerald-400">
          ✓ Vidéo prête
          {state.durationSeconds ? ` (${Math.round(state.durationSeconds / 60)} min)` : ''}
        </span>
      )}
      {state.step === 'error' && <span className="text-red-400">{state.message}</span>}
    </div>
  );
}
