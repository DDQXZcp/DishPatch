import DemographicCard from "../ecommerce/DemographicCard";
import RobotStatus from "../ecommerce/RobotStatus";
import Orders from "../ecommerce/Orders";
import AlertsNotificationsWidget from "./AlertsNotificationsWidget";
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
    render: () => <RobotStatus framed={false} />,
  },
  {
    id: "pos-orders",
    title: "POS Order Status",
    description: "Placeholder for POS order flow",
    render: () => (
      // <PlaceholderWidget
      //   label="Order status widget"
      //   description="Future POS order data can land here while keeping the dashboard layout stable."
      // />
      <Orders framed={false} />
    ),
  },
  {
    id: "alerts-notifications",
    title: "Alerts / Notifications",
    description: "Operational alerts and service notifications",
    render: () => <AlertsNotificationsWidget />, 
  },
];

export const WIDGET_BY_ID = new Map<WidgetId, DashboardWidgetDefinition>(
  DASHBOARD_WIDGETS.map((widget) => [widget.id, widget]),
);
