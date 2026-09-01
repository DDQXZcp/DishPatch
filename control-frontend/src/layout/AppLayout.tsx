import { DashboardWidgetsProvider } from "../context/DashboardWidgetsContext";
import { DashboardSelectionProvider } from "../context/DashboardSelectionContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import { AlertsProvider } from "../components/dashboard/AlertsNotificationsWidget";

const AppLayout: React.FC = () => {
  return (
    <DashboardWidgetsProvider>
      {/* Alert bookkeeping lives above the Outlet so dismissals, event
          timestamps and the order baseline survive page navigation. The
          snackbars themselves still render only on the dashboard. */}
      <AlertsProvider>
        {/* Which robot or order is selected is shared by the map, the robot
            list and the POS table, so it has to sit above all three. It is
            deliberately not persisted — a selection is a momentary act of
            pointing at something, not part of the saved layout. */}
        <DashboardSelectionProvider>
          <div className="flex h-screen flex-col">
            <AppHeader />
            {/* p-3 matches the gap-3 between and within dashboard rows, so the
              space around the widgets is the same as the space between them.
              Keep these in step: DashboardWidgets' STACK_GAP_PX is the same
              12px. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 w-full">
              <Outlet />
            </div>
          </div>
        </DashboardSelectionProvider>
      </AlertsProvider>
    </DashboardWidgetsProvider>
  );
};

export default AppLayout;
