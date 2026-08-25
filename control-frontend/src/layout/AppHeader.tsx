import { useState } from "react";
import { useLocation } from "react-router";

// import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import UserDropdown from "../components/header/UserDropdown";
import HeaderLogoMenu from "../components/header/HeaderLogoMenu";
import DashboardWidgetsToolbar from "../components/dashboard/DashboardWidgetsToolbar";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isDashboardRoute = pathname === "/";

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen((previousState) => !previousState);
  };

  return (
    <header className="sticky top-0 z-[99999] w-full border-b border-brand-border bg-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:px-6">
        {/* Left area */}
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3 lg:w-auto lg:px-0 lg:py-4">
          <HeaderLogoMenu />

          <button
            type="button"
            onClick={toggleApplicationMenu}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors duration-200 hover:bg-brand-light hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/20 lg:hidden"
            aria-label="Toggle application menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* Right area */}
        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } w-full items-center justify-between gap-4 border-t border-brand-border bg-white px-5 py-4 lg:flex lg:w-auto lg:justify-end lg:border-t-0 lg:px-0 lg:py-0`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            {/* Dark mode button disabled for now */}
            {/* <ThemeToggleButton /> */}
          </div>

          {isDashboardRoute && <DashboardWidgetsToolbar />}

          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;