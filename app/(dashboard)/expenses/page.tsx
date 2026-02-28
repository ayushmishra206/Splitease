import { fetchExpenses } from "@/actions/expenses";
import { fetchGroups } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { ExpenseList } from "@/components/expenses/expense-list";

export default async function ExpensesPage() {
  const [user, expenses, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchExpenses(),
    fetchGroups(),
  ]);

  return <ExpenseList expenses={expenses} groups={groups} currentUserId={user.id} />;
}
