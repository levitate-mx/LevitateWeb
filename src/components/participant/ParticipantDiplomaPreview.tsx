import { useMemo } from "react";
import { layoutParticipantDiplomaRecipient, type ParticipantDiplomaRecipientField } from "../../../shared/participant-diploma-layout.js";

const nameFamily = '"Times New Roman", Times, serif';
const academyFamily = "Arial, sans-serif";

type PreviewField = ParticipantDiplomaRecipientField & { compressedWidth?: number };

function recipientLayout(name: string, academy: string): { name: PreviewField; academy: PreviewField } {
  const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  const measure = (family: string) => (value: string, size: number) => {
    if (context) {
      context.font = `${size}px ${family}`;
      context.fontKerning = "none";
      return context.measureText(value).width;
    }
    // The server-rendered placeholder uses conservative widths; the browser
    // measures its actual fonts before displaying the personalized recipient.
    return [...value].reduce((width, character) => width + (/\s/u.test(character) ? 0.3 : /[ilIjt.,']/u.test(character) ? 0.35 : /[MW]/u.test(character) ? 0.95 : 0.65), 0) * size;
  };
  const measureName = measure(nameFamily);
  const measureAcademy = measure(academyFamily);
  try {
    return layoutParticipantDiplomaRecipient({ name, academy, measureName, measureAcademy });
  } catch {
    // Keep an unusually long record visible without breaking the whole page.
    // PDF issuance still validates that its full identity fits the template.
    return {
      name: { size: 18, lines: [name], baselines: [390], compressedWidth: 470 },
      academy: { size: 7, lines: academy ? [academy] : [], baselines: academy ? [420] : [], compressedWidth: 440 },
    };
  }
}

export function ParticipantDiplomaPreview({
  name,
  academy,
  season,
  eventTitle,
  preview,
  internalPreview = false,
}: {
  name: string;
  academy: string;
  season: string;
  eventTitle: string;
  preview: boolean;
  internalPreview?: boolean;
}) {
  const recipient = useMemo(() => recipientLayout(name, academy), [name, academy]);

  return (
    <div className="participant-diploma-stage" data-participant-reveal>
      <div
        className="participant-certificate participant-certificate--authenticated"
        role="img"
        aria-label={`Reconocimiento de participación autenticado de ${name}`}
      >
        <img
          className="participant-certificate__art"
          src="/assets/participant-recognition-template.png"
          alt=""
          aria-hidden="true"
          width="1020"
          height="1320"
        />
        <div className="participant-certificate__content" aria-hidden="true">
          <svg className="participant-certificate__recipient" viewBox="0 0 612 792" aria-hidden="true">
            {recipient.name.lines.map((line, index) => (
              <text
                key={`name-${index}`}
                className="participant-certificate__name"
                x="306"
                y={recipient.name.baselines[index]}
                fontSize={recipient.name.size}
                textLength={recipient.name.compressedWidth}
                lengthAdjust="spacingAndGlyphs"
              >
                {line}
              </text>
            ))}
            {recipient.academy.lines.map((line, index) => (
              <text
                key={`academy-${index}`}
                className="participant-certificate__academy"
                x="306"
                y={recipient.academy.baselines[index]}
                fontSize={recipient.academy.size}
                textLength={recipient.academy.compressedWidth}
                lengthAdjust="spacingAndGlyphs"
              >
                {line}
              </text>
            ))}
          </svg>
          <div className="participant-certificate__auth">
            <span aria-hidden="true">✓</span>
            {internalPreview ? "Vista interna · No publicado" : preview ? "Ejemplo autenticado" : "Reconocimiento autenticado"}
          </div>
        </div>
      </div>
      <span className="participant-diploma-stage__caption">
        {internalPreview ? "Vista interna · No publicado" : "Reconocimiento autenticado"} · {season || eventTitle}
      </span>
    </div>
  );
}
