import React from "react";

export default function AuthLayout({
  title,
  footer,
  children,
}: {
  title: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full bg-app-background">
      {/* Left image section */}
      <section className="relative hidden min-h-screen w-1/2 overflow-hidden lg:block">
        <img
          src="/images/ANU_Hive.jpg"
          alt="The Hive study space at the Australian National University"
          className="h-full w-full object-cover"
        />

        {/* Scrim for caption readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/5" />

        {/* Venue information */}
        <blockquote className="absolute bottom-16 left-12 text-white drop-shadow-md">
          <p className="text-2xl font-semibold">The Hive Study Space</p>

          <footer className="mt-3 text-lg font-medium text-amber-300">
            — Australian National University
          </footer>
        </blockquote>
      </section>

      {/* Authentication section */}
      <section className="flex min-h-screen w-full items-center justify-center bg-app-background px-6 py-10 lg:w-1/2 lg:px-12">
        <div className="w-[460px] max-w-full">
          {/* Branding */}
          <header className="mb-8 flex flex-col items-center text-center">
            <img
              src="/images/logo/dishpatch-light.svg"
              alt="DishPatch"
              className="mb-4 h-20 w-auto object-contain"
            />

            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-app-text-secondary">
              DishPatch Control System
            </p>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-app-text">
              {title}
            </h1>
          </header>

          {/* Form card */}
          <div className="min-h-[460px] rounded-2xl border border-app-border bg-app-surface p-8 shadow-card">
            {children}
          </div>

          {/* Switch between sign in and sign up */}
          <div className="mt-6 text-center">{footer}</div>
        </div>
      </section>
    </main>
  );
}
