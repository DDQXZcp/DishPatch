import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FiRefreshCw } from "react-icons/fi";

import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import { getOrders } from "../https";
import useVerticalDragScroll from "../hooks/useVerticalDragScroll";

import type { Order } from "../types/order";

type OrderFilter =
  | "all"
  | "Preparing"
  | "Completed"
  | "Cancelled";

const Orders = () => {
  const [status, setStatus] =
    useState<OrderFilter>("all");

  const dragScrollRef = useVerticalDragScroll();

  useEffect(() => {
    document.title = "POS | Order History";
  }, []);

  const {
    data: resData,
    isError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,

    // No polling
    refetchInterval: false,
  });

  useEffect(() => {
    if (!isError) return;

    enqueueSnackbar("Unable to load your orders.", {
      variant: "error",
    });
  }, [isError]);

  const orders: Order[] =
    resData?.data?.data ?? [];

  const statuses: OrderFilter[] = [
    "all",
    "Preparing",
    "Completed",
    "Cancelled",
  ];

  const filteredOrders = useMemo(() => {
    return [...orders]
      .filter(
        (order) =>
          status === "all" ||
          order.orderStatus === status
      )
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() -
          new Date(a.orderDate).getTime()
      );
  }, [orders, status]);

  const handleRefresh = async (): Promise<void> => {
    const result = await refetch();

    if (result.isError) {
      enqueueSnackbar(
        "Unable to refresh your orders.",
        {
          variant: "error",
        }
      );

      return;
    }

    enqueueSnackbar("Orders refreshed.", {
      variant: "success",
    });
  };

  return (
    <section className="h-[calc(100dvh-5rem)] overflow-hidden bg-background font-sans">
      <div className="flex h-[calc(100%-5rem)] min-h-0 flex-col px-4 py-4 lg:px-6">
        {/* Header */}
        <div className="shrink-0">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Order History
              </h1>

              <p className="mt-1 text-sm text-text-secondary">
                View the progress and details of your
                orders.
              </p>
            </div>

            <div className="flex items-center gap-3">
              

              {/* Refresh button */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                aria-label="Refresh orders"
                title="Refresh orders"
                className="
                  mb-2 flex h-10 shrink-0 items-center
                  gap-2 rounded-xl border border-border
                  bg-surface px-3
                  text-sm font-semibold text-text-secondary
                  transition
                  hover:border-primary
                  hover:bg-primary-light/40
                  hover:text-primary
                  focus:outline-none
                  focus:ring-4 focus:ring-primary/10
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <FiRefreshCw
                  size={17}
                  className={
                    isFetching ? "animate-spin" : ""
                  }
                />

                <span className="hidden sm:inline">
                  {isFetching
                    ? "Refreshing..."
                    : "Refresh"}
                </span>
              </button>
              
              {/* Status filters */}
              <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-2 scrollbar-hide lg:flex-none">
                {statuses.map((item) => {
                  const active = status === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStatus(item)}
                      className={`
                        shrink-0 whitespace-nowrap
                        rounded-xl border px-4 py-2
                        text-sm font-semibold
                        transition duration-200
                        ${
                          active
                            ? "border-primary bg-primary-light text-primary"
                            : "border-border bg-surface text-text-secondary hover:border-primary hover:bg-primary-light/40"
                        }
                      `}
                    >
                      {item === "all" ? "All" : item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Orders list */}
        <div
          ref={dragScrollRef}
          className="
            mt-6 min-h-0 flex-1
            cursor-grab overflow-y-auto
            overscroll-contain select-none
            scrollbar-hide active:cursor-grabbing
          "
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-surface">
              <p className="text-sm text-text-secondary">
                Loading orders...
              </p>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div
              className="
                grid gap-5
                sm:grid-cols-2
                xl:grid-cols-3
                2xl:grid-cols-4
              "
            >
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 text-center">
              <p className="text-sm font-medium text-text-primary">
                No orders found
              </p>

              <p className="mt-1 text-xs text-text-secondary">
                {status === "all"
                  ? "There are no orders to display."
                  : `There are no ${status.toLowerCase()} orders to display.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;