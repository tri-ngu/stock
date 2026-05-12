// app.jsx — top-level: prototype state machine + design canvas layout + tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "ivory",
  "riskStyle": "slider",
  "density": "regular",
  "personality": "formal",
  "autoRebalance": true,
  "autoTax": false,
  "autoIncome": true,
  "autoRisk": false
}/*EDITMODE-END*/;

const { useState: useS, useEffect: useE, useMemo: useM } = React;

// ── Prototype container — full state machine ─────────────────────────────
function Prototype({ paletteKey, riskStyle, density, personality, automation, setAutomation, initialScreen = 'welcome', initialProfile, initialPortfolio }) {
  const palette = PALETTES[paletteKey] || PALETTES.ivory;
  const copy = COPY[personality] || COPY.formal;
  const [screen, setScreen] = useS(initialScreen);
  const [profile, setProfile] = useS(initialProfile || {
    budget: 10000,
    risk: 50,
    term: 15,
    goals: ['retire', 'wealth'],
  });
  const [portfolio, setPortfolio] = useS(initialPortfolio || null);
  // Pending orders queued from the trade UI (live dashboard only).
  const [pendingOrders, setPendingOrders] = useS([]);
  // Which order set the BuyConfirm modal is reviewing: 'initial' (whole portfolio) or 'pending' (queued trades).
  const [confirmMode, setConfirmMode] = useS('initial');

  const goGenerate = () => {
    setPortfolio(buildPortfolio(profile.budget, profile.risk, profile.term));
    setScreen('generating');
  };

  const addOrder = (order) => {
    setPendingOrders((prev) => {
      // Merge into existing pending order for same ticker/side
      const idx = prev.findIndex((o) => o.ticker === order.ticker && o.side === order.side);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], shares: +(next[idx].shares + order.shares).toFixed(4) };
        return next;
      }
      return [...prev, order];
    });
  };
  const removeOrder = (i) => setPendingOrders((prev) => prev.filter((_, ix) => ix !== i));
  const applyPending = () => {
    setPortfolio((p) => applyOrdersToPortfolio(p, pendingOrders));
    setPendingOrders([]);
  };

  return (
    <div style={{
      ...paletteVars(palette),
      width: '100%', height: '100%',
      background: 'var(--bg)', color: 'var(--ink)',
      fontFamily: 'Geist, system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {screen === 'welcome' && (
        <WelcomeScreen copy={copy} onBegin={() => setScreen('profile')} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          copy={copy}
          profile={profile}
          setProfile={setProfile}
          riskStyle={riskStyle}
          density={density}
          onBack={() => setScreen('welcome')}
          onContinue={goGenerate}
        />
      )}
      {screen === 'generating' && (
        <GeneratingScreen
          copy={copy}
          profile={profile}
          onComplete={() => setScreen('dashboard-preauth')}
        />
      )}
      {screen === 'dashboard-preauth' && portfolio && (
        <Dashboard
          copy={copy}
          profile={profile}
          portfolio={portfolio}
          density={density}
          mode="initial"
          onBuy={() => { setConfirmMode('initial'); setScreen('buy'); }}
          onCounsel={() => setScreen('counsel')}
        />
      )}
      {screen === 'buy' && portfolio && (
        <>
          <Dashboard copy={copy} profile={profile} portfolio={portfolio} density={density}
            mode={confirmMode === 'pending' ? 'live' : 'initial'}
            pendingOrders={pendingOrders}
            onBuy={() => {}} onCounsel={() => {}} />
          <BuyConfirm copy={copy} portfolio={portfolio}
            orders={confirmMode === 'pending' ? pendingOrders : undefined}
            onConfirm={() => {
              if (confirmMode === 'pending') {
                applyPending();
                setScreen('dashboard');
              } else {
                setScreen('success');
              }
            }}
            onCancel={() => setScreen(confirmMode === 'pending' ? 'dashboard' : 'dashboard-preauth')} />
        </>
      )}
      {screen === 'success' && portfolio && (
        <Success copy={copy} portfolio={portfolio} onDone={() => setScreen('dashboard')} />
      )}
      {screen === 'dashboard' && portfolio && (
        <Dashboard
          copy={copy}
          profile={profile}
          portfolio={portfolio}
          density={density}
          mode="live"
          pendingOrders={pendingOrders}
          onAddOrder={addOrder}
          onRemoveOrder={removeOrder}
          onAuthorize={() => { setConfirmMode('pending'); setScreen('buy'); }}
          onBuy={() => setScreen('counsel')}
          onCounsel={() => setScreen('counsel')}
        />
      )}
      {screen === 'counsel' && portfolio && (
        <Counsel copy={copy} profile={profile} portfolio={portfolio}
          automation={automation} setAutomation={setAutomation}
          onBack={() => setScreen(portfolio ? 'dashboard' : 'dashboard-preauth')} />
      )}
    </div>
  );
}

