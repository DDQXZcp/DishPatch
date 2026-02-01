import React, { useState, useMemo } from "react";
import Invoice from "../invoice/Invoice";
import { AUDFormatter } from "../../utils/currency";
import { enqueueSnackbar } from "notistack";
import { sendPaymentMessage } from "../../https";

const Bill = ({ table, orders }) => {
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);

  // Combine all orders’ items for the selected table
  const allItems = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const merged = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!merged[item.name]) {
          merged[item.name] = { ...item };
        } else {
          merged[item.name].quantity += item.quantity || 1;
          merged[item.name].price += item.price || 0;
        }
      });
    });
    return Object.values(merged);
  }, [orders]);

  // Compute totals
  const subtotal = allItems.reduce((sum, i) => sum + i.price, 0);
  const tax = subtotal * 0.1;
  const totalWithTax = subtotal + tax;

  // Handle Payment
  const handlePay = async () => {
    if (!paymentMethod) {
      enqueueSnackbar("Please select a payment method!", { variant: "warning" });
      return;
    }

    if (!table) {
      enqueueSnackbar("No table selected!", { variant: "info" });
      return;
    }

    if (paymentMethod === "Online") {
      enqueueSnackbar("💳 Online payment (PayPal) coming soon!", { variant: "info" });
      return;
    }

    try {
      // Let backend generate UUID
      const orderIds = orders.map((o) => o.orderId);
      const payload = {
        orderIds,
        transactionType: paymentMethod.toLowerCase(), // 'cash'
        amount: totalWithTax,
      };

      await sendPaymentMessage(payload);
      enqueueSnackbar("Payment sent successfully!", { variant: "success" });

      // Local invoice
      const invoice = {
        orderDate: new Date().toISOString(),
        orderId: `TABLE-${table.tableNo}-${Date.now()}`,
        customerDetails: {
          name: table.customerName || "Guest",
          phone: table.customerPhone || "-",
          guests: table.guests || 1,
        },
        tableNo: table.tableNo,
        items: allItems,
        bills: {
          total: subtotal,
          tax,
          totalWithTax,
        },
        paymentMethod,
      };

      setOrderInfo(invoice);
      setShowInvoice(true);
    } catch (error) {
      console.error("Payment failed:", error);
      enqueueSnackbar("Failed to send payment.", { variant: "error" });
    }
  };

  return (
    <>
      {/* --- Bill Summary --- */}
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Items ({allItems.length})
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {AUDFormatter.format(subtotal)}
        </h1>
      </div>

      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">GST (10%)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {AUDFormatter.format(tax)}
        </h1>
      </div>

      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">
          Total (incl. GST)
        </p>
        <h1 className="text-[#f5f5f5] text-md font-bold">
          {AUDFormatter.format(totalWithTax)}
        </h1>
      </div>

      {/* --- Payment Buttons --- */}
      <div className="flex items-center gap-3 px-5 mt-4">
        <button
          onClick={() => setPaymentMethod("Cash")}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg font-semibold ${
            paymentMethod === "Cash" ? "bg-[#383737] text-white" : "text-[#ababab]"
          }`}
        >
          Cash
        </button>
        <button
          onClick={() => {
            setPaymentMethod("Online");
            // enqueueSnackbar("Online payment (PayPal) coming soon!", {
            //   variant: "info",
            // });
          }}
          className={`bg-[#1f1f1f] px-4 py-3 w-full rounded-lg font-semibold ${
            paymentMethod === "Online" ? "bg-[#383737] text-white" : "text-[#ababab]"
          }`}
        >
          Online
        </button>
      </div>

      {/* --- Action Buttons --- */}
      <div className="flex items-center gap-3 px-5 mt-4">
        <button
          onClick={() => {
            if (!orderInfo) {
              enqueueSnackbar("Please generate invoice first.", { variant: "info" });
              return;
            }
            setShowInvoice(true);
          }}
          className="bg-[#025cca] px-4 py-3 flex-1 rounded-lg text-white font-semibold text-lg whitespace-nowrap"
        >
          Print Receipt
        </button>
        <button
          onClick={handlePay}
          className="bg-[#f6b100] px-4 py-3 flex-1 rounded-lg text-[#1f1f1f] font-semibold text-lg whitespace-nowrap"
        >
          Pay
        </button>
      </div>

      {/* --- Invoice Modal --- */}
      {showInvoice && (
        <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />
      )}
    </>
  );
};

export default Bill;