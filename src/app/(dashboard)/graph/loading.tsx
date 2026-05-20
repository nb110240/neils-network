import { Skeleton } from "@/components/ui/skeleton"

export default function GraphLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-20 mb-4" />
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-5 w-80 mt-2" />
      </div>
      <Skeleton className="h-[28rem] w-full rounded-2xl" />
    </div>
  )
}
