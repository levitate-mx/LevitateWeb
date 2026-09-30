export async function createMultiImagePdfBlob(
  pages: Array<{ canvas: HTMLCanvasElement; height: number; width: number }>,
) {
  const encodedPages = await Promise.all(
    pages.map(async (page) => {
      const imageBlob = await new Promise<Blob | null>((resolve) =>
        page.canvas.toBlob(resolve, "image/jpeg", 0.94),
      );

      if (!imageBlob) {
        throw new Error("No pudimos preparar una página del PDF.");
      }

      return {
        bytes: new Uint8Array(await imageBlob.arrayBuffer()),
        canvasHeight: page.canvas.height,
        canvasWidth: page.canvas.width,
        height: page.height,
        width: page.width,
      };
    }),
  );
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets = [0];
  let offset = 0;

  const toBlobPart = (bytes: Uint8Array) =>
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

  const writeText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(toBlobPart(bytes));
    offset += bytes.length;
  };

  const writeBytes = (bytes: Uint8Array) => {
    chunks.push(toBlobPart(bytes));
    offset += bytes.length;
  };

  const startObject = (objectNumber: number) => {
    offsets[objectNumber] = offset;
    writeText(`${objectNumber} 0 obj\n`);
  };

  writeText("%PDF-1.4\n");
  startObject(1);
  writeText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  const kids = encodedPages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  writeText(
    `<< /Type /Pages /Kids [${kids}] /Count ${encodedPages.length} >>\nendobj\n`,
  );

  encodedPages.forEach((page, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    const imageName = `Ticket${index + 1}`;
    const contentStream = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/${imageName} Do\nQ\n`;

    startObject(pageObject);
    writeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj\n`,
    );
    startObject(imageObject);
    writeText(
      `<< /Type /XObject /Subtype /Image /Width ${page.canvasWidth} /Height ${page.canvasHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    writeBytes(page.bytes);
    writeText("\nendstream\nendobj\n");
    startObject(contentObject);
    writeText(
      `<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`,
    );
  });

  const totalObjects = 2 + encodedPages.length * 3;
  const xrefOffset = offset;
  writeText(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);

  for (let objectNumber = 1; objectNumber <= totalObjects; objectNumber += 1) {
    writeText(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
  }

  writeText(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  return new Blob(chunks, { type: "application/pdf" });
}
