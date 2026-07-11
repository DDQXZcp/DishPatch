import { useEffect } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";

import useVerticalDragScroll from "../../hooks/useVerticalDragScroll";
import {
  removeAllItems,
  removeItemCompletely,
} from "../../redux/slices/cartSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import { AUDFormatter } from "../../utils/currency";

interface CartItem {
  uuid: string;
  name: string;
  quantity: number;
  price: number;
  pricePerQuantity?: number;
}

const MENU_IMAGES_BASE_URL: string =
  import.meta.env.VITE_MENU_IMAGES_BASE_URL ?? "";

const getMenuItemImageUrl = (uuid: string): string => {
  return `${MENU_IMAGES_BASE_URL}/${uuid}.png`;
};

const CartInfo = () => {
  const cartData = useSelector(
    (state: RootState) => state.cart
  ) as CartItem[];

  const dispatch = useDispatch<AppDispatch>();
  const scrollRef = useVerticalDragScroll();

  useEffect(() => {
    const scrollContainer = scrollRef.current;

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData, scrollRef]);

  const handleRemove = (item: CartItem): void => {
    dispatch(
      removeItemCompletely({
        uuid: item.uuid,
      })
    );
  };

  const handleRemoveAll = (): void => {
    dispatch(removeAllItems());
  };

  return (
    <section className="flex h-full min-h-0 flex-col px-4 py-4">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Order Items
          </h2>

          <p className="mt-1 text-xs text-text-secondary">
            {cartData.length === 0
              ? "Your cart is empty"
              : `${cartData.length} ${
                  cartData.length === 1 ? "item" : "items"
                } in cart`}
          </p>
        </div>

        <button
          data-no-drag
          type="button"
          onClick={handleRemoveAll}
          disabled={cartData.length === 0}
          title="Remove all items"
          aria-label="Remove all items"
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl border border-border bg-background
            text-text-secondary transition
            hover:border-red-200 hover:bg-red-50 hover:text-red-600
            focus:outline-none focus:ring-4 focus:ring-red-100
            disabled:cursor-not-allowed disabled:opacity-30
          "
        >
          <RiDeleteBin2Fill size={18} />
        </button>
      </div>

      {/* Cart items */}
      <div
        ref={scrollRef}
        style={{ touchAction: "pan-x" }}
        className="
          mt-4 min-h-0 flex-1
          cursor-grab space-y-3
          overflow-y-auto overscroll-contain
          select-none pr-1 scrollbar-hide
          active:cursor-grabbing
        "
      >
        {cartData.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 text-center">
            <RiDeleteBin2Fill
              size={26}
              className="mb-3 text-text-muted"
            />

            <p className="text-sm font-medium text-text-primary">
              No items added
            </p>

            <p className="mt-1 text-xs text-text-secondary">
              Select an item from the menu to add it here.
            </p>
          </div>
        ) : (
          cartData.map((item) => (
            <article
              key={item.uuid}
              className="
                rounded-2xl border border-border
                bg-background p-3
                transition duration-200
                hover:border-primary/40
                hover:bg-primary-light/30
              "
            >
              {/* Top row */}
              <div className="flex items-center gap-3">
                {/* Item image */}
                <div
                  className="
                    flex h-14 w-14 shrink-0 items-center justify-center
                    overflow-hidden rounded-full
                    border border-border bg-surface
                  "
                >
                  <img
                    src={getMenuItemImageUrl(item.uuid)}
                    alt={item.name}
                    className="h-full w-full object-contain p-1.5"
                    draggable={false}
                  />
                </div>

                {/* Name and quantity */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                      {item.name}
                    </h3>

                    <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 text-sm font-semibold text-primary">
                      ×{item.quantity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-base font-bold text-text-primary">
                  {AUDFormatter.format(item.price)}
                </p>

                <button
                  data-no-drag
                  type="button"
                  onClick={() => handleRemove(item)}
                  aria-label={`Remove ${item.name} from cart`}
                  className="
                    flex items-center gap-1.5
                    rounded-lg px-2 py-1.5
                    text-sm font-medium text-text-secondary
                    transition
                    hover:bg-red-50 hover:text-red-600
                    focus:outline-none focus:ring-4 focus:ring-red-100
                  "
                >
                  <RiDeleteBin2Fill size={16} />
                  <span>Remove</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
};

export default CartInfo;