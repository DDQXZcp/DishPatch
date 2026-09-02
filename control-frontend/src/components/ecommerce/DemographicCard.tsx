import RestaurantMap from "../maps/RestaurantMap";

interface DemographicCardProps {
  framed?: boolean;
}

export default function DemographicCard({ framed = true }: DemographicCardProps) {
  if (!framed) {
    return <RestaurantMap />;
  }

  const content = (
    <div className="my-6 h-[500px] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <RestaurantMap />
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Robot Operational Map
        </h3>
        <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
          Robot operational status in the restaurant
        </p>
      </div>

      {content}
    </div>
  );
}
