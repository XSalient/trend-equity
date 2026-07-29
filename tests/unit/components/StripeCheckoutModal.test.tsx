import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../setup-dom';
import { StripeCheckoutModal } from '../../../src/components/StripeCheckoutModal';

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
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(Tag, props, children);
  return {
    motion: { div: passthrough('div'), button: passthrough('button') },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const TOKEN = 'firebase-token';

/** Captures the tier the component actually asks Stripe to bill for. */
function mockCheckoutFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function postedTier(fetchMock: ReturnType<typeof vi.fn>): string {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string).tier;
}

beforeEach(() => {
  // window.location.href assignment on redirect — jsdom would warn on navigation.
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('StripeCheckoutModal', () => {
  describe('free user — the picked plan drives the CTA (TE-45)', () => {
    it('preselects Builder and bills Builder when the Builder card opened the modal', async () => {
      const fetchMock = mockCheckoutFetch();
      render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="free"
          initialTier="builder"
          firebaseToken={TOKEN}
        />
      );

      const cta = screen.getByRole('button', { name: /upgrade to builder/i });
      await userEvent.click(cta);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(postedTier(fetchMock)).toBe('builder');
    });

    it('preselects Pro when the Pro card opened the modal', () => {
      mockCheckoutFetch();
      render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="free"
          initialTier="pro"
          firebaseToken={TOKEN}
        />
      );

      expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /upgrade to builder/i })).toBeNull();
    });

    it('offers both plans and follows an in-modal switch', async () => {
      const fetchMock = mockCheckoutFetch();
      render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="free"
          initialTier="pro"
          firebaseToken={TOKEN}
        />
      );

      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Builder')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Builder'));
      await userEvent.click(screen.getByRole('button', { name: /upgrade to builder/i }));

      expect(postedTier(fetchMock)).toBe('builder');
    });

    it('resets a stale selection when the modal is reopened for a different plan', () => {
      const { rerender } = render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="free"
          initialTier="builder"
          firebaseToken={TOKEN}
        />
      );
      expect(screen.getByRole('button', { name: /upgrade to builder/i })).toBeInTheDocument();

      rerender(
        <StripeCheckoutModal
          isOpen={false}
          onClose={vi.fn()}
          userTier="free"
          initialTier="builder"
          firebaseToken={TOKEN}
        />
      );
      rerender(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="free"
          initialTier="pro"
          firebaseToken={TOKEN}
        />
      );

      expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
    });
  });

  describe('existing subscriber — Checkout is free → paid only (docs/PAYMENTS.md)', () => {
    it('offers no Checkout CTA to a Pro member, only the billing portal', async () => {
      const fetchMock = mockCheckoutFetch();
      const onManageBilling = vi.fn();
      render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="pro"
          initialTier="pro"
          firebaseToken={TOKEN}
          onManageBilling={onManageBilling}
        />
      );

      // The bug: a Builder-only card list with an "Upgrade to Pro" button.
      expect(screen.queryByRole('button', { name: /upgrade to pro/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /upgrade to builder/i })).toBeNull();
      expect(screen.getByText(/already on the/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /manage billing/i }));
      expect(onManageBilling).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows no empty plan grid with a dangling CTA for a Builder member', () => {
      render(
        <StripeCheckoutModal
          isOpen
          onClose={vi.fn()}
          userTier="builder"
          initialTier="pro"
          firebaseToken={TOKEN}
          onManageBilling={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /^upgrade to/i })).toBeNull();
      expect(screen.getByText(/manage your plan/i)).toBeInTheDocument();
    });
  });

  it('reports an expired session instead of firing a 401 checkout', async () => {
    const fetchMock = mockCheckoutFetch();
    render(<StripeCheckoutModal isOpen onClose={vi.fn()} userTier="free" initialTier="builder" />);

    await userEvent.click(screen.getByRole('button', { name: /upgrade to builder/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
  });
});
