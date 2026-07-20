import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
  TrendingUp,
  Zap,
  BarChart3,
  Radio,
  Database,
  ArrowRight,
  CheckCircle2,
  Target,
  Clock,
  Eye,
  Telescope,
  GitFork,
} from 'lucide-react';

const ROLES = [
  'VC Partner / GP',
  'Investment Analyst',
  'Corp Innovation Lead',
  'Portfolio Manager',
  'Other',
];

const PAIN_POINTS = [
  {
    icon: Clock,
    title: "You're missing signals",
    body: "Manual scanning of HN, Reddit, and TechCrunch takes hours every morning — and you're still only seeing what everyone else sees.",
  },
  {
    icon: Eye,
    title: 'Your thesis has blind spots',
    body: "Emerging categories don't map neatly onto your existing coverage areas until it's too late to lead a round.",
  },
  {
    icon: Target,
    title: 'Sourcing is reactive',
    body: 'By the time a deal crosses your desk through a warm intro, the best terms are already gone.',
  },
];

const FEATURES = [
  {
    icon: Zap,
    label: 'Deal Flow Intelligence',
    product: 'Daily Feed',
    description:
      '35 AI-curated opportunities per day, each grounded in live signals from Google Trends, Reddit, HN, and TechCrunch — not training-data guesses.',
  },
  {
    icon: Radio,
    label: 'Sector Trend Monitoring',
    product: 'Weekly Radar',
    description:
      'Weekly macro analysis of market shifts, emerging categories, and opportunity areas. Know which verticals are heating up before the consensus forms.',
  },
  {
    icon: Telescope,
    label: 'White Space Analysis',
    product: 'Futurecasting',
    description:
      '2027, 2030, and 2035 horizon maps for emerging verticals — with signal rationale and estimated impact scores for each projection.',
  },
  {
    icon: BarChart3,
    label: 'Thesis Validation',
    product: 'Custom Analysis',
    description:
      'Submit any company, sector, or trend. Get a full VC-grade breakdown — moat analysis, revenue model, market size, competitor landscape — in seconds.',
  },
  {
    icon: GitFork,
    label: 'Data Integration',
    product: 'API Access',
    description:
      'Push curated deal flow directly to your Notion workspace, Airtable base, or CRM via our REST API. No more manual copy-paste between tools.',
  },
  {
    icon: Database,
    label: 'Signal Provenance',
    product: 'Live Sources',
    description:
      'Every idea cites its signal source — the specific Reddit thread, HN discussion, or TechCrunch funding story that triggered it. Full audit trail.',
  },
];

const SOURCES = ['Google Trends', 'Product Hunt', 'Hacker News', 'Reddit', 'TechCrunch'];

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function EnterpriseLanding() {
  const { user, authReady, handleLogin } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    role: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !user) {
      handleLogin();
    }
  }, [authReady, user, handleLogin]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!form.firstName || !form.email || !form.company || !form.role) {
      setSubmitError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'enterprise_leads'), {
        ...form,
        createdAt: serverTimestamp(),
        source: 'enterprise_landing',
      });
      setSubmitted(true);
    } catch {
      setSubmitError('Something went wrong. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
          </div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-black uppercase tracking-widest text-white">
              Trend Equity
            </span>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Enterprise
            </span>
          </div>
          <a
            href="/"
            className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            Back to app <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-28 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={FADE_UP}>
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 rounded-full mb-8">
              For VCs &amp; Corporate Innovation Teams
            </span>
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 32 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } },
            }}
            className="text-5xl md:text-7xl font-black uppercase italic tracking-tight leading-none mb-6"
          >
            Deal Flow Intelligence.
            <br />
            <span className="text-emerald-400">Before the Market Sees It.</span>
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.25 } },
            }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Real-time sector monitoring, white space analysis, and AI-generated thesis validation —
            built for investment teams that move first.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.35 } },
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <button
              onClick={() => scrollTo(formRef)}
              className="px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm uppercase tracking-widest rounded-xl transition-colors"
            >
              Request Early Access
            </button>
            <button
              onClick={() => scrollTo(featuresRef)}
              className="px-7 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              See It In Action <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Pain strip ──────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-white/5 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {PAIN_POINTS.map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={FADE_UP}
              className="p-6 bg-zinc-900 border border-white/5 rounded-2xl"
            >
              <Icon className="w-5 h-5 text-zinc-500 mb-4" />
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ────────────────────────────────────── */}
      <section ref={featuresRef} className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={FADE_UP}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight mb-4">
              One Platform. Five Unfair Advantages.
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-sm">
              Everything your deal sourcing workflow is missing — unified, automated, and running
              before you wake up.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, label, product, description }, i) => (
              <motion.div
                key={label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } },
                }}
                className="p-6 bg-zinc-900 border border-white/5 rounded-2xl hover:border-emerald-500/20 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {product}
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm mb-2">{label}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Signal sources ──────────────────────────────────── */}
      <section className="py-12 px-6 border-y border-white/5 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">
            Grounded in real data, not training-data guesses
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {SOURCES.map((s) => (
              <span key={s} className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead capture form ───────────────────────────────── */}
      <section ref={formRef} id="contact" className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={FADE_UP}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight mb-4">
              Get Early Access
            </h2>
            <p className="text-zinc-400 text-sm">
              We're onboarding a select group of investment teams. Tell us about your workflow and
              we'll be in touch within 24 hours.
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 px-8 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-black uppercase italic mb-2">You're on the list.</h3>
              <p className="text-zinc-400 text-sm">We'll be in touch within 24 hours.</p>
            </motion.div>
          ) : (
            <motion.form
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={FADE_UP}
              onSubmit={handleSubmit}
              className="space-y-4 bg-zinc-900 border border-white/5 rounded-3xl p-8"
            >
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ['firstName', 'First name *'],
                    ['lastName', 'Last name'],
                  ] as const
                ).map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                      {label}
                    </label>
                    <input
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      required={name === 'firstName'}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Work email *
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Company *
                </label>
                <input
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  Role *
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                >
                  <option value="">Select your role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  What are you trying to solve?{' '}
                  <span className="text-zinc-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. We spend 3 hours a day manually sourcing, looking for something more systematic…"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                />
              </div>
              {submitError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm uppercase tracking-widest rounded-xl transition-colors"
              >
                {submitting ? 'Sending…' : 'Request Early Access'}
              </button>
            </motion.form>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-xs text-zinc-600">
          © 2025 Trend Equity · Built for builders who move first.
        </p>
      </footer>
    </div>
  );
}
