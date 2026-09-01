import type { ReactNode } from "react";

export const WIDGET_IDS = [
  "robot-map",
  "robot-list",
  "pos-orders",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface DashboardWidgetDefinition {
  id: WidgetId;
  title: string;
  description?: string;
  render: () => ReactNode;
  renderHeaderActions?: () => ReactNode;
  renderHeaderDetail?: () => ReactNode;
  wrap?: (children: ReactNode) => ReactNode;
  bleed?: boolean;
}
