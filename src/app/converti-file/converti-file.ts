import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../material.module';
import { MatSliderThumb } from '@angular/material/slider';

const FILE_CATEGORIES = [
  'Immagini',
  'Documenti',
  'Fogli di calcolo',
  'Presentationi',
  'Audio',
  'Video',
  'Ebook',
  'Dati',
  'Archivi',
  'Font',
] as const;

const IMAGE_FORMATS = ['JPG', 'PNG', 'WEBP', 'GIF', 'BMP', 'TIFF', 'SVG', 'AVIF', 'HEIC', 'ICO'];
const DOCUMENT_FORMATS = ['PDF', 'DOCX', 'DOC', 'ODT', 'RTF', 'TXT', 'HTML', 'MD', 'EPUB'];
const SPREADSHEET_FORMATS = ['XLSX', 'XLS', 'ODS', 'CSV', 'TSV', 'PDF'];
const PRESENTATION_FORMATS = ['PPTX', 'PPT', 'ODP', 'PDF', 'JPG'];
const AUDIO_FORMATS = ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A', 'WMA', 'AIFF'];
const VIDEO_FORMATS = ['MP4', 'MKV', 'AVI', 'MOV', 'WEBM', 'WMV', 'FLV', 'GIF'];
const EBOOK_FORMATS = ['EPUB', 'MOBI', 'AZW3', 'PDF', 'FB2'];
const DATA_FORMATS = ['JSON', 'XML', 'CSV', 'YAML', 'TSV'];
const ARCHIVE_FORMATS = ['ZIP', '7Z', 'RAR', 'TAR', 'GZ'];
const FONT_FORMATS = ['TTF', 'OTF', 'WOFF', 'WOFF2'];

@Component({
  imports: [MaterialModule, MatSliderThumb],
  selector: 'app-converti-file',
  styleUrl: './converti-file.css',
  templateUrl: './converti-file.html',
})
export class ConvertiFile {
  readonly categories = FILE_CATEGORIES;
  readonly imageAccept = '.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.svg,.avif,.heic,.ico';
  readonly documentAccept = '.pdf,.docx,.doc,.odt,.rtf,.txt,.html,.htm,.md,.epub';
  readonly spreadsheetAccept = '.xlsx,.xls,.ods,.csv,.tsv,.pdf';
  readonly presentationAccept = '.pptx,.ppt,.odp,.pdf,.jpg,.jpeg';
  readonly audioAccept = '.mp3,.wav,.flac,.aac,.ogg,.m4a,.wma,.aiff,.aif';
  readonly videoAccept = '.mp4,.mkv,.avi,.mov,.webm,.wmv,.flv,.gif';
  readonly ebookAccept = '.epub,.mobi,.azw3,.pdf,.fb2';
  readonly dataAccept = '.json,.xml,.csv,.yaml,.yml,.tsv';
  readonly archiveAccept = '.zip,.7z,.rar,.tar,.gz';
  readonly fontAccept = '.ttf,.otf,.woff,.woff2';
  selectedSourceCategory: (typeof FILE_CATEGORIES)[number] | null = null;
  selectedDestinationCategory: (typeof FILE_CATEGORIES)[number] | null = null;
  selectedDestinationFormat: string | null = null;
  queuedFiles: File[] = [];
  isDragging = false;
  qualityPercentage = 50;

  constructor(private readonly snackBar: MatSnackBar) {}

  get isConversionReady(): boolean {
    return (
      this.selectedSourceCategory !== null &&
      this.selectedDestinationFormat !== null &&
      this.queuedFiles.length > 0
    );
  }

  get totalQueuedSize(): number {
    return this.queuedFiles.reduce((total, file) => total + file.size, 0);
  }

  get supportedFormatsText(): string {
    let formats: string[];
    switch (this.selectedSourceCategory) {
      case 'Immagini':
        formats = IMAGE_FORMATS;
        break;
      case 'Documenti':
        formats = DOCUMENT_FORMATS;
        break;
      case 'Fogli di calcolo':
        formats = SPREADSHEET_FORMATS;
        break;
      case 'Presentationi':
        formats = PRESENTATION_FORMATS;
        break;
      case 'Audio':
        formats = AUDIO_FORMATS;
        break;
      case 'Video':
        formats = VIDEO_FORMATS;
        break;
      case 'Ebook':
        formats = EBOOK_FORMATS;
        break;
      case 'Dati':
        formats = DATA_FORMATS;
        break;
      case 'Archivi':
        formats = ARCHIVE_FORMATS;
        break;
      case 'Font':
        formats = FONT_FORMATS;
        break;
      default:
        formats = [];
    }

    const supportedFormats = formats.length > 0 ? `${formats.join(', ')}. ` : '';
    return `Formati supportati: ${supportedFormats}I file restano sul tuo computer.`;
  }

