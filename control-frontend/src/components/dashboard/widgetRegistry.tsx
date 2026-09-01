import DemographicCard from "../ecommerce/DemographicCard";
import { MapControls, MapLegend, MapViewProvider } from "../maps/RestaurantMap";
import RobotStatus, {
  RobotStatusFilterProvider,
  RobotStatusHeaderActions,
} from "../ecommerce/RobotStatus";
import Orders, {
  OrdersProvider,
  OrdersHeaderActions,
} from "../ecommerce/Orders";
import type { DashboardWidgetDefinition, WidgetId } from "./types";

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: "robot-map",
    title: "Robot Operational Map",
    description: "Robot operational status in the restaurant",
    render: () => <DemographicCard framed={false} />,
    renderHeaderDetail: () => <MapLegend />,
    renderHeaderActions: () => <MapControls />,
    wrap: (children) => <MapViewProvider>{children}</MapViewProvider>,
    bleed: true,
  },
  {
    id: "robot-list",
    title: "Robot Fleet",
    description: "Live robot fleet status",
    render: () => <RobotStatus framed={false} />,
    renderHeaderActions: () => <RobotStatusHeaderActions />,
    wrap: (children) => (
      <RobotStatusFilterProvider>{children}</RobotStatusFilterProvider>
    ),
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
    renderHeaderActions: () => <OrdersHeaderActions />,
    wrap: (children) => (
      <OrdersProvider>{children}</OrdersProvider>
    ),
  },
];

export const WIDGET_BY_ID = new Map<WidgetId, DashboardWidgetDefinition>(
  DASHBOARD_WIDGETS.map((widget) => [widget.id, widget]),
);
