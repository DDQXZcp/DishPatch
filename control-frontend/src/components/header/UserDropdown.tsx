import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { GroupIcon } from "../../icons";

// Shown until the profile resolves, and if it never does. Deliberately makes no
// claim about who is signed in — a wrong identity is worse than no identity.
const UNKNOWN_NAME = "Account";

interface UserData {
  userId: string;
  name: string;
  email: string;
}

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
  const { userId, logout } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [failed, setFailed] = useState(false);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

  const handleSignOut = () => {
    logout();
    closeDropdown();
  }

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    fetch(`${backendUrl}/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setUser(data.data);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

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
        aria-label={`Open user menu for ${user?.name ?? UNKNOWN_NAME}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="dropdown-toggle flex items-center rounded-xl px-2 py-1.5 text-gray-700 transition-colors hover:bg-brand-light"
      >
        <span className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-light text-brand">
          <DefaultUserIcon />
        </span>

        <span className="mr-1 block font-medium text-theme-sm">
          {user?.name ?? UNKNOWN_NAME}
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
            {user?.name ?? UNKNOWN_NAME}
          </span>

          {user ? (
            <span className="mt-0.5 block text-theme-xs text-gray-500">
              {user.email}
            </span>
          ) : failed ? (
            <span className="mt-0.5 block text-theme-xs text-gray-500">
              Couldn&apos;t load profile
            </span>
          ) : null}
        </div>

        <ul className="flex flex-col gap-1 border-b border-brand-border pb-3 pt-3">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              baseClassName=""
              className={dropdownItemClass}
            >
              <span className="text-gray-500 transition-colors group-hover:text-brand">
                <ProfileIcon />
              </span>
              User Profile
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/contributors"
              baseClassName=""
              className={dropdownItemClass}
            >
              <span className="text-gray-500 transition-colors group-hover:text-brand">
                <GroupIcon className="h-6 w-6" />
              </span>
              Contributors
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