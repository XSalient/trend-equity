import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Comment } from '../types';

export function useComments(ideaId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ideaId) return;

    const q = query(
      collection(db, 'comments'),
      where('ideaId', '==', ideaId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      
      // Sort client-side to avoid Firestore composite index requirement
      newComments.sort((a, b) => {
        const timeA = a.timestamp?.toMillis?.() || Date.now();
        const timeB = b.timestamp?.toMillis?.() || Date.now();
        return timeB - timeA; // Descending
      });

      setComments(newComments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ideaId]);

  const postComment = async (user: any, text: string) => {
    if (!user || !text.trim()) return;

    await addDoc(collection(db, 'comments'), {
      ideaId,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhoto: user.photoURL,
      text,
      timestamp: serverTimestamp()
    });
  };

  const deleteComment = async (commentId: string, userId: string, currentUser: any) => {
    if (!currentUser || currentUser.uid !== userId) return;
    await deleteDoc(doc(db, 'comments', commentId));
  };

  return { comments, loading, postComment, deleteComment };
}
