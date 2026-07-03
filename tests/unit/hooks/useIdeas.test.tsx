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
} = vi.hoisted(() => ({
  mockFetchCachedCustomFeed: vi.fn(),
  mockGenerateCustomFeed: vi.fn(),
  mockGenerateDailyIdeas: vi.fn(),
  mockSetCurrentIdToken: vi.fn(),
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
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
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
