import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

export interface AnalyticsEvent {
  name: string;
  context?: Record<string, any>;
}

let eventQueue: AnalyticsEvent[] = [];
let isOnline = true;

// Listen to online/offline status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    flushQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

async function flushQueue() {
  if (!isOnline || eventQueue.length === 0 || !auth.currentUser) return;

  const queue = [...eventQueue];
  eventQueue = [];

  try {
    const uid = auth.currentUser.uid;
    const date = new Date().toISOString().split('T')[0];
    const docId = `${uid}_${date}`;
    const eventsRef = collection(db, 'user_analytics');

    // Batch write events with timestamp
    for (const event of queue) {
      await addDoc(eventsRef, {
        uid,
        date,
        name: event.name,
        context: event.context || {},
        timestamp: serverTimestamp(),
      });
    }

    console.log(`[analytics] Flushed ${queue.length} events for ${uid}`);
  } catch (err) {
    console.error('[analytics] Failed to flush queue:', err);
    // Re-queue events on failure
    eventQueue = [...queue, ...eventQueue];
  }
}

export async function logEvent(name: string, context?: Record<string, any>) {
  try {
    if (!auth.currentUser) {
      console.debug('[analytics] No user authenticated, skipping event:', name);
      return;
    }

    const event: AnalyticsEvent = { name, context };
    eventQueue.push(event);

    // Flush immediately if online, otherwise queue for later
    if (isOnline) {
      // Debounce flush to batch events
      setTimeout(() => flushQueue(), 100);
    }
  } catch (err) {
    console.error('[analytics] Error logging event:', err);
  }
}
