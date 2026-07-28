import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  CalendarDays,
  Repeat,
  Sparkles,
  MonitorSmartphone,
  ArrowRight,
  Check,
  Search,
  Plus,
} from 'lucide-react';

const FEATURES = [
  { icon: ShieldCheck, key: 'localfirst' },
  { icon: CalendarDays, key: 'calendar' },
  { icon: Repeat, key: 'recurrence' },
  { icon: Sparkles, key: 'ai' },
  { icon: MonitorSmartphone, key: 'crossplatform' },
];

const MOCK_TASKS = [
  { done: false, tone: 'rose', w: 78 },
  { done: true, tone: 'primary', w: 62 },
  { done: false, tone: 'amber', w: 70 },
  { done: false, tone: 'emerald', w: 54 },
];

const TONE_DOT = {
  rose: 'bg-[hsl(var(--accent-danger))]',
  primary: 'bg-primary',
  amber: 'bg-[hsl(var(--accent-energy))]',
  emerald: 'bg-[hsl(var(--success))]',
};

const STATS = [
  { value: '100%', key: 'local' },
  { value: '24/7', key: 'offline' },
  { value: '3+', key: 'platforms' },
];

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight">{t('app.name')}</span>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('landing.ctaLogin')}
            </Link>
            <Link
              to="/register"
              className="btn-primary hidden h-9 items-center text-sm sm:inline-flex"
            >
              {t('landing.ctaRegister')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero + Mockup */}
      <section className="relative overflow-hidden">
        {/* 气势背景：primary 光斑 + 网格点阵 */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-[-15%] h-[700px] w-[1100px] -translate-x-1/2 rounded-full opacity-80 blur-3xl"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 60%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-100"
            style={{
              backgroundImage:
                'radial-gradient(hsl(var(--foreground) / 0.13) 1.5px, transparent 1.5px)',
              backgroundSize: '32px 32px',
              maskImage:
                'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 70%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 70%)',
            }}
          />
        </div>

        <div className="mx-auto max-w-5xl px-6 pt-24 text-center md:pt-36">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t('landing.badge')}
          </span>
          <h1 className="mx-auto mt-7 text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {t('landing.heroDesc')}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="btn-primary inline-flex h-12 items-center gap-2 px-7 text-base"
            >
              {t('landing.ctaRegister')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-7 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t('landing.ctaLogin')}
            </Link>
          </div>

          {/* 数字统计 */}
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-4">
            {STATS.map((s) => (
              <div key={s.key} className="text-center">
                <div className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">
                  {t(`landing.stats.${s.key}`)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup 窗口 */}
        <div className="relative mx-auto -mt-6 max-w-5xl px-6 pb-24 md:-mt-16 md:pb-28">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[hsl(var(--accent-danger))]" />
              <span className="h-3 w-3 rounded-full bg-[hsl(var(--accent-energy))]" />
              <span className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" />
              <div className="ml-4 flex-1">
                <div className="mx-auto h-5 max-w-xs rounded-full bg-background" />
              </div>
            </div>
            <div className="flex">
              <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-border bg-muted/30 p-3 sm:flex">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <div className="h-6 w-6 rounded-md bg-primary" />
                  <div className="h-3 w-20 rounded bg-foreground/15" />
                </div>
                {[
                  { dot: 'bg-primary', w: 'w-24', active: true },
                  { dot: 'bg-foreground/20', w: 'w-20', active: false },
                  { dot: 'bg-foreground/20', w: 'w-16', active: false },
                ].map((n, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${
                      n.active ? 'bg-accent' : ''
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${n.dot}`} />
                    <span className={`h-2.5 rounded ${n.w} bg-foreground/15`} />
                  </div>
                ))}
              </aside>
              <div className="flex-1 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="h-4 w-28 rounded bg-foreground/20" />
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
                      <Search className="h-4 w-4" />
                    </div>
                    <div className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground">
                      <Plus className="h-4 w-4" />
                      <span className="h-2.5 w-10 rounded bg-primary-foreground/40" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {MOCK_TASKS.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          task.done
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                      >
                        {task.done && <Check className="h-3 w-3" />}
                      </span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[task.tone]}`} />
                      <span
                        className={`h-3 rounded bg-foreground/20 ${task.done ? 'opacity-40' : ''}`}
                        style={{ width: `${task.w}%` }}
                      />
                      <span className="h-2.5 w-12 shrink-0 rounded bg-muted-foreground/30" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t('landing.featuresDesc')}</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{t(`landing.feature.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.feature.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center shadow-lg">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(50% 80% at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)',
              }}
            />
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t('landing.ctaBottomTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              {t('landing.ctaBottomDesc')}
            </p>
            <Link
              to="/register"
              className="btn-primary mt-9 inline-flex h-12 items-center gap-2 px-7 text-base"
            >
              {t('landing.ctaRegister')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-muted-foreground">
          {t('app.name')} · {t('landing.footer')}
        </div>
      </footer>
    </div>
  );
}
