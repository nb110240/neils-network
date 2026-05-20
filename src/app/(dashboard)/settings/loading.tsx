import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-20 mb-4" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="shadow-refined">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-56 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-9 w-32 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
