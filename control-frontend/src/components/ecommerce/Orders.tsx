import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import { Dropdown } from "../ui/dropdown/Dropdown";

import type { Order, OrderItem} from "../../types/Order";

export type OrderStatus = "Preparing" | "Completed" | "Cancelled";

interface OrdersProps {
  orders?: Order[];
  framed?: boolean;
  isLoading?: boolean;
}

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

/**
 * Temporary example data.
 *
 * Replace this with data returned by the backend API once the
 * DynamoDB integration is ready.
 */
export const EXAMPLE_ORDERS: Order[] = [
  {
    orderId: "1202",
    items: [
      {
        productId: "meal-1",
        name: "Chicken Burger",
        quantity: 2,
        unitPrice: 14.5,
      },
      {
        productId: "drink-1",
        name: "Iced Coffee",
        quantity: 1,
        unitPrice: 6.5,
      },
    ],
    status: "Preparing",
  },
  {
    orderId: "8301",
    items: [
      {
        productId: "meal-2",
        name: "Vegetable Wrap",
        quantity: 1,
        unitPrice: 12,
      },
    ],
    status: "Completed",
  },
  {
    orderId: "6756",
    items: [
      {
        productId: "meal-3",
        name: "Beef Rice Bowl",
        quantity: 1,
        unitPrice: 17.5,
      },
      {
        productId: "drink-2",
        name: "Sparkling Water",
        quantity: 2,
        unitPrice: 4,
      },
    ],
    status: "Cancelled",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export default function Orders({
  orders = EXAMPLE_ORDERS,
  framed = true,
  isLoading = false,
}: OrdersProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const [activeFilters, setActiveFilters] = useState<Set<OrderStatus>>(
    new Set(),
  );

  const toggleFilter = (status: OrderStatus) => {
    setActiveFilters((previousFilters) => {
      const updatedFilters = new Set(previousFilters);

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
    const matchingOrders =
      activeFilters.size === 0
        ? orders
        : orders.filter((order) => activeFilters.has(order.status));

    return matchingOrders;
  }, [orders, activeFilters]);

  const content = (
    <>
      <div
        className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center ${
          framed ? "sm:justify-between" : "sm:justify-end"
        }`}
      >
        {framed && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Orders
            </h3>

            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              className={`dropdown-toggle inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-theme-sm font-medium shadow-theme-xs ${
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
                      className={`h-2.5 w-2.5 rounded-full ${STATUS_CONFIG[status].dotClassName}`}
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
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-theme-sm font-medium shadow-theme-xs ${
              activeFilters.size > 0
                ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
                : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500"
            }`}
          >
            See all
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          Loading orders...
        </div>
      )}

      {!isLoading && filteredOrders.length === 0 && (
        <div className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          {orders.length === 0
            ? "No orders have been created yet."
            : "No orders match the selected filters."}
        </div>
      )}

      {!isLoading && filteredOrders.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-y border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableCell
                  isHeader
                  className="min-w-[150px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Order
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[100px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Items
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[110px] py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOrders.map((order) => {
                const itemCount = order.items.reduce(
                  (total, item) => total + item.quantity,
                  0,
                );

                return (
                  <TableRow
                    key={order.orderId}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  >
                    <TableCell className="py-3">
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        #{order.orderId}
                      </p>
                    </TableCell>

                    <TableCell className="py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge
                        size="sm"
                        color={STATUS_CONFIG[order.status].badgeColor}
                      >
                        {order.status}
                      </Badge>
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
      className="fill-white stroke-current dark:fill-gray-800"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.29004 5.90393H17.7067"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M17.7075 14.0961H2.29085"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12.0826 3.33331C13.5024 3.33331 14.6534 4.48431 14.6534 5.90414C14.6534 7.32398 13.5024 8.47498 12.0826 8.47498C10.6627 8.47498 9.51172 7.32398 9.51172 5.90415C9.51172 4.48432 10.6627 3.33331 12.0826 3.33331Z"
        strokeWidth="1.5"
      />

      <path
        d="M7.91745 11.525C6.49762 11.525 5.34662 12.676 5.34662 14.0959C5.34661 15.5157 6.49762 16.6667 7.91745 16.6667C9.33728 16.6667 10.4883 15.5157 10.4883 14.0959C10.4883 12.676 9.33728 11.525 7.91745 11.525Z"
        strokeWidth="1.5"
      />
    </svg>
  );
}