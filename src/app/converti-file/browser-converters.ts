import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export async function convertDocument(
  file: File,
  sourceFormat: string,
  destinationFormat: string,
): Promise<Blob> {
  if (destinationFormat === 'PNG.ZIP') {
    if (sourceFormat !== 'PDF') {
      throw new Error('l’esportazione delle pagine come immagini richiede un PDF');
    }
    return renderPdfPagesAsZip(file);
  }

  const html = await readDocumentHtml(file, sourceFormat);
  const text = htmlToText(html);

  switch (destinationFormat) {
    case 'TXT':
    case 'MD':
      return new Blob([text], { type: 'text/plain;charset=utf-8' });
    case 'HTML':
      return new Blob([html], { type: 'text/html;charset=utf-8' });
    case 'PDF':
      return createPdf(text);
    case 'EPUB':
      return createEpub(html);
    default:
      throw new Error(`conversione documento verso ${destinationFormat} non supportata`);
  }
}

async function readDocumentHtml(file: File, format: string): Promise<string> {
  if (format === 'DOCX') {
    const mammothModule = await import('mammoth/mammoth.browser.js');
    const result = await mammothModule.default.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    return result.value;
  }
  if (format === 'PDF') {
    const text = await readPdfText(file);
    return `<pre>${escapeHtml(text)}</pre>`;
  }
  if (format === 'EPUB') {
    return readEpubHtml(file);
  }

  const source = await file.text();
  if (format === 'HTML') {
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    parsed.querySelectorAll('script,style,iframe,object,embed').forEach((element) => element.remove());
    return parsed.body.innerHTML;
  }
  if (format === 'MD') {
    return markdownToHtml(source);
  }
  return `<pre>${escapeHtml(source)}</pre>`;
}

async function readPdfText(file: File): Promise<string> {
  const pdf = await loadPdf(file);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => 'str' in item)
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  const text = pages.join('\n\n');
  if (!text.trim()) {
    throw new Error('il PDF non contiene testo estraibile; i PDF scansiti richiedono OCR');
  }
  return text;
}

async function renderPdfPagesAsZip(file: File): Promise<Blob> {
  const pdf = await loadPdf(file);
  if (pdf.numPages > 500) {
    throw new Error('il PDF supera il limite di 500 pagine per l’esportazione');
  }
  const images: Record<string, Uint8Array> = {};
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, Math.sqrt(20_000_000 / (baseViewport.width * baseViewport.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('canvas non disponibile per l’esportazione PDF');
    }
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const image = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('errore nella creazione dell’immagine'))),
        'image/png',
      );
    });
    images[`pagina-${String(pageNumber).padStart(4, '0')}.png`] =
      new Uint8Array(await image.arrayBuffer());
  }
  return new Blob([zipSync(images)], { type: 'application/zip' });
}

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'assets/pdfjs/pdf.worker.mjs',
    document.baseURI,
  ).toString();
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

async function readEpubHtml(file: File): Promise<string> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const containerFile = entries['META-INF/container.xml'];
  if (!containerFile) {
    throw new Error('struttura EPUB non valida');
  }
  const container = new DOMParser().parseFromString(strFromU8(containerFile), 'application/xml');
  const packagePath = container.getElementsByTagNameNS('*', 'rootfile')[0]
    ?.getAttribute('full-path');
  if (!packagePath || !entries[packagePath]) {
    throw new Error('manifest EPUB non trovato');
  }

  const packageDocument = new DOMParser().parseFromString(
    strFromU8(entries[packagePath]),
    'application/xml',
  );
  const manifest = new Map<string, string>();
  for (const item of Array.from(packageDocument.getElementsByTagNameNS('*', 'item'))) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifest.set(id, resolveZipPath(packagePath, href));
    }
  }

  const chapterPaths = Array.from(packageDocument.getElementsByTagNameNS('*', 'itemref'))
    .map((item) => manifest.get(item.getAttribute('idref') ?? ''))
    .filter((path): path is string => path !== undefined && entries[path] !== undefined);
  if (chapterPaths.length === 0) {
    throw new Error('il libro EPUB non contiene capitoli leggibili');
  }

  return chapterPaths.map((path) => {
    const chapter = new DOMParser().parseFromString(strFromU8(entries[path]), 'text/html');
    chapter.querySelectorAll('script,style,iframe,object,embed').forEach((element) => element.remove());
    return chapter.body.innerHTML;
  }).join('\n');
}

