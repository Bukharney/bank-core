export interface AccountMetadata {
  nickname: string;
  color: string; // e.g. "emerald" | "blue" | "violet" | "amber" | "rose" | "cyan" | "slate"
}

export interface ColorPreset {
  id: string;
  name: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  activeBorderLight: string;
  activeBorderDark: string;
  activeRing: string;
  activeBadge: string;
  textLight: string;
  textDark: string;
  dot: string;
  badge: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  emerald: {
    id: "emerald",
    name: "Emerald Green",
    bgLight: "bg-emerald-50/70",
    bgDark: "dark:bg-emerald-950/30",
    borderLight: "border-emerald-200",
    borderDark: "dark:border-emerald-900/60",
    activeBorderLight: "border-emerald-600",
    activeBorderDark: "dark:border-emerald-500",
    activeRing: "ring-2 ring-emerald-500/50 shadow-md shadow-emerald-500/10",
    activeBadge: "bg-emerald-600 dark:bg-emerald-500 text-white",
    textLight: "text-emerald-700",
    textDark: "dark:text-emerald-400",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  blue: {
    id: "blue",
    name: "Sapphire Blue",
    bgLight: "bg-blue-50/70",
    bgDark: "dark:bg-blue-950/30",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-900/60",
    activeBorderLight: "border-blue-600",
    activeBorderDark: "dark:border-blue-500",
    activeRing: "ring-2 ring-blue-500/50 shadow-md shadow-blue-500/10",
    activeBadge: "bg-blue-600 dark:bg-blue-500 text-white",
    textLight: "text-blue-700",
    textDark: "dark:text-blue-400",
    dot: "bg-blue-500",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  violet: {
    id: "violet",
    name: "Royal Violet",
    bgLight: "bg-violet-50/70",
    bgDark: "dark:bg-violet-950/30",
    borderLight: "border-violet-200",
    borderDark: "dark:border-violet-900/60",
    activeBorderLight: "border-violet-600",
    activeBorderDark: "dark:border-violet-500",
    activeRing: "ring-2 ring-violet-500/50 shadow-md shadow-violet-500/10",
    activeBadge: "bg-violet-600 dark:bg-violet-500 text-white",
    textLight: "text-violet-700",
    textDark: "dark:text-violet-400",
    dot: "bg-violet-500",
    badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  },
  amber: {
    id: "amber",
    name: "Warm Amber",
    bgLight: "bg-amber-50/70",
    bgDark: "dark:bg-amber-950/30",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-900/60",
    activeBorderLight: "border-amber-600",
    activeBorderDark: "dark:border-amber-500",
    activeRing: "ring-2 ring-amber-500/50 shadow-md shadow-amber-500/10",
    activeBadge: "bg-amber-600 dark:bg-amber-500 text-white",
    textLight: "text-amber-700",
    textDark: "dark:text-amber-400",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  rose: {
    id: "rose",
    name: "Ruby Rose",
    bgLight: "bg-rose-50/70",
    bgDark: "dark:bg-rose-950/30",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-900/60",
    activeBorderLight: "border-rose-600",
    activeBorderDark: "dark:border-rose-500",
    activeRing: "ring-2 ring-rose-500/50 shadow-md shadow-rose-500/10",
    activeBadge: "bg-rose-600 dark:bg-rose-500 text-white",
    textLight: "text-rose-700",
    textDark: "dark:text-rose-400",
    dot: "bg-rose-500",
    badge: "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  cyan: {
    id: "cyan",
    name: "Ocean Cyan",
    bgLight: "bg-cyan-50/70",
    bgDark: "dark:bg-cyan-950/30",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-900/60",
    activeBorderLight: "border-cyan-600",
    activeBorderDark: "dark:border-cyan-500",
    activeRing: "ring-2 ring-cyan-500/50 shadow-md shadow-cyan-500/10",
    activeBadge: "bg-cyan-600 dark:bg-cyan-500 text-white",
    textLight: "text-cyan-700",
    textDark: "dark:text-cyan-400",
    dot: "bg-cyan-500",
    badge: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  },
  slate: {
    id: "slate",
    name: "Minimal Slate",
    bgLight: "bg-white",
    bgDark: "dark:bg-[#0f172a]/90",
    borderLight: "border-slate-200",
    borderDark: "dark:border-slate-800",
    activeBorderLight: "border-slate-900",
    activeBorderDark: "dark:border-white",
    activeRing: "ring-2 ring-slate-900/40 dark:ring-white/40 shadow-md",
    activeBadge: "bg-slate-900 dark:bg-white text-white dark:text-slate-900",
    textLight: "text-slate-700",
    textDark: "dark:text-slate-300",
    dot: "bg-slate-500",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
};

export function getAccountMeta(accountId: number): AccountMetadata {
  if (typeof window === "undefined") {
    return { nickname: "", color: "slate" };
  }
  try {
    const raw = localStorage.getItem(`bank-core-account-meta-${accountId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        nickname: parsed.nickname || "",
        color: COLOR_PRESETS[parsed.color] ? parsed.color : "slate",
      };
    }
  } catch {}
  return { nickname: "", color: "slate" };
}

export function setAccountMeta(accountId: number, meta: AccountMetadata): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`bank-core-account-meta-${accountId}`, JSON.stringify(meta));
    window.dispatchEvent(new Event("bank-core-account-meta-changed"));
  } catch {}
}
