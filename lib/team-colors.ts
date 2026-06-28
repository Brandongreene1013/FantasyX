export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

const TEAM_COLORS: Record<string, TeamColors> = {
  KC:  { primary: "#E31837", secondary: "#FFB81C", text: "#ffffff" },
  LAC: { primary: "#0080C6", secondary: "#FFC20E", text: "#ffffff" },
  LV:  { primary: "#A5ACAF", secondary: "#000000", text: "#000000" },
  DEN: { primary: "#FB4F14", secondary: "#002244", text: "#ffffff" },
  BUF: { primary: "#00338D", secondary: "#C60C30", text: "#ffffff" },
  MIA: { primary: "#008E97", secondary: "#FC4C02", text: "#ffffff" },
  NE:  { primary: "#002244", secondary: "#C60C30", text: "#ffffff" },
  NYJ: { primary: "#125740", secondary: "#000000", text: "#ffffff" },
  BAL: { primary: "#241773", secondary: "#9E7C0C", text: "#ffffff" },
  CLE: { primary: "#FF3C00", secondary: "#311D00", text: "#ffffff" },
  CIN: { primary: "#FB4F14", secondary: "#000000", text: "#ffffff" },
  PIT: { primary: "#FFB612", secondary: "#101820", text: "#101820" },
  HOU: { primary: "#03202F", secondary: "#A71930", text: "#ffffff" },
  IND: { primary: "#002C5F", secondary: "#A2AAAD", text: "#ffffff" },
  JAX: { primary: "#006778", secondary: "#9F792C", text: "#ffffff" },
  TEN: { primary: "#0C2340", secondary: "#4B92DB", text: "#ffffff" },
  PHI: { primary: "#004C54", secondary: "#A5ACAF", text: "#ffffff" },
  DAL: { primary: "#003594", secondary: "#869397", text: "#ffffff" },
  NYG: { primary: "#0B2265", secondary: "#A71930", text: "#ffffff" },
  WAS: { primary: "#5A1414", secondary: "#FFB612", text: "#ffffff" },
  ATL: { primary: "#A71930", secondary: "#000000", text: "#ffffff" },
  CAR: { primary: "#0085CA", secondary: "#101820", text: "#ffffff" },
  NO:  { primary: "#D3BC8D", secondary: "#101820", text: "#101820" },
  TB:  { primary: "#D50A0A", secondary: "#FF7900", text: "#ffffff" },
  CHI: { primary: "#0B162A", secondary: "#C83803", text: "#ffffff" },
  DET: { primary: "#0076B6", secondary: "#B0B7BC", text: "#ffffff" },
  GB:  { primary: "#203731", secondary: "#FFB612", text: "#ffffff" },
  MIN: { primary: "#4F2683", secondary: "#FFC62F", text: "#ffffff" },
  ARI: { primary: "#97233F", secondary: "#000000", text: "#ffffff" },
  LAR: { primary: "#003594", secondary: "#FFA300", text: "#ffffff" },
  SEA: { primary: "#002244", secondary: "#69BE28", text: "#ffffff" },
  SF:  { primary: "#AA0000", secondary: "#B3995D", text: "#ffffff" },
  FA:  { primary: "#334155", secondary: "#64748B", text: "#ffffff" }
};

export function getTeamColors(team: string): TeamColors {
  return TEAM_COLORS[team] ?? TEAM_COLORS["FA"]!;
}

export const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  QB: { bg: "rgba(245, 158, 11, 0.15)", text: "#F59E0B", border: "rgba(245, 158, 11, 0.3)" },
  RB: { bg: "rgba(16, 185, 129, 0.15)", text: "#10B981", border: "rgba(16, 185, 129, 0.3)" },
  WR: { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  TE: { bg: "rgba(139, 92, 246, 0.15)", text: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" }
};

export function getPositionColor(position: string) {
  return POSITION_COLORS[position] ?? POSITION_COLORS["WR"]!;
}

export const ALL_TEAMS = Object.keys(TEAM_COLORS).filter((t) => t !== "FA").sort();
