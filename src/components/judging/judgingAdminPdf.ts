import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

type Bundle = {
  event: { name: string };
  snapshot: {
    rows: { id: string; programNumber?: string; name: string; academy: string; status: string }[];
    report: {
      blocks: {
        id: string;
        title: string;
        name: string;
        sections: {
          label: string;
          categories: {
            title: string;
            rows: {
              routineId: string;
              score: number | null;
              placement: null | { label: string };
            }[];
          }[];
        }[];
        specialAwards: { title: string; displayValue: string }[];
        topScore?: null | { routineId: string; score: number };
      }[];
    };
  };
};

export async function generateAdminReportPdf(bundle: Bundle, blockId: string) {
  const block = bundle.snapshot.report.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error("No hay un bloque seleccionado.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const response = await fetch("/assets/participant-recognition-unicode.ttf");
  if (!response.ok) throw new Error("No se pudo cargar la tipografía del PDF.");
  const font = await pdf.embedFont(await response.arrayBuffer(), {
    subset: true,
  });
  const supported = new Set(font.getCharacterSet());
  const lookup = new Map(bundle.snapshot.rows.map((r) => [r.id, r]));
  const pink = rgb(0.88, 0.13, 0.43),
    ink = rgb(0.09, 0.09, 0.11),
    muted = rgb(0.4, 0.42, 0.47),
    line = rgb(0.87, 0.88, 0.9);
  let page = pdf.addPage([595.28, 841.89]),
    y = 0;
  const clean = (v: string) => v.replace(/[\u0000-\u001f]/g, " ").trim();
  function wrapped(value: string, width: number, size: number) {
    const out: string[] = [];
    let current = "";
    for (const token of clean(value).split(/\s+/)) {
      if (
        current &&
        font.widthOfTextAtSize(`${current} ${token}`, size) > width
      ) {
        out.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(token, size) > width) {
        for (const ch of token) {
          if (current && font.widthOfTextAtSize(current + ch, size) > width) {
            out.push(current);
            current = "";
          }
          current += ch;
        }
      } else current += (current ? " " : "") + token;
    }
    if (current) out.push(current);
    return out.length ? out : [""];
  }
  function draw(value: string, x: number, top: number, size = 10, color = ink) {
    if (
      [...clean(value)].some(
        (character) => !supported.has(character.codePointAt(0)!),
      )
    )
      throw new Error(
        "El PDF contiene caracteres no compatibles con la tipografía. No se modificaron los nombres.",
      );
    page.drawText(clean(value), {
      x,
      y: 841.89 - top - size,
      font,
      size,
      color,
    });
  }
  function header() {
    y = 40;
    draw("LEVITATE MX", 34, y, 19, pink);
    draw("DICTAMEN FINAL", 355, y + 4, 12);
    y += 34;
    for (const l of wrapped(bundle.event.name, 527, 10)) {
      draw(l, 34, y, 10, muted);
      y += 15;
    }
    for (const l of wrapped(block!.title || block!.name, 527, 13)) {
      draw(l, 34, y, 13);
      y += 18;
    }
    y += 15;
  }
  function ensure(height: number) {
    if (y + height > 790) {
      page = pdf.addPage([595.28, 841.89]);
      header();
    }
  }
  header();
  for (const section of block.sections) {
    ensure(60);
    draw(section.label.toUpperCase(), 34, y, 15, pink);
    y += 24;
    for (const category of section.categories) {
      const heading = wrapped(category.title, 505, 10);
      ensure(heading.length * 15 + 70);
      page.drawRectangle({
        x: 34,
        y: 841.89 - y - heading.length * 15 - 14,
        width: 527,
        height: heading.length * 15 + 14,
        color: rgb(0.95, 0.95, 0.96),
      });
      for (const l of heading) {
        draw(l, 44, y + 7, 10);
        y += 15;
      }
      y += 18;
      for (const standing of category.rows) {
        const row = lookup.get(standing.routineId);
        if (!row) continue;
        const lines = wrapped(`#${row.programNumber || row.id} · ${row.name}`, 316, 10),
          academy = wrapped(row.academy, 316, 8),
          place = wrapped(standing.placement?.label || "Sin lugar", 90, 8);
        const h = Math.max(
          (lines.length + academy.length) * 14 + 18,
          place.length * 13 + 18,
          46,
        );
        ensure(h);
        let top = y + 4;
        for (const l of lines) {
          draw(l, 43, top, 10);
          top += 14;
        }
        for (const l of academy) {
          draw(l, 43, top, 8, muted);
          top += 12;
        }
        draw(
          standing.score == null
            ? "Pendiente"
            : new Intl.NumberFormat("es-MX", {
                maximumFractionDigits: 2,
              }).format(standing.score),
          375,
          y + 5,
          13,
          pink,
        );
        for (let n = 0; n < place.length; n++)
          draw(place[n], 465, y + 6 + n * 13, 8);
        if (row.status !== "complete") {
          draw(
            row.status === "partial" ? "Incompleta" : "Pendiente",
            375,
            y + 27,
            7,
            muted,
          );
        }
        y += h;
        page.drawLine({
          start: { x: 34, y: 841.89 - y },
          end: { x: 561, y: 841.89 - y },
          thickness: 0.5,
          color: line,
        });
      }
      y += 14;
    }
  }
  if (block.topScore) {
    const lines = wrapped(
      `TOP SCORE: ${lookup.get(block.topScore.routineId)?.name || block.topScore.routineId} · ${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(block.topScore.score)}`,
      527,
      11,
    );
    ensure(lines.length * 15 + 20);
    for (const value of lines) {
      draw(value, 34, y, 11, pink);
      y += 15;
    }
    y += 20;
  }
  if (block.specialAwards.length) {
    const needed =
      35 +
      block.specialAwards.reduce(
        (sum, a) =>
          sum +
          wrapped(`${a.title}: ${a.displayValue || "Sin asignar"}`, 515, 10)
            .length *
            15 +
          12,
        0,
      );
    ensure(Math.min(needed, 650));
    draw("PREMIOS ESPECIALES", 34, y, 13, pink);
    y += 26;
    for (const award of block.specialAwards) {
      const lines = wrapped(
        `${award.title}: ${award.displayValue || "Sin asignar"}`,
        515,
        10,
      );
      ensure(lines.length * 15 + 12);
      for (const l of lines) {
        draw(l, 43, y, 10);
        y += 15;
      }
      y += 12;
    }
  }
  pdf
    .getPages()
    .forEach((p, index) =>
      p.drawText(
        `${index + 1} / ${pdf.getPageCount()}  ·  ${new Date().toLocaleDateString("es-MX")}`,
        { x: 430, y: 22, size: 7, font, color: muted },
      ),
    );
  return pdf.save();
}
