import { Card } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export const News = () => (
  <div className="space-y-5 pb-28">
    <div className="flex items-center gap-3">
      <Newspaper className="h-6 w-6 text-gold" />
      <h2 className="font-serif text-2xl text-gradient-gold">Tour News</h2>
    </div>

    <Card className="gradient-card border-gold/15 p-6 text-center">
      <p className="font-serif text-base text-foreground">No live news feed connected yet.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Tour events and headlines will appear here once a verified news source is linked.
      </p>
    </Card>
  </div>
);