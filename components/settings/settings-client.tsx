"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { exportUserData, importUserData } from "@/actions/backup";
import { changePassword, signOut } from "@/actions/auth";
import { subscribePush, unsubscribePush } from "@/actions/push";
import { toast } from "sonner";
import {
  Download,
  Upload,
  User,
  Mail,
  Calendar,
  Shield,
  Palette,
  Database,
  Bell,
  LogOut,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Lock } from "lucide-react";

interface SettingsClientProps {
  profile: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);

  // Check if push notifications are already subscribed on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) setPushEnabled(true);
    });
  }, []);

  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }, []);

  const handlePushToggle = useCallback(async (enabled: boolean) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    setPushLoading(true);
    try {
      if (enabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied");
          setPushLoading(false);
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });

        const json = sub.toJSON();
        await subscribePush({
          endpoint: sub.endpoint,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
        });

        setPushEnabled(true);
        toast.success("Push notifications enabled");
      } else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await unsubscribePush(sub.endpoint);
            await sub.unsubscribe();
          }
        }

        setPushEnabled(false);
        toast.success("Push notifications disabled");
      }
    } catch {
      toast.error("Failed to update push notification settings");
    } finally {
      setPushLoading(false);
    }
  }, [urlBase64ToUint8Array]);

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChangingPassword(true);
    const formData = new FormData(e.currentTarget);
    const result = await changePassword(formData);
    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.success);
      passwordFormRef.current?.reset();
    }
    setChangingPassword(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `splitease-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const results = await importUserData(payload);

      if (results.errors.length > 0) {
        toast.error(`Import completed with ${results.errors.length} error(s)`);
      } else {
        toast.success(
          `Imported ${results.imported} group(s)` +
            (results.skipped.length > 0
              ? `, skipped ${results.skipped.length}`
              : "")
        );
      }
    } catch {
      toast.error("Failed to import data. Check file format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Account Section ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-1">
                <User className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <User className="size-3.5" />
                  Name
                </p>
                <p className="text-sm">{profile.fullName || "Not set"}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Mail className="size-3.5" />
                  Email
                </p>
                <p className="text-sm">{profile.email}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Member since
                </p>
                <p className="text-sm">
                  {format(new Date(profile.createdAt), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Security Section ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Security
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-1">
                <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Change Password
            </CardTitle>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              ref={passwordFormRef}
              onSubmit={handleChangePassword}
              className="space-y-4 max-w-sm"
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" disabled={changingPassword}>
                <Shield className="size-4" />
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* ── Preferences Section ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preferences
        </h2>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-1">
                <Palette className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <ThemeToggle className="gap-2" />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-1">
                <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Notifications
            </CardTitle>
            <CardDescription>
              Manage how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications for new expenses and settlements
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={pushLoading}
                aria-label="Toggle push notifications"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Data Section ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Data
        </h2>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-1">
                <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Data Management
            </CardTitle>
            <CardDescription>
              Export or import your groups, expenses, and settlements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-medium">Export Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download all your groups and expense data as a JSON file.
                </p>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <Download className="size-4" />
                  {exporting ? "Exporting..." : "Export Data"}
                </Button>
              </div>

              <Separator orientation="vertical" className="hidden sm:block" />
              <Separator className="sm:hidden" />

              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-medium">Import Data</h3>
                <p className="text-sm text-muted-foreground">
                  Restore data from a previously exported backup file.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="size-4" />
                  {importing ? "Importing..." : "Import Data"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Sign Out (visible on mobile) ── */}
      <section className="space-y-4 md:hidden">
        <Separator />
        <form action={signOut}>
          <Button variant="outline" className="w-full text-red-500 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
