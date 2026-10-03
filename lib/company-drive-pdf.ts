// A printable PDF with a complete JSON attachment, saved only in the customer's Drive.
export function driveHistoryPdf(json: string): Buffer {
  const doc = JSON.parse(json);
  const labels: Record<string, string> = {
    description: 'Producto', scientificName: 'Nombre científico', lot: 'Lote',
    origin: 'Procedencia', fao: 'FAO', subzone: 'Subzona', fishingGear: 'Arte de pesca',
    netWeight: 'Peso neto', productionMethod: 'Método de producción', freshness: 'Frescura',
    ceCode: 'Registro sanitario', buyer: 'Comprador', buyerNumber: 'N.º comprador',
    invoiceNumber: 'Factura', invoiceDate: 'Fecha de factura', shipper: 'Expedidor',
    shipperTaxId: 'NIF expedidor', shipperHealthRegistration: 'Registro expedidor',
    captureDate: 'Fecha de captura', firstShipper: 'Primer expedidor', presentation: 'Presentación',
    brand: 'Marca', population: 'Población', establishment: 'Establecimiento', consumerNotice: 'Aviso',
  };
  const lines = ['CA46 · HISTÓRICO PRIVADO', String(doc.empresa), '', String(doc.producto),
    `Publicada: ${doc.publicada}`, `Fin de exposición: ${doc.fin_exposicion} (${doc.horas_exposicion} horas)`,
    `Identificador: ${doc.id}`, ...(doc.lote_madre_id ? [`Etiqueta madre: ${doc.lote_madre_id}`] : []), ''];
  for (const [key, value] of Object.entries(doc.trazabilidad || {})) {
    if (key === 'extraFields') {
      for (const field of (value || []) as Array<{label: string; value: string}>) lines.push(`${field.label}: ${field.value}`);
    } else if (value) lines.push(`${labels[key] || key}: ${value}`);
  }
  if (doc.anulada) lines.push(`Anulada: ${doc.anulada}`, `Motivo: ${doc.motivo_anulacion || ''}`);
  for (const transformation of doc.transformaciones || []) {
    lines.push('', 'TRANSFORMACIÓN', `Producto: ${transformation.output_product_name || ''}`,
      `Lote: ${transformation.output_lot || ''}`, `Proceso: ${transformation.process_type || ''}`,
      `Fecha: ${transformation.processed_at || ''}`, `Peso final: ${transformation.output_weight_kg || ''} kg`,
      `Ingredientes: ${JSON.stringify(transformation.ingredients || [])}`,
      `Conservación: ${transformation.storage_instructions || ''}`);
  }
  lines.push('', 'Este histórico permanece en el Drive de tu empresa.', 'Los datos completos se incluyen como archivo adjunto en este PDF.');
  const wrapped = lines.flatMap(line => {
    const result = []; let remaining = line;
    while (remaining.length > 88) {
      const space = remaining.lastIndexOf(' ', 88);
      const end = space > 25 ? space : 88;
      result.push(remaining.slice(0, end)); remaining = remaining.slice(end).trimStart();
    }
    result.push(remaining); return result;
  });
  const escape = (value: string) => value.replace(/[^\x20-\xFF]/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const chunks = [];
  for (let i = 0; i < wrapped.length; i += 44) chunks.push(wrapped.slice(i, i + 44));
  const pageIds = chunks.map((_, i) => 4 + i * 2);
  const attachmentId = 4 + chunks.length * 2;
  const specId = attachmentId + 1;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(datos-etiqueta.json) ${specId} 0 R] >> >> >>`,
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${chunks.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  chunks.forEach((chunk, i) => {
    const stream = chunk.map((line, j) => `BT /F1 ${i === 0 && j === 0 ? 16 : 10} Tf 42 ${795 - j * 16} Td (${escape(line)}) Tj ET`).join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });
  const attachment = Buffer.from(json, 'utf8').toString('latin1');
  objects.push(`<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${Buffer.byteLength(json)} >>\nstream\n${attachment}\nendstream`,
    `<< /Type /Filespec /F (datos-etiqueta.json) /EF << /F ${attachmentId} 0 R >> >>`);
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
