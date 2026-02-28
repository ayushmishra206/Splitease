import { fetchExpenses } from "@/actions/expenses";
import { fetchGroups } from "@/actions/groups";
import { createClient } from "@/lib/supabase/server";
import { ExpenseList } from "@/components/expenses/expense-list";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [expenses, groups] = await Promise.all([
    fetchExpenses(),
    fetchGroups(),
  ]);

  return <ExpenseList expenses={expenses} groups={groups} currentUserId={user!.id} />;
}
