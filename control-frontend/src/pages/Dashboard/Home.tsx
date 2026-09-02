import PageMeta from "../../components/common/PageMeta";
import DashboardWidgets from "../../components/dashboard/DashboardWidgets";

export default function Home() {
  return (
    <div className="flex h-full min-h-full flex-col">
      <PageMeta
        title="Control Dashboard"
        description="DishPatch | Real-time control dashboard for robot management."
      />
      <DashboardWidgets />
    </div>
  );
}
