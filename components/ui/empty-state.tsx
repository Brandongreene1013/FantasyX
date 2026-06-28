interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-8 px-4" : "py-16 px-6"}`}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-panel2 border border-rim text-muted">
          {icon}
        </div>
      )}
      <p className={`font-black text-frost ${compact ? "text-sm" : "text-base"}`}>{title}</p>
      {description && (
        <p className={`mt-1.5 text-muted font-medium ${compact ? "text-xs" : "text-sm"}`}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-crimson/20 bg-crimson/5 p-5 text-center">
      <p className="text-sm font-bold text-crimson">{message}</p>
      {onRetry && (
        <button
          className="mt-3 rounded-lg bg-crimson/15 px-4 py-2 text-xs font-black text-crimson hover:bg-crimson/25 transition"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      )}
    </div>
  );
}
