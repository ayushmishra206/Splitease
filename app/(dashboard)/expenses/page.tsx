import { fetchExpenses } from "@/actions/expenses";
import { fetchGroups } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { ExpenseList } from "@/components/expenses/expense-list";

export default async function ExpensesPage() {
  const [user, expenseData, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchExpenses(),
    fetchGroups(),
  ]);

  return (
    <ExpenseList
      initialExpenses={expenseData.items}
      initialNextCursor={expenseData.nextCursor}
      groups={groups}
      currentUserId={user.id}
    />
  );
}
