"use client";

import { getTeamColors, getPositionColor } from "@/lib/team-colors";

interface PlayerAvatarProps {
  name: string;
  team: string;
  position: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showPosition?: boolean;
  headshotUrl?: string | null;
  jerseyNumber?: number | null;
  className?: string;
}

const SIZE_MAP = {
  xs: { outer: "h-7 w-7", text: "text-xs", badge: "hidden", number: "text-[8px]" },
  sm: { outer: "h-9 w-9", text: "text-xs", badge: "text-[8px] px-1", number: "text-[9px]" },
  md: { outer: "h-11 w-11", text: "text-sm", badge: "text-[9px] px-1.5", number: "text-xs" },
  lg: { outer: "h-14 w-14", text: "text-base", badge: "text-[10px] px-1.5 py-0.5", number: "text-sm" },
  xl: { outer: "h-20 w-20", text: "text-xl", badge: "text-xs px-2 py-0.5", number: "text-base" }
};

export function PlayerAvatar({
  name,
  team,
  position,
  size = "md",
  showPosition = true,
  headshotUrl,
  jerseyNumber,
  className = ""
}: PlayerAvatarProps) {
  const teamColors = getTeamColors(team);
  const posColors = getPositionColor(position);
  const { outer, text, badge } = SIZE_MAP[size];

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${outer} rounded-full flex items-center justify-center font-black overflow-hidden`}
        style={{
          background: headshotUrl
            ? undefined
            : `linear-gradient(135deg, ${teamColors.primary} 0%, ${teamColors.secondary || teamColors.primary}99 100%)`,
          color: teamColors.text
        }}
        aria-hidden="true"
      >
        {headshotUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={headshotUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className={`${text} select-none leading-none`}>
            {jerseyNumber != null ? `#${jerseyNumber}` : initials}
          </span>
        )}
      </div>
      {showPosition && badge !== "hidden" && (
        <span
          className={`absolute -bottom-1 -right-1 rounded-full font-black leading-none ${badge}`}
          style={{
            background: posColors.bg,
            color: posColors.text,
            border: `1px solid ${posColors.border}`
          }}
        >
          {position}
        </span>
      )}
    </div>
  );
}
