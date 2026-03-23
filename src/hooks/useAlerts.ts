import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp,
  addDoc,
  getDocs,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Alert } from '../types';
import { generateAlerts } from '../services/geminiService';

export function useAlerts(user: FirebaseUser | null) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }

    const q = query(
      collection(db, 'user_alerts'), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // No alerts for this user yet, let's generate some initial ones
        setLoading(true);
        try {
          const generated = await generateAlerts();
          const batch = generated.map(async (a: any) => {
            await addDoc(collection(db, 'user_alerts'), {
              ...a,
              userId: user.uid,
              timestamp: serverTimestamp(),
              isRead: false
            });
          });
          await Promise.all(batch);
        } catch (err) {
          console.error("Failed to generate initial alerts:", err);
        } finally {
          setLoading(false);
        }
      } else {
        const fetchedAlerts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Alert));
        setAlerts(fetchedAlerts);
      }
    }, (err) => {
      console.error("Alerts Sync Error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const markAlertAsRead = async (id: string) => {
    if (!user) return;
    try {
      const alertRef = doc(db, 'user_alerts', id);
      await setDoc(alertRef, { isRead: true }, { merge: true });
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;

  return { alerts, setShowAlerts, showAlerts, markAlertAsRead, unreadAlertsCount, loading };
}
