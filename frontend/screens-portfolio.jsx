// Generating, Dashboard, Buy, Success, Recommendations screens.

const { useState: useState2, useEffect: useEffect2, useMemo: useMemo2, useRef: useRef2 } = React;

// Wrapper for InteractiveChart with fallback to AreaChart
function ChartComponent(props) {
  if (window.InteractiveChart) {
    return React.createElement(window.InteractiveChart, props);
  }
  // Fallback to AreaChart
  return React.createElement(AreaChart, {
    data: props.series?.map(s => s.value) || [],
    height: 208,
    accent: props.accent,
    yLabels: [],
    xLabels: [],
  });
}

// ── Generating screen ────────────────────────────────────────────────────
function GeneratingScreen({ copy, profile, onComplete, autoPlay = true, isLoading = true }) {
  const [stepIdx, setStepIdx] = useState2(0);
  const [animDone, setAnimDone] = useState2(false);
  // Only consider truly done when both animation finished AND AI has responded
  const done = animDone && !isLoading;

  useEffect2(() => {
    if (!autoPlay) return;
    const total = AGENT_STEPS.length;
    let i = 0;
    const tick = () => {
      setStepIdx(i);
      i++;
      // Stop at last step — keep it spinning until AI finishes
      if (i >= total) { setAnimDone(true); return; }
      setTimeout(tick, 950 + Math.random() * 400);
    };
    tick();
  }, []);

  // Transition once both animation and AI are complete
  useEffect2(() => {
    if (animDone && !isLoading) setTimeout(onComplete, 600);
  }, [animDone, isLoading]);

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid var(--rule)' }}>
        <Wordmark size={16} />
        <div style={{ display: 'flex', gap: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <span>01 · Profile</span>
          <span style={{ color: 'var(--ink)' }}>02 · Generate</span>
          <span>03 · Authorize</span>
          <span>04 · Steward</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        {/* Left: progress narrative */}
        <div style={{ padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Eyebrow>{copy.generating}</Eyebrow>
          <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: 44, fontWeight: 400, letterSpacing: -0.5, margin: '10px 0 18px', textWrap: 'pretty', lineHeight: 1.05 }}>
            {copy.generating}.
          </h1>
          <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.4, margin: '0 0 36px', maxWidth: 480 }}>
            {copy.generatingSub}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid var(--rule)' }}>
            {AGENT_STEPS.map((step, i) => {
              const active = i === stepIdx && !done;
              const complete = i < stepIdx || done;
              return (
                <div key={i} style={{
                  display: 'flex', gap: 16, padding: '16px 0',
                  borderBottom: '1px solid var(--rule)',
                  opacity: i > stepIdx && !done ? 0.35 : 1,
                  transition: 'opacity 0.3s',
                }}>
                  <div style={{
                    flexShrink: 0, width: 22, height: 22, marginTop: 2,
                    border: '1px solid var(--ink)',
                    background: complete ? 'var(--ink)' : 'transparent',
                    color: complete ? 'var(--bg)' : 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    position: 'relative',
                  }}>
                    {complete ? '✓' : (active ? <Spinner /> : (i + 1).toString().padStart(2, '0'))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'Newsreader, serif', fontSize: 18,
                      color: active ? 'var(--ink)' : (complete ? 'var(--ink)' : 'var(--ink-soft)'),
                    }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{step.detail}</div>
                  </div>
                  {active && (
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>
                      RUNNING…
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: live numbers ticker */}
        <div style={{ background: 'var(--surface)', borderLeft: '1px solid var(--rule)', padding: '64px 56px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Eyebrow>Diagnostic</Eyebrow>

          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Candidate set</div>
            <div style={{ fontFamily: 'Newsreader, serif', fontSize: 56, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(0, 8412 - stepIdx * 1641).toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>securities under consideration</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { k: 'Sharpe target',     v: '≥ 0.85' },
              { k: 'Max drawdown',      v: '≤ 18%' },
              { k: 'Expense ceiling',   v: '0.12%' },
              { k: 'Liquidity',         v: 'T+1' },
            ].map((c, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--rule)', paddingTop: 10 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{c.k}</div>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 20, marginTop: 2 }}>{c.v}</div>
              </div>
            ))}
          </div>

          {/* Console-like stream */}
          <div style={{
            marginTop: 'auto',
            background: 'var(--bg)', border: '1px solid var(--rule)',
            padding: 14, height: 180, overflow: 'hidden',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, lineHeight: 1.6,
            color: 'var(--ink-soft)',
          }}>
            {[
              '› Checking today’s prices across major exchanges',
              '› Narrowed the field to 6,771 promising securities',
              '› Looking at how each one behaves in a crisis',
              '› Reviewing 24 years of market history',
              `› Tuning for your goal — ${riskLabelFor(profile.risk).label.toLowerCase()}`,
              `› Building for a ${profile.term < 1 ? Math.round(profile.term * 12) + '-month' : profile.term + '-year'} horizon`,
              '› Filtering out high-fee and illiquid options',
              '› Balancing growth, income, and protection',
              '› Found a mix that fits your profile',
              '› Putting your summary together',
            ].slice(0, Math.min(10, stepIdx * 2 + 2)).map((l, i) => (
              <div key={i} style={{ opacity: 0.6 + (i / 14) }}>{l}</div>
            ))}
            {!done && <div><span style={{ color: 'var(--ink)' }}>▊</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" style={{ animation: 'mer-spin 0.8s linear infinite' }}>
      <circle cx="5.5" cy="5.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 16" strokeLinecap="round" />
    </svg>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ copy, profile, portfolio, density, mode = 'initial', pendingOrders = [], onAddOrder, onRemoveOrder, onAuthorize, onBuy, onCounsel, onModify, chartPeriod = 'Max', onChartPeriodChange, currentScreen, onNavigate, automation = {} }) {
  const [expanded, setExpanded] = useState2(null);
  const defaultProjectedPeriod = portfolio.term <= 0.5 ? '6M' : portfolio.term <= 1 ? '1Y' : `${portfolio.term}Y`;
  const [projectedChartPeriod, setProjectedChartPeriod] = useState2(defaultProjectedPeriod);
  const compact = density === 'compact';
  const dense = density === 'dense';

  const segments = useMemo2(() => {
    const map = {};
    portfolio.positions.forEach((p) => { map[p.sector] = (map[p.sector] || 0) + p.weight; });
    return Object.entries(map).map(([sector, weight]) => ({ sector, weight, color: SECTOR_COLORS[sector] || 'var(--ink)' }));
  }, [portfolio]);

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Masthead */}
      <div style={{ borderBottom: '2px solid var(--ink)', padding: '20px 40px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Wordmark size={16} />
        </div>
        <div style={{ display: 'flex', gap: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {['portfolio', 'counsel'].map((s) => (
            <span key={s} onClick={() => onNavigate && onNavigate(s)} style={{
              cursor: 'pointer',
              color: s === currentScreen ? 'var(--ink)' : 'var(--ink-mute)',
              transition: 'color 0.2s',
            }}>{s === 'portfolio' ? 'Portfolio' : 'Counsel'}</span>
          ))}
          {/* TODO: Implement Activity and Settings tabs */}
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '28px 40px 20px', borderBottom: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: 32, alignItems: 'flex-end' }}>
        <div>
          <Eyebrow>{copy.success}</Eyebrow>
          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 56, lineHeight: 1, marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
            {fmtUSD(portfolio.budget)}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            <Delta value={0.42} size="lg" />
            <span style={{ color: 'var(--ink-mute)' }}>today · {fmtUSD(portfolio.budget * 0.0042, { signed: true, decimals: 2 })}</span>
          </div>
        </div>
        {[
          { k: 'Posture', v: riskLabelFor(profile.risk).label, sub: `${profile.risk}/100` },
          { k: 'Horizon', v: `${profile.term} yr`, sub: 'Long-term hold' },
          { k: 'Exp. return', v: `${portfolio.metrics.expReturn.toFixed(1)}%`, sub: `vol ${portfolio.metrics.vol.toFixed(1)}%` },
        ].map((s, i) => (
          <div key={i} style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 18 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.k}</div>
            <div style={{ fontFamily: 'Newsreader, serif', fontSize: 24, marginTop: 4 }}>{s.v}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
        <button onClick={() => onModify && onModify()} style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          padding: '8px 14px',
          background: 'var(--ink)',
          color: 'var(--bg)',
          border: 'none',
          cursor: 'pointer',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          height: 'fit-content',
          transition: 'opacity 0.2s',
        }} onMouseEnter={(e) => e.target.style.opacity = '0.8'} onMouseLeave={(e) => e.target.style.opacity = '1'}>
          Modify
        </button>
      </div>

      {/* Body grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.4fr 1fr', overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ padding: '24px 40px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Historical performance */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <Eyebrow>Historical performance</Eyebrow>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 24, marginTop: 4 }}>
                  {fmtUSD(portfolio.series[portfolio.series.length - 1]?.value || portfolio.budget, { compact: true })} <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>current value</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(() => {
                  const periods = typeof window.getPeriodsForSeries === 'function'
                    ? window.getPeriodsForSeries(portfolio.series)
                    : ['1M', '3M', '6M', '1Y', '3Y'];
                  const activePeriod = periods.includes(chartPeriod) ? chartPeriod : periods[periods.length - 1];
                  return periods.map((r) => (
                    <button key={r} onClick={() => onChartPeriodChange && onChartPeriodChange(r)} style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      padding: '4px 10px', background: activePeriod === r ? 'var(--ink)' : 'transparent',
                      color: activePeriod === r ? 'var(--bg)' : 'var(--ink-soft)',
                      border: '1px solid var(--rule)', cursor: 'pointer',
                      letterSpacing: '0.1em', transition: 'all 0.2s',
                    }}>{r}</button>
                  ));
                })()}
              </div>
            </div>
            <div style={{ height: 220, border: "1px solid var(--rule)", background: "var(--surface)" }}>
              <ChartComponent
                series={portfolio.series}
                dailySeries={portfolio.dailySeries}
                chartPeriod={chartPeriod}
                accent="#4d9fa0"
              />
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>Low (16%)</span><span>{fmtUSD(portfolio.metrics.projLow, { compact: true })}</span></div>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>Median</span><span style={{ color: 'var(--gain)' }}>{fmtUSD(portfolio.metrics.projMid, { compact: true })}</span></div>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>High (84%)</span><span>{fmtUSD(portfolio.metrics.projHigh, { compact: true })}</span></div>
            </div>
          </section>

          {/* Projected trajectory */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <Eyebrow>Projected trajectory</Eyebrow>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 24, marginTop: 4 }}>
                  {fmtUSD(portfolio.metrics.projMid, { compact: true })} <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>est. at year {portfolio.term}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(() => {
                  const periods = typeof window.getPeriodsForTerm === 'function' ? window.getPeriodsForTerm(portfolio.term) : (portfolio.term > 7 ? ['1M', '3M', '6M', '1Y', '3Y', '5Y'] : portfolio.term <= 3 ? ['1M', '3M', '6M', '1Y'] : ['1M', '3M', '6M', '1Y', '3Y']);
                  return periods.map((r) => (
                    <button key={r} onClick={() => setProjectedChartPeriod(r)} style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      padding: '4px 10px', background: projectedChartPeriod === r ? 'var(--ink)' : 'transparent',
                      color: projectedChartPeriod === r ? 'var(--bg)' : 'var(--ink-soft)',
                      border: '1px solid var(--rule)', cursor: 'pointer',
                      letterSpacing: '0.1em', transition: 'all 0.2s',
                    }}>{r}</button>
                  ));
                })()}
              </div>
            </div>
            <div style={{ height: 220, border: "1px solid var(--rule)", background: "var(--surface)" }}>
              {portfolio.projectedSeries && (
                <ChartComponent
                  series={portfolio.projectedSeries}
                  dailySeries={[]}
                  chartPeriod={projectedChartPeriod}
                  accent="#4d9fa0"
                  viewMode="projection"
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>Low (16%)</span><span>{fmtUSD(portfolio.metrics.projLow, { compact: true })}</span></div>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>Median</span><span style={{ color: 'var(--gain)' }}>{fmtUSD(portfolio.metrics.projMid, { compact: true })}</span></div>
              <div><span style={{ color: 'var(--ink-mute)', marginRight: 6 }}>High (84%)</span><span>{fmtUSD(portfolio.metrics.projHigh, { compact: true })}</span></div>
            </div>
          </section>

          {/* AI Agent Reasoning */}
          {portfolio.agentReasoning?.steps && portfolio.agentReasoning.steps.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <Eyebrow>AI Agent Reasoning</Eyebrow>
              <div style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: 11, lineHeight: 1.6 }}>
                {portfolio.agentReasoning.steps.map((step, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: '8px', background: 'var(--surface)', border: '1px solid var(--rule)' }}>
                    <strong style={{ color: 'var(--ink)' }}>→ {step.tool}</strong>
                    <div style={{ color: 'var(--ink-mute)', marginTop: 4, fontSize: 10 }}>
                      {typeof step.reasoning === 'object' ? JSON.stringify(step.reasoning, null, 2) : String(step.reasoning)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Holdings table */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <Eyebrow>Holdings · {portfolio.positions.length}</Eyebrow>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
                Click any row to expand
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--ink)' }}>
                  {['Ticker', 'Name', 'Weight', 'Shares', 'Price', 'Value', 'Day'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', fontWeight: 500, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((p, i) => {
                  const isOpen = expanded === p.ticker;
                  return (
                    <React.Fragment key={p.ticker}>
                      <tr onClick={() => setExpanded(isOpen ? null : p.ticker)} style={{
                        borderBottom: '1px solid var(--rule)', cursor: 'pointer',
                        background: isOpen ? 'var(--surface)' : 'transparent',
                      }}>
                        <td style={{ padding: '10px', fontWeight: 500, color: 'var(--ink)' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, background: SECTOR_COLORS[p.sector], marginRight: 8, verticalAlign: 'middle' }} />
                          {p.ticker}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--ink-soft)', fontFamily: 'Newsreader, serif', fontSize: 13 }}>{p.name}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{(p.weight * 100).toFixed(1)}%</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: 'var(--ink-soft)' }}>{p.shares.toFixed(2)}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>${p.price.toFixed(2)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 500 }}>{fmtUSD(p.dollars, { decimals: 0 })}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}><Delta value={p.day} /></td>
                      </tr>
                      {isOpen && (
                        <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
                          <td colSpan={7} style={{ padding: '8px 10px 16px 30px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 28, alignItems: 'center' }}>
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>30-day price action</div>
                                <Candles width={300} height={48} data={genCandles(p)} />
                              </div>
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Role</div>
                                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 14, marginTop: 2, color: 'var(--ink)' }}>{p.sector}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>Contributes broad market exposure with minimal idiosyncratic risk.</div>
                              </div>
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cost basis</div>
                                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 18, marginTop: 2 }}>${p.price.toFixed(2)}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>P/E 22.4 · Yield 1.3%</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        {/* Right column */}
        <aside style={{ borderLeft: '1px solid var(--rule)', background: 'var(--surface)', padding: '24px 32px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {mode === 'initial' ? (
            /* Initial action card */
            <div style={{ border: '1px solid var(--ink)', padding: 20, background: 'var(--bg)' }}>
              <Eyebrow>Action required</Eyebrow>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}>
                Authorize {portfolio.positions.length} orders to establish your portfolio.
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
                Total notional: <span style={{ color: 'var(--ink)' }}>{fmtUSD(portfolio.budget)}</span> · est. commission $0.00
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Button onClick={onBuy} style={{ flex: 1, justifyContent: 'center' }}>{copy.btnConfirm} →</Button>
                <Button variant="ghost" onClick={onCounsel}>Counsel</Button>
              </div>
            </div>
          ) : (
            /* Live trade panel + pending orders */
            <>
              <TradeSearch portfolio={portfolio} onAddOrder={onAddOrder} />
              <PendingOrders orders={pendingOrders} onRemove={onRemoveOrder} onAuthorize={onAuthorize} copy={copy} />
            </>
          )}

          {/* Allocation donut */}
          <div>
            <Eyebrow style={{ marginBottom: 14 }}>Allocation</Eyebrow>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <Donut segments={segments} size={130} thickness={16} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {segments.map((s) => (
                  <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, background: s.color, display: 'inline-block' }} />
                      <span style={{ color: 'var(--ink-soft)' }}>{s.sector}</span>
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{(s.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Risks observed</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { name: 'Equity drawdown', level: 0.4 + profile.risk / 200, note: 'Worst 12-month decline simulated' },
                { name: 'Rate sensitivity', level: 0.65 - profile.risk / 300, note: 'Bond duration exposure' },
                { name: 'Concentration', level: 0.15 + profile.risk / 400, note: 'Top 5 holdings as % of portfolio' },
              ].map((r, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                    <span>{r.name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-mute)' }}>
                      {r.level < 0.33 ? 'Low' : r.level < 0.66 ? 'Moderate' : 'Elevated'}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--rule)' }}>
                    <div style={{ width: `${Math.min(100, r.level * 100)}%`, height: '100%', background: r.level > 0.66 ? 'var(--loss)' : 'var(--ink)' }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3 }}>{r.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Counsel preview */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Forward counsel</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FUTURE_ACTIONS.slice(0, 2).map((a, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--rule)', paddingTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Newsreader, serif', fontSize: 14 }}>{a.action}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{a.when}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{a.detail}</div>
                </div>
              ))}
            </div>
            <button onClick={onCounsel} style={{
              marginTop: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink)', letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: 0, textDecoration: 'underline', textUnderlineOffset: 4,
            }}>View full counsel →</button>
          </div>

          {/* Upcoming automation */}
          <div>
            <Eyebrow style={{ marginBottom: 10 }}>Upcoming automation</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const enabled = ACTION_CATEGORIES.filter(cat => cat.tweakKey && automation[cat.tweakKey]);
                if (!enabled.length) return (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontStyle: 'italic', paddingTop: 4 }}>
                    No automations enabled — configure in Counsel.
                  </div>
                );
                return enabled.map((cat, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--rule)', paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--gain)', display: 'inline-block' }} />
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink)' }}>{cat.label}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {cat.actions.length} action{cat.actions.length === 1 ? '' : 's'} queued
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}

