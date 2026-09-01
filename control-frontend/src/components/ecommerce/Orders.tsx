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
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useRobotContext } from "../../context/RobotWebSocketProvider";
import {
  useDashboardHighlight,
  useDashboardSelection,
} from "../../context/DashboardSelectionContext";
import { formatOrderItemLine } from "../../utils/orderTable";

import type {
  Order,
  OrdersApiResponse,
  OrderStatus,
} from "../../types/Order";

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

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:8080";

const ALL_STATUSES: OrderStatus[] = [
  "Preparing",
  "Completed",
  "Cancelled",
];

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
  isRefreshing: boolean;
  loadError: string | null;
  actionError: string | null;
  cancellingOrderId: string | null;
  activeFilters: Set<OrderStatus>;
  toggleFilter: (status: OrderStatus) => void;
  clearFilters: () => void;
  refresh: () => void;
  cancelOrder: (order: Order) => void;
}

const OrdersContext = createContext<OrdersContextValue | null>(
  null,
);

function useOrders() {
  const context = useContext(OrdersContext);

  if (!context) {
    throw new Error(
      "useOrders must be used within an OrdersProvider",
    );
  }

  return context;
}

export function OrdersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { orders: liveOrders } = useRobotContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [loadError, setLoadError] = useState<
    string | null
  >(null);

  const [actionError, setActionError] = useState<
    string | null
  >(null);

  const [cancellingOrderId, setCancellingOrderId] =
    useState<string | null>(null);

  const [activeFilters, setActiveFilters] =
    useState<Set<OrderStatus>>(new Set());

  const loadOrders = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/orders`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load orders: HTTP ${response.status}`,
          );
        }

        const result =
          (await response.json()) as OrdersApiResponse;

        if (!result.success) {
          throw new Error(
            result.message || "Unable to load orders",
          );
        }

        if (!Array.isArray(result.data)) {
          throw new Error(
            "The orders API returned an invalid response",
          );
        }

        setOrders(result.data);
        setLoadError(null);
        setActionError(null);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load orders",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  // Backend pushes the full order list on a timer; keep the table in sync.
  useEffect(() => {
    if (liveOrders !== null) {
      setOrders(liveOrders);
      setIsLoading(false);
      setLoadError(null);
    }
  }, [liveOrders]);

  const cancelOrder = async (order: Order) => {
    if (
      order.orderStatus !== "Preparing" ||
      cancellingOrderId !== null
    ) {
      return;
    }

    setCancellingOrderId(order.orderId);
    setActionError(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/orders/${encodeURIComponent(
          order.orderId,
        )}`,
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
        .catch(() => null)) as
        | UpdateOrderApiResponse
        | null;

      if (
        !response.ok ||
        !result?.success ||
        !result.data
      ) {
        throw new Error(
          result?.message ||
            `Unable to cancel order: HTTP ${response.status}`,
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
        error instanceof Error
          ? error.message
          : "Unable to cancel the order",
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  const toggleFilter = (status: OrderStatus) => {
    setActiveFilters((previousFilters) => {
      const updatedFilters = new Set(
        previousFilters,
      );

      if (updatedFilters.has(status)) {
        updatedFilters.delete(status);
      } else {
        updatedFilters.add(status);
      }

      return updatedFilters;
    });
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
  };

  const filteredOrders = useMemo(() => {
    if (activeFilters.size === 0) {
      return orders;
    }

    return orders.filter((order) =>
      activeFilters.has(order.orderStatus),
    );
  }, [orders, activeFilters]);

  const refresh = () => {
    void loadOrders();
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        filteredOrders,
        isLoading,
        isRefreshing,
        loadError,
        actionError,
        cancellingOrderId,
        activeFilters,
        toggleFilter,
        clearFilters,
        refresh,
        cancelOrder: (order) => void cancelOrder(order),
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function OrdersHeaderActions() {
  const {
    isLoading,
    isRefreshing,
    refresh,
    activeFilters,
    toggleFilter,
    clearFilters,
  } = useOrders();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div
      className="flex items-center gap-2"
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading || isRefreshing}
        aria-label={
          isRefreshing
            ? "Refreshing orders"
            : "Refresh orders"
        }
        title={
          isRefreshing
            ? "Refreshing orders"
            : "Refresh orders"
        }
        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
      >
        <RefreshIcon
          spinning={isRefreshing}
          className="h-4 w-4"
        />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setFilterOpen((open) => !open)
          }
          className={`dropdown-toggle inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-theme-xs font-medium shadow-theme-xs ${
            activeFilters.size > 0
              ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-400"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          }`}
          aria-expanded={filterOpen}
          aria-label="Filter orders by status"
        >
          <FilterIcon />

          <span>Filter</span>

          {activeFilters.size > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-xs text-white">
              {activeFilters.size}
            </span>
          )}
        </button>

        <Dropdown
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          className="w-52 p-2"
        >
          {ALL_STATUSES.map((status) => {
            const isSelected = activeFilters.has(status);

            return (
              <button
                type="button"
                key={status}
                onClick={() => toggleFilter(status)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    isSelected
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isSelected && <CheckIcon />}
                </span>

                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    STATUS_CONFIG[status].dotClassName
                  }`}
                />

                <span>{status}</span>
              </button>
            );
          })}
        </Dropdown>
      </div>

      <button
        type="button"
        onClick={clearFilters}
        disabled={activeFilters.size === 0}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-theme-xs font-medium shadow-theme-xs ${
          activeFilters.size > 0
            ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
            : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500"
        }`}
      >
        See all
      </button>
    </div>
  );
}

interface OrdersProps {
  framed?: boolean;
}

export default function Orders({
  framed = true,
}: OrdersProps) {
  const {
    orders,
    filteredOrders,
    isLoading,
    isRefreshing,
    loadError,
    actionError,
    cancellingOrderId,
    refresh,
    cancelOrder,
  } = useOrders();

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
            {orders.length}{" "}
            {orders.length === 1 ? "order" : "orders"}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          Loading orders...
        </div>
      )}

      {!isLoading && loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-theme-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>

            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <RefreshIcon
                spinning={isRefreshing}
              />

              {isRefreshing
                ? "Retrying..."
                : "Try again"}
            </button>
          </div>
        </div>
      )}

      {!isLoading &&
        !loadError &&
        actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-theme-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">
            {actionError}
          </div>
        )}

      {!isLoading &&
        !loadError &&
        filteredOrders.length === 0 && (
          <div className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            {orders.length === 0
              ? "No orders have been created yet."
              : "No orders match the selected filters."}
          </div>
        )}

      {!isLoading &&
        !loadError &&
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
                    className="min-w-[50px] py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    Action
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.map((order) => {
                  const canCancel =
                    order.orderStatus === "Preparing";

                  const isCancelling =
                    cancellingOrderId ===
                    order.orderId;

                  const isHighlighted =
                    order.orderId === highlightedOrderId;

                  return (
                    <TableRow
                      key={order.orderId}
                      ref={
                        isHighlighted
                          ? highlightedRowRef
                          : undefined
                      }
                      onClick={() =>
                        selectOrder(order.orderId)
                      }
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
                        {formatTableNumber(
                          order as OrderWithTable,
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge
                          size="sm"
                          color={
                            STATUS_CONFIG[
                              order.orderStatus
                            ].badgeColor
                          }
                        >
                          {order.orderStatus}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            // Cancelling is not a way of selecting the row.
                            event.stopPropagation();
                            void cancelOrder(order);
                          }}
                          disabled={
                            !canCancel ||
                            cancellingOrderId !== null
                          }
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
                          {isCancelling ? (
                            <LoadingIcon />
                          ) : (
                            <CancelIcon />
                          )}
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

function formatTableNumber(
  order: OrderWithTable,
): string {
  const value =
    order.tableNo ??
    (typeof order.table === "object"
      ? order.table?.tableNo
      : order.table);

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

interface RefreshIconProps {
  spinning?: boolean;
  className?: string;
}

function RefreshIcon({
  spinning = false,
  className = "h-5 w-5",
}: RefreshIconProps) {
  return (
    <svg
      className={`stroke-current ${className} ${
        spinning ? "animate-spin" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M20 4v7h-7"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      <path
        d="M6 6L18 18"
        strokeLinecap="round"
      />

      <path
        d="M18 6L6 18"
        strokeLinecap="round"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      className="h-5 w-5 stroke-current"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6H20"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M7 12H17"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M10 18H14"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}