import { createMultiImagePdfBlob } from "./adminPdf";
import {
  pendingCategories,
  type AcademyPendingReport,
  type PendingCategory,
} from "./academyPendingReport";

export async function createAcademyPendingPdf(
  report: AcademyPendingReport,
  categories: PendingCategory[],
  generatedAt = new Date(),
) {
  await document.fonts.ready;
  const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("No se pudo cargar el logo del reporte."));
    image.src = "/assets/levitate-logo-mx.png";
  });
  const width = 595;
  const height = 842;
  const margin = 42;
  const bottom = height - 56;
  const pages: Array<{
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
  }> = [];
  let context: CanvasRenderingContext2D;
  let y = 0;
  let activeCategory = "";
  const font = (size = 10, bold = false) => {
    context.font = `${bold ? 700 : 400} ${size}px Arial, sans-serif`;
  };
  const wrap = (text: string) => {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (
          line &&
          context.measureText(`${line} ${word}`).width > width - margin * 2
        ) {
          lines.push(line);
          line = "";
        }
        // Split unusually long names/URLs as well, without dropping any text.
        for (const letter of `${line ? " " : ""}${word}`) {
          if (context.measureText(line + letter).width > width - margin * 2) {
            lines.push(line);
            line = "";
          }
          line += letter;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const newPage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const nextContext = canvas.getContext("2d");
    if (!nextContext)
      throw new Error(
        "No se pudo preparar el PDF. Intenta desde otro navegador.",
      );
    context = nextContext;
    context.scale(2, 2);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#df1977";
    context.fillRect(0, 0, width, 7);
    const logoWidth = 118;
    context.drawImage(
      logo,
      margin,
      22,
      logoWidth,
      (logoWidth * logo.naturalHeight) / logo.naturalWidth,
    );
    font(9);
    context.fillStyle = "#65616d";
    context.fillText("ACOMPAÑANDO A SU ACADEMIA", width - 213, 40);
    pages.push({ canvas, width, height });
    y = 88;
    if (pages.length > 1 && activeCategory) {
      font(11, true);
      context.fillStyle = "#c01867";
      context.fillText(`${activeCategory} (continuación)`, margin, y);
      y += 24;
    }
  };
  const text = (value: string, size = 10, bold = false, color = "#292631") => {
    font(size, bold);
    const lines = wrap(value);
    for (const line of lines) {
      if (y + size * 1.5 > bottom) newPage();
      font(size, bold);
      context.fillStyle = color;
      context.fillText(line, margin, y);
      y += size * 1.5;
    }
  };
  const ensureSpace = (space: number) => {
    if (y + space > bottom) newPage();
  };
  newPage();
  text("Pendientes de su academia", 23, true);
  y += 5;
  text(report.academyName, 16, true);
  if (report.scopeLabel) text(report.scopeLabel, 10, false, "#65616d");
  const date = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(generatedAt);
  text(`Actualizado el ${date} (Ciudad de México)`, 9, false, "#65616d");
  y += 12;
  text(
    `Hola${report.contactName.trim() ? `, ${report.contactName.trim()}` : ""}:`,
    11,
    true,
  );
  text(
    "Gracias por ser parte de Levitate. Les compartimos los detalles que aún necesitamos completar para la participación de sus coreografías. Agradecemos su apoyo para revisarlos con su equipo y las familias.",
  );
  y += 8;
  for (const category of pendingCategories.filter((category) =>
    categories.includes(category.id),
  )) {
    const items = report.items.filter((item) => item.category === category.id);
    activeCategory = "";
    ensureSpace(100);
    y += 16;
    text(`${category.label} (${items.length})`, 14, true, "#c01867");
    text(category.description, 9, false, "#65616d");
    activeCategory = category.label;
    y += 6;
    if (!items.length)
      text("Todo al día en esta categoría. ¡Gracias!", 10, false, "#65616d");
    for (const item of items) {
      ensureSpace(70);
      text(item.subject, 11, true);
      if (item.context) text(item.context, 9, false, "#65616d");
      text(item.detail);
      y += 12;
    }
  }
  activeCategory = "";
  ensureSpace(110);
  y += 8;
  text("Gracias por ayudarnos a preparar cada detalle.", 11, true);
  text(
    "Si alguno de estos puntos ya fue atendido o tienen alguna duda, pueden escribirnos para revisarlo juntos.",
  );
  text(
    "Pueden consultar y completar sus registros desde su cuenta:",
    9,
    false,
    "#65616d",
  );
  text(report.portalUrl, 9, false, "#c01867");
  for (const [index, page] of pages.entries()) {
    const ctx = page.canvas.getContext("2d")!;
    ctx.strokeStyle = "#e8e4e9";
    ctx.beginPath();
    ctx.moveTo(margin, height - 39);
    ctx.lineTo(width - margin, height - 39);
    ctx.stroke();
    ctx.fillStyle = "#65616d";
    ctx.font = "9px Arial, sans-serif";
    ctx.fillText("Su equipo Levitate", margin, height - 23);
    ctx.textAlign = "right";
    ctx.fillText(`${index + 1} / ${pages.length}`, width - margin, height - 23);
  }
  return createMultiImagePdfBlob(pages);
}
