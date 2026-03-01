"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Share, X } from "lucide-react";
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
const IOS_INSTALL_DISMISS_KEY = "ios-install-prompt-dismissed";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // iOS Safari but NOT installed as PWA — show "Add to Home Screen" prompt
    if (isIOS() && !isStandalone()) {
      if (!localStorage.getItem(IOS_INSTALL_DISMISS_KEY)) {
        setShowInstallPrompt(true);
      }
      return;
    }

    // Don't show if browser doesn't support push
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;

    // Don't show if already dismissed
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Don't show if permission already granted and subscription exists
    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
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

      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

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

  const handleDismissInstall = useCallback(() => {
    localStorage.setItem(IOS_INSTALL_DISMISS_KEY, "1");
    setShowInstallPrompt(false);
  }, []);

  // iOS "Add to Home Screen" prompt
  if (showInstallPrompt) {
    return (
      <div className="mx-auto mb-4 w-full max-w-5xl px-4 sm:px-6">
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 mt-0.5">
            <Share className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Install SplitEase for notifications
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Tap the share button <span className="inline-block align-text-bottom"><Share className="inline size-3" /></span> in
              Safari, then &ldquo;Add to Home Screen&rdquo; to enable push notifications
            </p>
          </div>
          <button
            onClick={handleDismissInstall}
            className="shrink-0 rounded-md p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

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
