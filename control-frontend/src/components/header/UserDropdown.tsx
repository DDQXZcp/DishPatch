import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

const ADMIN_NAME = "DishPatch Admin";
const ADMIN_EMAIL = "admin@dishpatch.com";

function DefaultUserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20C5.62765 16.9783 8.27832 15 12 15C15.7217 15 18.3724 16.9783 19 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 20C5.7 16.9 8.3 15 12 15C15.7 15 18.3 16.9 19 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 15C19.6 14.5 20 14.2 20.5 14.1L21 14V10L20.5 9.9C20 9.8 19.6 9.5 19.4 9C19.2 8.5 19.3 8 19.6 7.6L19.9 7.2L17.1 4.4L16.7 4.7C16.3 5 15.8 5.1 15.3 4.9C14.8 4.7 14.5 4.3 14.4 3.8L14.3 3.3H10.3L10.2 3.8C10.1 4.3 9.8 4.7 9.3 4.9C8.8 5.1 8.3 5 7.9 4.7L7.5 4.4L4.7 7.2L5 7.6C5.3 8 5.4 8.5 5.2 9C5 9.5 4.6 9.8 4.1 9.9L3.6 10V14L4.1 14.1C4.6 14.2 5 14.5 5.2 15C5.4 15.5 5.3 16 5 16.4L4.7 16.8L7.5 19.6L7.9 19.3C8.3 19 8.8 18.9 9.3 19.1C9.8 19.3 10.1 19.7 10.2 20.2L10.3 20.7H14.3L14.4 20.2C14.5 19.7 14.8 19.3 15.3 19.1C15.8 18.9 16.3 19 16.7 19.3L17.1 19.6L19.9 16.8L19.6 16.4C19.3 16 19.2 15.5 19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M9.8 9.2C10 7.9 10.9 7 12.3 7C13.8 7 14.8 7.9 14.8 9.2C14.8 10.3 14.2 10.9 13.3 11.5C12.5 12 12 12.5 12 13.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 5H6C4.89543 5 4 5.89543 4 7V17C4 18.1046 4.89543 19 6 19H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 8L18 12L14 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12H18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  interface UserData {
  userId: string;
  name: string;
  email: string;
}

  const { userId, logout } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
  
  const handleSignOut = () => {
    logout();
    closeDropdown();
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`${backendUrl}/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setUser(data.data);
      })

    return () => { cancelled = true; };
  }, [userId]);

  function toggleDropdown() {
    setIsOpen((previousState) => !previousState);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const dropdownItemClass =
    "group flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm transition-colors hover:bg-brand-light hover:text-brand";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        aria-label={`Open user menu for ${user?.name || ADMIN_NAME}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="dropdown-toggle flex items-center rounded-xl px-2 py-1.5 text-gray-700 transition-colors hover:bg-brand-light"
      >
        <span className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-light text-brand">
          <DefaultUserIcon />
        </span>

        <span className="mr-1 block font-medium text-theme-sm">
          {user?.name || ADMIN_NAME}
        </span>

        <svg
          className={`stroke-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[280px] flex-col rounded-2xl border border-brand-border bg-white p-3 shadow-theme-lg"
      >
        <div className="rounded-xl bg-brand-light px-3 py-3">
          <span className="block font-semibold text-gray-800 text-theme-sm">
            {user?.name || ADMIN_NAME}
          </span>

          <span className="mt-0.5 block text-theme-xs text-gray-500">
            {user?.email || ADMIN_EMAIL}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-brand-border pb-3 pt-3">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className={dropdownItemClass}
            >
              <span className="text-gray-500 transition-colors group-hover:text-brand">
                <ProfileIcon />
              </span>
              Edit profile
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className={dropdownItemClass}
            >
              <span className="text-gray-500 transition-colors group-hover:text-brand">
                <SettingsIcon />
              </span>
              Account settings
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className={dropdownItemClass}
            >
              <span className="text-gray-500 transition-colors group-hover:text-brand">
                <SupportIcon />
              </span>
              Support
            </DropdownItem>
          </li>
        </ul>

        <Link
          to="/signin"
          onClick={handleSignOut}
          className="group mt-3 flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm transition-colors hover:bg-brand-light hover:text-brand"
        >
          <span className="text-gray-500 transition-colors group-hover:text-brand">
            <SignOutIcon />
          </span>
          Sign out
        </Link>
      </Dropdown>
    </div>
  );
}