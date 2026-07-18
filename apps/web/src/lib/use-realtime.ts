'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN, getAccessToken } from './api';

/**
 * Connexion temps réel unique de l'application (Socket.IO).
 * À la réception d'un événement, on invalide les requêtes concernées :
 * l'UI se met à jour instantanément, et le polling existant reste en
 * filet de sécurité si la connexion tombe.
 */
export function useRealtime(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const socket: Socket = io(`${API_ORIGIN}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('notification', () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
    });

    socket.on('message', (payload: { conversationId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      if (payload?.conversationId) {
        void queryClient.invalidateQueries({ queryKey: ['thread', payload.conversationId] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, queryClient]);
}
