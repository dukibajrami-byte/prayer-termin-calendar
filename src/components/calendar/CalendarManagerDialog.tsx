import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, ChevronDown, ChevronUp, Trash2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calendarLabel } from "@/lib/calendar-labels";
import { useI18n } from "@/lib/i18n";
import { useCalendars } from "@/hooks/useCalendars";
import type { CalendarKind, CalendarRow } from "@/lib/calendar.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const KINDS: CalendarKind[] = ["personal", "family", "mosque", "work"];
const DEFAULT_COLOR = COLORS[0]!;

export function CalendarManagerDialog({ open, onOpenChange }: Props) {

  const { t } = useI18n();
  const {
    calendars,
    members,
    loading,
    active,
    refresh,
    addCalendar,
    editCalendar,
    removeCalendar,
    fetchMembers,
    invite,
    remove,
  } = useCalendars();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CalendarKind>("family");
  const [newColor, setNewColor] = useState<string>(DEFAULT_COLOR);


  const [inviteEmail, setInviteEmail] = useState("");
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (open && active) refresh();
  }, [open, active, refresh]);

  useEffect(() => {
    if (expanded) fetchMembers(expanded);
  }, [expanded, fetchMembers]);

  const sorted = useMemo(
    () => [...calendars].sort((a, b) => a.name.localeCompare(b.name)),
    [calendars],
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    void addCalendar(newName.trim(), newKind, newColor).then(() => {
      setNewName("");
      setNewKind("family");
      setNewColor(DEFAULT_COLOR);
    });

  };

  const startEdit = (cal: CalendarRow) => {
    setEditName(calendarLabel(cal, t));
    setExpanded(cal.id);
  };

  const saveEdit = (cal: CalendarRow) => {
    if (!editName.trim()) return;
    void editCalendar(cal.id, { name: editName.trim() });
  };

  if (!active) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("calendars.title")}</DialogTitle>
            <DialogDescription>{t("calendars.subtitle")}</DialogDescription>
          </DialogHeader>
          <Card className="border-dashed border-muted">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="rounded-full bg-muted p-4">
                <CalendarPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("calendars.localHint")}</p>
              <Button asChild>
                <Link to="/premium">{t("premium.upgrade")}</Link>
              </Button>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("calendars.title")}</DialogTitle>
          <DialogDescription>{t("calendars.cloudHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border border-border/60">
            <CardContent className="space-y-3 pt-4">
              <div className="grid gap-2">
                <Label>{t("calendars.name")}</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("calendars.name")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{t("calendars.kind")}</Label>
                  <Select value={newKind} onValueChange={(v) => setNewKind(v as CalendarKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`calendars.kind.${k}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("calendars.color")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        onClick={() => setNewColor(c)}
                        className={`h-7 w-7 rounded-full ring-2 ring-offset-1 transition ${
                          newColor === c ? "ring-current" : "ring-transparent"
                        }`}
                        style={{ backgroundColor: c, color: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim() || loading} className="w-full">
                <CalendarPlus className="mr-2 h-4 w-4" />
                {t("calendars.create")}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {loading && !calendars.length ? (
              <p className="text-sm text-muted-foreground">{t("calendars.loading")}</p>
            ) : null}
            {sorted.map((cal) => {
              const isExpanded = expanded === cal.id;
              const calMembers = members[cal.id] || [];
              return (
                <Card key={cal.id} className="border border-border/60">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cal.color }}
                        />
                        <div>
                          <div className="font-medium">{calendarLabel(cal, t)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t(`calendars.kind.${cal.kind}`)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setExpanded(isExpanded ? null : cal.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => void removeCalendar(cal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <div className="grid gap-2">
                          <Label>{t("calendars.name")}</Label>
                          <div className="flex gap-2">
                            <Input
                              value={editName || calendarLabel(cal, t)}
                              onChange={(e) => setEditName(e.target.value)}
                              onFocus={() => startEdit(cal)}
                              onBlur={() => saveEdit(cal)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(cal);
                              }}
                            />
                          </div>
                        </div>

                        {cal.kind !== "personal" && (
                          <div className="grid gap-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <Label>{t("calendars.members")}</Label>
                              <Badge variant="secondary">{calMembers.length}</Badge>
                            </div>
                            <div className="space-y-1">
                              {calMembers.map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-sm"
                                >
                                  <span>{m.invited_email || m.user_id}</span>
                                  {m.role !== "owner" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-destructive"
                                      onClick={() => void remove(cal.id, m.id)}
                                    >
                                      {t("calendars.remove")}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder={t("calendars.inviteEmail")}
                                type="email"
                              />
                              <Button
                                disabled={!inviteEmail.trim()}
                                onClick={() => {
                                  void invite(cal.id, inviteEmail.trim()).then(() => setInviteEmail(""));
                                }}
                              >
                                {t("calendars.invite")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
