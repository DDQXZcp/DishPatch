import React from "react";
import { MdOutlineReorder, MdTableBar } from "react-icons/md";
import { CiCircleMore, CiUser } from "react-icons/ci";
import { BiSolidDish } from "react-icons/bi";
import { useLocation, useNavigate } from "react-router-dom";

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string): boolean => location.pathname === path;

  const navItemClass = (active: boolean): string =>
    `flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all duration-200 ${
      active
        ? "bg-primary-light text-primary"
        : "text-text-secondary hover:bg-secondary-light hover:text-text-primary"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface shadow-[0_-2px_12px_rgba(15,23,42,0.05)]">
      <div className="grid h-20 grid-cols-3 items-center gap-2 px-2 sm:px-4">
        <button
          type="button"
          onClick={() => navigate("/menu")}
          className={navItemClass(isActive("/menu"))}
        >
          <BiSolidDish size={22} />
          <span className="text-xs font-medium">Menu</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/orders")}
          className={navItemClass(isActive("/orders"))}
        >
          <MdOutlineReorder size={22} />
          <span className="text-xs font-medium">Orders</span>
        </button>

        {/* <button
          type="button"
          onClick={() => navigate("/tables")}
          className={navItemClass(isActive("/tables"))}
        >
          <MdTableBar size={22} />
          <span className="text-xs font-medium">Tables</span>
        </button> */}

        <button
          type="button"
          onClick={() => navigate("/profile")}
          className={navItemClass(isActive("/profile"))}
        >
          <CiUser size={24} />
          <span className="text-xs font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;