// ── Mobile artboard wrapper ─────────────────────────────────────────────
function MobileFrame({ paletteKey, personality, profile, portfolio }) {
  const palette = PALETTES[paletteKey] || PALETTES.ivory;
  const copy = COPY[personality] || COPY.formal;
  return (
    <div style={{
      ...paletteVars(palette),
      width: '100%', height: '100%',
      background: 'var(--bg)',
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>
      <MobileDashboard copy={copy} profile={profile} portfolio={portfolio} />
    </div>
  );
}

// ── App: design canvas with multiple artboards ───────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Precompute a default portfolio so static screens (mobile, counsel, dashboard variations) have data.
  const defaultProfile = { budget: 10000, risk: 50, term: 15, goals: ['retire', 'wealth'] };
  const defaultPortfolio = useM(() => buildPortfolio(defaultProfile.budget, defaultProfile.risk, defaultProfile.term), []);

  const aggressiveProfile = { budget: 50000, risk: 85, term: 15, goals: ['wealth'] };
  const aggressivePortfolio = useM(() => buildPortfolio(aggressiveProfile.budget, aggressiveProfile.risk, aggressiveProfile.term), []);

  const conservativeProfile = { budget: 5000, risk: 20, term: 3, goals: ['house'] };
  const conservativePortfolio = useM(() => buildPortfolio(conservativeProfile.budget, conservativeProfile.risk, conservativeProfile.term), []);

  const baseProps = {
    paletteKey: t.palette, riskStyle: t.riskStyle, density: t.density, personality: t.personality,
    automation: {
      autoRebalance: t.autoRebalance,
      autoTax: t.autoTax,
      autoIncome: t.autoIncome,
      autoRisk: t.autoRisk,
    },
    setAutomation: (key, val) => setTweak(key, val),
  };

  return (
    <>
      <DesignCanvas>

        <DCSection id="flow" title="The Meridian Flow" subtitle="Full clickable prototype · click any screen to navigate">
          <DCArtboard id="full-prototype" label="Live · clickable" width={1280} height={800}>
            <Prototype {...baseProps} initialScreen="welcome" />
          </DCArtboard>
        </DCSection>

        <DCSection id="screens" title="Screens · Captured States" subtitle="Each screen in isolation for review">
          <DCArtboard id="welcome" label="01 · Welcome" width={1280} height={800}>
            <Prototype {...baseProps} initialScreen="welcome" />
          </DCArtboard>
          <DCArtboard id="profile" label="02 · Profile · intake" width={1280} height={800}>
            <Prototype {...baseProps} initialScreen="profile" />
          </DCArtboard>
          <DCArtboard id="generating" label="03 · Generating" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="generating" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="dashboard" label="04 · Dashboard · pre-auth" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="dashboard-preauth" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="buy" label="05 · Authorize · Face ID" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="buy" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="success" label="06 · Executed" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="success" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="counsel" label="07 · Counsel & Outlook" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="counsel" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
        </DCSection>

        <DCSection id="dashvar" title="Dashboard · Risk Variations" subtitle="Same screen across three risk postures">
          <DCArtboard id="conservative" label="A · Conservative ($5k, 20)" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="dashboard-preauth" profile={conservativeProfile} portfolio={conservativePortfolio} />
          </DCArtboard>
          <DCArtboard id="balanced" label="B · Balanced ($10k, 50)" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="dashboard-preauth" profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="aggressive" label="C · Aggressive ($50k, 85)" width={1280} height={800}>
            <PrototypePinned {...baseProps} screen="dashboard-preauth" profile={aggressiveProfile} portfolio={aggressivePortfolio} />
          </DCArtboard>
        </DCSection>

        <DCSection id="mobile" title="Mobile · Companion" subtitle="iOS companion view of the portfolio">
          <DCArtboard id="m-dashboard" label="Portfolio" width={390} height={844}>
            <MobileFrame paletteKey={t.palette} personality={t.personality} profile={defaultProfile} portfolio={defaultPortfolio} />
          </DCArtboard>
          <DCArtboard id="m-conservative" label="Portfolio · Conservative" width={390} height={844}>
            <MobileFrame paletteKey={t.palette} personality={t.personality} profile={conservativeProfile} portfolio={conservativePortfolio} />
          </DCArtboard>
          <DCArtboard id="m-aggressive" label="Portfolio · Aggressive" width={390} height={844}>
            <MobileFrame paletteKey={t.palette} personality={t.personality} profile={aggressiveProfile} portfolio={aggressivePortfolio} />
          </DCArtboard>
        </DCSection>

      </DesignCanvas>

      <TweaksPanel title="Meridian · Tweaks">
        <TweakSection label="Palette">
          {/* Use a select for textual labels so users see palette names */}
          <TweakSelect
            label="Palette"
            value={t.palette}
            options={[
              { value: 'ivory',     label: 'Ivory · light cream' },
              { value: 'linen',     label: 'Linen · warm white' },
              { value: 'vellum',    label: 'Vellum · aged paper' },
              { value: 'newsprint', label: 'Newsprint · cool gray' },
              { value: 'slate',     label: 'Slate · cool blue-gray' },
              { value: 'sage',      label: 'Sage · muted green' },
              { value: 'rosewood',  label: 'Rosewood · warm rose' },
              { value: 'ink',       label: 'Ink · dark warm' },
              { value: 'graphite',  label: 'Graphite · dark cool' },
              { value: 'midnight',  label: 'Midnight · dark blue' },
              { value: 'bordeaux',  label: 'Bordeaux · dark wine' },
            ]}
            onChange={(v) => setTweak('palette', v)}
          />
        </TweakSection>

        <TweakSection label="Risk input style">
          <TweakSelect
            label="Style"
            value={t.riskStyle}
            options={[
              { value: 'slider',   label: 'Slider · conservative → aggressive' },
              { value: 'cards',    label: 'Cards · 5 named postures' },
              { value: 'dialogue', label: 'Dialogue · scenario Q&A' },
            ]}
            onChange={(v) => setTweak('riskStyle', v)}
          />
        </TweakSection>

        <TweakSection label="Data density">
          <TweakRadio
            label="Density"
            value={t.density}
            options={['compact', 'regular', 'dense']}
            onChange={(v) => setTweak('density', v)}
          />
        </TweakSection>

        <TweakSection label="Automated stewardship">
          <TweakToggle label="Rebalancing" value={t.autoRebalance} onChange={(v) => setTweak('autoRebalance', v)} />
          <TweakToggle label="Tax optimization" value={t.autoTax} onChange={(v) => setTweak('autoTax', v)} />
          <TweakToggle label="Income & cash sweep" value={t.autoIncome} onChange={(v) => setTweak('autoIncome', v)} />
          <TweakToggle label="Risk management" value={t.autoRisk} onChange={(v) => setTweak('autoRisk', v)} />
        </TweakSection>

        <TweakSection label="Agent personality">
          <TweakRadio
            label="Voice"
            value={t.personality}
            options={['formal', 'casual']}
            onChange={(v) => setTweak('personality', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Helper: render a Prototype pinned to a specific screen without internal nav
function PrototypePinned({ screen, profile, portfolio, ...rest }) {
  return <Prototype {...rest} initialScreen={screen} initialProfile={profile} initialPortfolio={portfolio} />;
}

Object.assign(window, { App });

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