async function createPdf(text: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const margin = 14;
  const lineHeight = 7;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = margin;

  for (const paragraph of text.split(/\r?\n/)) {
    const lines = pdf.splitTextToSize(paragraph || ' ', pdf.internal.pageSize.getWidth() - margin * 2);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  }
  return pdf.output('blob');
}

function createEpub(html: string): Blob {
  const body = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Documento convertito</title></head><body><pre>${escapeHtml(htmlToText(html))}</pre></body></html>`;
  const packageDocument = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">convertix-generated</dc:identifier>
    <dc:title>Documento convertito</dc:title>
    <dc:language>it</dc:language>
  </metadata>
  <manifest><item id="content" href="content.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="content"/></spine>
</package>`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  return new Blob(
    [
      zipSync({
        mimetype: [strToU8('application/epub+zip'), { level: 0 }],
        'META-INF/container.xml': strToU8(container),
        'OEBPS/content.xhtml': strToU8(body),
        'OEBPS/package.opf': strToU8(packageDocument),
      }),
    ],
    { type: 'application/epub+zip' },
  );
}

export async function convertSpreadsheet(
  file: File,
  sourceFormat: string,
  destinationFormat: string,
): Promise<Blob> {
  const rows = await readSpreadsheetRows(file, sourceFormat);

  if (destinationFormat === 'CSV' || destinationFormat === 'TSV') {
    return new Blob([rowsToDelimited(rows, destinationFormat === 'TSV' ? '\t' : ',')], {
      type: 'text/plain;charset=utf-8',
    });
  }
  if (destinationFormat === 'ODS') {
    return createOds(rows);
  }
  if (destinationFormat === 'XLSX') {
    const exceljs = (await import('exceljs')).default;
    const workbook = new exceljs.Workbook();
    workbook.addWorksheet('Foglio1').addRows(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
  throw new Error(`conversione foglio di calcolo verso ${destinationFormat} non supportata`);
}

async function readSpreadsheetRows(file: File, format: string): Promise<string[][]> {
  if (format === 'CSV' || format === 'TSV') {
    return parseDelimited(await file.text(), format === 'TSV' ? '\t' : ',');
  }
  if (format === 'ODS') {
    return readOds(file);
  }

  const exceljs = (await import('exceljs')).default;
  const workbook = new exceljs.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('il file XLSX non contiene fogli di lavoro');
  }
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    rows[rowNumber - 1] = Array.from(
      { length: row.cellCount },
      (_, index) => spreadsheetCellToText(row.getCell(index + 1).value),
    );
  });
  return rows;
}

function spreadsheetCellToText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return spreadsheetCellToText(value.result);
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

async function readOds(file: File): Promise<string[][]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const contentFile = entries['content.xml'];
  if (!contentFile) {
    throw new Error('il file ODS non contiene content.xml');
  }

  const xml = new DOMParser().parseFromString(strFromU8(contentFile), 'application/xml');
  if (xml.querySelector('parsererror')) {
    throw new Error('il documento ODS non è valido');
  }
  const tableNamespace = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
  const officeNamespace = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
  const textNamespace = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const worksheet = xml.getElementsByTagNameNS(tableNamespace, 'table')[0];
  if (!worksheet) {
    throw new Error('il file ODS non contiene fogli di lavoro');
  }

  const rows: string[][] = [];
  let totalCells = 0;
  for (const rowElement of Array.from(worksheet.getElementsByTagNameNS(tableNamespace, 'table-row'))) {
    const rowRepeat = Number(rowElement.getAttributeNS(tableNamespace, 'number-rows-repeated') || 1);
    const cells: string[] = [];
    for (const cell of Array.from(rowElement.children)) {
      if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') {
        continue;
      }
      const repeat = Number(cell.getAttributeNS(tableNamespace, 'number-columns-repeated') || 1);
      const valueType = cell.getAttributeNS(officeNamespace, 'value-type');
      const valueAttribute = valueType === 'float'
        ? cell.getAttributeNS(officeNamespace, 'value')
        : valueType === 'boolean'
          ? cell.getAttributeNS(officeNamespace, 'boolean-value')
          : cell.getAttributeNS(officeNamespace, 'string-value');
      const paragraphText = Array.from(cell.getElementsByTagNameNS(textNamespace, 'p'))
        .map((paragraph) => paragraph.textContent ?? '')
        .join('\n');
      const value = valueAttribute ?? paragraphText;
      if (repeat > 10000 || cells.length + repeat > 10000) {
        throw new Error('il foglio ODS supera il limite di colonne supportato');
      }
      for (let index = 0; index < repeat; index++) {
        cells.push(value);
      }
    }

    if (rowRepeat > 10000 || rows.length + rowRepeat > 10000) {
      throw new Error('il foglio ODS supera il limite di righe supportato');
    }
    totalCells += rowRepeat * cells.length;
    if (totalCells > 1_000_000) {
      throw new Error('il foglio ODS supera il limite di celle supportato');
    }
    for (let index = 0; index < rowRepeat; index++) {
      rows.push([...cells]);
    }
  }
  return rows;
}

