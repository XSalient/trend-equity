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

  it('tells the portal which plan was clicked, not just that a click happened', async () => {
    const fetchMock = mockFetch();
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    await userEvent.click(upgradeButtons()[0]);

    // The old test asserted only the URL, which is why the portal opening on
    // its homepage went unnoticed for the whole of TE-39.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ targetTier: 'builder' });
  });
});

describe('PricingSection plan-switch journey (TE-47)', () => {
  it('selects the clicked card even though the button stops propagation', async () => {
    mockFetch();
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    // The showcase strip below the cards renders the *selected* tier, and
    // starts on the user's own plan.
    expect(screen.getByText(/your PRO features/i)).toBeInTheDocument();

    await userEvent.click(upgradeButtons()[0]); // Builder
    expect(screen.getByText(/preview: BUILDER features/i)).toBeInTheDocument();
  });

  it('shows OPENING… on the button that was pressed, not on Manage billing', async () => {
    // A promise that never settles keeps the component in its in-flight state.
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PricingSection
        currentPlan="pro"
        isAuthenticated
        firebaseToken={TOKEN}
        subscription={{
          proEndDate: new Date('2026-08-12'),
          cancelAtPeriodEnd: false,
          status: 'active',
          hasBillingAccount: true,
          pendingTier: null,
          pendingTierDate: null,
        }}
      />
    );

    await userEvent.click(upgradeButtons()[0]);

    expect(screen.getByRole('button', { name: /opening/i })).toBeInTheDocument();
    // The standalone control keeps its own label — the busy state is per-action.
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
  });

  it('reports a portal failure next to the button that caused it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Stripe is unavailable' }),
      })
    );
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    await userEvent.click(upgradeButtons()[0]);

    expect(await screen.findByText('Stripe is unavailable')).toBeInTheDocument();
    expect(screen.getByText('Stripe is unavailable')).toHaveClass('text-red-400');
  });

  /**
   * TE-69: the server answers a click on a plan Stripe already has the user on
   * with a 409 and a reconciled tier. Painting that red tells somebody their
   * upgrade broke at the exact moment it was found to have worked.
   */
  it('renders a reconciled plan as a notice, not as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'You are already on Builder. Your account has been refreshed.',
          reconciledTier: 'builder',
        }),
      })
    );
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    await userEvent.click(upgradeButtons()[0]);

    const notice = await screen.findByText(
      'You are already on Builder. Your account has been refreshed.'
    );
    expect(notice).toHaveClass('text-amber-400');
    expect(notice).not.toHaveClass('text-red-400');
  });

  it('announces a scheduled downgrade instead of a renewal date', async () => {
    mockFetch();
    render(
      <PricingSection
        currentPlan="builder"
        isAuthenticated
        firebaseToken={TOKEN}
        subscription={{
          proEndDate: new Date('2026-08-12'),
          cancelAtPeriodEnd: false,
          status: 'active',
          hasBillingAccount: true,
          pendingTier: 'pro',
          pendingTierDate: new Date('2026-08-12'),
        }}
      />
    );

    // "Renews" would be true but misleading — what renews is a cheaper plan.
    expect(screen.getByText(/switches to PRO on/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Renews/i)).toBeNull();
  });

  it('does not offer a switch that is already booked', async () => {
    const fetchMock = mockFetch();
    render(
      <PricingSection
        currentPlan="builder"
        isAuthenticated
        firebaseToken={TOKEN}
        subscription={{
          proEndDate: new Date('2026-08-12'),
          cancelAtPeriodEnd: false,
          status: 'active',
          hasBillingAccount: true,
          pendingTier: 'pro',
          pendingTierDate: new Date('2026-08-12'),
        }}
      />
    );

    const scheduled = screen.getByRole('button', { name: 'SCHEDULED' });
    expect(scheduled).toBeDisabled();
    await userEvent.click(scheduled);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes a downgrade-to-free through the cancel flow after confirmation', async () => {
    const fetchMock = mockFetch();
    render(<PricingSection currentPlan="pro" isAuthenticated firebaseToken={TOKEN} />);

    await userEvent.click(screen.getByRole('button', { name: 'DOWNGRADE' }));
    // Retention modal first — nothing has been sent yet.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/nothing is charged today/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /downgrade to FREE/i }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ targetTier: 'free' });
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
