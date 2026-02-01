import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice, removeAllItems } from "../../redux/slices/cartSlice";
import { addOrder, updateTable } from "../../https";
import { enqueueSnackbar } from "notistack";
import { useMutation } from "@tanstack/react-query";
import { removeCustomer } from "../../redux/slices/customerSlice";
import { AUDFormatter } from "../../utils/currency";

const OrderSummary = () => {
  const dispatch = useDispatch();

  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);

  const taxRate = 10;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // ✅ Mutation to update table
  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
  });

  // ✅ Mutation to place order
  const orderMutation = useMutation({
    mutationFn: (reqData) => addOrder(reqData),
    onSuccess: (resData) => {
      const { data } = resData.data;

      // Always pass tableNo (string/number), not object
      const tableData = {
        status: "Occupied",
        orderId: data.orderId,
        tableNo: customerData.table?.tableNo || data.table, // fallback
      };
      tableUpdateMutation.mutate(tableData);

      enqueueSnackbar("Order Placed!", { variant: "success" });
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      setIsPlacingOrder(false);
    },
    onError: (error) => {
      console.error(error);
      enqueueSnackbar("Failed to place order", { variant: "error" });
      setIsPlacingOrder(false);
    },
  });

  const handlePlaceOrder = () => {
    if (!customerData?.table?.tableNo) {
      enqueueSnackbar("Please select a table!", { variant: "warning" });
      return;
    }

    const orderData = {
      customerDetails: {
        name: customerData.customerName || "",
        phone: customerData.customerPhone || "",
        guests: customerData.guests || 1,
      },
      orderStatus: "Preparing",
      bills: { total, tax, totalWithTax: totalPriceWithTax },
      items: cartData,
      // ✅ ensure only tableNo goes here
      table: customerData.table.tableNo,
    };

    setIsPlacingOrder(true);
    orderMutation.mutate(orderData);
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items ({cartData.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">{AUDFormatter.format(total)}</h1>
      </div>

      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">GST (10%)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">{AUDFormatter.format(tax)}</h1>
      </div>

      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Total (incl. GST)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {AUDFormatter.format(totalPriceWithTax)}
        </h1>
      </div>

      <div className="flex items-center gap-3 px-5 mt-4">
        <button
          onClick={handlePlaceOrder}
          disabled={isPlacingOrder || cartData.length === 0}
          className="bg-[#f6b100] px-4 py-3 w-full rounded-lg text-[#1f1f1f] font-semibold text-lg disabled:opacity-50"
        >
          {isPlacingOrder ? "Placing..." : "Place Order"}
        </button>
      </div>
    </>
  );
};

export default OrderSummary;