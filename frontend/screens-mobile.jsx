// Mobile companion view — single artboard showing the dashboard on phone.

function MobileDashboard({ copy, profile, portfolio }) {
  const segments = portfolio.positions.reduce((acc, p) => {
    const e = acc.find((x) => x.sector === p.sector);
    if (e) e.weight += p.weight; else acc.push({ sector: p.sector, weight: p.weight, color: SECTOR_COLORS[p.sector] });
    return acc;
  }, []);

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Geist, system-ui, sans-serif' }}>
      {/* status bar */}
      <div style={{ height: 42, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 22px 6px', fontFamily: 'Geist, system-ui, sans-serif', fontSize: 13, fontWeight: 600 }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 10 }}>●●●●</span>
          <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="2" width="12" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" /><rect x="1.5" y="3.5" width="9" height="3" fill="currentColor" /></svg>
        </span>
      </div>

      {/* masthead */}
      <div style={{ padding: '6px 22px 12px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark size={14} />
        <div style={{ width: 30, height: 30, borderRadius: 15, border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'Newsreader, serif' }}>S</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px 0' }}>
        <Eyebrow>Portfolio · today</Eyebrow>
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: 44, lineHeight: 1, marginTop: 6, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
          {fmtUSD(portfolio.budget)}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          <Delta value={0.42} size="lg" />
          <span style={{ color: 'var(--ink-mute)' }}>{fmtUSD(portfolio.budget * 0.0042, { signed: true, decimals: 2 })} today</span>
        </div>

        {/* Sparkline area */}
        <div style={{ marginTop: 20, height: 100, border: '1px solid var(--rule)', background: 'var(--surface)', padding: 8 }}>
          <Sparkline data={portfolio.series} width={300} height={84} stroke="var(--accent)" fill="var(--accent)" strokeWidth={1.4} />
        </div>

        {/* Allocation strip */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <Eyebrow>Allocation</Eyebrow>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)' }}>{riskLabelFor(profile.risk).label}</span>
          </div>
          <div style={{ display: 'flex', height: 8, gap: 1.5 }}>
            {segments.map((s) => (
              <div key={s.sector} style={{ flex: s.weight, background: s.color }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 10 }}>
            {segments.map((s) => (
              <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, background: s.color }} />
                  <span style={{ color: 'var(--ink-soft)' }}>{s.sector}</span>
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(s.weight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings */}
        <div style={{ marginTop: 22 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Holdings</Eyebrow>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {portfolio.positions.slice(0, 6).map((p) => (
              <div key={p.ticker} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--rule)', alignItems: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 4, background: SECTOR_COLORS[p.sector], marginRight: 4, verticalAlign: 'middle' }} />
                  {p.ticker}
                </div>
                <Sparkline data={genSeries(p.price)} width={70} height={20} stroke={p.day >= 0 ? 'var(--gain)' : 'var(--loss)'} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtUSD(p.dollars, { decimals: 0 })}</div>
                  <Delta value={p.day} />
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              + {portfolio.positions.length - 6} more
            </div>
          </div>
        </div>

        {/* Counsel card */}
        <div style={{ marginTop: 18, border: '1px solid var(--ink)', padding: '14px 16px', background: 'var(--surface)' }}>
          <Eyebrow>Next action · within 30 days</Eyebrow>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 16, lineHeight: 1.25, marginTop: 4 }}>
            Rebalance US equity drift back to target.
          </div>
          <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--gain)' }}>+ 0.18% expected return</div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      {/* tab bar */}
      <div style={{ borderTop: '1px solid var(--rule)', padding: '10px 0 22px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'var(--bg)' }}>
        {['Portfolio', 'Counsel', 'Trade', 'Profile'].map((t, i) => (
          <div key={t} style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: i === 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>
            <div style={{ width: 18, height: 18, margin: '0 auto 4px', border: '1px solid currentColor', borderRadius: i === 1 ? 9 : 0 }} />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function genSeries(seed) {
  const out = [];
  let v = 1;
  const rng = (i) => ((seed * 100 + i * 7919) % 233280) / 233280;
  for (let i = 0; i < 16; i++) { v = v * (1 + (rng(i) - 0.48) * 0.025); out.push(v); }
  return out;
}

Object.assign(window, { MobileDashboard });
