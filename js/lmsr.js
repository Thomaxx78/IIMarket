// ============================================================
// LMSR MATH
// ============================================================

// Cost function: C(q_yes, q_no) = b * ln(exp(q_yes/b) + exp(q_no/b))
// Uses log-sum-exp trick for numerical stability
function lmsrC(qY, qN, b) {
  const x = qY / b, y = qN / b;
  const m = Math.max(x, y);
  return b * (m + Math.log(Math.exp(x - m) + Math.exp(y - m)));
}

// Implicit probability of YES
function lmsrProb(qY, qN, b) {
  const d = (qY - qN) / b;
  if (d > 50) return 0.9999;
  if (d < -50) return 0.0001;
  return 1 / (1 + Math.exp(-d));
}

// Cost to buy `shares` on a given side
function costToBuy(mkt, side, shares) {
  const newQY = mkt.qYes + (side === 'yes' ? shares : 0);
  const newQN = mkt.qNo  + (side === 'no'  ? shares : 0);
  return lmsrC(newQY, newQN, mkt.b) - lmsrC(mkt.qYes, mkt.qNo, mkt.b);
}

// Binary search: how many shares for `coins`?
function sharesToReceive(mkt, side, coins) {
  if (coins <= 0) return 0;
  let lo = 0, hi = coins * 20;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    (costToBuy(mkt, side, mid) < coins) ? (lo = mid) : (hi = mid);
  }
  return (lo + hi) / 2;
}
