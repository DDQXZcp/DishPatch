import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import WidgetMessage from "../common/WidgetMessage";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { ArrowUpIcon } from "../../icons";
import { useRobotContext } from "../../context/RobotWebSocketProvider";
import {
  useDashboardHighlight,
  useDashboardSelection,
} from "../../context/DashboardSelectionContext";
import {
  formatOrderAge,
  formatOrderItemLine,
  ORDER_OVERDUE_MS,
} from "../../utils/orderTable";

import type { Order, OrdersApiResponse, OrderStatus } from "../../types/Order";

type OrderWithTable = Order & {
  tableNo?: string | number;
  table?:
    | string
    | number
    | {
        tableNo?: string | number;
      };
};

interface UpdateOrderApiResponse {
  success: boolean;
  message: string | null;
  data: OrderWithTable | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

type TimeRange = "24h" | "7d";

const TIME_RANGE_CONFIG: Record<
  TimeRange,
  { label: string; description: string; windowMs: number }
> = {
  "24h": {
    label: "Last 24 hours",
    description: "in the last 24 hours",
    windowMs: 24 * 60 * 60 * 1000,
  },
  "7d": {
    label: "Last 7 days",
    description: "in the last 7 days",
    windowMs: 7 * 24 * 60 * 60 * 1000,
  },
};

const TIME_RANGES: TimeRange[] = ["24h", "7d"];

const POS_ORDERS_URL = "https://pos.dish-patch.com/orders";

/**
 * The age column only resolves to minutes, so this is as often as it needs to
 * be recomputed. The table already re-renders at the websocket push rate, but
 * that is incidental and stops the moment the socket drops — exactly when a
 * stale order matters most — so the clock is made explicit.
 */
const AGE_TICK_MS = 30 * 1000;

interface OrderTimeInfo {
  createdAt: number;
  /** Pre-formatted so ~1,200 toLocaleString calls stay out of the render path. */
  absoluteLabel: string;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    dotClassName: string;
    badgeColor: "warning" | "success" | "error";
  }
> = {
  Preparing: {
    dotClassName: "bg-yellow-500",
    badgeColor: "warning",
  },
  Completed: {
    dotClassName: "bg-green-500",
    badgeColor: "success",
  },
  Cancelled: {
    dotClassName: "bg-red-500",
    badgeColor: "error",
  },
};

interface OrdersContextValue {
  orders: Order[];
  filteredOrders: Order[];
  isLoading: boolean;
  actionError: string | null;
  cancellingOrderId: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  timeInfoByOrderId: Map<string, OrderTimeInfo>;
  now: number;
  cancelOrder: (order: Order) => void;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

function useOrders() {
  const context = useContext(OrdersContext);

  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }

