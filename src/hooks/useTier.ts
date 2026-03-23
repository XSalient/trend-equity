import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Tier } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorUtils';

export function useTier(user: User | null) {
  const [tier, setTier] = useState<Tier>('free');

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(docSnap => {
        if (docSnap.exists()) {
          setTier(docSnap.data().tier || 'free');
        } else {
          setTier('free');
        }
      });
    } else {
      setTier('free');
    }
  }, [user]);

  const handleUpgrade = async (plan: Tier) => {
    setTier(plan);
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { tier: plan, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
    alert(`Upgraded to ${plan.toUpperCase()}!`);
  };

  const handleDowngrade = async (plan: Tier) => {
    setTier(plan);
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { tier: plan, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
    alert(`Downgraded to ${plan.toUpperCase()}.`);
  };

  const upgradeToBuilder = (onLoginNeeded: () => void) => {
    setTier('builder');
    if (!user) {
      // alert("Upgraded to Builder Tier (Local Simulation)!");
      return;
    }
    alert("Upgraded to Builder Tier! Full suite unlocked.");
  };

  return { tier, setTier, handleUpgrade, handleDowngrade, upgradeToBuilder };
}
