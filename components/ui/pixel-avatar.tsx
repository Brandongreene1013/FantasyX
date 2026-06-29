"use client";

/**
 * PixelPlayerAvatar — 8-bit stylized football player avatars.
 *
 * All characters are original pixel art. No official NFL logos or
 * licensed player likenesses are used. Variations are deterministic
 * based on playerId so each player always renders consistently.
 *
 * Stance presets by position:
 *  QB  → throwing (arm raised)
 *  RB  → running (forward lean, high knees)
 *  WR  → catching (arms up)
 *  TE  → set position (arms slightly out)
 */

import { getTeamColors } from "@/lib/team-colors";

export type PixelAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<PixelAvatarSize, number> = {
  xs: 24, sm: 32, md: 48, lg: 64, xl: 96
};

/** Deterministic hash from playerId string (0–255) */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h) % 256;
}

/** Pick from an array deterministically based on playerId */
function pick<T>(arr: T[], id: string, salt: number): T {
  const i = (hashId(id) + salt) % arr.length;
  return arr[i]!;
}

/** Lighten a hex color */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

/** Skin tone palette (generic, no specific ethnicity identification) */
const SKIN_TONES = ["#C68642", "#D4956A", "#E8B98C", "#A0522D", "#8B4513"];
/** Hair colors */
const HAIR_COLORS = ["#1a1a1a", "#4a3728", "#8B6914", "#2C2C2C", "#6B3A1F"];

// ── SVG path templates (16×16 pixel grid) ─────────────────────────────────
// Each position has a unique stance. Coordinates are in the 16×16 grid.

function renderQB(colors: { primary: string; secondary: string; skin: string; hair: string; accent: string }) {
  return (
    <>
      {/* Helmet */}
      <rect x="5" y="1" width="6" height="5" rx="1" fill={colors.primary} />
      <rect x="5" y="2" width="6" height="2" fill={lighten(colors.primary, 30)} opacity="0.5" />
      {/* Facemask */}
      <rect x="4" y="4" width="1" height="3" fill={colors.secondary} />
      <rect x="4" y="4" width="4" height="1" fill={colors.secondary} />
      {/* Head/neck */}
      <rect x="6" y="6" width="4" height="2" fill={colors.skin} />
      {/* Jersey body */}
      <rect x="4" y="8" width="8" height="5" fill={colors.primary} />
      {/* Number stripe */}
      <rect x="5" y="9" width="6" height="1" fill={colors.secondary} />
      {/* Throwing arm (raised) */}
      <rect x="10" y="6" width="2" height="1" fill={colors.skin} />
      <rect x="11" y="4" width="2" height="3" fill={colors.primary} />
      <rect x="12" y="3" width="2" height="2" fill={colors.skin} />
      {/* Ball */}
      <rect x="13" y="3" width="2" height="1" fill="#8B4513" />
      <rect x="14" y="2" width="1" height="1" fill="#D2691E" />
      {/* Off arm */}
      <rect x="2" y="8" width="3" height="1" fill={colors.primary} />
      {/* Pants */}
      <rect x="5" y="13" width="3" height="2" fill={colors.secondary} />
      <rect x="8" y="13" width="3" height="2" fill={colors.secondary} />
      {/* Shoes */}
      <rect x="4" y="15" width="3" height="1" fill="#111" />
      <rect x="8" y="15" width="3" height="1" fill="#111" />
    </>
  );
}

function renderRB(colors: { primary: string; secondary: string; skin: string; hair: string; accent: string }) {
  return (
    <>
      {/* Helmet (forward lean) */}
      <rect x="5" y="0" width="6" height="5" rx="1" fill={colors.primary} />
      <rect x="5" y="1" width="6" height="1" fill={lighten(colors.primary, 30)} opacity="0.5" />
      {/* Facemask */}
      <rect x="4" y="3" width="1" height="3" fill={colors.secondary} />
      <rect x="4" y="3" width="3" height="1" fill={colors.secondary} />
      {/* Head */}
      <rect x="6" y="5" width="4" height="2" fill={colors.skin} />
      {/* Jersey (forward lean) */}
      <rect x="4" y="7" width="8" height="5" fill={colors.primary} />
      {/* Number */}
      <rect x="5" y="8" width="6" height="1" fill={colors.secondary} />
      {/* High knee — right leg */}
      <rect x="9" y="12" width="3" height="2" fill={colors.secondary} />
      <rect x="10" y="10" width="2" height="3" fill={colors.secondary} />
      {/* Left leg (trailing) */}
      <rect x="4" y="12" width="3" height="3" fill={colors.secondary} />
      {/* Ball tucked */}
      <rect x="10" y="7" width="3" height="2" fill="#8B4513" />
      <rect x="11" y="6" width="2" height="2" fill={colors.skin} />
      {/* Off arm pump */}
      <rect x="1" y="8" width="4" height="1" fill={colors.primary} />
      <rect x="1" y="7" width="2" height="2" fill={colors.skin} />
      {/* Shoes */}
      <rect x="3" y="15" width="3" height="1" fill="#111" />
      <rect x="9" y="14" width="3" height="1" fill="#111" />
    </>
  );
}

