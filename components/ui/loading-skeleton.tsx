interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-shimmer rounded ${className}`} aria-hidden="true" />;
}

export function MarketCardSkeleton() {
  return (
    <div className="rounded-xl border border-rim bg-panel p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    </div>
  );
}

export function PositionCardSkeleton() {
  return (
    <div className="rounded-xl border border-rim bg-panel p-4 space-y-2" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function LoadingFeed({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading markets" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}