  get destinationFormats(): string[] {
    const category = this.selectedDestinationCategory ?? this.selectedSourceCategory;
    if (category === 'Immagini') {
      return IMAGE_FORMATS;
    }
    if (category === 'Documenti') {
      return DOCUMENT_FORMATS;
    }
    if (category === 'Fogli di calcolo') {
      return SPREADSHEET_FORMATS;
    }
    if (category === 'Presentationi') {
      return PRESENTATION_FORMATS;
    }
    if (category === 'Audio') {
      return AUDIO_FORMATS;
    }
    if (category === 'Video') {
      return VIDEO_FORMATS;
    }
    if (category === 'Ebook') {
      return EBOOK_FORMATS;
    }
    if (category === 'Dati') {
      return DATA_FORMATS;
    }
    if (category === 'Archivi') {
      return ARCHIVE_FORMATS;
    }
    if (category === 'Font') {
      return FONT_FORMATS;
    }
    return [];
  }

  get sourceAccept(): string | null {
    if (this.selectedSourceCategory === 'Immagini') {
      return this.imageAccept;
    }
    if (this.selectedSourceCategory === 'Documenti') {
      return this.documentAccept;
    }
    if (this.selectedSourceCategory === 'Fogli di calcolo') {
      return this.spreadsheetAccept;
    }
    if (this.selectedSourceCategory === 'Presentationi') {
      return this.presentationAccept;
    }
    if (this.selectedSourceCategory === 'Audio') {
      return this.audioAccept;
    }
    if (this.selectedSourceCategory === 'Video') {
      return this.videoAccept;
    }
    if (this.selectedSourceCategory === 'Ebook') {
      return this.ebookAccept;
    }
    if (this.selectedSourceCategory === 'Dati') {
      return this.dataAccept;
    }
    if (this.selectedSourceCategory === 'Archivi') {
      return this.archiveAccept;
    }
    if (this.selectedSourceCategory === 'Font') {
      return this.fontAccept;
    }
    return null;
  }

  selectSourceCategory(category: (typeof FILE_CATEGORIES)[number]): void {
    this.selectedSourceCategory = category;
    this.selectedDestinationCategory = null;
    this.selectedDestinationFormat = null;
    this.queuedFiles = [];
  }

  selectDestinationCategory(category: (typeof FILE_CATEGORIES)[number]): void {
    this.selectedDestinationCategory = category;
    this.selectedDestinationFormat = null;
  }

  selectDestinationFormat(format: string): void {
    this.selectedDestinationFormat = format;
  }

  async convertFiles(): Promise<void> {
    const destinationFormat = this.selectedDestinationFormat;
    const sourceCategory = this.selectedSourceCategory;
    if (!destinationFormat || !sourceCategory || this.queuedFiles.length === 0) {
      return;
    }

    let convertedCount = 0;
    for (const file of [...this.queuedFiles]) {
      try {
        const blob = await this.convertFile(file, sourceCategory, destinationFormat);
        this.downloadConvertedFile(file, destinationFormat, blob);
        convertedCount++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'errore non specificato';
        this.snackBar.open(
          `Impossibile convertire "${file.name}": ${reason}`,
          undefined,
          { duration: 5000, politeness: 'assertive' },
        );
      }
    }

    if (convertedCount > 0) {
      this.snackBar.open(
        convertedCount === 1
          ? 'File convertito e scaricato'
          : `${convertedCount} file convertiti e scaricati`,
        undefined,
        { duration: 3000, politeness: 'polite' },
      );
    }
  }