function genCandles(p) {
  const out = [];
  let last = p.price * 0.96;
  const rng = (i) => ((p.price * 100 + i * 7919) % 233280) / 233280;
  for (let i = 0; i < 24; i++) {
    const o = last;
    const c = o * (1 + (rng(i) - 0.48) * 0.018);
    const h = Math.max(o, c) * (1 + rng(i + 99) * 0.006);
    const l = Math.min(o, c) * (1 - rng(i + 199) * 0.006);
    out.push({ o, h, l, c });
    last = c;
  }
  return out;
}

// ── Buy confirmation ─────────────────────────────────────────────────────
function BuyConfirm({ copy, portfolio, orders, onConfirm, onCancel }) {
  const [state, setState] = useState2('idle'); // idle | scanning | done
  const [progress, setProgress] = useState2(0);
  // If an orders array is passed, we're authorizing a custom set of trades.
  // Otherwise we're authorizing the full initial portfolio (BUY all positions).
  const isCustom = Array.isArray(orders);
  const rows = isCustom ? orders : portfolio.positions.map((p) => ({
    ticker: p.ticker, side: 'buy', shares: p.shares, price: p.price,
  }));
  const totalNotional = rows.reduce((s, r) => s + (r.side === 'sell' ? -1 : 1) * r.price * r.shares, 0);
  const startScan = () => {
    if (state !== 'idle') return;
    setState('scanning');
    let p = 0;
    const tick = () => {
      p += 0.03 + Math.random() * 0.04;
      setProgress(p);
      if (p < 1) setTimeout(tick, 60);
      else {
        setState('done');
        setTimeout(onConfirm, 750);
      }
    };
    tick();
  };

  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: 'rgba(20,18,12,0.55)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', color: 'var(--ink)',
        width: 560, padding: '40px 44px',
        border: '1px solid var(--ink)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Eyebrow>{copy.confirmTitle}</Eyebrow>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>ESC</button>
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>
          Authorize {rows.length} order{rows.length === 1 ? '' : 's'}.
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-soft)', marginTop: 8 }}>
          {copy.confirmSub}
        </div>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--rule)', paddingTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 100px', gap: 12, alignItems: 'baseline' }}>
                <span style={{ color: r.side === 'sell' ? 'var(--loss)' : 'var(--ink)' }}>{(r.side || 'buy').toUpperCase()} {r.ticker}</span>
                <span style={{ color: 'var(--ink-soft)' }}>@ market</span>
                <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{r.shares.toFixed(2)} sh</span>
                <span style={{ textAlign: 'right' }}>{fmtUSD(r.price * r.shares, { decimals: 0 })}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{isCustom ? 'Net notional' : 'Total notional'}</span>
          <span style={{ fontFamily: 'Newsreader, serif', fontSize: 28, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(isCustom ? totalNotional : portfolio.budget, { signed: isCustom, decimals: 2 })}</span>
        </div>

        {/* Face-ID style */}
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={startScan} disabled={state !== 'idle'} style={{
            width: 88, height: 88, borderRadius: 44,
            border: '1.5px solid var(--ink)', background: 'var(--surface)',
            cursor: state === 'idle' ? 'pointer' : 'default',
            position: 'relative', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FaceIcon progress={progress} done={state === 'done'} />
          </button>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {state === 'idle' ? 'Tap to authorize' : state === 'scanning' ? 'Verifying…' : 'Authorized ✓'}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaceIcon({ progress, done }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--rule)" strokeWidth="1.5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={done ? 'var(--gain)' : 'var(--ink)'} strokeWidth="1.5"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.06s linear' }} />
      {/* Face glyph */}
      <g stroke={done ? 'var(--gain)' : 'var(--ink)'} strokeWidth="1.5" fill="none" strokeLinecap="round">
        <circle cx="28" cy="30" r="1.5" fill={done ? 'var(--gain)' : 'var(--ink)'} />
        <circle cx="44" cy="30" r="1.5" fill={done ? 'var(--gain)' : 'var(--ink)'} />
        {done ? (
          <path d="M28 40 L34 46 L46 32" />
        ) : (
          <path d="M30 42 Q36 46 42 42" />
        )}
      </g>
    </svg>
  );
}

// ── Success interstitial ──────────────────────────────────────────────
function Success({ copy, portfolio, onDone }) {
  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 48, textAlign: 'center' }}>
      <Eyebrow>{copy.success}</Eyebrow>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: 64, fontWeight: 400, letterSpacing: -1, margin: '12px 0 12px', textWrap: 'pretty', lineHeight: 1 }}>
        {copy.success}.
      </h1>
      <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-soft)', maxWidth: 480 }}>
        {copy.successSub}
      </p>
      <div style={{ marginTop: 36, borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)', padding: '20px 0', display: 'flex', gap: 48, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
        {[
          ['Orders filled', `${portfolio.positions.length}`],
          ['Deployed', fmtUSD(portfolio.budget, { compact: true })],
          ['Cash remaining', '$0.00'],
          ['Settle date', 'T+1'],
        ].map((s, i) => (
          <div key={i}>
            <div style={{ color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9 }}>{s[0]}</div>
            <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, marginTop: 4 }}>{s[1]}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 32 }}>
        <Button size="lg" onClick={onDone}>{copy.btnDone} →</Button>
      </div>
    </div>
  );
}

