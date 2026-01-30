import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Json } from '@/integrations/supabase/types';

interface GameState {
  grid?: unknown[];
  betAmount?: number;
  mineCount?: number;
  gridSize?: string;
  revealedCount?: number;
  currentMultiplier?: number;
  maxSafeReveals?: number | null;
  clickOrder?: number[];
  [key: string]: unknown;
}

interface GameSession {
  id: string;
  user_id: string;
  game: string;
  bet_amount: number;
  game_state: GameState;
  started_at: string;
  expires_at: string;
}

export const useGameSession = (gameName: string) => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch active session on mount
  useEffect(() => {
    if (!user?.id) {
      setActiveSession(null);
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('active_game_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('game', gameName)
        .gt('expires_at', now)
        .maybeSingle();

      if (!error && data) {
        // Parse game_state if it's a string
        const gameState = typeof data.game_state === 'string' 
          ? JSON.parse(data.game_state) 
          : data.game_state;
        
        const parsedSession: GameSession = {
          id: data.id,
          user_id: data.user_id,
          game: data.game,
          bet_amount: data.bet_amount,
          game_state: gameState as GameState,
          started_at: data.started_at,
          expires_at: data.expires_at
        };
        setActiveSession(parsedSession);
      } else {
        setActiveSession(null);
      }
      setLoading(false);
    };

    fetchSession();
  }, [user?.id, gameName]);

  // Save session to database
  const saveSession = useCallback(async (
    betAmount: number,
    gameState: GameState
  ) => {
    if (!user?.id) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('active_game_sessions')
      .upsert({
        user_id: user.id,
        game: gameName,
        bet_amount: betAmount,
        game_state: gameState as unknown as Json,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString()
      }, { 
        onConflict: 'user_id,game'
      })
      .select()
      .single();

    if (!error && data) {
      const gameStateData = typeof data.game_state === 'string' 
        ? JSON.parse(data.game_state) 
        : data.game_state;
        
      const parsedSession: GameSession = {
        id: data.id,
        user_id: data.user_id,
        game: data.game,
        bet_amount: data.bet_amount,
        game_state: gameStateData as GameState,
        started_at: data.started_at,
        expires_at: data.expires_at
      };
      setActiveSession(parsedSession);
      return parsedSession;
    }
    return null;
  }, [user?.id, gameName]);

  // Update session state (for game progress)
  const updateSession = useCallback(async (gameState: GameState) => {
    if (!user?.id || !activeSession) return;

    const { data, error } = await supabase
      .from('active_game_sessions')
      .update({
        game_state: gameState as unknown as Json,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('game', gameName)
      .select()
      .single();

    if (!error && data) {
      const gameStateData = typeof data.game_state === 'string' 
        ? JSON.parse(data.game_state) 
        : data.game_state;
        
      const parsedSession: GameSession = {
        id: data.id,
        user_id: data.user_id,
        game: data.game,
        bet_amount: data.bet_amount,
        game_state: gameStateData as GameState,
        started_at: data.started_at,
        expires_at: data.expires_at
      };
      setActiveSession(parsedSession);
    }
  }, [user?.id, gameName, activeSession]);

  // Clear session (game ended)
  const clearSession = useCallback(async () => {
    if (!user?.id) return;

    await supabase
      .from('active_game_sessions')
      .delete()
      .eq('user_id', user.id)
      .eq('game', gameName);

    setActiveSession(null);
  }, [user?.id, gameName]);

  // Calculate time remaining
  const getTimeRemaining = useCallback(() => {
    if (!activeSession) return null;
    
    const expiresAt = new Date(activeSession.expires_at).getTime();
    const remaining = expiresAt - Date.now();
    
    if (remaining <= 0) return '0h 0m';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [activeSession]);

  return {
    activeSession,
    loading,
    saveSession,
    updateSession,
    clearSession,
    getTimeRemaining
  };
};
