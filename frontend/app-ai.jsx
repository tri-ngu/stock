// app-ai.jsx — AI-integrated Meridian app with Groq backend

const { useState: useS, useEffect: useE, useMemo: useM, useRef: useRef } = React;

// Default palette for the live app (not the design system)
const DEFAULT_PALETTE = 'ivory';
const DEFAULT_PERSONALITY = 'formal';
const DEFAULT_RISK_STYLE = 'slider';

// ── AI Agent Loop ─────────────────────────────────────────────────────
async function callAIAgent(message, sessionId) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        session_id: sessionId
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let fullResponse = '';
    let portfolio = null;
    let agentReasoning = { steps: [] };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return new Promise((resolve, reject) => {
      const processStream = async () => {
        try {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              resolve({ text: fullResponse, portfolio, agentReasoning, success: true });
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullResponse += data.content;
                } else if (data.type === 'portfolio') {
                  portfolio = data.portfolio;
                } else if (data.type === 'tool_call') {
                  agentReasoning.steps.push({
                    tool: data.tool,
                    reasoning: data.input
                  });
                }
              }
            }
          }
        } catch (err) {
          reject(err);
        }
      };
      processStream();
    });
  } catch (error) {
    console.error('AI Agent error:', error);
    throw error;
  }
}

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

  // AI-powered portfolio generation
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

      // Use AI's portfolio if available, otherwise fallback to local generation
      const builtPortfolio = result.portfolio || buildPortfolio(profile.budget, profile.risk, profile.term);
      setPortfolio({
        ...builtPortfolio,
        agentReasoning: result.agentReasoning // Include reasoning steps
      });
      setChartPeriod('1Y');
      setAIGenerating(false);
      setScreen('dashboard-preauth');
    } catch (error) {
      console.error('AI generation failed:', error);
      setAIGenerating(false);
      // Fallback to local generation
      const builtPortfolio = buildPortfolio(profile.budget, profile.risk, profile.term);
      setPortfolio(builtPortfolio);
      setChartPeriod('1Y');
      setScreen('dashboard-preauth');
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
          onComplete={() => {}}
          autoPlay={aiGenerating}
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
          currentScreen="portfolio"
          onNavigate={(screen) => {
            if (screen === 'counsel') setScreen('counsel');
            // TODO: Implement Activity and Settings views
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
          onDone={() => setScreen('dashboard')}
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
          currentScreen="portfolio"
          onNavigate={(screen) => {
            if (screen === 'counsel') setScreen('counsel');
            // TODO: Implement Activity and Settings views
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
          onBack={() => setScreen(portfolio ? 'dashboard' : 'dashboard-preauth')}
        />
      )}

      {screen === 'modify-profile' && (
        <ProfileScreen
          copy={copy}
          profile={profile}
          setProfile={setProfile}
          riskStyle={DEFAULT_RISK_STYLE}
          density="regular"
          onBack={() => setScreen('dashboard')}
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
