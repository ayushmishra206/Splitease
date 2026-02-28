import { fetchAnalyticsData } from "@/actions/analytics";
import { fetchGroups } from "@/actions/groups";
import { getAuthenticatedUser } from "@/lib/auth";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export default async function AnalyticsPage() {
  const [, data, groups] = await Promise.all([
    getAuthenticatedUser(),
    fetchAnalyticsData(),
    fetchGroups(),
  ]);

  return (
    <AnalyticsClient
      data={data}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
    />
  );
}
