import { Skeleton } from "@/components/ui/skeleton";

export function TripCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
      <Skeleton className="h-52 w-full rounded-none sm:h-60" />
      <div className="space-y-5 p-6">
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
