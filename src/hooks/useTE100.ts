import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface TE100Entry {
  id: string;
  projectName: string;
  url: string;
  pitch: string;
  mrr: string | null;
  approvedAt: any;
}

export function useCuratedTE100() {
  const [entries, setEntries] = useState<TE100Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'te100'), orderBy('approvedAt', 'desc'), limit(50));
    getDocs(q)
      .then((snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TE100Entry, 'id'>) })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { entries, loading, error };
}
