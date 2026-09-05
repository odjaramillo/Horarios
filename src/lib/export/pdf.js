/**
 * Genera un PDF de una página con el horario dibujado.
 *
 * La app anterior descargaba 2 MB de pdfmake desde un CDN al primer clic. Un
 * PDF que solo contiene una imagen es un formato de texto con una parte binaria:
 * escribirlo a mano evita la dependencia, el tiempo de descarga y el fallo
 * silencioso cuando el CDN no responde.
 */

/** A4 apaisado, en puntos (1/72 de pulgada) */
const PAGE = { width: 842, height: 595 };
const MARGIN = 24;

const ascii = text => new TextEncoder().encode(text);

/**
 * Arma un PDF de una página con una imagen JPEG centrada
 * @param {Uint8Array} jpeg - Imagen ya codificada
 * @param {Number} imageWidth - Ancho de la imagen en píxeles
 * @param {Number} imageHeight - Alto de la imagen en píxeles
 * @param {String} title - Título del documento
 * @return {Uint8Array} Bytes del PDF
 */
export function buildPdf(jpeg, imageWidth, imageHeight, title = 'Horario') {
  // La imagen se escala para entrar en la página sin deformarse
  const usableWidth = PAGE.width - MARGIN * 2;
  const usableHeight = PAGE.height - MARGIN * 2;
  const ratio = Math.min(usableWidth / imageWidth, usableHeight / imageHeight);

  const drawWidth = imageWidth * ratio;
  const drawHeight = imageHeight * ratio;
  const offsetX = (PAGE.width - drawWidth) / 2;
  const offsetY = (PAGE.height - drawHeight) / 2;

  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${offsetX.toFixed(
    2
  )} ${offsetY.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const escapeTitle = title.replace(/[\\()]/g, match => `\\${match}`);

  const objects = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'
    ),
    [
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      ascii('\nendstream')
    ],
    ascii(`<< /Length ${content.length} >>\nstream\n${content}endstream`),
    ascii(`<< /Title (${escapeTitle}) /Producer (Planificador de Horarios UCAB) >>`)
  ];

  const parts = [];
  const offsets = [];
  let cursor = 0;

  const push = chunk => {
    parts.push(chunk);
    cursor += chunk.length;
  };

  push(ascii('%PDF-1.4\n'));
  // Marca de contenido binario: sin ella algunos lectores tratan el archivo como texto
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  objects.forEach((body, index) => {
    offsets.push(cursor);
    push(ascii(`${index + 1} 0 obj\n`));

    for (const chunk of Array.isArray(body) ? body : [body]) push(chunk);

    push(ascii('\nendobj\n'));
  });

  const xrefOffset = cursor;
  const entries = offsets
    .map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');

  push(
    ascii(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}` +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`
    )
  );

  const pdf = new Uint8Array(cursor);
  let position = 0;

  for (const chunk of parts) {
    pdf.set(chunk, position);
    position += chunk.length;
  }

  return pdf;
}
