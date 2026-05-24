// app-ai.jsx — AI-integrated Meridian app with Groq backend

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useRef } = React;

// AI agent chat handler — calls backend SSE endpoint and collects portfolio + reasoning
async function callAIAgent(message, sessionId) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let portfolio = null;
  let agentReasoning = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'text') agentReasoning.push(event.content);
        if (event.type === 'portfolio') portfolio = event.portfolio;
      } catch {}
    }
  }
  return { portfolio, agentReasoning: agentReasoning.join('') };
}

// Default palette for the live app (not the design system)
const DEFAULT_PALETTE = 'ivory';
const DEFAULT_PERSONALITY = 'formal';
const DEFAULT_RISK_STYLE = 'slider';

// ── Main App Component ────────────────────────────────────────────────
function AIPrototype() {
  const palette = PALETTES[DEFAULT_PALETTE] || PALETTES.ivory;
  const copy = COPY[DEFAULT_PERSONALITY] || COPY.formal;

  const [screen, setScreen] = useS('welcome');
  const [sessionId] = useS(`session_${Date.now()}`);
  const [profile, setProfile] = useS({
    budget: 10000,
    risk: 50,
    term: 15,
    goals: ['retire', 'wealth'],
  });
  const [portfolio, setPortfolio] = useS(null);
  const [aiGenerating, setAIGenerating] = useS(false);
  const [pendingOrders, setPendingOrders] = useS([]);
  const [confirmMode, setConfirmMode] = useS('initial');
  const [chartPeriod, setChartPeriod] = useS('Max');
  const [automation, setAutomation] = useS({
    autoRebalance: true,
    autoTax: false,
    autoIncome: true,
    autoRisk: false,
  });
  const [scheduleModal, setScheduleModal] = useS({ open: false });
  const [hasPurchased, setHasPurchased] = useS(false);

  // AI-powered portfolio generation with real market data
  const goGenerateAI = async () => {
    setAIGenerating(true);
    setScreen('generating');

    try {
      const message = `Build a portfolio recommendation for:
        - Budget: $${profile.budget}
        - Risk level: ${profile.risk}/100 (${profile.risk < 30 ? 'conservative' : profile.risk < 60 ? 'moderate' : 'aggressive'})
        - Time horizon: ${profile.term} years
        - Goals: ${profile.goals.join(', ')}

        Provide specific stock and ETF recommendations with allocations.`;

      const result = await callAIAgent(message, sessionId);

      // Use AI's portfolio if available, enhance with real data
      let builtPortfolio;
      if (result.portfolio && result.portfolio.stocks && result.portfolio.stocks.length > 0) {
        // Get real market data for the AI-selected stocks
        builtPortfolio = await window.buildPortfolioWithRealData(
          profile.budget,
          profile.risk,
          profile.term,
          result.portfolio.stocks
        );
      } else {
        // Fallback: use real data with default tickers
        const defaultTickers = ['VTI', 'VXUS', 'BND', 'AAPL', 'MSFT'];
        builtPortfolio = await window.buildPortfolioWithRealData(
          profile.budget,
          profile.risk,
          profile.term,
          defaultTickers
        );
      }

      setPortfolio({
        ...builtPortfolio,
        agentReasoning: result.agentReasoning
      });
      const periods = typeof window.getPeriodsForSeries === 'function'
        ? window.getPeriodsForSeries(builtPortfolio.series)
        : ['1M', '3M', '6M', '1Y', '3Y'];
      setChartPeriod(periods[periods.length - 1]);
      setAIGenerating(false);
      // Screen transition driven by GeneratingScreen once animation + AI are both done
    } catch (error) {
      console.error('AI generation failed:', error);
      const fallbackPortfolio = buildPortfolio(profile.budget, profile.risk, profile.term);
      setPortfolio(fallbackPortfolio);
      const fallbackPeriods = typeof window.getPeriodsForSeries === 'function'
        ? window.getPeriodsForSeries(fallbackPortfolio.series)
        : ['1M', '3M', '6M', '1Y', '3Y'];
      setChartPeriod(fallbackPeriods[fallbackPeriods.length - 1]);
      setAIGenerating(false);
      // Screen transition driven by GeneratingScreen
    }
  };


  const addOrder = (order) => {
    setPendingOrders((prev) => {
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

  const handleSwitchAccepted = (from, to) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const allAlts = Object.values(window.SECTOR_ALT_POOL || {}).flat();
      const toInfo = allAlts.find(a => a.ticker === to);
      return {
        ...prev,
        positions: prev.positions.map(p =>
          p.ticker !== from ? p : { ...p, ticker: to, name: toInfo?.name || to }
        ),
      };
    });
  };

  return (
    <div style={{
      ...paletteVars(palette),
      width: '100%',
      height: '100%',
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'Geist, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {screen === 'welcome' && (
        <WelcomeScreen copy={copy} onBegin={() => setScreen('profile')} />
      )}

      {screen === 'profile' && (
        <ProfileScreen
          copy={copy}
          profile={profile}
          setProfile={setProfile}
          riskStyle={DEFAULT_RISK_STYLE}
          density="regular"
          onBack={() => setScreen('welcome')}
          onContinue={goGenerateAI}
        />
      )}

      {screen === 'generating' && (
        <GeneratingScreen
          copy={copy}
          profile={profile}
          onComplete={() => setScreen('dashboard-preauth')}
          autoPlay={aiGenerating}
          isLoading={aiGenerating}
        />
      )}

      {screen === 'dashboard-preauth' && portfolio && (
        <Dashboard
          copy={copy}
          profile={profile}
          portfolio={portfolio}
          density="regular"
          mode="initial"
          chartPeriod={chartPeriod}
          onChartPeriodChange={setChartPeriod}
          onBuy={() => {
            setConfirmMode('initial');
            setScreen('buy');
          }}
          onCounsel={() => setScreen('counsel')}
          onModify={() => setScreen('modify-profile')}
          automation={automation}
          currentScreen="portfolio"
          onNavigate={(s) => {
            if (s === 'counsel') setScreen('counsel');
          }}
        />
      )}

      {screen === 'buy' && portfolio && (
        <>
          <Dashboard
            copy={copy}
            profile={profile}
            portfolio={portfolio}
            density="regular"
            mode={confirmMode === 'pending' ? 'live' : 'initial'}
            pendingOrders={pendingOrders}
            chartPeriod={chartPeriod}
            onChartPeriodChange={setChartPeriod}
            onBuy={() => {}}
            onCounsel={() => {}}
            currentScreen="portfolio"
            onNavigate={(screen) => {
              if (screen === 'counsel') setScreen('counsel');
              else if (screen === 'activity') alert('Activity view coming soon');
              else if (screen === 'settings') alert('Settings coming soon');
            }}
          />
          <BuyConfirm
            copy={copy}
            portfolio={portfolio}
            orders={confirmMode === 'pending' ? pendingOrders : undefined}
            onConfirm={() => {
              if (confirmMode === 'pending') {
                applyPending();
                setScreen('dashboard');
              } else {
                setScreen('success');
              }
            }}
            onCancel={() =>
              setScreen(confirmMode === 'pending' ? 'dashboard' : 'dashboard-preauth')
            }
          />
        </>
      )}

      {screen === 'success' && portfolio && (
        <Success
          copy={copy}
          portfolio={portfolio}
          onDone={() => { setHasPurchased(true); setScreen('dashboard'); }}
        />
      )}

      {screen === 'dashboard' && portfolio && (
        <Dashboard
          copy={copy}
          profile={profile}
          portfolio={portfolio}
          density="regular"
          mode="live"
          pendingOrders={pendingOrders}
          chartPeriod={chartPeriod}
          onChartPeriodChange={setChartPeriod}
          onAddOrder={addOrder}
          onRemoveOrder={removeOrder}
          onAuthorize={() => {
            setConfirmMode('pending');
            setScreen('buy');
          }}
          onBuy={() => setScreen('counsel')}
          onCounsel={() => setScreen('counsel')}
          onModify={() => setScreen('modify-profile')}
          automation={automation}
          currentScreen="portfolio"
          onNavigate={(s) => {
            if (s === 'counsel') setScreen('counsel');
          }}
        />
      )}

      {screen === 'counsel' && portfolio && (
        <Counsel
          copy={copy}
          profile={profile}
          portfolio={portfolio}
          automation={automation}
          setAutomation={(key, value) => {
            setAutomation(prev => ({ ...prev, [key]: value }));
          }}
          scheduleModal={scheduleModal}
          setScheduleModal={setScheduleModal}
          onSwitchAccepted={handleSwitchAccepted}
          onBack={() => setScreen(hasPurchased ? 'dashboard' : 'dashboard-preauth')}
        />
      )}

      {screen === 'modify-profile' && (
        <ProfileScreen
          copy={copy}
          profile={profile}
          setProfile={setProfile}
          riskStyle={DEFAULT_RISK_STYLE}
          density="regular"
          onBack={() => setScreen(hasPurchased ? 'dashboard' : 'dashboard-preauth')}
          onContinue={goGenerateAI}
        />
      )}

    </div>
  );
}

// ── Simple App Mount ────────────────────────────────────────────────
function App() {
  return <AIPrototype />;
}

Object.assign(window, { App });

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
