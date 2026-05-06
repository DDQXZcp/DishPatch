interface PlaceholderWidgetProps {
  label: string;
  description: string;
}

export default function PlaceholderWidget({
  label,
  description,
}: PlaceholderWidgetProps) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-700 dark:bg-white/[0.02]">
      <div>
        <p className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          {label}
        </p>
        <p className="mt-2 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}
