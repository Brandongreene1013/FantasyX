import type { PlayerPosition, ThresholdType } from "@prisma/client";

export type MarketTemplate = {
  id: string;
  name: string;
  position: PlayerPosition;
  thresholdType: ThresholdType;
  description: string;
};

export const MARKET_TEMPLATES: MarketTemplate[] = [
  { id: "qb_top3",  name: "QB Top 3 Finish",  position: "QB", thresholdType: "TOP_3",  description: "QB finishes in the top 3 at their positional rank (half-PPR)" },
  { id: "qb_top5",  name: "QB Top 5 Finish",  position: "QB", thresholdType: "TOP_5",  description: "QB finishes in the top 5 at their positional rank (half-PPR)" },
  { id: "rb_top5",  name: "RB Top 5 Finish",  position: "RB", thresholdType: "TOP_5",  description: "RB finishes in the top 5 at their positional rank (half-PPR)" },
  { id: "rb_top10", name: "RB Top 10 Finish", position: "RB", thresholdType: "TOP_10", description: "RB finishes in the top 10 at their positional rank (half-PPR)" },
  { id: "wr_top5",  name: "WR Top 5 Finish",  position: "WR", thresholdType: "TOP_5",  description: "WR finishes in the top 5 at their positional rank (half-PPR)" },
  { id: "wr_top10", name: "WR Top 10 Finish", position: "WR", thresholdType: "TOP_10", description: "WR finishes in the top 10 at their positional rank (half-PPR)" },
  { id: "te_top3",  name: "TE Top 3 Finish",  position: "TE", thresholdType: "TOP_3",  description: "TE finishes in the top 3 at their positional rank (half-PPR)" },
  { id: "te_top5",  name: "TE Top 5 Finish",  position: "TE", thresholdType: "TOP_5",  description: "TE finishes in the top 5 at their positional rank (half-PPR)" },
];

export function getTemplatesForPosition(position: PlayerPosition): MarketTemplate[] {
  return MARKET_TEMPLATES.filter((t) => t.position === position);
}

export function getAllTemplates(): MarketTemplate[] {
  return MARKET_TEMPLATES;
}

export function getTemplate(templateId: string): MarketTemplate | undefined {
  return MARKET_TEMPLATES.find((t) => t.id === templateId);
}