function createOds(rows: string[][]): Blob {
  const office = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
  const table = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
  const text = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const rowsXml = rows.map((row) =>
    `<table:table-row>${row.map((cell) =>
      `<table:table-cell office:value-type="string"><text:p>${escapeXml(cell)}</text:p></table:table-cell>`,
    ).join('')}</table:table-row>`,
  ).join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${office}" xmlns:table="${table}" xmlns:text="${text}" office:version="1.2">
  <office:body><office:spreadsheet><table:table table:name="Foglio1">${rowsXml}</table:table></office:spreadsheet></office:body>
</office:document-content>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

  return new Blob(
    [
      zipSync({
        mimetype: [
          strToU8('application/vnd.oasis.opendocument.spreadsheet'),
          { level: 0 },
        ],
        'content.xml': strToU8(content),
        'META-INF/manifest.xml': strToU8(manifest),
      }),
    ],
    { type: 'application/vnd.oasis.opendocument.spreadsheet' },
  );
}

function rowsToDelimited(rows: string[][], delimiter: string): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (/[",\r\n\t]/.test(cell)) {
            return `"${cell.replaceAll('"', '""')}"`;
          }
          return cell;
        })
        .join(delimiter),
    )
    .join('\r\n');
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') {
        index++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function createWav(audio: AudioBuffer): Blob {
  const channelCount = audio.numberOfChannels;
  const frameCount = audio.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * blockAlign, true);

  const channels = Array.from({ length: channelCount }, (_, index) =>
    audio.getChannelData(index),
  );
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function convertAudio(file: File): Promise<Blob> {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    throw new Error('Web Audio API non disponibile in questo browser');
  }
  const context = new AudioContextConstructor();
  try {
    let audio: AudioBuffer;
    try {
      audio = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error('il browser non riesce a decodificare questo formato audio');
    }
    return createWav(audio);
  } finally {
    await context.close();
  }
}

export async function convertVideo(
  file: File,
  destinationFormat: string,
  quality: number,
): Promise<Blob> {
  const video = document.createElement('video');
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;
  video.preload = 'auto';
  video.playsInline = true;

  try {
    await waitForVideoEvent(video, 'loadedmetadata');
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('durata video non valida');
    }

    if (destinationFormat !== 'WEBM') {
      await waitForVideoEvent(video, 'loadeddata');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('canvas non disponibile');
      }
      context.drawImage(video, 0, 0);
      const mimeType = `image/${destinationFormat.toLowerCase()}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('errore durante la codifica'))),
          mimeType,
          quality / 100,
        );
      });
      if (blob.type !== mimeType) {
        throw new Error(`il browser non supporta l'esportazione in ${destinationFormat}`);
      }
      return blob;
    }

    return await recordVideo(video, destinationFormat);
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function recordVideo(video: HTMLVideoElement, format: string): Promise<Blob> {
  const captureStream = (
    video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }
  ).captureStream ?? (
    video as HTMLVideoElement & {
      mozCaptureStream?: () => MediaStream;
    }
  ).mozCaptureStream;
  if (!captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('registrazione video non supportata da questo browser');
  }
  const mimeTypes = format === 'MP4'
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = mimeTypes
    .find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) {
    throw new Error(`il browser non supporta la codifica video ${format}`);
  }

  const stream = captureStream.call(video);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.addEventListener(
      'error',
      () => reject(new Error('errore durante la registrazione video')),
      { once: true },
    );
    video.addEventListener(
      'ended',
      () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      },
      { once: true },
    );
  });

  try {
    recorder.start();
    await video.play();
    await stopped;
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) {
      throw new Error('la conversione video non ha prodotto dati');
    }
    return blob;
  } finally {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    stream.getTracks().forEach((track) => track.stop());
  }
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string): Promise<void> {
  if (eventName === 'loadedmetadata' && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  if (eventName === 'loadeddata' && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    video.addEventListener(eventName, () => resolve(), { once: true });
    video.addEventListener(
      'error',
      () => reject(new Error('il browser non riesce a decodificare questo video')),
      { once: true },
    );
  });
}

