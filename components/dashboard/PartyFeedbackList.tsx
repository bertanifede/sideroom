import { Feedback } from "@/types";

interface PartyFeedbackListProps {
  feedback: Feedback[];
}

export function PartyFeedbackList({ feedback }: PartyFeedbackListProps) {
  if (feedback.length === 0) {
    return (
      <p className="text-text-secondary text-sm">No listener notes yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback.map((item) => (
        <div
          key={item.id}
          className="bg-surface border border-surface-border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">
              {item.guest_name}
            </span>
            <span className="text-xs text-text-secondary">
              {new Date(item.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">
            {item.message}
          </p>
        </div>
      ))}
    </div>
  );
}
