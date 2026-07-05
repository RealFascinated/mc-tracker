import { Link } from "@tanstack/react-router";
import { MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ChatAuthGate() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <MessageCircleIcon className="text-muted-foreground size-8 stroke-1" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Sign in to use the assistant
        </p>
        <p className="text-muted-foreground text-xs">
          Ask about player counts, trends, and peaks across tracked servers.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button variant="brand" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/signup">Create account</Link>
        </Button>
      </div>
    </div>
  );
}
