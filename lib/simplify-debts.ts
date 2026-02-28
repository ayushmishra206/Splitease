export type SimplifiedDebt = {
  from: string;
  to: string;
  amount: number;
};

/**
 * Greedy debt simplification: minimise the number of transactions needed
 * to settle all balances.
 *
 * @param netBalances  Map of memberId → net amount (positive = is owed, negative = owes)
 * @returns            Minimal list of { from, to, amount } transfers
 */
export function simplifyDebts(
  netBalances: Record<string, number>
): SimplifiedDebt[] {
  // Filter out near-zero balances and separate into creditors/debtors
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const [id, balance] of Object.entries(netBalances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) {
      creditors.push({ id, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ id, amount: Math.abs(rounded) });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const results: SimplifiedDebt[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);

    if (transfer > 0.01) {
      results.push({
        from: debtors[di].id,
        to: creditors[ci].id,
        amount: Math.round(transfer * 100) / 100,
      });
    }

    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return results;
}

/**
 * Build net balances for all members in a group from expenses and settlements.
 * Positive balance = member is owed money, negative = member owes money.
 */
export function computeNetBalances(
  expenses: Array<{
    payerId: string | null;
    amount: number;
    splits: Array<{ memberId: string; share: number }>;
  }>,
  settlements: Array<{
    fromMember: string;
    toMember: string;
    amount: number;
  }>
): Record<string, number> {
  const net: Record<string, number> = {};

  for (const expense of expenses) {
    if (!expense.payerId) continue;
    // Payer is owed the total, each participant owes their share
    net[expense.payerId] = (net[expense.payerId] ?? 0) + expense.amount;
    for (const split of expense.splits) {
      net[split.memberId] = (net[split.memberId] ?? 0) - split.share;
    }
  }

  // Settlements: fromMember paid toMember (settles debt, so fromMember's net increases)
  for (const s of settlements) {
    net[s.fromMember] = (net[s.fromMember] ?? 0) + s.amount;
    net[s.toMember] = (net[s.toMember] ?? 0) - s.amount;
  }

  return net;
}
