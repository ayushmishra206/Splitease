import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <FileQuestion className="size-16 text-muted-foreground/50" />
      <h1 className="mt-6 text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
