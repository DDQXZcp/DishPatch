import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { BiCart } from "react-icons/bi";

import BottomNav from "../components/shared/BottomNav";
import MenuContainer from "../components/menu/MenuContainer";
import TableInfo from "../components/menu/TableInfo";
import CartInfo from "../components/menu/CartInfo";
import OrderSummary from "../components/menu/OrderSummary";

const Menu = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => {
    setIsCartOpen(true);
  };

  const closeCart = () => {
    setIsCartOpen(false);
  };

  return (
    <section className="h-[calc(100dvh-5rem)] overflow-hidden bg-background font-sans">
      {/* Main content between header and bottom navigation */}
      <div className="flex h-[calc(100%-5rem)] min-h-0 gap-4 px-4 py-4">
        {/* Menu section */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-0 pb-4 sm:px-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Menu
            </h1>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <MenuContainer />
          </div>
        </main>

        {/* Desktop cart sidebar */}
        <aside
          className="
            hidden h-full min-h-0 w-[360px] shrink-0
            flex-col overflow-hidden rounded-2xl
            border border-border bg-surface shadow-card
            lg:flex xl:w-[400px]
          "
        >
          <div className="shrink-0">
            <TableInfo />
          </div>

          {/* CartInfo owns the scrolling */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <hr className="border-border" />
            <CartInfo />
          </div>

          <div className="shrink-0 border-t border-border bg-surface">
            <OrderSummary />
          </div>
        </aside>
      </div>

      {/* Mobile cart button */}
      <button
        type="button"
        onClick={openCart}
        className="
          fixed bottom-24 right-4 z-30
          flex items-center gap-2 rounded-full
          bg-primary px-5 py-3
          text-sm font-semibold text-white
          shadow-lg transition
          hover:bg-primary-hover
          focus:outline-none focus:ring-4 focus:ring-primary/20
          lg:hidden
        "
        aria-label="Open cart"
      >
        <BiCart size={21} />
        View Cart
      </button>

      {/* Mobile backdrop */}
      {isCartOpen && (
        <button
          type="button"
          onClick={closeCart}
          className="fixed inset-x-0 bottom-20 top-20 z-40 bg-slate-950/40 lg:hidden"
          aria-label="Close cart"
        />
      )}

      {/* Mobile cart drawer */}
      <aside
        className={`
          fixed inset-x-0 bottom-20 z-50
          flex h-[calc(100dvh-10rem)] min-h-0 flex-col
          overflow-hidden rounded-t-3xl
          border-t border-border bg-surface
          shadow-[0_-12px_40px_rgba(15,23,42,0.18)]
          transition-transform duration-300 ease-out
          lg:hidden
          ${isCartOpen ? "translate-y-0" : "translate-y-full"}
        `}
        aria-hidden={!isCartOpen}
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <BiCart className="text-xl text-primary" />

            <h2 className="text-lg font-semibold text-text-primary">
              Your Cart
            </h2>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="
              rounded-xl p-2 text-text-secondary
              transition hover:bg-secondary-light
              hover:text-text-primary
            "
            aria-label="Close cart"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Fixed table information */}
        <div className="shrink-0">
          <TableInfo />
        </div>

        {/* CartInfo receives the remaining fixed height */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <hr className="border-border" />
          <CartInfo />
        </div>

        {/* Fixed order summary */}
        <div className="shrink-0 border-t border-border bg-surface">
          <OrderSummary />
        </div>
      </aside>

      <BottomNav />
    </section>
  );
};

export default Menu;