function renderWR(colors: { primary: string; secondary: string; skin: string; hair: string; accent: string }) {
  return (
    <>
      {/* Helmet */}
      <rect x="5" y="1" width="6" height="5" rx="1" fill={colors.primary} />
      <rect x="5" y="2" width="6" height="1" fill={lighten(colors.primary, 30)} opacity="0.5" />
      {/* Facemask */}
      <rect x="10" y="4" width="1" height="3" fill={colors.secondary} />
      <rect x="8" y="4" width="3" height="1" fill={colors.secondary} />
      {/* Head */}
      <rect x="6" y="6" width="4" height="2" fill={colors.skin} />
      {/* Jersey */}
      <rect x="4" y="8" width="8" height="5" fill={colors.primary} />
      {/* Number */}
      <rect x="5" y="9" width="6" height="1" fill={colors.secondary} />
      {/* Arms up (catching) */}
      <rect x="1" y="5" width="4" height="1" fill={colors.primary} />
      <rect x="1" y="4" width="2" height="2" fill={colors.skin} />
      <rect x="11" y="5" width="4" height="1" fill={colors.primary} />
      <rect x="13" y="4" width="2" height="2" fill={colors.skin} />
      {/* Gloves */}
      <rect x="0" y="3" width="2" height="2" fill={colors.accent} />
      <rect x="14" y="3" width="2" height="2" fill={colors.accent} />
      {/* Pants */}
      <rect x="5" y="13" width="3" height="2" fill={colors.secondary} />
      <rect x="8" y="13" width="3" height="2" fill={colors.secondary} />
      {/* Shoes */}
      <rect x="4" y="15" width="3" height="1" fill="#111" />
      <rect x="8" y="15" width="3" height="1" fill="#111" />
    </>
  );
}

function renderTE(colors: { primary: string; secondary: string; skin: string; hair: string; accent: string }) {
  return (
    <>
      {/* Helmet */}
      <rect x="5" y="1" width="6" height="5" rx="1" fill={colors.primary} />
      <rect x="5" y="2" width="6" height="2" fill={lighten(colors.primary, 30)} opacity="0.5" />
      {/* Facemask */}
      <rect x="4" y="4" width="1" height="2" fill={colors.secondary} />
      <rect x="4" y="5" width="3" height="1" fill={colors.secondary} />
      {/* Head */}
      <rect x="6" y="6" width="4" height="2" fill={colors.skin} />
      {/* Wider body (TE bulk) */}
      <rect x="3" y="8" width="10" height="5" fill={colors.primary} />
      {/* Number */}
      <rect x="5" y="9" width="6" height="1" fill={colors.secondary} />
      {/* Shoulder pads visible */}
      <rect x="2" y="8" width="2" height="2" fill={lighten(colors.primary, 20)} />
      <rect x="12" y="8" width="2" height="2" fill={lighten(colors.primary, 20)} />
      {/* Arms slightly out (set position) */}
      <rect x="0" y="9" width="3" height="1" fill={colors.primary} />
      <rect x="13" y="9" width="3" height="1" fill={colors.primary} />
      <rect x="0" y="8" width="2" height="2" fill={colors.skin} />
      <rect x="14" y="8" width="2" height="2" fill={colors.skin} />
      {/* Pants */}
      <rect x="4" y="13" width="3" height="2" fill={colors.secondary} />
      <rect x="9" y="13" width="3" height="2" fill={colors.secondary} />
      {/* Shoes */}
      <rect x="3" y="15" width="4" height="1" fill="#111" />
      <rect x="9" y="15" width="4" height="1" fill="#111" />
    </>
  );
}

const RENDERERS = { QB: renderQB, RB: renderRB, WR: renderWR, TE: renderTE };

export function PixelPlayerAvatar({
  playerId,
  playerName,
  team,
  position,
  size = "md",
  className = ""
}: {
  playerId: string;
  playerName: string;
  team: string;
  position: "QB" | "RB" | "WR" | "TE";
  size?: PixelAvatarSize;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const { primary, secondary } = getTeamColors(team);
  const skin  = pick(SKIN_TONES, playerId, 0);
  const hair  = pick(HAIR_COLORS, playerId, 3);
  // Use a contrasting accent (gloves, shoes, stripe)
  const accent = secondary || lighten(primary, 40);

  const colors = { primary, secondary: secondary || "#ffffff", skin, hair, accent };
  const render = RENDERERS[position] ?? renderWR;

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-sm ${className}`}
      style={{ width: px, height: px, background: "rgba(13,17,23,0.8)", border: `1px solid ${primary}40` }}
      aria-label={`${playerName} pixel avatar`}
      role="img"
    >
      <svg
        viewBox="0 0 16 16"
        width={px - 4}
        height={px - 4}
        style={{ imageRendering: "pixelated" }}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {render(colors)}
      </svg>
    </div>
  );
}
