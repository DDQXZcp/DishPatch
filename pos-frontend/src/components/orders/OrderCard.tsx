import React from "react";
import { FaCheckDouble, FaCircle } from "react-icons/fa";
import { formatDateAndTime } from "../../utils";
import { Order } from "../../types/order";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderStatus } from "../../https"; // ✅ API call
import { useSnackbar } from "notistack";

interface OrderCardProps {
  order: Order;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // ✅ mutation for updating order status
  const mutation = useMutation({
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: string }) =>
      updateOrderStatus({ orderId, orderStatus }),
    onSuccess: () => {
      enqueueSnackbar("Order updated successfully", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to update order", { variant: "error" });
    },
  });

  const handleUpdate = (status: string) => {
    mutation.mutate({ orderId: order.orderId, orderStatus: status });
  };

  return (
    <div className="w-[360px] bg-[#262626] p-4 rounded-lg mb-4">
      {/* Top section */}
      <div className="flex items-start justify-between">
        {/* Left: Info */}
        <div className="flex flex-col items-start gap-1">
          <p className="text-[#ababab] text-sm">#{order.displayId} / Dine in</p>
          <p className="text-[#ababab] text-sm">
            Table {typeof order.table === "string" ? order.table : order.table?.tableNo}
          </p>
        </div>

        {/* Right: status + cancel button */}
        <div className="flex items-center gap-2">
          {order.orderStatus === "Served" && (
            <p className="text-green-600 bg-[#2e4a40] px-2 py-1 rounded-lg text-sm">
              <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
            </p>
          )}

          {order.orderStatus === "Preparing" && (
            <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg text-sm">
              <FaCircle className="inline mr-2" /> {order.orderStatus}
            </p>
          )}

          {order.orderStatus === "Paid" && (
            <p className="text-blue-400 bg-[#1e3a8a] px-2 py-1 rounded-lg text-sm">
              💳 {order.orderStatus}
            </p>
          )}

          {order.orderStatus === "Cancelled" && (
            <p className="text-red-500 bg-[#4a1e1e] px-2 py-1 rounded-lg text-sm">
              ✕ {order.orderStatus}
            </p>
          )}

          {order.orderStatus !== "Served" && order.orderStatus !== "Cancelled" && (
            <button
              onClick={() => handleUpdate("Cancelled")}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Date + Items count */}
      <div className="flex justify-between items-center mt-2 text-[#ababab]">
        <p>{formatDateAndTime(order.orderDate)}</p>
        <p className="text-yellow-400">
          {order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} Items
        </p>
      </div>

      <hr className="w-full mt-4 border-t-1 border-gray-500" />

      {/* Items list */}
      <div className="mt-3 text-gray-300 text-sm">
        <ul className="list-disc list-inside">
          {order.items?.map((item, idx) => (
            <li key={idx}>
              {item.name} x {item.quantity}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom button */}
      {order.orderStatus === "Preparing" && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleUpdate("Served")}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg"
          >
            Served
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderCard;