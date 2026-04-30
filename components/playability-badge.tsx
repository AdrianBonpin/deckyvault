import {
  CircleCheck,
  CircleDot,
  Wrench,
  CircleX,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayabilityBadgeProps {
  status: "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" | null;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  great: {
    icon: CircleCheck,
    label: "Plays Great",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  playable: {
    icon: CircleDot,
    label: "Playable",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dotColor: "bg-blue-400",
  },
  needs_tweaks: {
    icon: Wrench,
    label: "Needs Tweaks",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  unplayable: {
    icon: CircleX,
    label: "Unplayable",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    dotColor: "bg-red-400",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    dotColor: "bg-zinc-400",
  },
} as const;

export function PlayabilityBadge({
  status,
  compact = false,
  showLabel = true,
  className,
}: PlayabilityBadgeProps) {
  if (!status) return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          config.color,
          className
        )}
        title={config.label}
      >
        <span className={cn("h-2 w-2 rounded-full", config.dotColor)} />
        {showLabel && config.label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium",
        config.color,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}
