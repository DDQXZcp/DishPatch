import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRobotContext } from "../../context/RobotWebSocketProvider";
import type { Order, OrdersApiResponse } from "../../types/Order";
import type { Robot } from "../../types/Robot";

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "info" | "success" | "error";
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

const severityStyles: Record<AlertItem["severity"], string> = {
  warning: "bg-amber-100 text-amber-700",
  info: "bg-sky-100 text-sky-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

const STUCK_ROBOT_THRESHOLD_MS = 20 * 1000;

function isStuckCandidate(robot: Robot) {
  return robot.speed === 0 && (robot.status === "Serving" || robot.status === "Returning");
}

function getTableLabel(order: Order) {
  return order.tableNo ?? "unknown table";
}

function buildAlerts(
  robots: Robot[],
  orders: Order[],
  stuckSinceByRobotId: Record<number, number>,
  now: number
): AlertItem[] {
  const alerts: AlertItem[] = [];

  const overdueOrders = orders.filter((order) => {
    const statusValue = order.orderStatus.toLowerCase();

    if (statusValue !== "preparing") {
      return false;
    }

    const createdTime = Date.parse(order.orderDate);
    
    return !Number.isNaN(createdTime) && now - createdTime > 15 * 60 * 1000;
  });

  overdueOrders.forEach((order) => {
    alerts.push({
      id: `overdue-${order.orderId}`,
      title: "Order delayed",
      detail: `Order ${order.displayId} has been preparing at table ${getTableLabel(order)} for over 15 minutes.`,
      severity: "warning",
    });
  });

  const recentOrders = orders.filter((order) => {
    const createdTime = Date.parse(order.orderDate);
    return !Number.isNaN(createdTime) && now - createdTime <= 5 * 60 * 1000;
  });
  if (recentOrders.length > 0) {
    alerts.push({
      id: "recent-orders",
      title: "New orders received",
      detail: `${recentOrders.length} order${recentOrders.length > 1 ? "s" : ""} arrived in the last 5 minutes.`,
      severity: "info",
    });
  }

  const stuckRobots = robots.filter((robot) => {
    if (!isStuckCandidate(robot)) {
      return false;
    }

    const stuckSince = stuckSinceByRobotId[robot.id];
    return typeof stuckSince === "number" && now - stuckSince > STUCK_ROBOT_THRESHOLD_MS;
  });
  if (stuckRobots.length > 0) {
    alerts.push({
      id: "stuck-robots",
      title: "Robot stuck",
      detail: `${stuckRobots.map((robot) => robot.name).join(", ")} appear stalled and need staff attention.`,
      severity: "error",
    });
  }

  const lowBatteryRobots = robots.filter((robot) => robot.battery <= 20);
  if (lowBatteryRobots.length > 0) {
    alerts.push({
      id: "low-battery",
      title: "Battery low",
      detail: `${lowBatteryRobots.map((robot) => robot.name).join(", ")} have low battery and may need charging.`,
      severity: "warning",
    });
  }

  return alerts;
}

interface AlertsContextValue {
  isLoading: boolean;
  error: string | null;
  alerts: AlertItem[];
  visibleAlerts: AlertItem[];
  actionableAlertCount: number;
  dismissAlert: (id: string) => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

function useAlerts() {
  const context = useContext(AlertsContext);

  if (!context) {
    throw new Error("useAlerts must be used within an AlertsProvider");
  }

  return context;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { robots } = useRobotContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [stuckSinceByRobotId, setStuckSinceByRobotId] = useState<Record<number, number>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const now = Date.now();

    setStuckSinceByRobotId((prev) => {
      const next: Record<number, number> = {};

      robots.forEach((robot) => {
        if (isStuckCandidate(robot)) {
          next[robot.id] = prev[robot.id] ?? now;
        }
      });

      return next;
    });
  }, [robots]);

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/orders`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load orders: HTTP ${response.status}`);
        }

        const result = (await response.json()) as OrdersApiResponse;

        if (!result.success) {
          throw new Error(result.message || "Unable to load orders");
        }

        if (!Array.isArray(result.data)) {
          throw new Error("The orders API returned an invalid response");
        }

        if (isMounted) {
          setOrders(result.data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load alerts");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadOrders();
    const intervalId = window.setInterval(() => {
      void loadOrders();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const alerts = useMemo(
    () => buildAlerts(robots, orders, stuckSinceByRobotId, currentTime),
    [robots, orders, stuckSinceByRobotId, currentTime]
  );

  const actionableAlertCount = useMemo(
    () => alerts.filter((alert) => alert.severity === "warning" || alert.severity === "error").length,
    [alerts]
  );

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissedIds.includes(a.id)),
    [alerts, dismissedIds]
  );

  function dismissAlert(id: string) {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <AlertsContext.Provider
      value={{
        isLoading,
        error,
        alerts,
        visibleAlerts,
        actionableAlertCount,
        dismissAlert,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function AlertsHeaderActions() {
  const { actionableAlertCount } = useAlerts();

  return (
    <span
      className={
        `rounded-full px-2.5 py-1 text-xs font-medium ` +
        (actionableAlertCount === 0
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700")
      }
    >
      {actionableAlertCount} ALERTS
    </span>
  );
}

export default function AlertsNotificationsWidget() {
  const { isLoading, error, alerts, visibleAlerts, dismissAlert } =
    useAlerts();

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-auto">
        {isLoading && alerts.length === 0 && (
          <p className="text-sm text-gray-500">Loading alerts…</p>
        )}

        {!isLoading && error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!isLoading && !error && alerts.length === 0 && (
          <p className="text-sm text-gray-500">No active alerts right now.</p>
        )}

        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {alert.title}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {alert.detail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium capitalize ${severityStyles[alert.severity]}`}
                >
                  {alert.severity}
                </span>

                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  aria-label="Dismiss alert"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
