import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Dumbbell,
  Flame,
  HeartPulse,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react';
import PublicNavbar from '../../components/layout/PublicNavbar';
import PublicFooter from '../../components/layout/PublicFooter';

const HERO_METRICS = [
  { label: 'Training Floor', value: '15,000+ sq ft' },
  { label: 'Biometric Access', value: 'ZKFace V4.0' },
  { label: 'Certified Coaches', value: '12 Specialists' },
  { label: 'Open Daily', value: '05 AM – 10:30 PM' },
];

const PROGRAMS = [
  {
    title: 'Strength & Hypertrophy',
    description:
      'Periodized progressive overload blocks built around calibrated plates, Olympic racks, and guided form coaching.',
    icon: Dumbbell,
    tag: 'Most Popular',
  },
  {
    title: 'HIIT & Metabolic Burn',
    description:
      'High-output interval circuits combining sled pushes, assault bikes, and kettlebell complexes for rapid conditioning.',
    icon: Flame,
    tag: 'Fat Loss',
  },
  {
    title: '1-on-1 Personal Coaching',
    description:
      'Tailored programming, weekly body-composition check-ins, and nutrition targets built around your schedule.',
    icon: Award,
    tag: 'Custom Plan',
  },
  {
    title: 'Mobility & Athletic Recovery',
    description:
      'Joint longevity, posture correction, and guided active recovery sessions to keep you training pain-free.',
    icon: HeartPulse,
    tag: 'Longevity',
  },
];

const PLANS = [
  {
    name: 'Monthly',
    price: '₹2,499',
    period: '/ month',
    description: 'Flexible month-to-month access with full floor and biometric entry.',
    features: [
      'Unlimited gym floor access',
      'ZKFace touchless biometric check-in',
      'Initial fitness & mobility assessment',
      'Locker & shower access',
    ],
    featured: false,
    cta: 'Choose Monthly',
  },
  {
    name: 'Quarterly',
    price: '₹6,499',
    period: '/ 3 months',
    badge: 'Most Popular',
    description: 'Our best-selling transformation tier with structured coach check-ins.',
    features: [
      'Everything in Monthly plan',
      '2 personal training orientation sessions',
      'Monthly body-composition & progress review',
      'WhatsApp renewal & streak reminders',
      'Save ₹1,000 compared to monthly',
    ],
    featured: true,
    cta: 'Join Quarterly',
  },
  {
    name: 'Annual',
    price: '₹19,999',
    period: '/ 12 months',
    description: 'Maximum value for year-round athletes committed to long-term impact.',
    features: [
      'Everything in Quarterly plan',
      'Priority group HIIT & mobility slots',
      '4 guest day-passes per quarter',
      '14-day membership freeze flexibility',
      'Save nearly ₹10,000 per year',
    ],
    featured: false,
    cta: 'Go Annual',
  },
];

const FACILITIES = [
  {
    title: 'Touchless Facial Biometric Entry',
    description:
      'Walk straight in with our ZKFace V4.0 recognition terminal—instant attendance logging with zero keycards or queues.',
    icon: ScanFace,
  },
  {
    title: 'Competition-Grade Lifting Zone',
    description:
      'Six power racks, deadlift platforms, calibrated Olympic barbells, and dumbbells up to 60 kg.',
    icon: ShieldCheck,
  },
  {
    title: 'Connected Cardio Theatre',
    description:
      'Commercial treadmills, Concept2 rowers, stair climbers, and air bikes with heart-rate zone tracking.',
    icon: Activity,
  },
  {
    title: 'Dedicated Coach Support',
    description:
      'Floor trainers available across peak morning and evening shifts for spotting, form checks, and workout guidance.',
    icon: Users,
  },
];

/**
 * 100% static public marketing landing page.
 * Strict constraint: zero database or Supabase API calls.
 */
