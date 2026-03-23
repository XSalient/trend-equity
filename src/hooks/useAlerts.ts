import { useState, useEffect } from 'react';
import { Alert } from '../types';
import { generateAlerts } from '../services/geminiService';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const generatedAlerts = await generateAlerts();
        setAlerts(generatedAlerts.map((a: any, i: number) => ({
          ...a,
          id: `alert-${Date.now()}-${i}`,
          timestamp: new Date(),
          isRead: false
        })));
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
      }
    };
    fetchAlerts();
  }, []);

  const markAlertAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;

  return { alerts, setShowAlerts, showAlerts, markAlertAsRead, unreadAlertsCount };
}
