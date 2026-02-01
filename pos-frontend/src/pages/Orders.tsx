import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrders } from "../https/index";
import { enqueueSnackbar } from "notistack";
import { Order } from "../types/order";
import useDragScroll from "../hooks/useDragScroll";

const Orders: React.FC = () => {
  const [status, setStatus] = useState("all");
  const dragScrollRef = useDragScroll();

  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await getOrders(),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  const orders: Order[] = resData?.data?.data || [];

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <div className="flex items-center justify-around gap-4">
          {["all", "Preparing", "Served", "Paid", "Cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-[#ababab] text-lg ${
                status === s && "bg-[#383838] rounded-lg px-5 py-2"
              } rounded-lg px-5 py-2 font-semibold`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div
        ref={dragScrollRef}
        className="flex flex-wrap content-start gap-x-4 gap-y-0 px-10 py-4 overflow-y-auto h-[calc(100vh-14rem)] cursor-grab scrollbar-hide items-start select-none"
      >
        {orders.length > 0 ? (
          orders
            .filter((order) => status === "all" || order.orderStatus === status)
            // ✅ sort by date ascending (earliest first)
            .sort(
              (a, b) =>
                new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
            )
            .map((order) => (
              <OrderCard key={order.orderId} order={order} />
            ))
        ) : (
          <p className="col-span-3 text-gray-500">No orders available</p>
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;