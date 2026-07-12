import { FaCheckDouble, FaCircle } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

import { formatDateAndTime } from "../../utils";
import type { Order } from "../../types/order";

interface OrderCardProps {
  order: Order;
}

type CustomerOrderStatus =
  | "Preparing"
  | "Completed"
  | "Cancelled";

const MENU_IMAGES_BASE_URL: string =
  import.meta.env.VITE_MENU_IMAGES_BASE_URL ?? "";

const getMenuItemImageUrl = (uuid: string): string => {
  return `${MENU_IMAGES_BASE_URL}/${uuid}.png`;
};

const OrderCard = ({ order }: OrderCardProps) => {
  const tableNumber =
    typeof order.table === "string"
      ? order.table
      : order.table?.tableNo ?? "Not assigned";

  const itemCount =
    order.items?.reduce(
      (sum, item) => sum + (item.quantity ?? 0),
      0
    ) ?? 0;

  const orderStatus =
    order.orderStatus as CustomerOrderStatus;

  const getStatusClasses = (
    status: CustomerOrderStatus
  ): string => {
    switch (status) {
      case "Preparing":
        return "border-amber-200 bg-amber-50 text-amber-700";

      case "Completed":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";

      case "Cancelled":
        return "border-red-200 bg-red-50 text-red-700";
    }
  };

  const renderStatusIcon = (
    status: CustomerOrderStatus
  ) => {
    switch (status) {
      case "Preparing":
        return <FaCircle className="text-[8px]" />;

      case "Completed":
        return <FaCheckDouble className="text-sm" />;

      case "Cancelled":
        return <IoClose className="text-sm" />;
    }
  };

  return (
    <article
      className="
        flex min-h-[280px] w-full flex-col
        rounded-2xl border border-border
        bg-surface p-4 shadow-sm
        transition duration-200
        hover:-translate-y-0.5
        hover:border-primary/40
        hover:shadow-card
      "
    >
      {/* Order information */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            Order #{order.displayId}
          </p >

          <p className="mt-1 text-xs text-text-secondary">
            Dine in · Table {tableNumber}
          </p >
        </div>

        <span
          className={`
            inline-flex shrink-0 items-center gap-1.5
            rounded-full border px-2.5 py-1
            text-xs font-semibold
            ${getStatusClasses(orderStatus)}
          `}
        >
          {renderStatusIcon(orderStatus)}
          {orderStatus}
        </span>
      </div>

      {/* Date + Item count */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {formatDateAndTime(order.orderDate)}
        </p >

        <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
          {itemCount}{" "}
          {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="my-4 border-t border-dashed border-border" />

      {/* Ordered items */}
      <div className="min-h-0 flex-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Order items
        </h3>

        {order.items?.length ? (
          <ul className="mt-3 space-y-3">
            {order.items.map((item, index) => (
              <li
                key={`${item.uuid}-${index}`}
                className="
                  flex items-center gap-3
                  rounded-xl bg-background
                  px-3 py-2
                "
              >
                {/* Item image */}
                <div
                  className="
                    flex h-10 w-10 shrink-0
                    items-center justify-center
                    overflow-hidden rounded-full
                    border border-border
                    bg-surface
                  "
                >
                  <img
                    src={getMenuItemImageUrl(item.uuid)}
                    alt={item.name}
                    className="h-full w-full object-contain p-1"
                    draggable={false}
                  />
                </div>

                {/* Item name */}
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {item.name}
                </span>

                {/* Quantity */}
                <span className="shrink-0 rounded-full bg-primary-light px-2 py-1 text-xs font-semibold text-primary">
                  ×{item.quantity}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            No items recorded.
          </p >
        )}
      </div>
    </article>
  );
};

export default OrderCard;