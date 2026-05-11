import { useState, useEffect, useRef, useCallback } from "react";

const TD_API_KEY = import.meta.env.VITE_TD_API_KEY;

const CURRENCY_PAIRS = [
  { id: "EUR/USD", symbol: "EUR/USD", label: "EUR/USD", type: "major", flag: "🇪🇺🇺🇸" },
  { id: "GBP/USD", symbol: "GBP/USD", label: "GBP/USD", type: "major", flag: "🇬🇧🇺🇸" },
  { id: "USD/JPY", symbol: "USD/JPY", label: "USD/JPY", type: "major", flag: "🇺🇸🇯🇵" },
];

const TF_MAP = {
  M1: "1min",
  M5: "5min",
  M15: "15min",
  H1: "1h",
};

async function fetchLiveCandles(symbol, tf) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    symbol
  )}&interval=${TF_MAP[tf]}&outputsize=60&apikey=${TD_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.values || data.status === "error") {
    throw new Error(data.message || "API error");
  }

  return data.values.reverse().map((v, i) => ({
    open: parseFloat(v.open),
    close: parseFloat(v.close),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    volume: parseFloat(v.volume || 0),
    time: i,
  }));
}

function calcRSI(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;

  const closes = candles.map((c) => c.close);

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  gains /= period;
  losses /= period;

  if (losses === 0) return 100;

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function detectSignals(candles, rsi) {
  if (!candles || candles.length < 2 || rsi === null) return [];

  const last = candles[candles.length - 1];
  const bullish = last.close > last.open;
  const bearish = last.close < last.open;

  const signals = [];

  if (rsi < 30 && bullish) {
    signals.push({
      direction: "BUY",
      title: "RSI Oversold Reversal",
      strength: 3,
    });
  }

  if (rsi > 70 && bearish) {
    signals.push({
      direction: "SELL",
      title: "RSI Overbought Reversal",
      strength: 3,
    });
  }

  return signals;
}

export default function CurrencyBot() {
  const [pair, setPair] = useState(CURRENCY_PAIRS[0]);
  const [tf, setTf] = useState("M5");
  const [candles, setCandles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const data = await fetchLiveCandles(pair.symbol, tf);

      if (!data || data.length < 2) return;

      const rsi = calcRSI(data);
      const sigs = detectSignals(data, rsi);

      setCandles(data);
      setSignals(sigs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pair, tf]);

  useEffect(() => {
    loadData();

    refreshRef.current = setInterval(loadData, 60000);

    return () => {
      clearInterval(refreshRef.current);
    };
  }, [loadData]);

  const currentPrice =
    candles.length > 0
      ? candles[candles.length - 1].close.toFixed(5)
      : "0.00000";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0c10",
        color: "#c8d0e0",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      <h1>
        Currency<span style={{ color: "#00e5a0" }}>Bot</span>
      </h1>

      <div style={{ marginBottom: "20px" }}>
        {CURRENCY_PAIRS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPair(p)}
            style={{
              marginRight: "10px",
              padding: "8px 12px",
              background: pair.id === p.id ? "#00e5a0" : "#151c2e",
              color: pair.id === p.id ? "#000" : "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {p.flag} {p.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: "20px" }}>
        {["M1", "M5", "M15", "H1"].map((timeframe) => (
          <button
            key={timeframe}
            onClick={() => setTf(timeframe)}
            style={{
              marginRight: "10px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #1e2535",
              background: tf === timeframe ? "#4a6fff" : "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {timeframe}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "#111520",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <div>Pair: {pair.label}</div>
        <div>Price: {currentPrice}</div>
        <div>Status: {loading ? "Loading..." : "Live"}</div>
      </div>

      <div
        style={{
          background: "#111520",
          padding: "20px",
          borderRadius: "10px",
        }}
      >
        <h3>Signals</h3>

        {signals.length === 0 && <div>No active signals</div>}

        {signals.map((s, i) => (
          <div
            key={i}
            style={{
              padding: "10px",
              marginTop: "10px",
              borderRadius: "6px",
              background:
                s.direction === "BUY" ? "#003b2b" : "#4b0d1c",
            }}
          >
            <strong>{s.direction}</strong> — {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}
