import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { PricingSection } from '../../../src/components/PricingSection';

// Strip motion-only props so they never reach the DOM as unknown attributes.
vi.mock('motion/react', () => {
  const passthrough =
    (Tag: 'div' | 'button') =>
    ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      mode: _mode,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(Tag, props, children);
  return {
    motion: { div: passthrough('div'), button: passthrough('button') },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const TOKEN = 'firebase-token';

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ url: 'https://stripe.test/redirect' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Card order in the DOM is Free, Pro, Builder. */
function upgradeButtons() {
  return screen.getAllByRole('button', { name: 'UPGRADE NOW' });
}

beforeEach(() => {
  Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PricingSection → StripeCheckoutModal (TE-45)', () => {
  it('opens Checkout on the plan the user actually clicked, not always Pro', async () => {
    mockFetch();
    render(<PricingSection currentPlan="free" isAuthenticated firebaseToken={TOKEN} />);

    const [, builderUpgrade] = upgradeButtons();
    await userEvent.click(builderUpgrade);

    expect(screen.getByRole('button', { name: /upgrade to builder/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).toBeNull();
  });

  it('opens Checkout on Pro when the Pro card is the one clicked', async () => {
    mockFetch();
    render(<PricingSection currentPlan="free" isAuthenticated firebaseToken={TOKEN} />);

    const [proUpgrade] = upgradeButtons();
    await userEvent.click(proUpgrade);

    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it('blocks every plan action while the server tier is still loading', async () => {
    const fetchMock = mockFetch();
    render(<PricingSection currentPlan="free" isAuthenticated tierLoading firebaseToken={TOKEN} />);

    // 'free' here is a placeholder, not server truth — nothing may be bought yet.
    expect(screen.queryByRole('button', { name: 'UPGRADE NOW' })).toBeNull();
    const loadingButtons = screen.getAllByRole('button', { name: /loading/i });
    expect(loadingButtons).toHaveLength(3);
    loadingButtons.forEach((button) => expect(button).toBeDisabled());

    await userEvent.click(loadingButtons[2]);
    expect(screen.queryByRole('button', { name: /upgrade to/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an existing Pro subscriber to the portal, never to Checkout', async () => {
    const fetchMock = mockFetch();
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    // Only Builder offers an upgrade for a Pro member.
    const [builderUpgrade] = upgradeButtons();
    await userEvent.click(builderUpgrade);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/portal');
    expect(screen.queryByRole('button', { name: /upgrade to/i })).toBeNull();
  });

  it('parks a pre-sign-in plan pick until the server tier is known', async () => {
    mockFetch();
    const { rerender } = render(
      <PricingSection currentPlan="free" isAuthenticated={false} onSignIn={vi.fn()} />
    );

    // Signed-out visitor picks Builder, then signs in.
    const proceedButtons = screen.getAllByRole('button', { name: 'PROCEED' });
    await userEvent.click(proceedButtons[2]);

    // Token has landed but the tier snapshot has not — Checkout must stay shut.
    rerender(
      <PricingSection currentPlan="free" isAuthenticated tierLoading firebaseToken={TOKEN} />
    );
    expect(screen.queryByRole('button', { name: /upgrade to/i })).toBeNull();

    // Snapshot says the account is genuinely free — now the pick resumes.
    rerender(<PricingSection currentPlan="free" isAuthenticated firebaseToken={TOKEN} />);
    expect(screen.getByRole('button', { name: /upgrade to builder/i })).toBeInTheDocument();
  });

  it('does not resume a parked pick for someone who turns out to be subscribed', async () => {
    const fetchMock = mockFetch();
    const { rerender } = render(
      <PricingSection currentPlan="free" isAuthenticated={false} onSignIn={vi.fn()} />
    );

    const proceedButtons = screen.getAllByRole('button', { name: 'PROCEED' });
    await userEvent.click(proceedButtons[2]);

    rerender(
      <PricingSection currentPlan="free" isAuthenticated tierLoading firebaseToken={TOKEN} />
    );
    rerender(<PricingSection currentPlan="builder" isAuthenticated firebaseToken={TOKEN} />);

    expect(screen.queryByRole('button', { name: /upgrade to/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
