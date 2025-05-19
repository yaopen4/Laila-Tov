import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from 'lucide-react';

interface CoachRecommendationsDisplayProps {
  notes?: string;
}

const CoachRecommendationsDisplay: FC<CoachRecommendationsDisplayProps> = ({ notes }) => {
  return (
    <Card className="mt-8 shadow-lg bg-accent/10 border-accent">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2 text-accent-foreground">
          <MessageSquareText className="h-5 w-5" />
          המלצות המאמן/ת
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notes ? (
          <p className="text-muted-foreground whitespace-pre-line">{notes}</p>
        ) : (
          <p className="text-muted-foreground">אין כרגע המלצות מהמאמן/ת.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CoachRecommendationsDisplay;
