import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

interface WizardStepScheduleProps {
  scheduledDate: Date | undefined;
  setScheduledDate: (d: Date | undefined) => void;
  hour: string;
  setHour: (v: string) => void;
  minute: string;
  setMinute: (v: string) => void;
  ampm: string;
  setAmpm: (v: string) => void;
  seatLimit: number;
  setSeatLimit: (v: number) => void;
  pinEnabled: boolean;
  setPinEnabled: (v: boolean) => void;
  pin: string;
  setPin: (v: string) => void;
  scheduledAt: Date | null;
  // Edit-mode PIN
  mode: "create" | "edit";
  hasPinSet: boolean;
  pinChanging: boolean;
  setPinChanging: (v: boolean) => void;
}

export default function WizardStepSchedule({
  scheduledDate,
  setScheduledDate,
  hour,
  setHour,
  minute,
  setMinute,
  ampm,
  setAmpm,
  seatLimit,
  setSeatLimit,
  pinEnabled,
  setPinEnabled,
  pin,
  setPin,
  scheduledAt,
  mode,
  hasPinSet,
  pinChanging,
  setPinChanging,
}: WizardStepScheduleProps) {
  return (
    <Card className="bg-surface border-surface-border text-text-primary">
      <CardHeader>
        <CardTitle className="text-base">Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <p className="text-xs text-text-secondary">Up to 7 days in advance</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-surface-inset border-surface-border text-text-primary hover:bg-surface-hover"
              >
                <CalendarIcon className="size-4" />
                {scheduledDate
                  ? format(scheduledDate, "EEEE, MMMM d, yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-brand-blue border-surface-border" align="start">
              <Calendar
                mode="single"
                selected={scheduledDate}
                onSelect={setScheduledDate}
                className="bg-brand-blue text-text-primary"
                classNames={{
                  weekday: "text-text-tertiary rounded-md flex-1 font-normal text-[0.8rem] select-none",
                  outside: "text-text-tertiary/50 aria-selected:text-text-tertiary/50",
                  disabled: "text-text-tertiary opacity-50",
                  today: "bg-surface text-text-primary rounded-md data-[selected=true]:rounded-none",
                }}
                disabled={(date) =>
                  date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                  date > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Time</Label>
          <div className="flex items-center gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="flex-1 h-9 rounded-md border border-surface-border bg-brand-blue px-3 text-sm text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-surface-border"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={String(h)}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-text-secondary">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="flex-1 h-9 rounded-md border border-surface-border bg-brand-blue px-3 text-sm text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-surface-border"
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={ampm}
              onChange={(e) => setAmpm(e.target.value)}
              className="flex-1 h-9 rounded-md border border-surface-border bg-brand-blue px-3 text-sm text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-surface-border"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Seats</Label>
            <Badge className="bg-surface border border-surface-border text-text-primary">{seatLimit}</Badge>
          </div>
          <Slider
            min={2}
            max={50}
            step={1}
            value={[seatLimit]}
            onValueChange={([v]) => setSeatLimit(v)}
            className="[&_[data-slot=slider-track]]:bg-surface-inset [&_[data-slot=slider-range]]:bg-text-primary [&_[data-slot=slider-thumb]]:border-text-primary"
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>2</span>
            <span>50</span>
          </div>
        </div>

        {/* Passcode protection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="pin-toggle">Require a Passcode</Label>
            <button
              type="button"
              role="switch"
              aria-checked={pinEnabled}
              onClick={() => {
                const newEnabled = !pinEnabled;
                setPinEnabled(newEnabled);
                if (!newEnabled) {
                  setPin("");
                  setPinChanging(false);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                pinEnabled ? "bg-text-primary" : "bg-surface-inset"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                  pinEnabled ? "translate-x-[18px] bg-brand-blue" : "translate-x-[3px] bg-text-primary"
                }`}
              />
            </button>
          </div>
          {pinEnabled && (
            <div className="space-y-2">
              {mode === "edit" && hasPinSet && !pinChanging ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-text-secondary flex-1">
                    Existing passcode set
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPinChanging(true);
                      setPin("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="pin"
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8))}
                    placeholder="e.g. midnight"
                    maxLength={8}
                    className="bg-surface-inset border-surface-border text-text-primary placeholder:text-text-tertiary"
                  />
                  <p className="text-xs text-text-secondary">
                    4–8 letters or numbers. Share this separately from the invite link.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {scheduledAt && (
          <p className="text-xs text-text-secondary">
            Party starts{" "}
            {format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