// ── Schedule Modal ────────────────────────────────────────────────────
function ScheduleModal({ action, onSchedule, onCancel }) {
  const [frequency, setFrequency] = useState2('daily');
  const [time, setTime] = useState2('09:00');

  const scheduleOptions = [
    { value: 'once', label: 'Run once now' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const times = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: 'rgba(20,18,12,0.55)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', color: 'var(--ink)',
        width: 560, padding: '40px 44px',
        border: '1px solid var(--ink)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Eyebrow>Schedule action</Eyebrow>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>ESC</button>
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>
          Schedule this action.
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-soft)', marginTop: 8 }}>
          {action || 'Rebalance portfolio'}
        </div>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--rule)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Frequency</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {scheduleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid var(--rule)',
                    background: frequency === opt.value ? 'var(--ink)' : 'transparent',
                    color: frequency === opt.value ? 'var(--bg)' : 'var(--ink)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: '0.08em',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {frequency !== 'once' && (
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Time</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {times.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--rule)',
                      background: time === t ? 'var(--ink)' : 'transparent',
                      color: time === t ? 'var(--bg)' : 'var(--ink)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => {
            onSchedule({ frequency, time });
            onCancel();
          }}>
            Schedule →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Review Switch Modal ───────────────────────────────────────────────
function ReviewModal({ sw, onAccept, onDismiss, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: 'rgba(20,18,12,0.55)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)', color: 'var(--ink)',
        width: 520, padding: '40px 44px',
        border: '1px solid var(--ink)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Eyebrow>Sector rotation · review</Eyebrow>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>ESC</button>
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>
          Switch {sw.from} → {sw.to}.
        </div>
        <div style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-soft)', marginTop: 8 }}>
          {sw.reason}
        </div>
        <div style={{ marginTop: 24, borderTop: '1px solid var(--rule)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ border: '1px solid var(--rule)', padding: 16 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Current · {sw.from}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, color: 'var(--ink-mute)' }}>+{sw.fromProj}%</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>12M projected</div>
            </div>
            <div style={{ border: '1px solid var(--gain)', padding: 16 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--gain)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Suggested · {sw.to}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, color: 'var(--gain)' }}>+{sw.toProj}%</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>12M projected · +{sw.uplift}% uplift</div>
            </div>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--gain)', padding: '8px 12px', border: '1px solid var(--gain)', background: 'color-mix(in oklab, var(--gain) 5%, transparent)' }}>
            {sw.sector} · projected uplift +{sw.uplift}%
          </div>
        </div>
        <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onDismiss}>Dismiss</Button>
          <Button onClick={onAccept}>Accept switch →</Button>
        </div>
      </div>
    </div>
  );
}