  return context;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { orders: liveOrders } = useRobotContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [actionError, setActionError] = useState<string | null>(null);

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );

  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), AGE_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Only ever the initial load now. A failure here needs no retry affordance:
  // the websocket pushes the full order list and will overwrite this the moment
  // it delivers, and if it cannot, the connection state says so.
  const loadOrders = useCallback(async () => {
    setIsLoading(true);

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

      setOrders(result.data);
      setActionError(null);
    } catch (error) {
      console.warn("Unable to load orders", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Backend pushes the full order list on a timer; keep the table in sync.
  useEffect(() => {
    if (liveOrders !== null) {
      setOrders(liveOrders);
      setIsLoading(false);
    }
  }, [liveOrders]);

  const cancelOrder = async (order: Order) => {
    if (order.orderStatus !== "Preparing" || cancellingOrderId !== null) {
      return;
    }

    setCancellingOrderId(order.orderId);
    setActionError(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/orders/${encodeURIComponent(order.orderId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderStatus: "Cancelled",
          }),
        },
      );

      const result = (await response
        .json()
        .catch(() => null)) as UpdateOrderApiResponse | null;

      if (!response.ok || !result?.success || !result.data) {
        throw new Error(
          result?.message || `Unable to cancel order: HTTP ${response.status}`,
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.orderId === order.orderId
            ? {
                ...currentOrder,
                ...result.data,
                orderStatus: "Cancelled",
              }
            : currentOrder,
        ),
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to cancel the order",
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Parsed and formatted once per order list rather than per render: the table
  // is unvirtualised and re-renders at the push rate, so doing this inline
  // would mean thousands of date parses a second.
  const timeInfoByOrderId = useMemo(() => {
    const next = new Map<string, OrderTimeInfo>();

    orders.forEach((order) => {
      const createdAt = Date.parse(order.orderDate);

      next.set(order.orderId, {
        createdAt,
        absoluteLabel: Number.isNaN(createdAt)
          ? "Unknown time"
          : new Date(createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
      });
    });

    return next;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGE_CONFIG[timeRange].windowMs;

    return orders.filter((order) => {
      const createdAt = timeInfoByOrderId.get(order.orderId)?.createdAt;

      // An order whose date will not parse is kept rather than silently
      // dropped; its age cell renders an em dash.
      return createdAt === undefined || Number.isNaN(createdAt)
        ? true
        : createdAt >= cutoff;
    });
  }, [orders, timeRange, timeInfoByOrderId]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        filteredOrders,
        isLoading,
        actionError,
        cancellingOrderId,
        timeRange,
        setTimeRange,
        timeInfoByOrderId,
        now,
        cancelOrder: (order) => void cancelOrder(order),
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function OrdersHeaderActions() {
  const { timeRange, setTimeRange } = useOrders();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div
      className="flex items-center gap-2"
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setFilterOpen((open) => !open)}
          className="dropdown-toggle inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-xs font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          aria-expanded={filterOpen}
          aria-label="Filter orders by time range"
        >
          <FilterIcon />

          <span>Filter</span>
        </button>

        <Dropdown
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          className="w-44 p-2"
        >
          {TIME_RANGES.map((range) => {
            const isSelected = timeRange === range;

            return (
              <button
                type="button"
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setFilterOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isSelected && <CheckIcon />}
                </span>

                <span>{TIME_RANGE_CONFIG[range].label}</span>
              </button>
            );
          })}

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <a
            href={POS_ORDERS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setFilterOpen(false)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <span className="flex h-4 w-4 items-center justify-center" />

            <span>See all</span>

            <ArrowUpIcon className="ml-auto h-3.5 w-3.5 rotate-45 text-gray-400" />
          </a>
        </Dropdown>
      </div>
    </div>
  );
}

interface OrdersProps {
  framed?: boolean;
}

export default function Orders({ framed = true }: OrdersProps) {
  const {
    orders,
    filteredOrders,
    isLoading,
    actionError,
    cancellingOrderId,
    timeRange,
    timeInfoByOrderId,
    now,
    cancelOrder,
  } = useOrders();

  const { connectionState } = useRobotContext();
  const { selectOrder } = useDashboardSelection();
  const { highlightedOrderId } = useDashboardHighlight();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  // The table is unvirtualised and routinely holds four figures of orders, so
  // the partner row of a selected robot is almost always off-screen. One ref
  // attached to whichever row is lit beats an effect per row.
  useEffect(() => {
    highlightedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightedOrderId]);

  const content = (
    <>
      {framed && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Orders
          </h3>

          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "order" : "orders"}{" "}
            {TIME_RANGE_CONFIG[timeRange].description}
          </p>
        </div>
      )}

      {/* Checked before loading and before the empty state: an outage must
          never fall through to "No orders have been created yet". */}
      {connectionState === "disconnected" && (
        <WidgetMessage>Not connected</WidgetMessage>
      )}

      {connectionState !== "disconnected" && isLoading && (
        <WidgetMessage>Loading orders...</WidgetMessage>
      )}

      {!isLoading && actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-theme-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">
          {actionError}
        </div>
      )}

      {connectionState === "connected" &&
        !isLoading &&
        filteredOrders.length === 0 && (
          <WidgetMessage>
            {orders.length === 0
              ? "No orders have been created yet."
              : `No orders ${TIME_RANGE_CONFIG[timeRange].description}.`}
          </WidgetMessage>
        )}

      {connectionState !== "disconnected" &&
        !isLoading &&
        filteredOrders.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-y border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableCell
                  isHeader
                  className="min-w-[65px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Order ID
                </TableCell>

                <TableCell
                  isHeader
                  className="min-w-[190px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Items
                </TableCell>

                <TableCell
                  isHeader
                  className="min-w-[50px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Table
                </TableCell>

                <TableCell
                  isHeader
                  className="min-w-[50px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Status
                </TableCell>

                <TableCell
                  isHeader
                  className="min-w-[60px] py-3 pr-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Age
                </TableCell>

                <TableCell
                  isHeader
                  className="min-w-[50px] py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Action
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOrders.map((order) => {
                const canCancel = order.orderStatus === "Preparing";

                const isCancelling = cancellingOrderId === order.orderId;

                const isHighlighted = order.orderId === highlightedOrderId;

                const timeInfo = timeInfoByOrderId.get(order.orderId);

                // Only a Preparing order can be late. A Completed one from
                // yesterday is old, not overdue.
                const isOverdue =
                  canCancel &&
                  timeInfo !== undefined &&
                  !Number.isNaN(timeInfo.createdAt) &&
                  now - timeInfo.createdAt > ORDER_OVERDUE_MS;

                return (
                  <TableRow
                    key={order.orderId}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    onClick={() => selectOrder(order.orderId)}
                    aria-selected={isHighlighted}
                    className={`cursor-pointer transition-colors ${
                      isHighlighted
                        ? "bg-brand-50 dark:bg-brand-500/10"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        #{order.displayId}
                      </p>
                    </TableCell>

                    <TableCell className="py-3 text-theme-xs text-gray-500 dark:text-gray-400">
                      {order.items && order.items.length > 0 ? (
                        <ul className="list-disc space-y-0.5 pl-4">
                          {order.items.map((item, index) => (
                            <li key={index}>{formatOrderItemLine(item)}</li>
                          ))}
                        </ul>
                      ) : (
                        "No items"
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {formatTableNumber(order as OrderWithTable)}
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge
                        size="sm"
                        color={STATUS_CONFIG[order.orderStatus].badgeColor}
                      >
                        {order.orderStatus}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className={`py-3 pr-3 text-theme-sm tabular-nums ${
                        isOverdue
                          ? "font-medium text-orange-500 dark:text-orange-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <time
                        dateTime={order.orderDate}
                        title={timeInfo?.absoluteLabel ?? "Unknown time"}
                      >
                        {formatOrderAge(timeInfo?.createdAt ?? Number.NaN, now)}
                      </time>
                    </TableCell>

                    <TableCell className="py-3 text-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          // Cancelling is not a way of selecting the row.
                          event.stopPropagation();
                          void cancelOrder(order);
                        }}
                        disabled={!canCancel || cancellingOrderId !== null}
                        aria-label={`Cancel order ${order.displayId}`}
                        title={
                          canCancel
                            ? "Cancel order"
                            : `Order is already ${order.orderStatus.toLowerCase()}`
                        }
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                          canCancel
                            ? "border-red-300 bg-white text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
                            : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500"
                        }`}
                      >
                        {isCancelling ? <LoadingIcon /> : <CancelIcon />}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  if (!framed) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      {content}
    </div>
  );
}

function formatTableNumber(order: OrderWithTable): string {
  const value =
    order.tableNo ??
    (typeof order.table === "object" ? order.table?.tableNo : order.table);

  if (value === undefined || value === null || value === "") {
    return "—";
  }

  return String(value);
}

function LoadingIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />

      <path
        className="opacity-75"
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M6 6L18 18" strokeLinecap="round" />

      <path d="M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3 w-3 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      className="stroke-current fill-white dark:fill-gray-800"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.29004 5.90393H17.7067"
        stroke=""
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M17.7075 14.0961H2.29085"
        stroke=""
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12.0826 3.33331C13.5024 3.33331 14.6534 4.48431 14.6534 5.90414C14.6534 7.32398 13.5024 8.47498 12.0826 8.47498C10.6627 8.47498 9.51172 7.32398 9.51172 5.90415C9.51172 4.48432 10.6627 3.33331 12.0826 3.33331Z"
        fill=""
        stroke=""
        strokeWidth="1.5"
      />

      <path
        d="M7.91745 11.525C6.49762 11.525 5.34662 12.676 5.34662 14.0959C5.34661 15.5157 6.49762 16.6667 7.91745 16.6667C9.33728 16.6667 10.4883 15.5157 10.4883 14.0959C10.4883 12.676 9.33728 11.525 7.91745 11.525Z"
        fill=""
        stroke=""
        strokeWidth="1.5"
      />
    </svg>
  );
}
