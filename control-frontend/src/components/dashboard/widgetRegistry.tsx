import DemographicCard from "../ecommerce/DemographicCard";
import RecentOrders from "../ecommerce/RecentOrders";
import PlaceholderWidget from "./PlaceholderWidget";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: "robot-map",
    title: "Robot Operational Map",
    description: "Robot operational status in the restaurant",
    render: () => <DemographicCard framed={false} />,
  },
  {
    id: "robot-list",
    title: "Robot",
    description: "Live robot fleet status",
    render: () => <RecentOrders framed={false} />,
  },
  {
    id: "pos-orders",
    title: "POS Order Status",
    description: "Placeholder for POS order flow",
    render: () => (
      <PlaceholderWidget
        label="Order status widget"
        description="Future POS order data can land here while keeping the dashboard layout stable."
      />
    ),
  },
  {
    id: "table-status",
    title: "Table Status",
    description: "Placeholder for table state",
    render: () => (
      <PlaceholderWidget
        label="Table status widget"
        description="Future seated, ordered, served, and cleared states can be shown here."
      />
    ),
  },
];

export const WIDGET_BY_ID = new Map<WidgetId, DashboardWidgetDefinition>(
  DASHBOARD_WIDGETS.map((widget) => [widget.id, widget]),
);
