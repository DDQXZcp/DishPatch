/**
 * The centred, muted block a data widget shows in place of its table: loading,
 * empty, or disconnected.
 *
 * Shared so that the robot fleet and the POS order table cannot drift apart in
 * how they report the same backend state — they should look like two views of
 * one system, not two widgets that each invented their own empty state.
 */
export default function WidgetMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
      {children}
    </div>
  );
}