export async function convertArchive(file: File, destinationFormat: string): Promise<Blob> {
  const maxInputBytes = 100 * 1024 * 1024;
  const maxExpandedBytes = 250 * 1024 * 1024;
  const maxFileCount = 10000;
  if (file.size > maxInputBytes) {
    throw new Error('l’archivio supera il limite di 100 MB');
  }

  const { Archive, ArchiveCompression, ArchiveFormat } = await import('libarchive.js');
  Archive.init({
    workerUrl: new URL('assets/libarchive/worker-bundle.js', document.baseURI),
  });

  const archive = await Archive.open(file);
  try {
    const metadata = await archive.getFilesArray() as Array<{ file: { size: number } }>;
    if (metadata.length > maxFileCount) {
      throw new Error('l’archivio contiene più di 10.000 file');
    }
    const expandedSize = metadata.reduce((total, entry) => total + entry.file.size, 0);
    if (!Number.isFinite(expandedSize) || expandedSize > maxExpandedBytes) {
      throw new Error('il contenuto estratto supera il limite di 250 MB');
    }

    const tree = await archive.extractFiles();
    const files: Array<{ file: File; pathname: string }> = [];
    collectArchiveFiles(tree, '', files);
    if (files.length === 0) {
      throw new Error('l’archivio non contiene file convertibili');
    }

    const tarGzip = destinationFormat === 'TAR.GZ';
    const writeArchive = Archive.write as unknown as (options: {
      files: Array<{ file: File; pathname: string }>;
      outputFileName: string;
      compression: string;
      format: string;
      passphrase: null;
    }) => Promise<File>;
    const converted = await writeArchive({
      files,
      outputFileName: tarGzip ? 'archivio.tar.gz' : 'archivio.zip',
      compression: tarGzip ? ArchiveCompression.GZIP : ArchiveCompression.NONE,
      format: tarGzip ? ArchiveFormat.USTAR : ArchiveFormat.ZIP,
      passphrase: null,
    });
    return new Blob([converted], {
      type: tarGzip ? 'application/gzip' : 'application/zip',
    });
  } finally {
    await archive.close();
  }
}

function collectArchiveFiles(
  tree: unknown,
  parentPath: string,
  files: Array<{ file: File; pathname: string }>,
): void {
  if (tree instanceof File) {
    const pathname = sanitizeArchivePath(parentPath || tree.name);
    if (pathname) {
      files.push({ file: tree, pathname });
    }
    return;
  }
  if (tree && typeof tree === 'object') {
    for (const [name, value] of Object.entries(tree)) {
      collectArchiveFiles(value, parentPath ? `${parentPath}/${name}` : name, files);
    }
  }
}

function sanitizeArchivePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..' && !part.includes('\0'))
    .join('/');
}

function resolveZipPath(baseFile: string, href: string): string {
  const baseDirectory = baseFile.slice(0, baseFile.lastIndexOf('/') + 1);
  const parts: string[] = [];
  for (const part of `${baseDirectory}${decodeURIComponent(href)}`.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

export async function convertFont(
  file: File,
  sourceFormat: string,
  destinationFormat: string,
): Promise<Blob> {
  const fonteditor = await import('fonteditor-core');
  if (sourceFormat === 'WOFF2' || destinationFormat === 'WOFF2') {
    await fonteditor.woff2.init(
      new URL('assets/fonteditor/woff2.wasm', document.baseURI).toString(),
    );
  }

  const font = fonteditor.createFont(await file.arrayBuffer(), {
    type: sourceFormat.toLowerCase() as 'ttf' | 'otf' | 'woff' | 'woff2',
    hinting: true,
    kerning: true,
  });
  const output = font.write({
    type: destinationFormat.toLowerCase() as 'ttf' | 'woff' | 'woff2',
    hinting: true,
    kerning: true,
  });
  const mimeType = destinationFormat === 'WOFF2'
    ? 'font/woff2'
    : destinationFormat === 'WOFF'
      ? 'font/woff'
      : 'font/ttf';
  return new Blob([output], { type: mimeType });
}

function markdownToHtml(markdown: string): string {
  return markdown.split(/\r?\n\s*\r?\n/).map((paragraph) => {
    const heading = /^(#{1,6})\s+([\s\S]*)$/.exec(paragraph.trim());
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
    }
    return `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`;
  }).join('\n');
}

function htmlToText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,style,iframe,object,embed').forEach((element) => element.remove());
  return document.body.textContent ?? '';
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(text: string): string {
  return escapeHtml(text);
}
