// Onboarding screens: welcome, profile (budget/risk/term/goals).
// All use CSS custom props from the palette applied at the prototype root.

const { useState, useEffect, useRef } = React;

// ── Button ────────────────────────────────────────────────────────────────
function Button({ children, onClick, variant = 'primary', size = 'md', disabled, style = {} }) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: 'Geist, system-ui, sans-serif',
      fontSize: size === 'lg' ? 14 : 13,
      fontWeight: 500,
      letterSpacing: 0.1,
      padding: size === 'lg' ? '14px 22px' : '10px 18px',
      borderRadius: 2,
      border: isGhost ? 'none' : '1px solid var(--ink)',
      background: isPrimary ? 'var(--ink)' : 'transparent',
      color: isPrimary ? 'var(--bg)' : 'var(--ink)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      display: 'inline-flex', alignItems: 'center', gap: 8,
      transition: 'all 0.15s',
      ...style,
    }}>{children}</button>
  );
}

// ── Numeric input with currency prefix ───────────────────────────────────
function MoneyInput({ value, onChange, autoFocus }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      borderBottom: '1px solid var(--ink)', paddingBottom: 6,
    }}>
      <span style={{ fontFamily: 'Newsreader, serif', fontSize: 56, fontWeight: 400, color: 'var(--ink-soft)' }}>$</span>
      <input type="text" value={value.toLocaleString('en-US')} autoFocus={autoFocus}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ''));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        style={{
          fontFamily: 'Newsreader, serif', fontSize: 56, fontWeight: 400,
          border: 'none', background: 'transparent', color: 'var(--ink)',
          outline: 'none', width: '100%', padding: 0, lineHeight: 1.1,
          fontFeatureSettings: '"tnum"',
        }} />
    </div>
  );
}

// ── Risk slider (variant A) ─────────────────────────────────────────────
function RiskSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const handlePtr = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    onChange(Math.round((x / r.width) * 100));
  };
  const label = riskLabelFor(value);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 28, lineHeight: 1.1 }}>{label.label}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{label.desc}</div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
          {String(value).padStart(3, '0')} / 100
        </div>
      </div>
      <div ref={trackRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePtr(e); }}
        onPointerMove={(e) => { if (e.buttons) handlePtr(e); }}
        style={{ position: 'relative', height: 32, cursor: 'pointer', userSelect: 'none', touchAction: 'none' }}>
        {/* Hairline track with tick marks */}
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 1, background: 'var(--rule)' }} />
        {Array.from({ length: 21 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 13, left: `${(i / 20) * 100}%`, width: 1, height: 7,
            background: 'var(--rule)', transform: 'translateX(-0.5px)',
          }} />
        ))}
        {/* Filled track up to current */}
        <div style={{ position: 'absolute', top: 16, left: 0, width: `${value}%`, height: 1, background: 'var(--ink)' }} />
        {/* Handle */}
        <div style={{
          position: 'absolute', top: 6, left: `${value}%`, transform: 'translateX(-50%)',
          width: 22, height: 22, borderRadius: 11, background: 'var(--bg)',
          border: '1.5px solid var(--ink)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          transition: 'transform 0.05s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <span>Conservative</span><span>Balanced</span><span>Aggressive</span>
      </div>
    </div>
  );
}

