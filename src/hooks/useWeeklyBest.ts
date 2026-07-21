import { useState, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Idea, WeeklyBestIdea, Tier } from '../types';

export function useWeeklyBest(tier: Tier) {
  const [weeklyBest, setWeeklyBest] = useState<WeeklyBestIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  // Use a ref for the in-flight guard so the callback has a stable identity
  const loadingRef = useRef(false);

  const updateWeeklyBestIdea = useCallback((updatedIdea: Idea) => {
    setWeeklyBest((prev) =>
      prev.map((idea) =>
        idea.id === updatedIdea.id
          ? { ...updatedIdea, recurrenceCount: idea.recurrenceCount }
          : idea
      )
    );
  }, []);

  const fetchWeeklyBest = useCallback(async () => {
    if (loadingRef.current || tier === 'free') return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Collect dates: today minus 1..7 (not today — today's feed is separate)
      const today = new Date();
      const dates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      // Fetch all docs in parallel
      const snaps = await Promise.all(
        dates.map((date) => getDoc(doc(db, 'daily_generations', date)))
      );

      // Aggregate: map normalized headline → { idea, count, date }
      // For collisions, keep the most recent version (earlier index = more recent date)
      const seen = new Map<string, { idea: Idea; count: number }>();

      snaps.forEach((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!Array.isArray(data?.ideas)) return;
        (data.ideas as Idea[]).forEach((idea) => {
          if (!idea?.headline) return;
          const key = idea.headline.trim().toLowerCase();
          const existing = seen.get(key);
          if (existing) {
            existing.count += 1;
            // Keep the already-stored version (more recent — earlier date index)
          } else {
            seen.set(key, { idea, count: 1 });
          }
        });
      });

      // Sort: recurrenceCount DESC, then revenuePotentialScore DESC, take top 10
      const sorted = Array.from(seen.values())
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return (b.idea.revenuePotentialScore ?? 0) - (a.idea.revenuePotentialScore ?? 0);
        })
        .slice(0, 10)
        .map(({ idea, count }) => ({ ...idea, recurrenceCount: count }));

      setWeeklyBest(sorted);
      setFetched(true);
    } catch (err: any) {
      console.error('[useWeeklyBest] fetch error:', err);
      setError('Failed to load weekly best ideas. Please try again.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []); // stable — uses ref for in-flight guard

  return { weeklyBest, loading, error, fetched, fetchWeeklyBest, updateWeeklyBestIdea };
}
