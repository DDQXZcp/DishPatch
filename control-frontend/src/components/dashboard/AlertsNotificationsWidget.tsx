import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRobotContext } from "../../context/RobotWebSocketProvider";
import type { Order, OrderStatus, OrdersApiResponse } from "../../types/Order";
import type { Robot } from "../../types/Robot";

const ORDER_ARRIVED_WINDOW_MS = 5 * 60 * 1000;

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "info" | "success" | "error";
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

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
  arrivedAtByOrderId: Record<string, number>,
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

  recentOrders.forEach((order) => {
    alerts.push({
      id: `recent-order-${order.orderId}`,
      title: "New order coming",
      detail: `Order ${order.displayId} just came in for table ${getTableLabel(order)}.`,
      severity: "info",
    });
  });

  const arrivedOrders = orders.filter((order) => {
    const arrivedAt = arrivedAtByOrderId[order.orderId];
    return typeof arrivedAt === "number" && now - arrivedAt <= ORDER_ARRIVED_WINDOW_MS;
  });

  arrivedOrders.forEach((order) => {
    alerts.push({
      id: `order-arrived-${order.orderId}`,
      title: "Order arrived",
      detail: `Order ${order.displayId} has arrived at table ${getTableLabel(order)}.`,
      severity: "info",
    });
  });

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
  visibleAlerts: AlertItem[];
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
  const { robots, orders: liveOrders } = useRobotContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [stuckSinceByRobotId, setStuckSinceByRobotId] = useState<Record<number, number>>({});
  const [arrivedAtByOrderId, setArrivedAtByOrderId] = useState<Record<string, number>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const previousOrderStatusById = useRef<Map<string, OrderStatus>>(new Map());
  const hasSeenOrdersOnce = useRef(false);

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
        }
      } catch (err) {
        console.warn("Unable to load orders for alerts", err);
      }
    };

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  // Backend pushes the full order list live; this keeps new/updated orders
  // showing up immediately instead of waiting on a REST poll interval.
  useEffect(() => {
    if (liveOrders !== null) {
      setOrders(liveOrders);
    }
  }, [liveOrders]);

  useEffect(() => {
    const previousStatusById = previousOrderStatusById.current;
    const now = Date.now();
    const isFirstRun = !hasSeenOrdersOnce.current;
    const newlyArrivedOrderIds: string[] = [];

    orders.forEach((order) => {
      const previousStatus = previousStatusById.get(order.orderId);
      if (!isFirstRun && order.orderStatus === "Completed" && previousStatus !== "Completed") {
        newlyArrivedOrderIds.push(order.orderId);
      }
      previousStatusById.set(order.orderId, order.orderStatus);
    });

    hasSeenOrdersOnce.current = true;

    if (newlyArrivedOrderIds.length > 0) {
      setArrivedAtByOrderId((prev) => {
        const next = { ...prev };
        newlyArrivedOrderIds.forEach((orderId) => {
          next[orderId] = now;
        });
        return next;
      });
    }
  }, [orders]);

  useEffect(() => {
    setArrivedAtByOrderId((prev) => {
      const now = Date.now();
      const next: Record<string, number> = {};
      let changed = false;

      for (const [orderId, arrivedAt] of Object.entries(prev)) {
        if (now - arrivedAt <= ORDER_ARRIVED_WINDOW_MS) {
          next[orderId] = arrivedAt;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [currentTime]);

  const alerts = useMemo(
    () => buildAlerts(robots, orders, stuckSinceByRobotId, arrivedAtByOrderId, currentTime),
    [robots, orders, stuckSinceByRobotId, arrivedAtByOrderId, currentTime]
  );

  useEffect(() => {
    const activeIds = new Set(alerts.map((alert) => alert.id));
    setDismissedIds((prev) => {
      const next = prev.filter((id) => activeIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [alerts]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissedIds.includes(a.id)),
    [alerts, dismissedIds]
  );

  function dismissAlert(id: string) {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <AlertsContext.Provider value={{ visibleAlerts, dismissAlert }}>
      {children}
    </AlertsContext.Provider>
  );
}

const snackbarStyles: Record<
  "warning" | "error" | "info",
  { bar: string; detail: string; dismissButton: string }
> = {
  warning: {
    bar: "bg-red-600 text-white",
    detail: "text-red-100",
    dismissButton: "bg-white/20 hover:bg-white/30",
  },
  error: {
    bar: "bg-red-600 text-white",
    detail: "text-red-100",
    dismissButton: "bg-white/20 hover:bg-white/30",
  },
  info: {
    bar: "bg-gray-500 text-white",
    detail: "text-gray-100",
    dismissButton: "bg-white/20 hover:bg-white/30",
  },
};

export function AlertsSnackbarStack() {
  const { visibleAlerts, dismissAlert } = useAlerts();
  const scheduledInfoIds = useRef<Set<string>>(new Set());
  const timeoutIdsRef = useRef<number[]>([]);

  const bannerAlerts = visibleAlerts.filter(
    (alert): alert is AlertItem & { severity: "warning" | "error" | "info" } =>
      alert.severity === "warning" ||
      alert.severity === "error" ||
      alert.severity === "info"
  );

  useEffect(() => {
    bannerAlerts
      .filter((alert) => alert.severity === "info")
      .forEach((alert) => {
        if (scheduledInfoIds.current.has(alert.id)) {
          return;
        }

        scheduledInfoIds.current.add(alert.id);
        timeoutIdsRef.current.push(
          window.setTimeout(() => dismissAlert(alert.id), 5000)
        );
      });
  }, [bannerAlerts, dismissAlert]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (bannerAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 z-[100000] flex -translate-x-1/2 flex-col items-center gap-2">
      {bannerAlerts.map((alert) => {
        const styles = snackbarStyles[alert.severity];

        return (
          <div
            key={alert.id}
            className={`flex w-max max-w-xs items-start gap-2 rounded-lg px-3 py-2 shadow-lg ${styles.bar}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold">{alert.title}</p>
              <p className={`truncate text-xs ${styles.detail}`}>{alert.detail}</p>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${styles.dismissButton}`}
              aria-label="Dismiss alert"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
