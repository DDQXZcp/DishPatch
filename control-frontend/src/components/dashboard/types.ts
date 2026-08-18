import type { ReactNode } from "react";

export const WIDGET_IDS = [
  "robot-map",
  "robot-list",
  "pos-orders",
  "alerts-notifications",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface DashboardWidgetDefinition {
  id: WidgetId;
  title: string;
  description?: string;
  render: () => ReactNode;
  renderHeaderActions?: () => ReactNode;
  wrap?: (children: ReactNode) => ReactNode;
}
