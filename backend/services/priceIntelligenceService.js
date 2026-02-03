/**
 * Price Intelligence Service (Agent-3)
 * Analyzes price trends, detects drops/spikes/anomalies, recommends Buy/Wait/Monitor.
 * No scraping - uses internal DB only.
 */
import sql from "../config/database.js";

const TREND_WINDOW_DAYS = 30;
const DROP_THRESHOLD_PCT = 10;
const SPIKE_THRESHOLD_PCT = 15;

/**
 * Get price history for a medicine (from price_history + current from medicine_prices)
 */
export async function getPriceHistory(medicineName, days = TREND_WINDOW_DAYS) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  let history = [];
  let current = [];
  try {
    history = await sql`
      SELECT price, recorded_at, source
      FROM price_history
      WHERE medicine_name ILIKE ${"%" + medicineName + "%"}
        AND recorded_at >= ${cutoff}
      ORDER BY recorded_at ASC
    `;
  } catch (_) {}

  try {
    current = await sql`
      SELECT price, recorded_at
      FROM medicine_prices
      WHERE medicine_name ILIKE ${"%" + medicineName + "%"}
      ORDER BY price ASC
      LIMIT 1
    `;
  } catch (_) {
    try {
      const meds = await sql`
        SELECT price, created_at as recorded_at
        FROM medicines
        WHERE name ILIKE ${"%" + medicineName + "%"} OR salt ILIKE ${"%" + medicineName + "%"}
        ORDER BY price ASC
        LIMIT 1
      `;
      current = meds;
    } catch (__) {}
  }

  const points = history.map((r) => ({
    price: Number(r.price),
    date: r.recorded_at,
  }));

  if (current[0]) {
    points.push({
      price: Number(current[0].price),
      date: current[0].recorded_at || new Date(),
    });
  }

  return points.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Compute trend: "rising" | "falling" | "stable"
 */
function computeTrend(points) {
  if (!points || points.length < 2) return "stable";
  const recent = points.slice(-5);
  const first = recent[0]?.price ?? 0;
  const last = recent[recent.length - 1]?.price ?? 0;
  if (first === 0) return "stable";
  const pctChange = ((last - first) / first) * 100;
  if (pctChange > 2) return "rising";
  if (pctChange < -2) return "falling";
  return "stable";
}

/**
 * Detect if current price is a significant drop vs average
 */
function detectDrop(points, avgPrice) {
  if (!points.length || !avgPrice) return false;
  const current = points[points.length - 1]?.price ?? 0;
  return current < avgPrice * (1 - DROP_THRESHOLD_PCT / 100);
}

/**
 * Detect if current price is a significant spike vs average
 */
function detectSpike(points, avgPrice) {
  if (!points.length || !avgPrice) return false;
  const current = points[points.length - 1]?.price ?? 0;
  return current > avgPrice * (1 + SPIKE_THRESHOLD_PCT / 100);
}

/**
 * Recommendation: "buy_now" | "wait" | "monitor"
 */
export function getRecommendation(insights) {
  const { trend, dropDetected, spikeDetected, currentPrice, avgPrice } = insights;
  if (spikeDetected) return "wait";
  if (dropDetected || trend === "falling") return "buy_now";
  if (trend === "stable" && currentPrice <= (avgPrice || currentPrice)) return "buy_now";
  if (trend === "rising") return "wait";
  return "monitor";
}

/**
 * Full price intelligence for a medicine
 */
export async function analyzeMedicinePrice(medicineName) {
  const points = await getPriceHistory(medicineName);
  const currentPrice = points.length ? points[points.length - 1].price : null;
  const avgPrice =
    points.length ? points.reduce((s, p) => s + p.price, 0) / points.length : currentPrice;
  const minPrice = points.length ? Math.min(...points.map((p) => p.price)) : currentPrice;
  const maxPrice = points.length ? Math.max(...points.map((p) => p.price)) : currentPrice;

  const trend = computeTrend(points);
  const dropDetected = detectDrop(points, avgPrice);
  const spikeDetected = detectSpike(points, avgPrice);

  const insights = {
    currentPrice,
    avgPrice: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
    minPrice,
    maxPrice,
    trend,
    dropDetected,
    spikeDetected,
    dataPoints: points.length,
    recommendation: getRecommendation({
      trend,
      dropDetected,
      spikeDetected,
      currentPrice,
      avgPrice,
    }),
  };

  return insights;
}

/**
 * Record price into history (call when price is updated via admin/CSV)
 */
export async function recordPriceHistory(medicineName, price, platformId = null, source = "manual") {
  await sql`
    INSERT INTO price_history (medicine_name, price, platform_id, source)
    VALUES (${medicineName}, ${price}, ${platformId}, ${source})
  `;
}
