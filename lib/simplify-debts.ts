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

export type BalanceExpense = {
  payerId: string | null;
  amount: number;
  /** Who actually paid and how much. When absent or empty, `payerId` paid `amount`. */
  payers?: Array<{ memberId: string; amount: number }>;
  splits: Array<{ memberId: string; share: number }>;
};

export type BalanceSettlement = {
  fromMember: string;
  toMember: string;
  amount: number;
};

/**
 * Resolve who paid for an expense. Supports both the legacy single `payerId`
 * and the multi-payer `payers` list.
 */
export function resolvePayers(
  expense: Pick<BalanceExpense, "payerId" | "amount" | "payers">
): Array<{ memberId: string; amount: number }> {
  if (expense.payers && expense.payers.length > 0) return expense.payers;
  if (expense.payerId) return [{ memberId: expense.payerId, amount: expense.amount }];
  return [];
}

/**
 * Build net balances for all members in a group from expenses and settlements.
 * Positive balance = member is owed money, negative = member owes money.
 */
export function computeNetBalances(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[]
): Record<string, number> {
  const net: Record<string, number> = {};

  for (const expense of expenses) {
    const payers = resolvePayers(expense);
    if (payers.length === 0) continue;
    // Each payer is owed what they paid, each participant owes their share
    for (const payer of payers) {
      net[payer.memberId] = (net[payer.memberId] ?? 0) + payer.amount;
    }
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

/**
 * Balances between one member and everyone else, derived from the simplified
 * transfer plan. Positive = they owe `userId`, negative = `userId` owes them.
 */
export function balancesForUser(
  netBalances: Record<string, number>,
  userId: string
): Array<{ memberId: string; amount: number }> {
  const out: Array<{ memberId: string; amount: number }> = [];
  for (const t of simplifyDebts(netBalances)) {
    if (t.to === userId) out.push({ memberId: t.from, amount: t.amount });
    else if (t.from === userId) out.push({ memberId: t.to, amount: -t.amount });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
