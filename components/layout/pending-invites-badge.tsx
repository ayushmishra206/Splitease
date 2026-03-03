"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchPendingInviteCount } from "@/actions/group-invites";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingInvitesBadgeProps {
  collapsed?: boolean;
}

export function PendingInvitesBadge({ collapsed }: PendingInvitesBadgeProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchPendingInviteCount().then(setCount).catch(() => {});
    // Poll every 60 seconds
    const interval = setInterval(() => {
      fetchPendingInviteCount().then(setCount).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/invites"
      title={collapsed ? `${count} pending invite${count !== 1 ? "s" : ""}` : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20",
        collapsed && "justify-center px-2"
      )}
    >
      <div className="relative shrink-0">
        <Mail className="h-5 w-5" />
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      </div>
      {!collapsed && <span>Invites ({count})</span>}
    </Link>
  );
}
