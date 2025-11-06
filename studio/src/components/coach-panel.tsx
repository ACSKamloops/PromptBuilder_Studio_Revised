import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface CoachInsight {
  title: string;
  detail: string;
}

interface CoachPanelProps {
  insights: CoachInsight[];
}

export function CoachPanel({ insights }: CoachPanelProps) {
  if (!insights.length) {
    return null;
  }

  return (
    <section className="space-y-2">
      <Card className="border-dashed border-border bg-muted/40">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="max-h-56">
            <div className="space-y-3">
              {insights.map((insight) => (
                <div key={insight.title} className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {insight.title}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {insight.detail}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}
