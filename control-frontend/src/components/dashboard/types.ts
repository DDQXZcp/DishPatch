import type { ReactNode } from "react";

export const WIDGET_IDS = [
  "robot-map",
  "robot-list",
  "pos-orders",
  "table-status",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface DashboardWidgetDefinition {
  id: WidgetId;
  title: string;
  description?: string;
  render: () => ReactNode;
}
