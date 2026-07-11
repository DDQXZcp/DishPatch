import React, { useEffect, useState } from "react";
import restaurant from "../assets/images/harbs-yokohama.jpg";
import logo from "../assets/images/HarbsLogo.png";
import Register from "../components/auth/Register";
import Login from "../components/auth/Login";

const Auth = () => {
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    document.title = "POS | Auth";
  }, []);

  const toggleAuthMode = (): void => {
    setIsRegister((currentValue) => !currentValue);
  };

  return (
    <main className="flex min-h-screen w-full bg-background font-sans">
      {/* Left image section */}
      <section className="relative hidden min-h-screen w-1/2 overflow-hidden lg:block">
        <img
          src={restaurant}
          alt="HARBS Lumine Yokohama restaurant"
          className="h-full w-full object-cover"
        />

        {/* Soft overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />

        {/* Restaurant information */}
        <blockquote className="absolute bottom-16 left-12 text-white">
          <p className="text-2xl font-semibold">
            LUMINE YOKOHAMA Store
          </p>

          <footer className="mt-3 text-lg font-medium text-amber-300">
            — HARBS Japan
          </footer>
        </blockquote>
      </section>

      {/* Authentication section */}
      <section className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10 lg:w-1/2 lg:px-12">
        <div className="w-[460px] max-w-full">
          {/* Branding */}
          <header className="mb-8 flex flex-col items-center text-center">
            <img
              src={logo}
              alt="HARBS logo"
              className="mb-4 h-20 w-auto object-contain"
            />

            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-secondary">
              DishPatch POS System
            </p>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-text-primary">
              {isRegister ? "Staff Sign Up" : "Staff Login"}
            </h1>
          </header>

          {/* Form card */}
          <div className="min-h-[460px] rounded-2xl border border-border bg-surface p-8 shadow-card">
            {isRegister ? (
              <Register setIsRegister={setIsRegister} />
            ) : (
              <Login />
            )}
          </div>

          {/* Switch between login and registration */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              {isRegister
                ? "Already have an account? "
                : "Don't have an account? "}

              <button
                type="button"
                onClick={toggleAuthMode}
                className="font-semibold text-primary transition-colors hover:text-primary-hover hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {isRegister ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Auth;