import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaInfoCircle,
  FaReceipt,
  FaUserCircle,
  FaUtensils,
} from "react-icons/fa";
import { MdChevronRight } from "react-icons/md";

import BottomNav from "../components/shared/BottomNav";
import type { RootState } from "../redux/store";

interface ProfileActionProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

const ProfileAction = ({
  icon,
  title,
  description,
  onClick,
}: ProfileActionProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex w-full items-center gap-4
        rounded-2xl border border-border
        bg-surface p-4 text-left
        shadow-sm transition duration-200
        hover:border-primary/40
        hover:bg-primary-light/20
        hover:shadow-card
        focus:outline-none
        focus:ring-4 focus:ring-primary/10
      "
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-text-primary">
          {title}
        </h3>

        <p className="mt-1 text-xs text-text-secondary">
          {description}
        </p >
      </div>

      <MdChevronRight
        size={24}
        className="shrink-0 text-text-muted"
      />
    </button>
  );
};

const Profile = () => {
  const navigate = useNavigate();

  const userData = useSelector(
    (state: RootState) => state.user
  );

  useEffect(() => {
    document.title = "POS | Profile";
  }, []);

  const displayName = userData.name?.trim() || "Guest";
  const displayEmail =
    userData.email?.trim() || "Guest customer";

  return (
    <section className="h-[calc(100dvh-5rem)] overflow-hidden bg-background font-sans">
      <div className="h-[calc(100%-5rem)] overflow-y-auto px-4 py-5 scrollbar-hide sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {/* Header */}
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Profile
            </h1>

            <p className="mt-1 text-sm text-text-secondary">
              View your account and access your orders.
            </p >
          </header>

          {/* User profile */}
          <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <FaUserCircle className="text-5xl text-primary" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Current Profile
                </p >

                <h2 className="mt-1 truncate text-xl font-bold text-text-primary">
                  {displayName}
                </h2>

                <p className="mt-1 truncate text-sm text-text-secondary">
                  {displayEmail}
                </p >
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-text-secondary">
                    Account status
                  </p >

                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    Signed in
                  </p >
                </div>

                <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                  Active
                </span>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Quick Access
            </h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ProfileAction
                icon={<FaReceipt size={20} />}
                title="Order History"
                description="View your recent orders and their status."
                onClick={() => navigate("/orders")}
              />

              <ProfileAction
                icon={<FaUtensils size={20} />}
                title="Browse Menu"
                description="Browse the menu and place another order."
                onClick={() => navigate("/menu")}
              />
            </div>
          </section>

          {/* App information */}
          <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-light">
                <FaInfoCircle className="text-lg text-text-secondary" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  About DishPatch
                </h2>

                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  DishPatch is an open-source, AWS cloud-based restaurant service-robot platform.
                </p >
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Your order will be processed and dispatched by our autonomous service robots.
                </p >
              </div>
            </div>
          </section>
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default Profile;