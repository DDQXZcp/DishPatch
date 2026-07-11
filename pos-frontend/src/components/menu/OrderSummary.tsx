import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import {
  getTotalPrice,
  removeAllItems,
} from "../../redux/slices/cartSlice";
import { removeCustomer } from "../../redux/slices/customerSlice";
import { addOrder, updateTable } from "../../https";
import type { AppDispatch, RootState } from "../../redux/store";
import { AUDFormatter } from "../../utils/currency";

interface TableInfo {
  tableNo: string;
}

interface CustomerState {
  customerName: string;
  customerPhone: string;
  guests: number;
  table: TableInfo | null;
}

interface CartItem {
  uuid: string;
  name: string;
  quantity: number;
  price: number;
  pricePerQuantity?: number;
}

const OrderSummary = () => {
  const dispatch = useDispatch<AppDispatch>();

  const customerData = useSelector(
    (state: RootState) => state.customer
  ) as CustomerState;

  const cartData = useSelector(
    (state: RootState) => state.cart
  ) as CartItem[];

  const total = useSelector(getTotalPrice);

  const taxRate = 10;
  const tax = (total * taxRate) / 100;
  const totalPriceWithTax = total + tax;

  const [isPlacingOrder, setIsPlacingOrder] =
    useState<boolean>(false);

  const tableUpdateMutation = useMutation({
    mutationFn: (requestData: {
      status: string;
      orderId: string;
      tableNo: string;
    }) => updateTable(requestData),
  });

  const orderMutation = useMutation({
    mutationFn: (requestData: unknown) => addOrder(requestData),

    onSuccess: (response: any) => {
      const { data } = response.data;

      tableUpdateMutation.mutate({
        status: "Occupied",
        orderId: data.orderId,
        tableNo: customerData.table?.tableNo || data.table,
      });

      enqueueSnackbar("Order placed successfully!", {
        variant: "success",
      });

      dispatch(removeCustomer());
      dispatch(removeAllItems());

      setIsPlacingOrder(false);
    },

    onError: (error) => {
      console.error(error);

      enqueueSnackbar("Failed to place order.", {
        variant: "error",
      });

      setIsPlacingOrder(false);
    },
  });

  const handlePlaceOrder = (): void => {
    if (!customerData.table?.tableNo) {
      enqueueSnackbar("Please select a table.", {
        variant: "warning",
      });
      return;
    }

    const orderData = {
      customerDetails: {
        name: customerData.customerName,
        phone: customerData.customerPhone,
        guests: customerData.guests || 1,
      },

      orderStatus: "Preparing",

      bills: {
        total,
        tax,
        totalWithTax: totalPriceWithTax,
      },

      items: cartData,

      table: customerData.table.tableNo,
    };

    setIsPlacingOrder(true);
    orderMutation.mutate(orderData);
  };

  return (
    <section className="bg-surface px-5 py-4">
      {/* Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-secondary">
            Items ({cartData.length})
          </p>

          <p className="text-sm font-semibold text-text-primary">
            {AUDFormatter.format(total)}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-secondary">
            GST (10%)
          </p>

          <p className="text-sm font-semibold text-text-primary">
            {AUDFormatter.format(tax)}
          </p>
        </div>
      </div>

      <div className="my-4 border-t border-dashed border-border" />

      {/* Total */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            Total
          </p>

          <p className="mt-1 text-xs text-text-muted">
            Includes GST
          </p>
        </div>

        <p className="text-xl font-bold text-text-primary">
          {AUDFormatter.format(totalPriceWithTax)}
        </p>
      </div>

      {/* Place order */}
      <button
        data-no-drag
        type="button"
        onClick={handlePlaceOrder}
        disabled={
          isPlacingOrder ||
          orderMutation.isPending ||
          cartData.length === 0
        }
        className="
          mt-5 w-full rounded-xl bg-primary
          px-4 py-3.5
          text-base font-semibold text-white
          shadow-sm transition duration-200
          hover:bg-primary-hover
          focus:outline-none
          focus:ring-4 focus:ring-primary/20
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {isPlacingOrder || orderMutation.isPending
          ? "Placing order..."
          : "Place Order"}
      </button>
    </section>
  );
};

export default OrderSummary;