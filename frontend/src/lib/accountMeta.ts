export interface AccountMetadata {
  nickname: string;
  color: string; // "bullion" | "mint" | "titanium" | "platinum" | "obsidian" | "copper" | "amber"
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
  chip: string;
}

export const COLOR_PRESETS: Record<string, ColorPreset> = {
  bullion: {
    id: "bullion",
    name: "Sovereign Bullion",
    bgLight: "bg-amber-50/70",
    bgDark: "dark:bg-vault-card",
    borderLight: "border-bullion-300",
    borderDark: "dark:border-bullion-500/40",
    activeBorderLight: "border-bullion-600",
    activeBorderDark: "dark:border-bullion-400",
    activeRing: "ring-2 ring-bullion-500/50 shadow-md shadow-bullion-500/10",
    activeBadge: "bg-bullion-500 text-vault-obsidian font-bold",
    textLight: "text-bullion-800",
    textDark: "dark:text-bullion-400",
    dot: "bg-bullion-500",
    badge: "bg-bullion-500/15 dark:bg-bullion-500/20 text-bullion-800 dark:text-bullion-300 border-bullion-500/30",
    chip: "from-amber-200 via-yellow-400 to-amber-600 border-amber-500/60",
  },
  mint: {
    id: "mint",
    name: "Alpine Mint",
    bgLight: "bg-emerald-50/70",
    bgDark: "dark:bg-emerald-950/30",
    borderLight: "border-emerald-300",
    borderDark: "dark:border-emerald-800/60",
    activeBorderLight: "border-emerald-600",
    activeBorderDark: "dark:border-ledger-credit",
    activeRing: "ring-2 ring-emerald-500/50 shadow-md shadow-emerald-500/10",
    activeBadge: "bg-emerald-600 dark:bg-ledger-credit text-white dark:text-vault-obsidian font-bold",
    textLight: "text-emerald-700",
    textDark: "dark:text-ledger-credit",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-ledger-credit border-emerald-300 dark:border-emerald-800",
    chip: "from-emerald-200 via-teal-400 to-emerald-600 border-emerald-500/60",
  },
  titanium: {
    id: "titanium",
    name: "Billet Titanium",
    bgLight: "bg-blue-50/70",
    bgDark: "dark:bg-vault-surface",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-900/60",
    activeBorderLight: "border-blue-600",
    activeBorderDark: "dark:border-blue-400",
    activeRing: "ring-2 ring-blue-500/50 shadow-md shadow-blue-500/10",
    activeBadge: "bg-blue-600 dark:bg-blue-500 text-white font-bold",
    textLight: "text-blue-700",
    textDark: "dark:text-blue-400",
    dot: "bg-blue-500",
    badge: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    chip: "from-blue-200 via-sky-400 to-blue-600 border-blue-500/60",
  },
  platinum: {
    id: "platinum",
    name: "Platinum Silver",
    bgLight: "bg-slate-100/70",
    bgDark: "dark:bg-vault-elevated",
    borderLight: "border-slate-300",
    borderDark: "dark:border-slate-600",
    activeBorderLight: "border-slate-700",
    activeBorderDark: "dark:border-slate-300",
    activeRing: "ring-2 ring-slate-400/50 shadow-md",
    activeBadge: "bg-slate-700 dark:bg-slate-200 text-white dark:text-vault-obsidian font-bold",
    textLight: "text-slate-800",
    textDark: "dark:text-slate-200",
    dot: "bg-slate-400",
    badge: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600",
    chip: "from-slate-200 via-slate-300 to-slate-400 border-slate-400/60",
  },
  obsidian: {
    id: "obsidian",
    name: "Vault Obsidian",
    bgLight: "bg-slate-100",
    bgDark: "dark:bg-vault-obsidian",
    borderLight: "border-slate-300",
    borderDark: "dark:border-vault-border",
    activeBorderLight: "border-slate-900",
    activeBorderDark: "dark:border-vault-highlight",
    activeRing: "ring-2 ring-slate-900/40 dark:ring-white/20 shadow-md",
    activeBadge: "bg-slate-900 dark:bg-vault-elevated text-white font-bold",
    textLight: "text-slate-900",
    textDark: "dark:text-slate-300",
    dot: "bg-slate-800 dark:bg-slate-400",
    badge: "bg-slate-200 dark:bg-vault-surface text-slate-800 dark:text-slate-300 border-slate-300 dark:border-vault-border",
    chip: "from-slate-700 via-slate-800 to-slate-900 border-slate-600/60",
  },
  copper: {
    id: "copper",
    name: "Rose Copper",
    bgLight: "bg-rose-50/70",
    bgDark: "dark:bg-rose-950/30",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-900/60",
    activeBorderLight: "border-rose-600",
    activeBorderDark: "dark:border-rose-400",
    activeRing: "ring-2 ring-rose-500/50 shadow-md shadow-rose-500/10",
    activeBadge: "bg-rose-600 dark:bg-rose-500 text-white font-bold",
    textLight: "text-rose-700",
    textDark: "dark:text-rose-400",
    dot: "bg-rose-500",
    badge: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    chip: "from-rose-200 via-orange-300 to-rose-500 border-rose-400/60",
  },
  amber: {
    id: "amber",
    name: "Reserve Amber",
    bgLight: "bg-amber-50/70",
    bgDark: "dark:bg-amber-950/30",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-900/60",
    activeBorderLight: "border-amber-600",
    activeBorderDark: "dark:border-amber-400",
    activeRing: "ring-2 ring-amber-500/50 shadow-md shadow-amber-500/10",
    activeBadge: "bg-amber-600 dark:bg-amber-500 text-white font-bold",
    textLight: "text-amber-700",
    textDark: "dark:text-amber-400",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    chip: "from-amber-200 via-amber-400 to-amber-600 border-amber-500/60",
  },
};

const LEGACY_COLOR_MAP: Record<string, string> = {
  slate: "obsidian",
  emerald: "mint",
  blue: "titanium",
  cyan: "titanium",
  violet: "titanium",
  rose: "copper",
  amber: "amber",
};

export function getAccountMeta(accountId: number): AccountMetadata {
  if (typeof window === "undefined") {
    return { nickname: "", color: "bullion" };
  }
  try {
    const raw = localStorage.getItem(`bank-core-account-meta-${accountId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      let rawColor = parsed.color || "bullion";
      if (LEGACY_COLOR_MAP[rawColor]) {
        rawColor = LEGACY_COLOR_MAP[rawColor];
      }
      return {
        nickname: parsed.nickname || "",
        color: COLOR_PRESETS[rawColor] ? rawColor : "bullion",
      };
    }
  } catch {}
  return { nickname: "", color: "bullion" };
}

export function setAccountMeta(accountId: number, meta: AccountMetadata): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`bank-core-account-meta-${accountId}`, JSON.stringify(meta));
    window.dispatchEvent(new Event("bank-core-account-meta-changed"));
  } catch {}
}
