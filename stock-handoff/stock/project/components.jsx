// Shared UI primitives for Meridian — sparkline, donut, line chart, rule, etc.
// All rely on CSS custom props from tokens.jsx (paletteVars).

const { useMemo } = React;

// ─── Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, width = 80, height = 24, stroke = 'currentColor', fill, strokeWidth = 1 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => `${(i * stepX).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`).join(' ');
  const last = data[data.length - 1];
  const lastY = height - ((last - min) / range) * height;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <polyline points={`0,${height} ${points} ${width},${height}`} fill={fill} stroke="none" />}
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={lastY} r={1.6} fill={stroke} />
    </svg>
  );
}

// ─── AreaChart (large, with grid + axis) ───────────────────────────────────
function AreaChart({ data, width = 600, height = 240, accent = 'currentColor', yLabels = [], xLabels = [] }) {
  const padL = 44, padR = 12, padT = 16, padB = 28;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const pts = data.map((v, i) => [padL + i * stepX, padT + innerH - ((v - min) / range) * innerH]);
  const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${line} L${padL + innerW},${padT + innerH} L${padL},${padT + innerH} Z`;
  const yTicks = yLabels.length ? yLabels : 5;
  const yT = Array.isArray(yTicks) ? yTicks : Array.from({ length: yTicks }, (_, i) => min + (range * i) / (yTicks - 1));
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yT.map((v, i) => {
        const y = padT + innerH - (i / (yT.length - 1)) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray={i === 0 || i === yT.length - 1 ? '' : '2 3'} />
            <text x={padL - 8} y={y + 3} fontSize="10" fill="var(--ink-mute)" textAnchor="end" fontFamily="JetBrains Mono, monospace">{typeof v === 'number' ? `$${v.toFixed(0)}` : v}</text>
          </g>
        );
      })}
      {xLabels.map((lbl, i) => {
        const x = padL + (i / Math.max(1, xLabels.length - 1)) * innerW;
        return <text key={i} x={x} y={height - 8} fontSize="10" fill="var(--ink-mute)" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{lbl}</text>;
      })}
      <path d={area} fill="url(#areaGrad)" />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={accent} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="6" fill={accent} opacity="0.18" />
    </svg>
  );
}

// ─── Donut allocation chart ────────────────────────────────────────────────
function Donut({ segments, size = 160, thickness = 18 }) {
  const total = segments.reduce((s, x) => s + x.weight, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s, i) => {
          const frac = s.weight / total;
          const dash = frac * c;
          const offset = -acc * c;
          acc += frac;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset} />
          );
        })}
      </g>
    </svg>
  );
}

// ─── Candlestick mini chart ────────────────────────────────────────────────
function Candles({ data, width = 90, height = 28 }) {
  const all = data.flatMap((d) => [d.h, d.l]);
  const min = Math.min(...all), max = Math.max(...all);
  const range = max - min || 1;
  const cw = width / data.length;
  const bw = Math.max(2, cw * 0.6);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x = i * cw + cw / 2;
        const yH = height - ((d.h - min) / range) * height;
        const yL = height - ((d.l - min) / range) * height;
        const yO = height - ((d.o - min) / range) * height;
        const yC = height - ((d.c - min) / range) * height;
        const up = d.c >= d.o;
        return (
          <g key={i}>
            <line x1={x} y1={yH} x2={x} y2={yL} stroke={up ? 'var(--gain)' : 'var(--loss)'} strokeWidth="0.8" />
            <rect x={x - bw / 2} y={Math.min(yO, yC)} width={bw} height={Math.max(1, Math.abs(yC - yO))}
              fill={up ? 'var(--gain)' : 'var(--loss)'} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Rule / divider ────────────────────────────────────────────────────────
function Rule({ style = {} }) {
  return <hr style={{ border: 0, borderTop: '1px solid var(--rule)', margin: 0, ...style }} />;
}

// ─── Section eyebrow ───────────────────────────────────────────────────────
function Eyebrow({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: 'var(--ink-mute)', ...style,
    }}>{children}</div>
  );
}

// ─── Meridian logo (M with rule) ───────────────────────────────────────────
function MeridianMark({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      <path d="M3 19 L3 5 L7 5 L12 13 L17 5 L21 5 L21 19" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="3" y1="22" x2="21" y2="22" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

// ─── Logo lockup ───────────────────────────────────────────────────────────
function Wordmark({ size = 18 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <MeridianMark size={size + 4} />
      <div>
        <div style={{ fontFamily: 'Newsreader, serif', fontSize: size, lineHeight: 1, fontWeight: 500, letterSpacing: -0.3 }}>Meridian</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: '0.22em', color: 'var(--ink-mute)', textTransform: 'uppercase', marginTop: 3 }}>est. 2026 · ai counsel</div>
      </div>
    </div>
  );
}

// ─── Money formatting ──────────────────────────────────────────────────────
const fmtUSD = (n, opts = {}) => {
  const { compact = false, signed = false, decimals = 0 } = opts;
  const sign = signed && n > 0 ? '+' : '';
  if (compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
    return `${sign}$${(n / 1e3).toFixed(1)}k`;
  }
  return `${sign}$${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const fmtPct = (n, { signed = false, decimals = 2 } = {}) => {
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
};

// ─── Tiny Delta pill ───────────────────────────────────────────────────────
function Delta({ value, suffix = '%', size = 'sm' }) {
  const up = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      color: up ? 'var(--gain)' : 'var(--loss)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: size === 'lg' ? 14 : 11,
      fontWeight: 500,
    }}>
      <span style={{ fontSize: '0.85em' }}>{up ? '▲' : '▼'}</span>
      {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

Object.assign(window, { Sparkline, AreaChart, Donut, Candles, Rule, Eyebrow, MeridianMark, Wordmark, fmtUSD, fmtPct, Delta });
