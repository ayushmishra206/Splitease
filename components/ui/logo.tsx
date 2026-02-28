import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-9 w-9 rounded-xl text-sm",
  md: "h-12 w-12 rounded-2xl text-lg",
  lg: "h-16 w-16 rounded-2xl text-2xl",
};

export function Logo({ size = "sm", className }: LogoProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold shadow-sm",
        sizes[size],
        className
      )}
    >
      S
    </div>
  );
}
