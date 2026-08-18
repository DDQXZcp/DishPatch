import { useDashboardWidgets } from "../../context/DashboardWidgetsContext";

export default function DashboardWidgetsToolbar() {
  const { resetLayout } = useDashboardWidgets();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={resetLayout}
        className="rounded-lg border border-brand-500 bg-brand-500 px-3 py-2 text-theme-xs font-medium text-white shadow-theme-xs hover:bg-brand-600"
      >
        Reset layout
      </button>
    </div>
  );
}