// ── Individual holding analysis with peer comparison ─────────────────
function StockAnalysis({ portfolio }) {
  if (!portfolio?.positions?.length) return null;
  const getM = typeof window.getTickerMetrics === 'function' ? window.getTickerMetrics : () => ({ pe: 20, divYield: 1.5, ret52w: 10, proj12m: 8, signal: 'hold', note: '' });
  const altPool = window.SECTOR_ALT_POOL || {};

  return (
    <div style={{ padding: '32px 64px', borderTop: '2px solid var(--ink)' }}>
      <Eyebrow style={{ marginBottom: 18 }}>Holdings analysis · peer comparison</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {portfolio.positions.map((pos, i) => {
          const m = getM(pos.ticker);
          const peers = (altPool[pos.sector] || []).filter(a => a.ticker !== pos.ticker).slice(0, 2);
          const rows = [{ ticker: pos.ticker, name: pos.name, ...m, isSelf: true }, ...peers.map(p => ({ ...p, isSelf: false }))];
          const signalCol = m.signal === 'overweight' ? 'var(--gain)' : m.signal === 'reduce' ? 'var(--loss)' : 'var(--ink-mute)';
          return (
            <div key={pos.ticker} style={{ borderTop: i === 0 ? '1px solid var(--ink)' : '1px solid var(--rule)', padding: '18px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 20, alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600 }}>{pos.ticker}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{pos.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{pos.sector}</div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.5, paddingTop: 2 }}>{m.note}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: signalCol, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.signal}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}>{(pos.weight * 100).toFixed(1)}% weight</div>
                </div>
              </div>
              {rows.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  <thead>
                    <tr>{['', 'P/E', 'Yield', '52W', '12M Proj.'].map((h, hi) => (
                      <th key={hi} style={{ textAlign: hi === 0 ? 'left' : 'right', padding: '4px 10px', color: 'var(--ink-mute)', fontWeight: 400, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid var(--rule)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={row.ticker} style={{ background: row.isSelf ? 'color-mix(in oklab, var(--ink) 5%, transparent)' : 'transparent' }}>
                        <td style={{ padding: '7px 10px', fontWeight: row.isSelf ? 600 : 400 }}>
                          {row.ticker}
                          {row.isSelf && <span style={{ color: 'var(--ink-mute)', fontWeight: 400, marginLeft: 6, fontSize: 9.5 }}>← holding</span>}
                          {!row.isSelf && row.proj12m > m.proj12m && <span style={{ color: 'var(--gain)', fontWeight: 600, marginLeft: 6, fontSize: 9.5 }}>↑ better</span>}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--ink-soft)' }}>{row.pe != null ? row.pe.toFixed(1) : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--ink-soft)' }}>{row.divYield > 0 ? row.divYield.toFixed(2) + '%' : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}><Delta value={row.ret52w} /></td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: (!row.isSelf && row.proj12m > m.proj12m) ? 600 : 400, color: (!row.isSelf && row.proj12m > m.proj12m) ? 'var(--gain)' : 'inherit' }}>
                          +{row.proj12m.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Counsel / Recommendations ────────────────────────────────────────
function Counsel({ copy, profile, portfolio, automation, setAutomation, onBack, scheduleModal, setScheduleModal, onSwitchAccepted }) {
  const auto = automation || {};
  const setAuto = setAutomation || (() => {});
  const [scheduled, setScheduled] = useState2({});
  const [reviewModal, setReviewModal] = useState2(null);
  const [reviewed, setReviewed] = useState2({});
  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid var(--rule)' }}>
        <Wordmark size={16} />
        <Button variant="ghost" onClick={onBack}>← Portfolio</Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '40px 64px 16px', borderBottom: '2px solid var(--ink)' }}>
          <Eyebrow>{copy.recommendations}</Eyebrow>
          <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: 56, fontWeight: 400, letterSpacing: -1, margin: '6px 0 8px', lineHeight: 1 }}>
            {copy.recommendations}.
          </h1>
          <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-soft)', margin: 0 }}>
            {copy.recSub}
          </p>
        </div>

        {/* Weekly activity — full-width editorial section */}
        <WeeklyActivity portfolio={portfolio} />

        {/* Per-holding analysis with peer comparison */}
        <StockAnalysis portfolio={portfolio} />

        <div style={{ padding: '32px 64px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48 }}>
          {/* Recommendations column */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <Eyebrow>Recommended actions · by category</Eyebrow>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {ACTION_CATEGORIES.filter((c) => auto[c.tweakKey]).length} of {ACTION_CATEGORIES.length} automated
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {ACTION_CATEGORIES.map((cat, ci) => {
                const on = !!auto[cat.tweakKey];
                return (
                  <section key={cat.id} style={{
                    borderTop: ci === 0 ? '1px solid var(--ink)' : '1px solid var(--rule)',
                    borderBottom: ci === ACTION_CATEGORIES.length - 1 ? '1px solid var(--ink)' : 'none',
                    padding: '18px 0',
                    background: on ? 'color-mix(in oklab, var(--gain) 5%, transparent)' : 'transparent',
                    transition: 'background 0.2s',
                  }}>
                    <header style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 14, alignItems: 'center', padding: '0 14px' }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 11,
                        border: '1px solid var(--ink)',
                        background: on ? 'var(--ink)' : 'transparent',
                        color: on ? 'var(--bg)' : 'var(--ink)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 500,
                      }}>{String(ci + 1).padStart(2, '0')}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                          <h3 style={{ fontFamily: 'Newsreader, serif', fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>{cat.label}</h3>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            {cat.actions.length} action{cat.actions.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{cat.desc}</div>
                      </div>
                      <AutoRunSwitch on={on} onChange={(v) => setAuto(cat.tweakKey, v)} />
                    </header>

                    <div style={{ padding: '12px 14px 0', display: 'flex', flexDirection: 'column' }}>
                      {cat.actions.map((a, ai) => (
                        <div key={ai} style={{
                          borderTop: '1px solid var(--rule)',
                          padding: '12px 0', display: 'grid',
                          gridTemplateColumns: '110px 1fr auto', gap: 16, alignItems: 'flex-start',
                        }}>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', paddingTop: 4 }}>{a.when}</div>
                          <div>
                            <div style={{ fontFamily: 'Newsreader, serif', fontSize: 16, lineHeight: 1.25 }}>{a.action}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, maxWidth: 440 }}>{a.detail}</div>
                            <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--gain)' }}>{a.impact}</div>
                          </div>
                          <div style={{ paddingTop: 4 }}>
                            {on ? (
                              <span style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                                padding: '4px 8px', border: '1px solid var(--gain)',
                                color: 'var(--gain)', letterSpacing: '0.12em', textTransform: 'uppercase',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--gain)' }} /> Auto-run
                              </span>
                            ) : scheduled[a.action] ? (
                              <span style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                                padding: '4px 8px', border: '1px solid var(--gain)',
                                color: 'var(--gain)', letterSpacing: '0.12em', textTransform: 'uppercase',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                              }}>
                                ✓ Scheduled
                              </span>
                            ) : (
                              <Button variant="ghost" onClick={() => setScheduleModal({ open: true, action: a.action })} style={{ padding: '5px 12px', fontSize: 11 }}>Schedule</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Dynamic stock switch suggestions derived from holdings */}
            {(() => {
              const switches = typeof window.generateSwitchSuggestions === 'function'
                ? window.generateSwitchSuggestions(portfolio?.positions || [])
                : [];
              if (!switches.length) return null;
              return (
                <div style={{ marginTop: 36 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                    <Eyebrow>Sector rotation · switch candidates</Eyebrow>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{switches.length} suggestion{switches.length === 1 ? '' : 's'}</div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--ink)' }}>
                    {switches.map((sw, si) => (
                      <div key={si} style={{ borderBottom: '1px solid var(--rule)', padding: '14px 0', display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{ paddingTop: 2 }}>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>On review</div>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 4 }}>{sw.sector}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Newsreader, serif', fontSize: 16, lineHeight: 1.25 }}>
                            Switch {sw.from} <span style={{ color: 'var(--ink-mute)' }}>→</span> {sw.to}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, maxWidth: 440 }}>{sw.reason}</div>
                          <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--gain)' }}>
                            +{sw.uplift}% projected uplift · {sw.fromProj}% → {sw.toProj}% (12M)
                          </div>
                        </div>
                        <div style={{ paddingTop: 4 }}>
                          {reviewed[`${sw.from}-${sw.to}`] ? (
                            <span style={{
                              fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                              padding: '4px 8px',
                              border: `1px solid ${reviewed[`${sw.from}-${sw.to}`] === 'accepted' ? 'var(--gain)' : 'var(--rule)'}`,
                              color: reviewed[`${sw.from}-${sw.to}`] === 'accepted' ? 'var(--gain)' : 'var(--ink-mute)',
                              letterSpacing: '0.12em', textTransform: 'uppercase',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              {reviewed[`${sw.from}-${sw.to}`] === 'accepted' ? '✓ Accepted' : '— Dismissed'}
                            </span>
                          ) : (
                            <Button variant="ghost" onClick={() => setReviewModal(sw)} style={{ padding: '5px 12px', fontSize: 11 }}>Review</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <Eyebrow style={{ marginTop: 40, marginBottom: 14 }}>Market headlines · curated</Eyebrow>
            <div style={{ borderTop: '1px solid var(--ink)' }}>
              {MARKET_HEADLINES.map((h, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--rule)', padding: '14px 0', display: 'grid', gridTemplateColumns: '60px 70px 1fr', gap: 16 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>{h.t}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h.kind}</span>
                  <span style={{ fontFamily: 'Newsreader, serif', fontSize: 15, lineHeight: 1.4 }}>{h.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trends column */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <Eyebrow style={{ marginBottom: 12 }}>Sector tape · today</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { s: 'Technology', d: 1.42, spark: [4, 4.1, 4.05, 4.2, 4.3, 4.4, 4.55, 4.6, 4.7, 4.85] },
                  { s: 'Financials', d: 0.62, spark: [3.9, 4.0, 3.95, 4.05, 4.1, 4.05, 4.12, 4.15, 4.2, 4.18] },
                  { s: 'Energy', d: -0.84, spark: [4.5, 4.4, 4.45, 4.3, 4.25, 4.2, 4.1, 4.15, 4.05, 4.0] },
                  { s: 'Health Care', d: 0.21, spark: [4.1, 4.12, 4.1, 4.15, 4.14, 4.16, 4.18, 4.2, 4.19, 4.22] },
                  { s: 'Real Estate', d: -0.18, spark: [4.2, 4.18, 4.22, 4.15, 4.18, 4.1, 4.12, 4.08, 4.1, 4.05] },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                    <span style={{ fontFamily: 'Newsreader, serif', fontSize: 14 }}>{r.s}</span>
                    <Sparkline data={r.spark} width={60} height={18} stroke={r.d >= 0 ? 'var(--gain)' : 'var(--loss)'} />
                    <span style={{ textAlign: 'right' }}><Delta value={r.d} /></span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--surface)', padding: 20, border: '1px solid var(--rule)' }}>
              <Eyebrow style={{ marginBottom: 10 }}>Counsel · the macro view</Eyebrow>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 17, lineHeight: 1.4, color: 'var(--ink)' }}>
                “Our base case favors a soft landing into Q4. We retain a modest equity overweight, with caution on duration as inflation prints cool.”
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 12 }}>
                — Meridian Investment Committee · May 2026
              </div>
            </div>

            <div>
              <Eyebrow style={{ marginBottom: 10 }}>Scenarios</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { s: 'Soft landing', p: '52%', v: portfolio.budget * 1.18 },
                  { s: 'Mild recession', p: '28%', v: portfolio.budget * 0.93 },
                  { s: 'Reaccel.', p: '14%', v: portfolio.budget * 1.27 },
                  { s: 'Tail risk', p: '6%', v: portfolio.budget * 0.78 },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'Newsreader, serif', fontSize: 14 }}>{s.s}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>{s.p}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, textAlign: 'right', color: s.v >= portfolio.budget ? 'var(--gain)' : 'var(--loss)' }}>
                      {fmtUSD(s.v, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {reviewModal && (
        <ReviewModal
          sw={reviewModal}
          onAccept={() => {
            setReviewed(prev => ({ ...prev, [`${reviewModal.from}-${reviewModal.to}`]: 'accepted' }));
            if (onSwitchAccepted) onSwitchAccepted(reviewModal.from, reviewModal.to);
            setReviewModal(null);
          }}
          onDismiss={() => {
            setReviewed(prev => ({ ...prev, [`${reviewModal.from}-${reviewModal.to}`]: 'dismissed' }));
            setReviewModal(null);
          }}
          onCancel={() => setReviewModal(null)}
        />
      )}

      {scheduleModal?.open && (
        <ScheduleModal
          action={scheduleModal.action}
          onSchedule={(config) => {
            setScheduled(prev => ({ ...prev, [scheduleModal.action]: true }));
            setScheduleModal({ open: false });
          }}
          onCancel={() => setScheduleModal({ open: false })}
        />
      )}
    </div>
  );
}

// ── Weekly activity report (Counsel section) ─────────────────────────
function WeeklyActivity({ portfolio }) {
  const w = WEEKLY_ACTIVITY;
  const pnlPositive = w.summary.pnl >= 0;
  return (
    <div style={{ borderTop: '2px solid var(--ink)', borderBottom: '1px solid var(--rule)', background: 'var(--surface)' }}>
      <div style={{ padding: '32px 64px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Eyebrow>This week’s stewardship</Eyebrow>
          <h2 style={{ fontFamily: 'Newsreader, serif', fontSize: 36, fontWeight: 400, letterSpacing: -0.4, margin: '4px 0 4px', lineHeight: 1.05 }}>
            Week of {w.weekOf}.
          </h2>
          <p style={{ fontFamily: 'Newsreader, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-soft)', margin: 0, maxWidth: 560 }}>
            A short brief on what moved, what we did, and what to make of it.
          </p>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Vol. I · No. 19
        </div>
      </div>

      <div style={{ padding: '24px 64px 36px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.1fr', gap: 40 }}>
        {/* Column 1 — narrative + stat strip */}
        <div>
          <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)', padding: '14px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { k: 'P&L', v: fmtUSD(w.summary.pnl, { signed: true, decimals: 0 }), accent: pnlPositive ? 'var(--gain)' : 'var(--loss)' },
              { k: 'Return', v: `${pnlPositive ? '+' : ''}${w.summary.pnlPct.toFixed(2)}%`, accent: pnlPositive ? 'var(--gain)' : 'var(--loss)' },
              { k: 'Trades', v: `${w.summary.trades}` },
              { k: 'Dividends', v: fmtUSD(w.summary.dividends, { decimals: 0 }) },
            ].map((s, i) => (
              <div key={i} style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--rule)', paddingLeft: i === 0 ? 0 : 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{s.k}</div>
                <div style={{ fontFamily: 'Newsreader, serif', fontSize: 22, marginTop: 4, color: s.accent || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: 'Newsreader, serif', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink)', textWrap: 'pretty', marginTop: 18 }}>
            Markets carried a constructive tone into the close. Your portfolio finished the week
            <span style={{ color: pnlPositive ? 'var(--gain)' : 'var(--loss)' }}> {pnlPositive ? 'ahead' : 'behind'}</span> of the broad tape,
            led by <em>{w.summary.bestTicker}</em>. We trimmed a small bond overweight on
            Thursday and reinvested into <em>MSFT</em> to keep your equity sleeve in line with target.
          </p>
          <p style={{ fontFamily: 'Newsreader, serif', fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink-soft)', fontStyle: 'italic', marginTop: 10 }}>
            “Nothing about this week alters the year-ahead thesis. Stay the course; we will revisit the glide-path in Q3.”
          </p>
        </div>

        {/* Column 2 — movers */}
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>Movers · 5-day</Eyebrow>
          <div style={{ borderTop: '1px solid var(--ink)' }}>
            {w.movers.map((m, i) => (
              <div key={m.ticker} style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0', display: 'grid', gridTemplateColumns: '60px 1fr 60px', gap: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500 }}>{m.ticker}</span>
                <div>
                  <div style={{ fontFamily: 'Newsreader, serif', fontSize: 13.5, lineHeight: 1.2 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{m.note}</div>
                </div>
                <span style={{ textAlign: 'right' }}><Delta value={m.wk} /></span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3 — ledger */}
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>Ledger · automated actions</Eyebrow>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
            <thead>
              <tr style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
                {['Date', 'Kind', 'Detail', 'Amount'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 3 ? 'right' : 'left', padding: '8px 6px', fontWeight: 500, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {w.ledger.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                  <td style={{ padding: '8px 6px', color: 'var(--ink-soft)' }}>{l.d}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 6px',
                      border: '1px solid var(--rule)',
                      fontSize: 9, letterSpacing: '0.12em',
                      color: l.kind === 'BUY' ? 'var(--ink)' : l.kind === 'SELL' ? 'var(--loss)' : l.kind === 'DIV' ? 'var(--gain)' : 'var(--ink-mute)',
                    }}>{l.kind}</span>
                    <span style={{ marginLeft: 6 }}>{l.ticker}</span>
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--ink-soft)', fontFamily: 'Newsreader, serif', fontSize: 13 }}>{l.detail}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: l.amt >= 0 ? 'var(--gain)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtUSD(l.amt, { signed: true, decimals: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'right' }}>
            Net cash flow · <span style={{ color: 'var(--ink)' }}>{fmtUSD(w.ledger.reduce((s, l) => s + l.amt, 0), { signed: true, decimals: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trade search + pending orders ────────────────────────────────────
function TradeSearch({ portfolio, onAddOrder }) {
  const [q, setQ] = useState2('');
  const [picked, setPicked] = useState2(null); // instrument
  const [side, setSide] = useState2('buy');
  const [shares, setShares] = useState2('');

  const ownedMap = useMemo2(() => {
    const m = {};
    for (const p of portfolio.positions) m[p.ticker] = p;
    return m;
  }, [portfolio]);

  const results = useMemo2(() => {
    if (!q.trim()) return [];
    const ql = q.trim().toLowerCase();
    return TRADABLE_UNIVERSE
      .filter((t) => t.ticker.toLowerCase().includes(ql) || t.name.toLowerCase().includes(ql))
      .slice(0, 6);
  }, [q]);

  const select = (inst) => {
    setPicked(inst);
    setQ('');
    setShares('1');
    setSide(ownedMap[inst.ticker] ? 'buy' : 'buy');
  };

  const submit = () => {
    if (!picked) return;
    const n = parseFloat(shares);
    if (!n || n <= 0) return;
    if (side === 'sell') {
      const owned = ownedMap[picked.ticker];
      if (!owned || owned.shares < n - 0.0001) return;
    }
    onAddOrder({ ticker: picked.ticker, name: picked.name, price: picked.price, side, shares: +n.toFixed(4) });
    setPicked(null);
    setShares('');
  };

  const maxSell = picked && ownedMap[picked.ticker] ? ownedMap[picked.ticker].shares : 0;
  const notional = picked && shares ? picked.price * (parseFloat(shares) || 0) : 0;

  return (
    <div style={{ border: '1px solid var(--ink)', padding: 20, background: 'var(--bg)' }}>
      <Eyebrow>Trade</Eyebrow>
      <div style={{ fontFamily: 'Newsreader, serif', fontSize: 18, lineHeight: 1.2, marginTop: 4, marginBottom: 12 }}>
        Buy or sell a security.
      </div>

      {!picked ? (
        <>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ticker or name (e.g. AAPL, bond)"
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--surface)', color: 'var(--ink)',
                border: '1px solid var(--rule)', outline: 'none',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>
          {results.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--rule)' }}>
              {results.map((r) => (
                <button key={r.ticker} onClick={() => select(r)} style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', borderBottom: '1px solid var(--rule)',
                  padding: '8px 0', cursor: 'pointer',
                  display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 8, alignItems: 'baseline',
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink)' }}>{r.ticker}</span>
                  <span style={{ fontFamily: 'Newsreader, serif', fontSize: 13, color: 'var(--ink-soft)' }}>{r.name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>${r.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          {q && results.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', fontStyle: 'italic' }}>No matching instruments.</div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink)' }}>{picked.ticker}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontSize: 13, color: 'var(--ink-soft)' }}>{picked.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>${picked.price.toFixed(2)}</div>
              <Delta value={picked.day} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {['buy', 'sell'].map((s) => (
              <button key={s} onClick={() => setSide(s)} style={{
                padding: '8px 0', cursor: 'pointer',
                background: side === s ? 'var(--ink)' : 'transparent',
                color: side === s ? 'var(--bg)' : 'var(--ink-soft)',
                border: '1px solid ' + (side === s ? 'var(--ink)' : 'var(--rule)'),
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{s}</button>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Shares {side === 'sell' && maxSell > 0 && <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>(own {maxSell.toFixed(2)})</span>}
            </span>
            <input type="text" inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)}
              style={{
                padding: '8px 10px', background: 'var(--surface)', color: 'var(--ink)',
                border: '1px solid var(--rule)', outline: 'none',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 13, boxSizing: 'border-box',
              }} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>
            <span>Notional</span>
            <span style={{ fontFamily: 'Newsreader, serif', fontSize: 18, color: 'var(--ink)' }}>{fmtUSD(notional, { decimals: 2 })}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => { setPicked(null); setShares(''); }}>Cancel</Button>
            <Button onClick={submit} style={{ flex: 1, justifyContent: 'center' }}>Queue order</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingOrders({ orders, onRemove, onAuthorize, copy }) {
  if (!orders.length) return null;
  const totalNotional = orders.reduce((s, o) => s + (o.side === 'buy' ? 1 : -1) * o.price * o.shares, 0);
  return (
    <div style={{ border: '1px solid var(--ink)', background: 'var(--surface)' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow>Pending orders · {orders.length}</Eyebrow>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>Unauthorized</span>
      </div>
      <div style={{ padding: '6px 0' }}>
        {orders.map((o, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '70px 1fr auto 16px', gap: 10, alignItems: 'baseline', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>
            <span style={{ color: o.side === 'buy' ? 'var(--ink)' : 'var(--loss)' }}>
              {o.side.toUpperCase()} {o.ticker}
            </span>
            <span style={{ color: 'var(--ink-soft)' }}>{o.shares.toFixed(2)} sh @ ${o.price.toFixed(2)}</span>
            <span style={{ textAlign: 'right' }}>{fmtUSD(o.price * o.shares, { decimals: 2 })}</span>
            <button onClick={() => onRemove(i)} aria-label="Remove" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink-mute)', fontSize: 14, padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--rule)' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Net</span>
        <span style={{ fontFamily: 'Newsreader, serif', fontSize: 18 }}>{fmtUSD(totalNotional, { signed: true, decimals: 2 })}</span>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <Button onClick={onAuthorize} style={{ width: '100%', justifyContent: 'center' }}>Authorize {orders.length} order{orders.length === 1 ? '' : 's'} →</Button>
      </div>
    </div>
  );
}

function AutoRunSwitch({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, color: 'var(--ink)',
      }}
    >
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: on ? 'var(--ink)' : 'var(--ink-mute)',
      }}>
        Auto-run · {on ? 'On' : 'Off'}
      </span>
      <span style={{
        width: 36, height: 18, borderRadius: 9,
        border: '1px solid ' + (on ? 'var(--ink)' : 'var(--rule)'),
        background: on ? 'var(--ink)' : 'var(--surface)',
        position: 'relative', transition: 'all 0.18s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 19 : 2,
          width: 12, height: 12, borderRadius: 6,
          background: on ? 'var(--bg)' : 'var(--ink-soft)',
          transition: 'left 0.18s',
        }} />
      </span>
    </button>
  );
}

Object.assign(window, { GeneratingScreen, Dashboard, BuyConfirm, Success, Counsel, WeeklyActivity, TradeSearch, PendingOrders, AutoRunSwitch });