// ── Risk cards (variant B) ──────────────────────────────────────────────
function RiskCards({ value, onChange }) {
  const opts = [
    { v: 15, label: 'Capital preservation', detail: 'Bond-dominant. Stable income, minimal drawdown risk.' },
    { v: 30, label: 'Conservative', detail: 'Income with modest growth. Suitable for shorter horizons.' },
    { v: 50, label: 'Balanced', detail: 'Equal weighting of growth and income. Cycle-tested allocation.' },
    { v: 70, label: 'Growth', detail: 'Long-horizon appreciation. Equity-tilted, cyclical exposure.' },
    { v: 90, label: 'Aggressive growth', detail: 'Maximum compounding. Concentrated in equities.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            textAlign: 'left', padding: '14px 16px',
            border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
            background: on ? 'var(--surface)' : 'transparent',
            cursor: 'pointer', borderRadius: 2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            transition: 'all 0.15s',
          }}>
            <div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: 'var(--ink)' }}>{o.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{o.detail}</div>
            </div>
            <div style={{
              width: 14, height: 14, borderRadius: 7, border: '1px solid var(--ink)',
              background: on ? 'var(--ink)' : 'transparent', flexShrink: 0,
            }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Risk dialogue (variant C) ───────────────────────────────────────────
function RiskDialogue({ value, onChange }) {
  // Conversational scenario-based input. Each answer nudges value.
  const scenarios = [
    { q: 'Markets fall 25% in a year. Your move?', as: [
      { t: 'Sell to cash', d: -30 },
      { t: 'Hold and wait', d: 0 },
      { t: 'Buy more', d: 25 },
    ]},
    { q: 'A friend offers a hot tip — high risk, possibly 10×.', as: [
      { t: 'No thanks', d: -15 },
      { t: 'Small position', d: 5 },
      { t: 'Sizeable bet', d: 20 },
    ]},
  ];
  const [answers, setAnswers] = useState({});
  useEffect(() => {
    const baseline = 50;
    const delta = Object.values(answers).reduce((s, n) => s + n, 0);
    onChange(Math.max(0, Math.min(100, baseline + delta)));
  }, [answers]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {scenarios.map((s, i) => (
        <div key={i}>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 16, marginBottom: 8 }}>“{s.q}”</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {s.as.map((a) => {
              const on = answers[i] === a.d;
              return (
                <button key={a.t} onClick={() => setAnswers((x) => ({ ...x, [i]: a.d }))} style={{
                  flex: 1, padding: '10px 12px', fontSize: 12,
                  fontFamily: 'Geist, system-ui, sans-serif',
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--bg)' : 'var(--ink)',
                  cursor: 'pointer', borderRadius: 2, transition: 'all 0.15s',
                }}>{a.t}</button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ paddingTop: 4, borderTop: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Indicated posture</div>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22 }}>{riskLabelFor(value).label}</div>
        </div>
      </div>
    </div>
  );
}

// ── Term selector ────────────────────────────────────────────────────────
function TermSelector({ value, onChange }) {
  // Term is stored in years; 0.5 = 6 mo. Range: 6 mo → 15 yr.
  const opts = [
    { v: 0.5, label: '6 mo', hint: 'Short' },
    { v: 1,   label: '1 yr', hint: 'Short' },
    { v: 3,   label: '3 yr', hint: 'Medium' },
    { v: 7,   label: '7 yr', hint: 'Medium' },
    { v: 15,  label: '15 yr', hint: 'Long' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '14px 8px', cursor: 'pointer', borderRadius: 2,
            border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
            background: on ? 'var(--surface)' : 'transparent',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontFamily: 'Newsreader, serif', fontSize: 20, color: 'var(--ink)' }}>{o.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{o.hint}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── Goal chips ──────────────────────────────────────────────────────────
function GoalChips({ value, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {GOALS.map((g) => {
        const on = value.includes(g.id);
        return (
          <button key={g.id} onClick={() => onToggle(g.id)} style={{
            padding: '10px 14px', cursor: 'pointer', borderRadius: 999,
            border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
            background: on ? 'var(--ink)' : 'transparent',
            color: on ? 'var(--bg)' : 'var(--ink)',
            fontFamily: 'Geist, system-ui, sans-serif', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}>
            {on && <span style={{ fontSize: 11 }}>✓</span>}
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Welcome screen ──────────────────────────────────────────────────────
function WelcomeScreen({ copy, onBegin }) {
  return (
    <div style={{
      height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg)', color: 'var(--ink)',
    }}>
      {/* Left: Editorial intro */}
      <div style={{ padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Wordmark size={20} />
        <div>
          <Eyebrow style={{ marginBottom: 18 }}>Vol. 01 · No. 001 · May 2026</Eyebrow>
          <h1 style={{
            fontFamily: 'Newsreader, serif', fontSize: 72, lineHeight: 0.95,
            margin: 0, fontWeight: 400, letterSpacing: -1.5,
            textWrap: 'pretty',
          }}>{copy.welcome}.</h1>
          <p style={{
            fontFamily: 'Newsreader, serif', fontStyle: 'italic',
            fontSize: 22, lineHeight: 1.35, color: 'var(--ink-soft)',
            marginTop: 24, maxWidth: 460,
          }}>{copy.welcomeSub}</p>
          <div style={{
            fontFamily: 'Geist, system-ui, sans-serif', fontSize: 14,
            color: 'var(--ink-soft)', lineHeight: 1.55, marginTop: 28, maxWidth: 440,
          }}>{copy.intro}</div>
          <div style={{ marginTop: 36 }}>
            <Button size="lg" onClick={onBegin}>{copy.btnBegin} →</Button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          <span>SIPC-insured custody · FINRA-aligned</span>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>
      {/* Right: editorial collage */}
      <div style={{ background: 'var(--surface)', padding: '64px 56px', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Eyebrow>The Counsel</Eyebrow>
        <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 12 }}>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 32, lineHeight: 1.1, letterSpacing: -0.5 }}>
            Markets reward the patient. The rest is noise.
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', marginTop: 16, textTransform: 'uppercase' }}>
            — Meridian House Doctrine
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, paddingTop: 8 }}>
          {[
            { k: 'Median time to portfolio', v: '4 min, 12 sec' },
            { k: 'Avg. expense ratio', v: '0.07%' },
            { k: 'Securities universe', v: '8,412' },
            { k: 'Counsel published', v: 'Daily · 09:30 ET' },
          ].map((s, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--rule)', paddingTop: 10 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.k}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, marginTop: 4 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--rule)', paddingTop: 16 }}>
          <Eyebrow style={{ marginBottom: 10 }}>Markets · Now</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
            {[['S&P 500', '5,847.21', 0.42], ['Nasdaq', '18,712.04', 0.66], ['Dow', '42,118.55', 0.21], ['10y UST', '4.18%', -0.04]].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--ink-soft)' }}>{r[0]}</span>
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--ink)' }}>{r[1]}</span>
                  <Delta value={r[2]} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile screen ──────────────────────────────────────────────────────
function ProfileScreen({ copy, profile, setProfile, riskStyle, density, onContinue, onBack }) {
  const { budget, risk, term, goals } = profile;
  const set = (patch) => setProfile({ ...profile, ...patch });
  const toggleGoal = (id) => set({ goals: goals.includes(id) ? goals.filter((x) => x !== id) : [...goals, id] });
  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid var(--rule)' }}>
        <Wordmark size={16} />
        <div style={{ display: 'flex', gap: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <span style={{ color: 'var(--ink)' }}>01 · Profile</span>
          <span>02 · Generate</span>
          <span>03 · Authorize</span>
          <span>04 · Steward</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
        {/* Form */}
        <div style={{ padding: '48px 72px', overflow: 'auto' }}>
          <Eyebrow>The intake</Eyebrow>
          <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: 40, fontWeight: 400, letterSpacing: -0.7, margin: '8px 0 36px', textWrap: 'pretty' }}>
            Tell me how you’d like to invest.
          </h1>

          {/* Budget */}
          <section style={{ marginBottom: 44 }}>
            <Eyebrow style={{ marginBottom: 12 }}>I · Budget to deploy</Eyebrow>
            <MoneyInput value={budget} onChange={(v) => set({ budget: v })} autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {[1000, 5000, 10000, 25000, 50000].map((v) => (
                <button key={v} onClick={() => set({ budget: v })} style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  padding: '4px 10px', background: 'transparent',
                  border: '1px solid var(--rule)', borderRadius: 999, cursor: 'pointer',
                  color: 'var(--ink-soft)',
                }}>${v.toLocaleString()}</button>
              ))}
            </div>
          </section>

          {/* Risk */}
          <section style={{ marginBottom: 44 }}>
            <Eyebrow style={{ marginBottom: 16 }}>II · Risk posture</Eyebrow>
            {riskStyle === 'slider' && <RiskSlider value={risk} onChange={(v) => set({ risk: v })} />}
            {riskStyle === 'cards' && <RiskCards value={risk} onChange={(v) => set({ risk: v })} />}
            {riskStyle === 'dialogue' && <RiskDialogue value={risk} onChange={(v) => set({ risk: v })} />}
          </section>

          {/* Term */}
          <section style={{ marginBottom: 44 }}>
            <Eyebrow style={{ marginBottom: 14 }}>III · Investment horizon</Eyebrow>
            <TermSelector value={term} onChange={(v) => set({ term: v })} />
          </section>

          {/* Goals */}
          <section style={{ marginBottom: 44 }}>
            <Eyebrow style={{ marginBottom: 14 }}>IV · Objectives <span style={{ color: 'var(--ink-mute)' }}>(select one or more)</span></Eyebrow>
            <GoalChips value={goals} onToggle={toggleGoal} />
          </section>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
            <Button variant="ghost" onClick={onBack}>← {copy.btnBack}</Button>
            <Button onClick={onContinue} disabled={!budget || !goals.length}>{copy.btnGenerate} →</Button>
          </div>
        </div>

        {/* Right rail: live preview */}
        <aside style={{ background: 'var(--surface)', borderLeft: '1px solid var(--rule)', padding: '40px 32px', overflow: 'auto' }}>
          <Eyebrow style={{ marginBottom: 14 }}>Live preview</Eyebrow>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 24, lineHeight: 1.15, marginBottom: 4 }}>
            {riskLabelFor(risk).label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 24 }}>
            {riskLabelFor(risk).desc}
          </div>

          <Rule style={{ margin: '0 0 18px' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Budget</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22 }}>{fmtUSD(budget)}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Projected at {term < 1 ? `${Math.round(term * 12)} mo` : `${term} yr`}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, color: 'var(--gain)' }}>
                {fmtUSD(budget * Math.pow(1 + (4.2 + 6.8 * risk / 100) / 100, term), { compact: true })}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>
                {fmtPct(((Math.pow(1 + (4.2 + 6.8 * risk / 100) / 100, term)) - 1) * 100, { signed: true, decimals: 0 })} expected
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Annualized vol.</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22 }}>{(4.5 + 12 * risk / 100).toFixed(1)}%</div>
            </div>
          </div>

          <Rule style={{ margin: '24px 0 18px' }} />

          <Eyebrow style={{ marginBottom: 10 }}>Indicative allocation</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(() => {
              const r = risk / 100;
              const raw = [
                { k: 'Technology',  v: 10 + 30 * r },
                { k: 'Healthcare',  v: 15 - 5  * r },
                { k: 'Financials',  v: 14 - 2  * r },
                { k: 'Consumer',    v: 10 - 3  * r },
                { k: 'Bonds',       v: 50 - 38 * r },
              ].map(s => ({ ...s, v: Math.max(2, s.v) }));
              const total = raw.reduce((s, a) => s + a.v, 0);
              return raw.map((s, i) => {
                const pct = (s.v / total) * 100;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{s.k}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-mute)' }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--rule)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: SECTOR_COLORS[s.k] || 'var(--ink)', transition: 'width 0.25s' }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-mute)' }}>
            Exact sector mix determined by AI based on your goals.
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Button, WelcomeScreen, ProfileScreen });
