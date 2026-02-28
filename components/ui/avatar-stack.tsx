import { cn } from "@/lib/utils";

interface AvatarStackProps {
  names: string[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AvatarStack({ names, max = 3, size = "sm", className }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - max;

  const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((name, i) => (
        <div
          key={i}
          title={name}
          className={cn(
            "inline-flex items-center justify-center rounded-full border-2 border-card font-medium text-white",
            sizeClasses,
            getColorForName(name)
          )}
        >
          {getInitials(name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full border-2 border-card bg-muted font-medium text-muted-foreground",
            sizeClasses
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
