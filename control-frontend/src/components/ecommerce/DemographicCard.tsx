import RestaurantMap from "../maps/RestaurantMap";

interface DemographicCardProps {
  framed?: boolean;
}

export default function DemographicCard({ framed = true }: DemographicCardProps) {
  const content = (
    <>
      <div className={`${framed ? "my-6" : "h-full"} overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800`}>
        <div id="mapOne" className={`mapOne map-btn w-full ${framed ? "h-[500px]" : "h-full"}`}>
          <RestaurantMap />
        </div>
      </div>
    </>
  );

  if (!framed) {
    return content;
  }

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