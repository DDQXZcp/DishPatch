import { useState } from "react";
import { useLocation } from "react-router";

import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import {
  ArrowUpIcon,
  BoxCubeIcon,
  ChevronDownIcon,
  DollarLineIcon,
  GridIcon,
} from "../../icons";

const NAV_ITEMS = [
  { name: "Robot Control Dashboard", path: "/", icon: <GridIcon /> },
];

const EXTERNAL_LINKS = [
  { name: "POS System", url: "https://pos.dish-patch.com/", icon: <DollarLineIcon /> },
  { name: "Robot Visualiser", url: "https://robot.dish-patch.com/", icon: <BoxCubeIcon /> },
];

const navItemClassName = "group flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-theme-sm transition-colors";

export default function HeaderLogoMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();

  function toggleDropdown() {
    setIsOpen((previousState) => !previousState);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open navigation menu"
        className="dropdown-toggle flex min-w-0 items-center gap-2 rounded-xl py-1.5 pl-1 pr-2 transition-colors hover:bg-brand-light lg:gap-3"
      >
        <img
          src="/images/logo/dishpatch-light-no-text.svg"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain"
        />
        <span className="min-w-0 truncate text-left text-theme-sm font-semibold tracking-[0.02em] text-slate-800 sm:text-base lg:text-lg xl:text-xl">
          DishPatch <span className="text-brand">Control System</span>
        </span>
        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="left-0 right-auto mt-2 flex w-[280px] flex-col gap-1 p-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;

          return (
            <DropdownItem
              key={item.path}
              tag="a"
              to={item.path}
              onItemClick={closeDropdown}
              // Drop the default base classes: their px-4 outranks the px-3
              // below, which would indent this item past the external links.
              baseClassName=""
              className={`${navItemClassName} ${
                isActive
                  ? "bg-brand-light text-brand-hover"
                  : "text-gray-600 hover:bg-brand-light hover:text-brand-hover"
              }`}
            >
              <span
                className={isActive ? "text-brand" : "text-gray-400 group-hover:text-brand"}
              >
                {item.icon}
              </span>
              {item.name}
            </DropdownItem>
          );
        })}

        {EXTERNAL_LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeDropdown}
            className={`${navItemClassName} text-gray-600 hover:bg-brand-light hover:text-brand-hover`}
          >
            <span className="text-gray-400 group-hover:text-brand">{link.icon}</span>
            {link.name}
            <ArrowUpIcon className="ml-auto h-3.5 w-3.5 rotate-45 text-gray-300 group-hover:text-brand-hover" />
          </a>
        ))}
      </Dropdown>
    </div>
  );
}
