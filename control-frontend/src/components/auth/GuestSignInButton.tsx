import { useNavigate } from "react-router-dom";
import { GUEST_USER, useAuth } from "../../context/AuthContext";

export default function GuestSignInButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGuestSignIn = () => {
    login(GUEST_USER);
    navigate("/");
  };

  return (
    <>
      {/* Divider */}
      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-app-border" />

        <span className="text-xs font-medium uppercase tracking-wide text-app-text-muted">
          or
        </span>

        <div className="h-px flex-1 bg-app-border" />
      </div>

      <button
        type="button"
        onClick={handleGuestSignIn}
        disabled={disabled}
        className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-4 text-base font-semibold text-slate-600 transition duration-200 hover:border-app-border-strong hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-600/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Guest Sign In
      </button>
    </>
  );
}
