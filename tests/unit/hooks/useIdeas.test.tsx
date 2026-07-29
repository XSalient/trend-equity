// @vitest-environment jsdom
/**
 * Unit tests for the custom requirement feed behavior in src/hooks/useIdeas.ts:
 * cached-feed restore on load, updateIdea syncing into customFeed, and the
 * custom feed view toggle.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const {
  mockFetchCachedCustomFeed,
  mockGenerateCustomFeed,
  mockGenerateDailyIdeas,
  mockSetCurrentIdToken,
  mockOnSnapshot,
  mockGetDoc,
} = vi.hoisted(() => ({
  mockFetchCachedCustomFeed: vi.fn(),
  mockGenerateCustomFeed: vi.fn(),
  mockGenerateDailyIdeas: vi.fn(),
  mockSetCurrentIdToken: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockGetDoc: vi.fn(),
}));

vi.mock('../../../src/services/geminiService', () => ({
  fetchCachedCustomFeed: mockFetchCachedCustomFeed,
  generateCustomFeed: mockGenerateCustomFeed,
  generateDailyIdeas: mockGenerateDailyIdeas,
  setCurrentIdToken: mockSetCurrentIdToken,
}));

vi.mock('../../../src/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: mockGetDoc,
  setDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  // Tagged so onSnapshot callers can tell the user_saves query apart from the
  // app_config doc listener that TierLimitsProvider registers.
  query: vi.fn(() => ({ __savesQuery: true })),
  where: vi.fn(),
  onSnapshot: mockOnSnapshot,
  serverTimestamp: vi.fn(() => 'server-ts'),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
}));

import { useIdeas } from '../../../src/hooks/useIdeas';
import { TierLimitsProvider } from '../../../src/context/TierLimitsContext';

// jsdom's localStorage is not reliably functional in this setup — the hook's
// feed cache helpers need a working implementation.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TierLimitsProvider>{children}</TierLimitsProvider>
);

const mockUser = {
  uid: 'user-1',
  getIdToken: vi.fn().mockResolvedValue('id-token'),
} as any;

const customIdea = {
  id: 'custom-feed-2026-07-03-1-abc',
  headline: 'Custom idea',
  pitch: 'p',
  vcJustification: 'v',
  categoryTags: [],
  costEffort: 'Low',
  revenuePotentialScore: 7,
  trendSources: [],
} as any;

const cachedFeed = {
  date: '2026-07-03',
  intro: 'Cached custom feed',
  ideas: [customIdea],
  generatedAt: new Date().toISOString(),
  customRequirement: 'fintech tools',
  _cached: true,
} as any;

function renderUseIdeas(tier: 'free' | 'pro' | 'builder' = 'builder', user = mockUser) {
  return renderHook(() => useIdeas(user, tier, true), { wrapper });
}

describe('useIdeas — custom requirement feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    mockFetchCachedCustomFeed.mockResolvedValue(null);
    mockUser.getIdToken.mockResolvedValue('id-token');
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    mockOnSnapshot.mockImplementation(() => () => {});
  });

  it('restores a fresh cached custom feed on load and shows it', async () => {
    mockFetchCachedCustomFeed.mockResolvedValue(cachedFeed);
    const { result } = renderUseIdeas();

    await waitFor(() => {
      expect(result.current.customFeed).not.toBeNull();
    });
    expect(result.current.customFeedVisible).toBe(true);
    expect(result.current.customFeed?.customRequirement).toBe('fintech tools');
    // Token must be synced before the authenticated peek call
    expect(mockSetCurrentIdToken).toHaveBeenCalledWith('id-token');
  });

  it('does not peek for the cached feed on free tier', async () => {
    renderUseIdeas('free');
    await act(async () => {});
    expect(mockFetchCachedCustomFeed).not.toHaveBeenCalled();
  });

  it('updateIdea syncs toolkit results into custom feed ideas', async () => {
    mockFetchCachedCustomFeed.mockResolvedValue(cachedFeed);
    const { result } = renderUseIdeas();
    await waitFor(() => expect(result.current.customFeed).not.toBeNull());

    const plan = { roadmap: [], generatedAt: new Date().toISOString() };
    await act(async () => {
      await result.current.updateIdea({ ...customIdea, fullActionPlan: plan });
    });

    expect(result.current.customFeed?.ideas[0].fullActionPlan).toEqual(plan);
  });

  it('generateCustomRequirementFeed shows the feed and clears the keyword filter', async () => {
    mockGenerateCustomFeed.mockResolvedValue(cachedFeed);
    const { result } = renderUseIdeas();
    await act(async () => {});

    act(() => {
      result.current.setFilters({ ...result.current.filters, customKeywords: 'fintech tools' });
    });
    await act(async () => {
      await result.current.generateCustomRequirementFeed();
    });

    expect(mockGenerateCustomFeed).toHaveBeenCalledWith('fintech tools');
    expect(result.current.customFeed).not.toBeNull();
    expect(result.current.customFeedVisible).toBe(true);
    // Requirement must not linger as a daily-feed keyword filter
    expect(result.current.filters.customKeywords).toBe('');
  });

  it('toggleCustomFeedView hides the feed without discarding the cached data', async () => {
    mockFetchCachedCustomFeed.mockResolvedValue(cachedFeed);
    const { result } = renderUseIdeas();
    await waitFor(() => expect(result.current.customFeedVisible).toBe(true));

    act(() => {
      result.current.toggleCustomFeedView();
    });
    expect(result.current.customFeedVisible).toBe(false);
    expect(result.current.customFeed).not.toBeNull();

    act(() => {
      result.current.toggleCustomFeedView();
    });
    expect(result.current.customFeedVisible).toBe(true);
  });
});

describe('useIdeas — sign-out state reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    mockFetchCachedCustomFeed.mockResolvedValue(null);
    mockUser.getIdToken.mockResolvedValue('id-token');
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    mockOnSnapshot.mockImplementation(() => () => {});
  });

  /** Renders the hook with a swappable `user` so a sign-out can be simulated. */
  function renderWithSwappableUser(tier: 'free' | 'pro' | 'builder' = 'builder') {
    return renderHook(({ user }: { user: any }) => useIdeas(user, tier, true), {
      wrapper,
      initialProps: { user: mockUser as any },
    });
  }

  const savedSnapshot = {
    docs: [
      {
        id: 'save-1',
        data: () => ({ userId: 'user-1', idea: customIdea, saveType: 'feed' }),
      },
    ],
  };

  it('clears saved ideas when the user signs out', async () => {
    let emitSaves: ((snap: unknown) => void) | null = null;
    mockOnSnapshot.mockImplementation((ref: any, next: (snap: unknown) => void) => {
      if (ref?.__savesQuery) emitSaves = next;
      return () => {};
    });

    const { result, rerender } = renderWithSwappableUser();
    await act(async () => {
      emitSaves!(savedSnapshot);
    });
    expect(result.current.userSaves).toHaveLength(1);
    expect(result.current.feedSaves).toHaveLength(1);

    // Sign out
    rerender({ user: null });
    await act(async () => {});

    expect(result.current.userSaves).toEqual([]);
    expect(result.current.feedSaves).toEqual([]);
    expect(result.current.customSaves).toEqual([]);
  });

  it('clears the Pro custom feed when the user signs out', async () => {
    mockFetchCachedCustomFeed.mockResolvedValue(cachedFeed);
    const { result, rerender } = renderWithSwappableUser();
    await waitFor(() => expect(result.current.customFeed).not.toBeNull());

    rerender({ user: null });
    await act(async () => {});

    expect(result.current.customFeed).toBeNull();
    expect(result.current.customFeedVisible).toBe(false);
  });

  it('resets saved filters to defaults when the user signs out', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ filters: { industries: ['Fintech'], sortBy: 'revenue' } }),
    });

    const { result, rerender } = renderWithSwappableUser();
    await waitFor(() => expect(result.current.filters.industries).toEqual(['Fintech']));

    rerender({ user: null });
    await act(async () => {});

    // Leaking these into the signed-out session also leaks them into the NEXT
    // account signed in on this browser, via the debounced filter-save effect.
    expect(result.current.filters.industries).toEqual([]);
    expect(result.current.filters.sortBy).toBe('quality');
  });
});
