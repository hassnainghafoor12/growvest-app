/**
 * GROWVEST REALTIME SUBSCRIPTION MANAGER
 * Handles:
 * - Duplicate subscription prevention
 * - Channel lifecycle tracking
 * - AppState foreground/background synchronization
 * - Clean teardown on unmount
 */

import { AppState, AppStateStatus } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

class RealtimeSyncManager {
  private activeChannels: Map<string, RealtimeChannel> = new Map();
  private channelRefCounts: Map<string, number> = new Map();
  private appState: AppStateStatus = AppState.currentState;

  constructor() {
    // Listen to Android AppState foreground/background transitions
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[RealtimeSync] App returned to foreground, verifying channel connections...');
      // Re-verify or reconnect channels if disconnected
      this.activeChannels.forEach((channel, name) => {
        if (channel.state !== 'joined') {
          console.log(`[RealtimeSync] Rejoining channel: ${name}`);
          channel.subscribe();
        }
      });
    }
    this.appState = nextAppState;
  };

  /**
   * Acquire or create a singleton Realtime channel
   */
  public getOrCreateChannel(
    name: string,
    setupFn: (channel: RealtimeChannel) => void
  ): RealtimeChannel {
    const existing = this.activeChannels.get(name);
    if (existing) {
      const currentCount = this.channelRefCounts.get(name) || 1;
      this.channelRefCounts.set(name, currentCount + 1);
      return existing;
    }

    const channel = supabase.channel(name);
    setupFn(channel);

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[RealtimeSync] Channel subscribed: ${name}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.warn(`[RealtimeSync] Channel error on ${name}:`, err);
      } else if (status === 'TIMED_OUT') {
        console.warn(`[RealtimeSync] Channel timeout on ${name}, reconnecting...`);
        channel.subscribe();
      }
    });

    this.activeChannels.set(name, channel);
    this.channelRefCounts.set(name, 1);
    return channel;
  }

  /**
   * Release channel reference and cleanup when no components are listening
   */
  public releaseChannel(name: string) {
    const count = this.channelRefCounts.get(name);
    if (!count) return;

    if (count <= 1) {
      const channel = this.activeChannels.get(name);
      if (channel) {
        supabase.removeChannel(channel);
        this.activeChannels.delete(name);
        this.channelRefCounts.delete(name);
        console.log(`[RealtimeSync] Channel removed: ${name}`);
      }
    } else {
      this.channelRefCounts.set(name, count - 1);
    }
  }

  public getActiveChannelCount(): number {
    return this.activeChannels.size;
  }
}

export const realtimeSync = new RealtimeSyncManager();