  updateQualityPercentage(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.qualityPercentage = target.valueAsNumber;
    }
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
  }

  onFileSelected(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      const file = input.files?.[0];
      if (file) {
        this.addFileToQueue(file);
      } else {
        this.showUploadAlert('Errore: Documento non caricato', 'assertive');
      }
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.addFileToQueue(file);
    } else {
      this.showUploadAlert('Errore: Documento non caricato', 'assertive');
    }
  }

  removeFileFromQueue(index: number): void {
    this.queuedFiles = this.queuedFiles.filter((_, fileIndex) => fileIndex !== index);
  }

  private addFileToQueue(file: File): void {
    if (!this.isSupportedFile(file)) {
      this.showUploadAlert(
        'Error: Stai tentando di caricare un file non supportato',
        'assertive',
      );
      return;
    }

    this.queuedFiles = [...this.queuedFiles, file];
    this.showUploadAlert('Documento caricato', 'polite');
  }

  private isSupportedFile(file: File): boolean {
    const extension = this.getFileFormat(file);
    const supportedFormats = this.sourceAccept
      ?.split(',')
      .map((format) => this.normalizeFormat(format.replace(/^\./, '')));

    return extension !== null && (supportedFormats?.includes(extension) ?? false);
  }

  private showUploadAlert(message: string, politeness: 'polite' | 'assertive'): void {
    this.snackBar.open(message, undefined, { duration: 3000, politeness });
  }

  private getFileFormat(file: File): string | null {
    const extensionStart = file.name.lastIndexOf('.');
    if (extensionStart < 0 || extensionStart === file.name.length - 1) {
      return null;
    }

    return this.normalizeFormat(file.name.slice(extensionStart + 1));
  }

  private normalizeFormat(format: string): string {
    const normalizedFormat = format.toUpperCase();
    switch (normalizedFormat) {
      case 'JPEG':
        return 'JPG';
      case 'TIF':
        return 'TIFF';
      case 'HTM':
        return 'HTML';
      case 'AIF':
        return 'AIFF';
      case 'YML':
        return 'YAML';
      default:
        return normalizedFormat;
    }
  }

  private async convertFile(
    file: File,
    category: (typeof FILE_CATEGORIES)[number],
    destinationFormat: string,
  ): Promise<Blob> {
    const sourceFormat = this.getFileFormat(file);
    if (!sourceFormat) {
      throw new Error('estensione del file non riconosciuta');
    }

    switch (category) {
      case 'Immagini':
        return this.convertImage(file, destinationFormat);
      case 'Documenti':
        return this.convertTextDocument(file, sourceFormat, destinationFormat);
      case 'Dati':
        return this.convertDataFile(file, sourceFormat, destinationFormat);
      default:
        throw new Error('questa conversione richiede un motore non disponibile nel browser');
    }
  }

  private async convertImage(file: File, destinationFormat: string): Promise<Blob> {
    const mimeType = this.getImageMimeType(destinationFormat);
    if (!mimeType) {
      throw new Error('il browser può esportare immagini solo in JPG, PNG o WEBP');
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('canvas non disponibile');
    }

    try {
      context.drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('errore durante la codifica'))),
        mimeType,
        this.qualityPercentage / 100,
      );
    });
    if (blob.type !== mimeType) {
      throw new Error(`il browser non supporta l'esportazione in ${destinationFormat}`);
    }
    return blob;
  }

  private async convertTextDocument(
    file: File,
    sourceFormat: string,
    destinationFormat: string,
  ): Promise<Blob> {
    if (!['TXT', 'MD', 'HTML'].includes(sourceFormat) ||
        !['TXT', 'MD', 'HTML'].includes(destinationFormat)) {
      throw new Error('nel browser sono convertibili solo TXT, MD e HTML');
    }

    const sourceText = await file.text();
    let convertedText = sourceText;
    if (destinationFormat === 'TXT') {
      convertedText = sourceFormat === 'HTML'
        ? new DOMParser().parseFromString(sourceText, 'text/html').body.textContent ?? ''
        : sourceFormat === 'MD' ? this.markdownToText(sourceText) : sourceText;
    } else if (destinationFormat === 'HTML') {
      convertedText = sourceFormat === 'MD'
        ? this.markdownToHtml(sourceText)
        : sourceFormat === 'TXT'
          ? `<pre>${this.escapeHtml(sourceText)}</pre>`
          : sourceText;
    } else if (sourceFormat === 'HTML') {
      convertedText = new DOMParser().parseFromString(sourceText, 'text/html').body.textContent ?? '';
    }

    const mimeType = destinationFormat === 'HTML' ? 'text/html' : 'text/plain';
    return new Blob([convertedText], { type: `${mimeType};charset=utf-8` });
  }

  private async convertDataFile(
    file: File,
    sourceFormat: string,
    destinationFormat: string,
  ): Promise<Blob> {
    const supportedFormats = ['JSON', 'XML', 'CSV', 'TSV'];
    if (!supportedFormats.includes(sourceFormat) || !supportedFormats.includes(destinationFormat)) {
      throw new Error('nel browser sono convertibili solo JSON, XML, CSV e TSV');
    }

    const sourceText = await file.text();
    const value = this.parseDataFile(sourceText, sourceFormat);
    const convertedText = this.serializeDataFile(value, destinationFormat);
    const mimeType = destinationFormat === 'JSON'
      ? 'application/json'
      : destinationFormat === 'XML'
        ? 'application/xml'
        : 'text/plain';
    return new Blob([convertedText], { type: `${mimeType};charset=utf-8` });
  }

  private parseDataFile(sourceText: string, format: string): unknown {
    if (format === 'JSON') {
      return JSON.parse(sourceText);
    }
    if (format === 'CSV' || format === 'TSV') {
      return this.parseDelimitedText(sourceText, format === 'TSV' ? '\t' : ',');
    }

    const document = new DOMParser().parseFromString(sourceText, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('il documento XML non è valido');
    }
    const root = document.documentElement;
    return { [root.nodeName]: this.xmlElementToValue(root) };
  }

  private serializeDataFile(value: unknown, format: string): string {
    if (format === 'JSON') {
      return JSON.stringify(value, null, 2);
    }
    if (format === 'XML') {
      return `<?xml version="1.0" encoding="UTF-8"?>\n${this.valueToXml('root', value)}`;
    }

    const rows = Array.isArray(value) ? value : [value];
    if (!rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
      throw new Error('CSV e TSV richiedono un oggetto o un array di oggetti');
    }
    const records = rows as Record<string, unknown>[];
    const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const delimiter = format === 'TSV' ? '\t' : ',';
    const quote = (cell: unknown): string => {
      const text = typeof cell === 'string' ? cell : JSON.stringify(cell) ?? '';
      return /[",\r\n\t]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
    };
    return [headers.map(quote).join(delimiter),
      ...records.map((record) => headers.map((header) => quote(record[header])).join(delimiter))]
      .join('\r\n');
  }

  private parseDelimitedText(text: string, delimiter: string): Record<string, string>[] {
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

    const headers = rows.shift() ?? [];
    return rows.filter((values) => values.some((value) => value !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  private xmlElementToValue(element: Element): unknown {
    if (element.children.length === 0) {
      return element.textContent ?? '';
    }
    const value: Record<string, unknown> = {};
    for (const child of Array.from(element.children)) {
      const childValue = this.xmlElementToValue(child);
      const current = value[child.nodeName];
      value[child.nodeName] = current === undefined
        ? childValue
        : Array.isArray(current) ? [...current, childValue] : [current, childValue];
    }
    return value;
  }

  private valueToXml(name: string, value: unknown): string {
    const tag = /^[A-Za-z_][\w.-]*$/.test(name) ? name : 'item';
    const escape = (text: string): string => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    if (Array.isArray(value)) {
      return value.map((item) => this.valueToXml(tag, item)).join('');
    }
    if (value !== null && typeof value === 'object') {
      const children = Object.entries(value)
        .map(([childName, childValue]) => this.valueToXml(childName, childValue))
        .join('');
      return `<${tag}>${children}</${tag}>`;
    }
    return `<${tag}>${escape(String(value ?? ''))}</${tag}>`;
  }

  private markdownToHtml(markdown: string): string {
    const paragraphs = markdown.split(/\r?\n\s*\r?\n/).map((paragraph) => {
      const heading = /^(#{1,6})\s+([\s\S]*)$/.exec(paragraph.trim());
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${this.escapeHtml(heading[2])}</h${level}>`;
      }
      return `<p>${this.escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`;
    });
    return paragraphs.join('\n');
  }

  private markdownToText(markdown: string): string {
    return markdown
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getImageMimeType(format: string): string | null {
    switch (this.normalizeFormat(format)) {
      case 'JPG':
        return 'image/jpeg';
      case 'PNG':
        return 'image/png';
      case 'WEBP':
        return 'image/webp';
      default:
        return null;
    }
  }

  private downloadConvertedFile(file: File, format: string, blob: Blob): void {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const extension = this.normalizeFormat(format).toLowerCase();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
