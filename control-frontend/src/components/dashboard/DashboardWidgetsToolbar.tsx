import { useState } from "react";

import { ChevronDownIcon } from "../../icons";
import { useDashboardWidgets } from "../../context/DashboardWidgetsContext";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DASHBOARD_WIDGETS } from "./widgetRegistry";

export default function DashboardWidgetsToolbar() {
  const { visibleIdSet, toggleWidget, resetLayout } = useDashboardWidgets();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={resetLayout}
        className="rounded-lg border border-brand-500 bg-brand-500 px-3 py-2 text-theme-xs font-medium text-white shadow-theme-xs hover:bg-brand-600"
      >
        Reset layout
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="dropdown-toggle inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-xs font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Widgets
          <ChevronDownIcon className="size-4" />
        </button>
        <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-56 p-2">
          {DASHBOARD_WIDGETS.map((widget) => {
            const active = visibleIdSet.has(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => toggleWidget(widget.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-theme-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    active
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {active && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="truncate">{widget.title}</span>
              </button>
            );
          })}
        </Dropdown>
      </div>
    </div>
  );
}
