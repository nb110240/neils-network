import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function DevLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="shadow-refined">
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
