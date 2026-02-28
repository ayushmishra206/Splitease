"use client";

import { useState, useRef } from "react";
import { exportUserData, importUserData } from "@/actions/backup";
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
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
