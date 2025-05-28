
/**
 * @fileoverview Component to display consultant's recommendations/notes to parents.
 * This is a read-only display.
 */
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from 'lucide-react';

/**
 * Props for the CoachRecommendationsDisplay component.
 */
interface CoachRecommendationsDisplayProps {
  /** The notes or recommendations provided by the consultant. Optional. */
  notes?: string;
}

/**
 * Renders a card displaying the sleep consultant's notes or recommendations.
 * If no notes are provided, a default message is shown.
 * @param {CoachRecommendationsDisplayProps} props - The component's props.
 */
const CoachRecommendationsDisplay: FC<CoachRecommendationsDisplayProps> = ({ notes }) => {
  return (
    <Card className="mt-8 shadow-lg bg-accent/10 border-accent">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2 text-accent-foreground">
          <MessageSquareText className="h-5 w-5" />
          המלצות היועצת
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notes ? (
          // whitespace-pre-line preserves newlines from the consultant's input.
          <p className="text-muted-foreground whitespace-pre-line">{notes}</p>
        ) : (
          <p className="text-muted-foreground">אין כרגע המלצות מהיועצת.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CoachRecommendationsDisplay;
