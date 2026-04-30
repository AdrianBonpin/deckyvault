import { Shield, ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react";
import { cn } from "~/lib/utils";

interface AntiCheatBadgeProps {
  antiCheatRelevant: boolean;
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown" | null;
  antiCheatName?: string | null;
  compact?: boolean; // for list views
  className?: string;
}

const statusConfig = {
  supported: {
    icon: ShieldCheck,
    label: "Anti-Cheat: Supported",
    color: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  unsupported: {
    icon: ShieldX,
    label: "Anti-Cheat: Unsupported",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  unknown: {
    icon: ShieldQuestion,
    label: "Anti-Cheat: Unknown",
    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  none: {
    icon: Shield,
    label: "No Anti-Cheat",
    color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
} as const;

export function AntiCheatBadge({
  antiCheatRelevant,
  antiCheatStatus,
  antiCheatName,
  compact = false,
  className,
}: AntiCheatBadgeProps) {
  if (!antiCheatRelevant || !antiCheatStatus || antiCheatStatus === "none") {
    return null;
  }

  const config = statusConfig[antiCheatStatus];
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          config.color,
          className
        )}
        title={antiCheatName ? `${config.label} (${antiCheatName})` : config.label}
      >
        <Icon className="h-3 w-3" />
        {antiCheatStatus === "unsupported" && "AC"}
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
      {antiCheatName && (
        <span className="text-xs opacity-75">({antiCheatName})</span>
      )}
    </div>
  );
}
