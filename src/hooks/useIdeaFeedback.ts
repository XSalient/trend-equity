import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type ReactionType = 'up' | 'down' | 'building';

export function useIdeaFeedback(ideaId: string, uid: string | undefined) {
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !ideaId) return;
    const docRef = doc(db, 'idea_reactions', `${uid}_${ideaId}`);
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        setReaction(snap.data().type as ReactionType);
      }
    });
  }, [uid, ideaId]);

  const toggleReaction = async (type: ReactionType) => {
    if (!uid || loading) return;
    setLoading(true);
    const docRef = doc(db, 'idea_reactions', `${uid}_${ideaId}`);
    try {
      if (reaction === type) {
        await deleteDoc(docRef);
        setReaction(null);
      } else {
        await setDoc(docRef, {
          uid,
          ideaId,
          type,
          date: new Date().toISOString().slice(0, 10),
          timestamp: serverTimestamp(),
        });
        setReaction(type);
      }
    } finally {
      setLoading(false);
    }
  };

  return { reaction, toggleReaction, loading };
}
