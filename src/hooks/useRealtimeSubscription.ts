import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'profiles' | 'bet_logs' | 'game_settings' | 'transactions' | 'user_betting_controls' | 'user_win_rates';

interface UseRealtimeOptions<T> {
  table: TableName;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

export const useRealtimeSubscription = <T extends Record<string, unknown>>({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true
}: UseRealtimeOptions<T>) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<T>) => {
    onChange?.(payload);
    
    if (payload.eventType === 'INSERT' && onInsert) {
      onInsert(payload.new as T);
    } else if (payload.eventType === 'UPDATE' && onUpdate) {
      onUpdate(payload.new as T);
    } else if (payload.eventType === 'DELETE' && onDelete) {
      onDelete(payload.old as T);
    }
  }, [onChange, onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${Date.now()}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscriptionConfig: any = {
      event,
      schema: 'public',
      table,
    };

    if (filter) {
      subscriptionConfig.filter = filter;
    }

    channelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', subscriptionConfig, handleChange as (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void)
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, event, filter, handleChange, enabled]);

  return channelRef.current;
};

// Hook for subscribing to game settings changes
export const useGameSettingsSubscription = (
  onSettingChange: (key: string, value: number) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('game-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_settings'
        },
        (payload) => {
          const newData = payload.new as { setting_key: string; setting_value: number };
          if (newData?.setting_key && newData?.setting_value !== undefined) {
            onSettingChange(newData.setting_key, newData.setting_value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onSettingChange, enabled]);
};

// Hook for subscribing to bet logs
export const useBetLogsSubscription = (
  onNewBet: (bet: Record<string, unknown>) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('bet-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bet_logs'
        },
        (payload) => {
          onNewBet(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewBet, enabled]);
};

// Hook for subscribing to profile changes
export const useProfilesSubscription = (
  onProfileChange: (profile: Record<string, unknown>) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            onProfileChange(payload.new as Record<string, unknown>);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onProfileChange, enabled]);
};

// Hook for subscribing to transaction changes
export const useTransactionsSubscription = (
  onTransactionChange: (transaction: Record<string, unknown>, eventType: string) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        (payload) => {
          const data = payload.eventType === 'DELETE' ? payload.old : payload.new;
          if (data && Object.keys(data).length > 0) {
            onTransactionChange(data as Record<string, unknown>, payload.eventType);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onTransactionChange, enabled]);
};
