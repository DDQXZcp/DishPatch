import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";

import { addItems, removeItem } from "../../redux/slices/cartSlice";
import type { AppDispatch, RootState } from "../../redux/store";
import { AUDFormatter } from "../../utils/currency";
import { getMenus } from "../../https";
import useDragScroll from "../../hooks/useDragScroll";
import useVerticalDragScroll from "../../hooks/useVerticalDragScroll";

interface MenuItem {
  uuid: string;
  name: string;
  price: number;
}

interface MenuCategory {
  menuName: string;
  icon?: string;
  items?: MenuItem[];
}

interface CartItem {
  uuid: string;
  name: string;
  pricePerQuantity: number;
  quantity: number;
}

interface MenusResponseData {
  data?: MenuCategory[];
}

const MENU_IMAGES_BASE_URL: string =
  import.meta.env.VITE_MENU_IMAGES_BASE_URL ?? "";

const getMenuItemImageUrl = (uuid: string): string => {
  return `${MENU_IMAGES_BASE_URL}/${uuid}.png`;
};

const MenuContainer = () => {
  const [menus, setMenus] = useState<MenuCategory[]>([]);
  const [selected, setSelected] = useState<MenuCategory | null>(null);

  const dispatch = useDispatch<AppDispatch>();

  const cart = useSelector(
    (state: RootState) => state.cart
  ) as CartItem[];

  const categoryDragScrollRef = useDragScroll();
  const itemDragScrollRef = useVerticalDragScroll();

  /*
   * useVerticalDragScroll returns a callback ref.
   * This additional normal ref lets us reset scrollTop when
   * the customer changes category.
   */
  const itemScrollElementRef = useRef<HTMLDivElement | null>(null);

  const setItemScrollRef = useCallback(
    (node: HTMLDivElement | null): void => {
      itemScrollElementRef.current = node;
      itemDragScrollRef(node);
    },
    [itemDragScrollRef]
  );

  useEffect(() => {
    const loadMenus = async (): Promise<void> => {
      try {
        const response = await getMenus();

        const responseData = response.data as MenusResponseData;
        const menuData = responseData.data ?? [];

        setMenus(menuData);

        if (menuData.length > 0) {
          setSelected(menuData[0]);
        }
      } catch (error: unknown) {
        console.error("Error loading menus:", error);
      }
    };

    void loadMenus();
  }, []);

  const handleSelectCategory = (
    menu: MenuCategory
  ): void => {
    if (selected?.menuName === menu.menuName) {
      return;
    }

    /*
     * Stop any remaining vertical scrolling before changing
     * the displayed category.
     */
    if (itemScrollElementRef.current) {
      itemScrollElementRef.current.scrollTop = 0;
    }

    setSelected(menu);

    /*
     * Reset again after React renders the new category items.
     * This avoids retaining the previous category's position.
     */
    requestAnimationFrame(() => {
      if (itemScrollElementRef.current) {
        itemScrollElementRef.current.scrollTop = 0;
      }
    });
  };

  const getCartQty = (item: MenuItem): number => {
    const cartItem = cart.find(
      (cartEntry) => cartEntry.uuid === item.uuid
    );

    return cartItem?.quantity ?? 0;
  };

  const handleIncrement = (item: MenuItem): void => {
    dispatch(
      addItems({
        uuid: item.uuid,
        name: item.name,
        pricePerQuantity: item.price,
      })
    );
  };

  const handleDecrement = (item: MenuItem): void => {
    dispatch(
      removeItem({
        uuid: item.uuid,
      })
    );
  };

  if (menus.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-text-secondary">
        Loading menus...
      </p >
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fixed category section */}
      <div className="shrink-0">
        <div className="min-w-0 px-4 py-4 sm:px-6 lg:px-4">
          <div
            ref={categoryDragScrollRef}
            style={{
              WebkitOverflowScrolling: "touch",
            }}
            className="
              flex w-full gap-3 overflow-x-auto pb-2
              cursor-grab select-none scrollbar-hide
              touch-pan-x overscroll-x-contain
              active:cursor-grabbing
            "
          >
            {menus.map((menu) => {
              const active =
                selected?.menuName === menu.menuName;

              return (
                <button
                  key={menu.menuName}
                  type="button"
                  draggable={false}
                  onClick={() => handleSelectCategory(menu)}
                  className={`
                    flex min-h-[90px] min-w-[170px] shrink-0
                    flex-col items-start justify-between
                    rounded-2xl border p-4 text-left
                    transition duration-200
                    ${
                      active
                        ? "border-primary bg-primary-light text-primary shadow-sm"
                        : "border-border bg-surface text-text-primary hover:border-primary hover:bg-primary-light/40"
                    }
                  `}
                >
                  <h2 className="text-base font-semibold leading-5">
                    {menu.icon && (
                      <span className="mr-2">
                        {menu.icon}
                      </span>
                    )}

                    {menu.menuName}
                  </h2>

                  <p
                    className={`mt-4 text-sm font-medium ${
                      active
                        ? "text-primary/80"
                        : "text-text-secondary"
                    }`}
                  >
                    {menu.items?.length ?? 0} Items
                  </p >
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-border" />
      </div>

      {/* Independently scrollable menu items */}
      <div
        ref={setItemScrollRef}
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
        className="
          min-h-0 flex-1 cursor-grab
          overflow-y-auto overscroll-contain
          select-none pb-24 scrollbar-hide
          active:cursor-grabbing
          lg:pb-6
        "
      >
        {/*
          Changing this key remounts the grid whenever a different
          category is selected, preventing stale item content.
        */}
        <div
          key={selected?.menuName ?? "no-category"}
          className="
            grid gap-4 px-4 py-5
            sm:grid-cols-2 sm:px-6
            lg:grid-cols-2 lg:px-4
            xl:grid-cols-3
            2xl:grid-cols-4
          "
        >
          {selected?.items?.map((item) => {
            const quantity = getCartQty(item);

            return (
              <article
                key={item.uuid}
                className="
                  flex min-h-[260px] flex-col rounded-2xl
                  border border-border bg-surface p-4
                  shadow-sm transition duration-200
                  hover:-translate-y-0.5
                  hover:border-primary
                  hover:shadow-card
                "
              >
                <h3 className="min-h-[48px] text-base font-semibold leading-6 text-text-primary">
                  {item.name}
                </h3>

                <div className="my-4 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-background">
                  <img
                    src={getMenuItemImageUrl(item.uuid)}
                    alt={item.name}
                    className="h-full w-full object-contain p-2"
                    draggable={false}
                  />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-text-primary">
                    {AUDFormatter.format(item.price)}
                  </p >

                  <div
                    data-no-drag
                    className="flex items-center rounded-xl border border-border bg-background"
                  >
                    <button
                      data-no-drag
                      type="button"
                      onClick={() => handleDecrement(item)}
                      disabled={quantity === 0}
                      className="
                        flex h-10 w-10 items-center justify-center
                        rounded-l-xl text-lg font-semibold
                        text-text-secondary transition
                        hover:bg-secondary-light
                        hover:text-text-primary
                        disabled:cursor-not-allowed
                        disabled:opacity-30
                      "
                      aria-label={`Remove one ${item.name}`}
                    >
                      −
                    </button>

                    <span className="w-8 text-center text-sm font-semibold text-text-primary">
                      {quantity}
                    </span>

                    <button
                      data-no-drag
                      type="button"
                      onClick={() => handleIncrement(item)}
                      className="
                        flex h-10 w-10 items-center justify-center
                        rounded-r-xl text-lg font-semibold
                        text-primary transition
                        hover:bg-primary-light
                      "
                      aria-label={`Add one ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {selected?.items?.length === 0 && (
            <div className="col-span-full flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-surface">
              <p className="text-sm text-text-secondary">
                No items available in this category.
              </p >
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuContainer;