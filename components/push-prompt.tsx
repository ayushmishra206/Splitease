"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribePush } from "@/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const DISMISS_KEY = "push-prompt-dismissed";

export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't show if browser doesn't support push
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Don't show if already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Don't show if permission already granted and subscription exists
    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
        if (!reg) {
          setVisible(true);
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        if (!sub) setVisible(true);
      });
      return;
    }

    // Don't show if permission was denied (user can re-enable via browser settings)
    if (Notification.permission === "denied") return;

    // Permission is "default" — show the prompt
    setVisible(true);
  }, []);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      await subscribePush({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      });

      toast.success("Push notifications enabled");
      setVisible(false);
    } catch {
      toast.error("Failed to enable push notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-auto mb-4 w-full max-w-5xl px-4 sm:px-6">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
          <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            Enable push notifications
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Get notified about new expenses, settlements, and group updates
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={loading}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? "Enabling..." : "Enable"}
          </Button>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
