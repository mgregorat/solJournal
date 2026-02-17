export type TradeMetricsInput = {
  pnl_usd: number;
  opened_at: Date;
  closed_at: Date;
};

export type TradeMetrics = {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  largestWin: number;
  largestLoss: number;
  avgHoldTimeMinutes: number;
};

export function computeTradeMetrics(journaledTrades: TradeMetricsInput[]): TradeMetrics {
  const totalTrades = journaledTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: null,
      largestWin: 0,
      largestLoss: 0,
      avgHoldTimeMinutes: 0,
    };
  }

  let winsCount = 0;
  let lossesCount = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalHoldTimeMinutes = 0;

  for (const trade of journaledTrades) {
    const pnl = trade.pnl_usd;

    if (pnl > 0) {
      winsCount += 1;
      totalWins += pnl;
      if (pnl > largestWin) largestWin = pnl;
    } else if (pnl < 0) {
      lossesCount += 1;
      totalLosses += pnl;
      if (pnl < largestLoss) largestLoss = pnl;
    }

    const openedAtMs = trade.opened_at.getTime();
    const closedAtMs = trade.closed_at.getTime();
    const holdMinutes = Math.max(0, (closedAtMs - openedAtMs) / 60000);
    totalHoldTimeMinutes += holdMinutes;
  }

  const winRate = (winsCount / totalTrades) * 100;
  const avgWin = winsCount > 0 ? totalWins / winsCount : 0;
  const avgLoss =
    lossesCount > 0
      ? Math.abs(totalLosses / lossesCount)
      : 0;
  const profitFactor = lossesCount > 0 ? totalWins / Math.abs(totalLosses) : null;
  const avgHoldTimeMinutes = totalHoldTimeMinutes / totalTrades;

  return {
    totalTrades,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    largestWin,
    largestLoss: Math.abs(largestLoss),
    avgHoldTimeMinutes,
  };
}
