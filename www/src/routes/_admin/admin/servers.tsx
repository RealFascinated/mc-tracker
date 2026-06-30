import { createFileRoute } from "@tanstack/react-router"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { pageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_admin/admin/servers")({
  head: () => ({
    meta: [{ title: pageTitle("Admin servers") }],
  }),
  component: AdminServersPage,
})

function AdminServersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Servers</CardTitle>
        <CardDescription>
          Server CRUD table and forms will be added in a follow-up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Admin API is available at <code className="rounded bg-muted px-1">/admin/servers</code>.
        </p>
      </CardContent>
    </Card>
  )
}
