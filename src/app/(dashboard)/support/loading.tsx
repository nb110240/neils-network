import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function SupportLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-20 mb-4" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      <Card className="shadow-refined">
        <CardContent className="p-6 space-y-5">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  )
}
