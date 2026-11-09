import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { ParticipantRoutine } from "./participantTypes";

export function ParticipantRoutineSelector({
  routines,
  selectedId,
  disabled,
  onSelect,
  context,
  label,
}: {
  routines: ParticipantRoutine[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  context: string;
  label: (value: string | null | undefined) => string;
}) {
  if (routines.length === 0) return null;
  return (
    <div className="participant-routine-picker">
      <div
        className="participant-routine-list"
        role="group"
        aria-label={`Seleccionar presentación para ${context}`}
      >
        {routines.map((routine, index) => (
          <button
            type="button"
            key={routine.id}
            aria-pressed={routine.id === selectedId}
            disabled={disabled}
            onClick={() => onSelect(routine.id)}
          >
            <span className="participant-routine-list__number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{routine.title}</strong>
              <small>
                {[routine.genre, routine.subgenre].map(label).filter(Boolean).join(" · ")}
              </small>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label className="participant-routine-select">
        <span className="participant-eyebrow">
          Presentación · {routines.findIndex((routine) => routine.id === selectedId) + 1} de{" "}
          {routines.length}
        </span>
        <span className="participant-select-wrap">
          <select
            aria-label={`Presentación para ${context}`}
            value={selectedId}
            onChange={(change) => onSelect(change.target.value)}
            disabled={disabled}
          >
            {routines.map((routine) => (
              <option key={routine.id} value={routine.id}>
                {routine.title} · {label(routine.subgenre || routine.genre)}
              </option>
            ))}
          </select>
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </label>
    </div>
  );
}
