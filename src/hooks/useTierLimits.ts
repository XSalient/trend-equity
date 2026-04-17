import { useTierLimitsContext } from '../context/TierLimitsContext';

/**
 * Hook to consume shared tier limits from TierLimitsContext.
 * This ensures only one Firestore listener is active per application instance.
 */
export function useTierLimits() {
  const { limits, loading, getAnalyzeLimit, getCustomSavesLimit } = useTierLimitsContext();

  return { limits, loading, getAnalyzeLimit, getCustomSavesLimit };
}