export default function Landing() {
  const [selectedPlan, setSelectedPlan] = useState('Quarterly');
  const [trialName, setTrialName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialSubmitted, setTrialSubmitted] = useState(false);

  function handleTrialSubmit(e) {
    e.preventDefault();
    if (!trialName.trim() || !trialPhone.trim()) return;
    setTrialSubmitted(true);
  }

  return (
    <div id="top" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-800/80">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_45%)]"
          />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8 lg:py-24">
            <div className="lg:col-span-7 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Smart Gym &amp; Biometric Facility</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
                Train Harder. <br />
                <span className="text-amber-400">Track Every Session</span> Effortlessly.
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Fit &amp; Impact pairs commercial-grade strength and conditioning zones with instant
                ZKFace V4.0 facial check-in—so you spend zero time at the front desk and 100% of
                your energy under the bar.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#plans"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
                >
                  <span>Join Now</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#book-trial"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                >
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span>Book Free Trial</span>
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
                {HERO_METRICS.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5"
                  >
                    <p className="text-lg font-bold text-white">{metric.value}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Book Free Trial Card */}
            <div id="book-trial" className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    7-Day Pass Available
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                    Zero Commitment
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-bold text-white">
                  Book Your Free Trial Session
                </h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  Experience the floor, meet our coaches, and test our touchless biometric entry.
                </p>

                {trialSubmitted ? (
                  <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-white">
                          Trial Request Noted for {trialName}
                        </p>
                        <p className="mt-1 text-slate-300">
                          Show this confirmation at the Fit &amp; Impact front desk or call{' '}
                          <span className="font-semibold text-white">+91 98765 43210</span> to
                          lock your preferred time slot ({selectedPlan} interest).
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setTrialSubmitted(false);
                            setTrialName('');
                            setTrialPhone('');
                          }}
                          className="mt-3 text-xs font-semibold text-amber-400 hover:underline"
                        >
                          Submit another inquiry
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleTrialSubmit} className="mt-6 space-y-4">
                    <div>
                      <label htmlFor="trial-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Full Name
                      </label>
                      <input
                        id="trial-name"
                        type="text"
                        required
                        value={trialName}
                        onChange={(e) => setTrialName(e.target.value)}
                        placeholder="e.g., Arjun Mehta"
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="trial-phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        WhatsApp / Phone Number
                      </label>
                      <input
                        id="trial-phone"
                        type="tel"
                        required
                        value={trialPhone}
                        onChange={(e) => setTrialPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="trial-plan" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Interested Tier
                      </label>
                      <select
                        id="trial-plan"
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      >
                        <option value="Monthly">Monthly Membership</option>
                        <option value="Quarterly">Quarterly Membership</option>
                        <option value="Annual">Annual Membership</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      Claim Free Trial Pass
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Programs Section */}
        <section id="programs" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Training Programs
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for Every Goal, Backed by Real Coaching
            </h2>
            <p className="mt-3 text-slate-400">
              Whether you are building foundational strength, cutting body fat, or preparing for athletic competition, our floor programs keep progression measurable.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((program) => {
              const Icon = program.icon;
              return (
                <div
                  key={program.title}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-amber-500/40 hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                      {program.tag}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{program.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {program.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Membership Plans Section */}
        <section id="plans" className="border-y border-slate-800/80 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Membership Plans
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Transparent Pricing. Zero Hidden Fees.
              </h2>
              <p className="mt-3 text-slate-400">
                All memberships include instant facial biometric enrollment, locker rooms, and full access to strength &amp; cardio zones.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-8 transition ${
                    plan.featured
                      ? 'border-amber-400 bg-slate-900 shadow-xl shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3.5 right-6 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
                    <div className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold tracking-tight text-white">
                        {plan.price}
                      </span>
                      <span className="text-sm font-medium text-slate-400">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="mt-8 flex-1 space-y-3.5 text-sm text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#book-trial"
                    onClick={() => setSelectedPlan(plan.name)}
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
                      plan.featured
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'border border-slate-700 bg-slate-900 text-white hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Facilities Section */}
        <section id="facilities" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Facilities &amp; Tech
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Designed for Flow, Speed, and Serious Training
              </h2>
              <p className="text-slate-400 leading-relaxed">
                From automated ZKFace V4.0 check-ins that sync your attendance in real time to competition-spec lifting platforms, every square foot is built to eliminate friction.
              </p>
              <div className="pt-2">
                <a
                  href="#book-trial"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 hover:text-amber-300"
                >
                  <span>Schedule a walkthrough &amp; trial</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 grid gap-6 sm:grid-cols-2">
              {FACILITIES.map((facility) => {
                const Icon = facility.icon;
                return (
                  <div
                    key={facility.title}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-white">{facility.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {facility.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
