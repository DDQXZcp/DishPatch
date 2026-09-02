import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";
import GuestSignInButton from "./GuestSignInButton";

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

const inputClasses =
  "w-full rounded-xl border border-app-border bg-app-surface px-4 py-4 text-base text-app-text placeholder:text-app-text-muted outline-none transition duration-200 hover:border-app-border-strong focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ fname: "", lname: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${backendUrl}/api/users/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fname: form.fname,
          lname: form.lname,
          email: form.email,
          password: form.password
        })
      });

      const data = await response.json();

      if (data.success) {
        login(data.data.userId);
        navigate("/");
      } else {
        alert(data.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fname"
              className="mb-2 block text-sm font-medium text-app-text-secondary"
            >
              First name
            </label>

            <input
              id="fname"
              name="fname"
              type="text"
              autoComplete="given-name"
              required
              value={form.fname}
              onChange={(e) => setForm({ ...form, fname: e.target.value })}
              placeholder="Enter your first name"
              className={inputClasses}
            />
          </div>

          <div>
            <label
              htmlFor="lname"
              className="mb-2 block text-sm font-medium text-app-text-secondary"
            >
              Last name
            </label>

            <input
              id="lname"
              name="lname"
              type="text"
              autoComplete="family-name"
              required
              value={form.lname}
              onChange={(e) => setForm({ ...form, lname: e.target.value })}
              placeholder="Enter your last name"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-app-text-secondary"
          >
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@anu.edu.au"
            className={inputClasses}
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-app-text-secondary"
          >
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter your password"
              className={`${inputClasses} pr-12`}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted transition-colors hover:text-app-text-secondary"
            >
              {showPassword ? (
                <EyeIcon className="size-5 fill-current" />
              ) : (
                <EyeCloseIcon className="size-5 fill-current" />
              )}
            </button>
          </div>
        </div>

        {/* Sign-up button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-xl bg-brand-500 px-4 py-4 text-base font-semibold text-white transition duration-200 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <GuestSignInButton disabled={isSubmitting} />
    </div>
  );
}
