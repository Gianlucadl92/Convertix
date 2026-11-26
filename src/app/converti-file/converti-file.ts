import { ChangeDetectorRef, Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from '../material.module';
import { MatSliderThumb } from '@angular/material/slider';
import {
  convertArchive,
  convertAudio,
  convertDocument,
  convertFont,
  convertSpreadsheet,
  convertVideo,
} from './browser-converters';

const FILE_CATEGORIES = [
  'Immagini',
  'Documenti',
  'Fogli di calcolo',
  'Dati',
  'Audio',
  'Video',
  'Ebook',
  'Archivi',
  'Font',
] as const;

const IMAGE_SOURCE_FORMATS = ['JPG', 'PNG', 'WEBP', 'GIF', 'BMP', 'SVG', 'AVIF', 'ICO'];
const IMAGE_DESTINATION_FORMATS = ['JPG', 'PNG', 'WEBP'];
const DOCUMENT_SOURCE_FORMATS = ['TXT', 'HTML', 'MD', 'PDF', 'DOCX'];
const DOCUMENT_DESTINATION_FORMATS = ['TXT', 'HTML', 'MD', 'PDF', 'EPUB', 'PNG.ZIP'];
const SPREADSHEET_FORMATS = ['XLSX', 'ODS', 'CSV', 'TSV'];
const DATA_FORMATS = ['JSON', 'XML', 'CSV', 'TSV', 'YAML'];
const AUDIO_SOURCE_FORMATS = ['MP3', 'WAV', 'OGG', 'M4A', 'AAC', 'FLAC'];
const AUDIO_MIME_TYPES: Record<string, string> = {
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
  OGG: 'audio/ogg',
  M4A: 'audio/mp4',
  AAC: 'audio/aac',
  FLAC: 'audio/flac',
};
const VIDEO_SOURCE_FORMATS = ['MP4', 'WEBM', 'MOV', 'OGV'];
const VIDEO_MIME_TYPES: Record<string, string> = {
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  MOV: 'video/quicktime',
  OGV: 'video/ogg',
};
const VIDEO_DESTINATION_FORMATS = ['WEBM', 'MP4', 'JPG', 'PNG', 'WEBP'];
const EBOOK_SOURCE_FORMATS = ['EPUB'];
const EBOOK_DESTINATION_FORMATS = ['TXT', 'HTML', 'MD', 'PDF'];
const ARCHIVE_SOURCE_FORMATS = ['ZIP', '7Z', 'RAR', 'TAR', 'GZ', 'TGZ'];
const ARCHIVE_DESTINATION_FORMATS = ['ZIP', 'TAR.GZ'];
const FONT_SOURCE_FORMATS = ['TTF', 'OTF', 'WOFF', 'WOFF2'];
const FONT_DESTINATION_FORMATS = ['TTF', 'WOFF', 'WOFF2'];

@Component({
  imports: [MaterialModule, MatSliderThumb],
  selector: 'app-converti-file',
  styleUrl: './converti-file.css',
  templateUrl: './converti-file.html',
})
export class ConvertiFile {
  readonly categories = FILE_CATEGORIES;
  readonly imageAccept = '.jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,.avif,.ico';
  readonly documentAccept = '.txt,.html,.htm,.md,.pdf,.docx';
  readonly spreadsheetAccept = '.xlsx,.ods,.csv,.tsv';
  readonly dataAccept = '.json,.xml,.csv,.tsv,.yaml,.yml';
  readonly ebookAccept = '.epub';
  readonly archiveAccept = '.zip,.7z,.rar,.tar,.gz,.tgz';
  readonly fontAccept = '.ttf,.otf,.woff,.woff2';
  selectedSourceCategory: (typeof FILE_CATEGORIES)[number] | null = null;
  selectedDestinationFormat: string | null = null;
  queuedFiles: File[] = [];
  isDragging = false;
  qualityPercentage = 50;
  private readonly convertedFiles = new Map<File, Blob>();
  private readonly pendingFiles = new Set<File>();
  private readonly conversionPromises = new Map<File, Promise<Blob>>();
  private readonly failedFiles = new Set<File>();
  private conversionGeneration = 0;

  constructor(
    private readonly snackBar: MatSnackBar,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  get isConversionReady(): boolean {
    return (
      this.selectedSourceCategory !== null &&
      this.selectedDestinationFormat !== null &&
      this.queuedFiles.length > 0
    );
  }

  get showQualityControl(): boolean {
    const usesImageQuality =
      this.selectedDestinationFormat === 'JPG' || this.selectedDestinationFormat === 'WEBP';
    return (
      usesImageQuality &&
      (this.selectedSourceCategory === 'Immagini' || this.selectedSourceCategory === 'Video')
    );
  }

  get conversionHint(): string {
    switch (this.selectedSourceCategory) {
      case 'Documenti':
        return 'I PDF scansiti non includono testo estraibile; DOCX e PDF vengono convertiti mantenendo il contenuto, non tutta la formattazione. PNG.ZIP esporta tutte le pagine del PDF come immagini.';
      case 'Fogli di calcolo':
        return 'La conversione considera il primo foglio e i valori delle celle; formule, grafici e formattazione non vengono mantenuti.';
      case 'Dati':
        return 'CSV e TSV devono contenere intestazioni; YAML viene interpretato come dati strutturati.';
      case 'Audio':
        return 'L’uscita WAV è PCM non compresso. Sono proposti solo i codec audio dichiarati dal browser.';
      case 'Video':
        return 'JPG, PNG e WEBP estraggono il primo fotogramma. WEBM/MP4 registra il video in tempo reale se supportato.';
      case 'Ebook':
        return 'È supportato EPUB; le conversioni in testo, HTML, Markdown e PDF preservano il contenuto, non l’impaginazione originale.';
      case 'Archivi':
        return 'Gli archivi vengono ricomposti in ZIP o TAR.GZ. Le dimensioni di estrazione sono limitate per proteggere il browser.';
      case 'Font':
        return 'La conversione preserva i glifi supportati; OTF può essere convertito in TTF, WOFF o WOFF2.';
      default:
        return '';
    }
  }

  get totalQueuedSize(): number {
    return this.queuedFiles.reduce((total, file) => total + file.size, 0);
  }

  get totalOutputSize(): number | null {
    if (this.queuedFiles.length === 0) {
      return null;
    }

    if (!this.queuedFiles.every((file) => this.convertedFiles.has(file))) {
      return null;
    }

    return this.queuedFiles.reduce(
      (total, file) => total + (this.convertedFiles.get(file)?.size ?? 0),
      0,
    );
  }

  get hasConversionErrors(): boolean {
    return this.queuedFiles.some((file) => this.failedFiles.has(file));
  }

  getOutputSize(file: File): number | null {
    return this.convertedFiles.get(file)?.size ?? null;
  }

  getSavedSize(file: File): number | null {
    const outputSize = this.getOutputSize(file);
    return outputSize === null ? null : Math.max(0, file.size - outputSize);
  }

  getConversionStatus(file: File): string {
    return this.failedFiles.has(file) ? 'Non disponibile' : 'Calcolo...';
  }

  get supportedFormatsText(): string {
    let formats: string[];
    switch (this.selectedSourceCategory) {
      case 'Immagini':
        formats = IMAGE_SOURCE_FORMATS;
        break;
      case 'Documenti':
        formats = DOCUMENT_SOURCE_FORMATS;
        break;
      case 'Fogli di calcolo':
        formats = SPREADSHEET_FORMATS;
        break;
      case 'Dati':
        formats = DATA_FORMATS;
        break;
      case 'Audio':
        formats = this.supportedAudioSourceFormats;
        break;
      case 'Video':
        formats = this.supportedVideoSourceFormats;
        break;
      case 'Ebook':
        formats = EBOOK_SOURCE_FORMATS;
        break;
      case 'Archivi':
        formats = ARCHIVE_SOURCE_FORMATS;
        break;
      case 'Font':
        formats = FONT_SOURCE_FORMATS;
        break;
      default:
        formats = [];
    }

    const supportedFormats = formats.length > 0
      ? `${formats.join(', ')}. `
      : this.selectedSourceCategory === 'Video'
        ? 'Nessun formato video decodificabile è disponibile in questo browser. '
        : this.selectedSourceCategory === 'Audio'
          ? 'Nessun formato audio decodificabile è disponibile in questo browser. '
        : '';
    return `Formati supportati: ${supportedFormats}`;
  }

  get destinationFormats(): string[] {
    const candidates = this.getDestinationCandidates();
    const category = this.selectedSourceCategory;
    if (this.queuedFiles.length === 0 || !category) {
      return candidates;
    }

    return candidates.filter((destination) =>
      this.queuedFiles.every((file) =>
        this.canConvert(category, this.getFileFormat(file) ?? '', destination),
      ),
    );
  }

  get sourceAccept(): string | null {
    switch (this.selectedSourceCategory) {
      case 'Immagini':
        return this.imageAccept;
      case 'Documenti':
        return this.documentAccept;
      case 'Fogli di calcolo':
        return this.spreadsheetAccept;
      case 'Dati':
        return this.dataAccept;
      case 'Audio':
        return this.supportedAudioSourceFormats
          .map((format) => `.${format.toLowerCase()}`)
          .join(',');
      case 'Video':
        return this.supportedVideoSourceFormats
          .map((format) => `.${format.toLowerCase()}`)
          .join(',');
      case 'Ebook':
        return this.ebookAccept;
      case 'Archivi':
        return this.archiveAccept;
      case 'Font':
        return this.fontAccept;
      default:
        return null;
    }
  }

  selectSourceCategory(category: (typeof FILE_CATEGORIES)[number]): void {
    this.selectedSourceCategory = category;
    this.selectedDestinationFormat = null;
    this.queuedFiles = [];
    this.clearConversionState();
  }

  selectDestinationFormat(format: string): void {
    if (!this.destinationFormats.includes(format)) {
      return;
    }
    this.selectedDestinationFormat = format;
    this.clearConvertedFiles();
    this.prepareQueuedFiles();
  }

  async convertFiles(): Promise<void> {
    const destinationFormat = this.selectedDestinationFormat;
    const sourceCategory = this.selectedSourceCategory;
    if (!destinationFormat || !sourceCategory || this.queuedFiles.length === 0) {
      return;
    }

    let convertedCount = 0;
    for (const file of [...this.queuedFiles]) {
      if (await this.convertQueuedFile(file, destinationFormat)) {
        convertedCount++;
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
    if (target instanceof HTMLInputElement && Number.isFinite(target.valueAsNumber)) {
      if (target.valueAsNumber === this.qualityPercentage) {
        return;
      }
      this.qualityPercentage = target.valueAsNumber;
      this.clearConvertedFiles();
      this.prepareQueuedFiles();
      this.changeDetectorRef.markForCheck();
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
      const files = Array.from(input.files ?? []);
      if (files.length > 0) {
        this.addFiles(files);
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
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) {
      this.addFiles(files);
    } else {
      this.showUploadAlert('Errore: Documento non caricato', 'assertive');
    }
  }

  removeFileFromQueue(index: number): void {
    const removedFile = this.queuedFiles[index];
    this.queuedFiles = this.queuedFiles.filter((_, fileIndex) => fileIndex !== index);
    if (removedFile) {
      this.convertedFiles.delete(removedFile);
      this.pendingFiles.delete(removedFile);
      this.conversionPromises.delete(removedFile);
      this.failedFiles.delete(removedFile);
    }
    this.changeDetectorRef.markForCheck();
  }

  private addFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const supportedFiles = files.filter((file) => this.isSupportedFile(file));
    if (supportedFiles.length !== files.length) {
      this.showUploadAlert(
        'Error: Stai tentando di caricare uno o più file non supportati',
        'assertive',
      );
    }

    if (supportedFiles.length === 0) {
      return;
    }

    for (const file of supportedFiles) {
      this.addFileToQueue(file, false);
    }

    if (supportedFiles.length > 1) {
      this.showUploadAlert(
        `${supportedFiles.length} documenti caricati`,
        'polite',
      );
    }
  }

  private addFileToQueue(file: File, notify = true): void {
    if (!this.selectedSourceCategory) {
      this.showUploadAlert(
        'Attenzione: selezionare il tipo di file da convertire',
        'assertive',
      );
      return;
    }

    if (!this.isSupportedFile(file)) {
      this.showUploadAlert(
        'Error: Stai tentando di caricare un file non supportato',
        'assertive',
      );
      return;
    }

    const category = this.selectedSourceCategory;
    const selectedDestinationFormat = this.selectedDestinationFormat;
    const newQueue = [...this.queuedFiles, file];
    if (
      selectedDestinationFormat &&
      !newQueue.every((queuedFile) =>
        this.canConvert(
          category,
          this.getFileFormat(queuedFile) ?? '',
          selectedDestinationFormat,
        ),
      )
    ) {
      this.selectedDestinationFormat = null;
      this.clearConvertedFiles();
    }
    this.queuedFiles = newQueue;
    this.prepareQueuedFiles([file]);
    if (notify) {
      this.showUploadAlert('Documento caricato', 'polite');
    }
  }

  private getDestinationCandidates(): string[] {
    switch (this.selectedSourceCategory) {
      case 'Immagini':
        return IMAGE_DESTINATION_FORMATS;
      case 'Documenti':
        return DOCUMENT_DESTINATION_FORMATS;
      case 'Fogli di calcolo':
        return SPREADSHEET_FORMATS;
      case 'Dati':
        return DATA_FORMATS;
      case 'Audio':
        return typeof window !== 'undefined' &&
          typeof window.AudioContext === 'function' &&
          this.supportedAudioSourceFormats.length > 0
          ? ['WAV']
          : [];
      case 'Video':
        if (this.supportedVideoSourceFormats.length === 0) {
          return [];
        }
        return VIDEO_DESTINATION_FORMATS.filter((format) =>
          ['JPG', 'PNG', 'WEBP'].includes(format) || this.supportsVideoRecording(format),
        );
      case 'Ebook':
        return EBOOK_DESTINATION_FORMATS;
      case 'Archivi':
        return ARCHIVE_DESTINATION_FORMATS;
      case 'Font':
        return FONT_DESTINATION_FORMATS;
      default:
        return [];
    }
  }

  private canConvert(
    category: (typeof FILE_CATEGORIES)[number],
    sourceFormat: string,
    destinationFormat: string,
  ): boolean {
    switch (category) {
      case 'Immagini':
        return IMAGE_SOURCE_FORMATS.includes(sourceFormat) &&
          IMAGE_DESTINATION_FORMATS.includes(destinationFormat);
      case 'Documenti':
        return DOCUMENT_SOURCE_FORMATS.includes(sourceFormat) &&
          (destinationFormat === 'PNG.ZIP'
            ? sourceFormat === 'PDF'
            : DOCUMENT_DESTINATION_FORMATS.includes(destinationFormat) &&
              sourceFormat !== destinationFormat);
      case 'Fogli di calcolo':
        return SPREADSHEET_FORMATS.includes(sourceFormat) &&
          SPREADSHEET_FORMATS.includes(destinationFormat) &&
          sourceFormat !== destinationFormat;
      case 'Dati':
        return DATA_FORMATS.includes(sourceFormat) &&
          DATA_FORMATS.includes(destinationFormat) &&
          sourceFormat !== destinationFormat;
      case 'Audio':
        return AUDIO_SOURCE_FORMATS.includes(sourceFormat) && destinationFormat === 'WAV';
      case 'Video':
        return VIDEO_SOURCE_FORMATS.includes(sourceFormat) &&
          VIDEO_DESTINATION_FORMATS.includes(destinationFormat);
      case 'Ebook':
        return EBOOK_SOURCE_FORMATS.includes(sourceFormat) &&
          EBOOK_DESTINATION_FORMATS.includes(destinationFormat);
      case 'Archivi':
        return ARCHIVE_SOURCE_FORMATS.includes(sourceFormat) &&
          ARCHIVE_DESTINATION_FORMATS.includes(destinationFormat);
      case 'Font':
        return FONT_SOURCE_FORMATS.includes(sourceFormat) &&
          FONT_DESTINATION_FORMATS.includes(destinationFormat) &&
          sourceFormat !== destinationFormat;
      default:
        return false;
    }
  }

  private supportsVideoRecording(format: string): boolean {
    if (typeof MediaRecorder === 'undefined' || typeof HTMLVideoElement === 'undefined') {
      return false;
    }
    const videoPrototype = HTMLVideoElement.prototype as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const hasCaptureStream =
      typeof videoPrototype.captureStream === 'function' ||
      typeof videoPrototype.mozCaptureStream === 'function';
    const mimeTypes = format === 'MP4'
      ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return hasCaptureStream && mimeTypes.some((mimeType) => MediaRecorder.isTypeSupported(mimeType));
  }

  private get supportedAudioSourceFormats(): string[] {
    if (typeof document === 'undefined') {
      return [];
    }
    const audio = document.createElement('audio');
    return AUDIO_SOURCE_FORMATS.filter((format) =>
      audio.canPlayType(AUDIO_MIME_TYPES[format]) !== '',
    );
  }

  private get supportedVideoSourceFormats(): string[] {
    if (typeof document === 'undefined') {
      return [];
    }
    const video = document.createElement('video');
    return VIDEO_SOURCE_FORMATS.filter((format) =>
      video.canPlayType(VIDEO_MIME_TYPES[format]) !== '',
    );
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

  private clearConvertedFiles(): void {
    this.conversionGeneration++;
    this.convertedFiles.clear();
    this.pendingFiles.clear();
    this.conversionPromises.clear();
    this.failedFiles.clear();
  }

  private clearConversionState(): void {
    this.clearConvertedFiles();
    this.changeDetectorRef.markForCheck();
  }

  private prepareQueuedFiles(files: File[] = this.queuedFiles): void {
    const sourceCategory = this.selectedSourceCategory;
    const destinationFormat = this.selectedDestinationFormat;
    if (!sourceCategory || !destinationFormat) {
      return;
    }

    const generation = this.conversionGeneration;
    for (const file of files) {
      if (this.convertedFiles.has(file) || this.pendingFiles.has(file)) {
        continue;
      }
      if (sourceCategory === 'Video' && ['WEBM', 'MP4'].includes(destinationFormat)) {
        continue;
      }

      this.pendingFiles.add(file);
      const conversionPromise = this.convertFile(file, sourceCategory, destinationFormat)
        .then((blob) => {
          if (generation === this.conversionGeneration && this.queuedFiles.includes(file)) {
            this.convertedFiles.set(file, blob);
            this.changeDetectorRef.markForCheck();
          }
          return blob;
        })
        .catch((error: unknown) => {
          if (generation === this.conversionGeneration && this.queuedFiles.includes(file)) {
            this.failedFiles.add(file);
            this.changeDetectorRef.markForCheck();
          }
          throw error;
        })
        .finally(() => {
          if (generation === this.conversionGeneration) {
            this.pendingFiles.delete(file);
            this.conversionPromises.delete(file);
            this.changeDetectorRef.markForCheck();
          }
        });
      this.conversionPromises.set(file, conversionPromise);
    }
  }

  private async prepareAndWaitForFile(file: File): Promise<Blob> {
    const sourceCategory = this.selectedSourceCategory;
    const destinationFormat = this.selectedDestinationFormat;
    if (!sourceCategory || !destinationFormat) {
      throw new Error('seleziona un formato di destinazione');
    }
    if (sourceCategory === 'Video' && ['WEBM', 'MP4'].includes(destinationFormat)) {
      return this.convertFile(file, sourceCategory, destinationFormat);
    }

    this.prepareQueuedFiles([file]);
    const conversionPromise = this.conversionPromises.get(file);
    if (conversionPromise) {
      return conversionPromise;
    }
    const convertedFile = this.convertedFiles.get(file);
    if (convertedFile) {
      return convertedFile;
    }
    throw new Error('conversione non disponibile');
  }

  private async convertQueuedFile(
    file: File,
    destinationFormat: string,
  ): Promise<boolean> {
    try {
      let blob = this.convertedFiles.get(file);
      if (!blob) {
        const conversionPromise = this.conversionPromises.get(file);
        blob = conversionPromise
          ? await conversionPromise
          : await this.prepareAndWaitForFile(file);
      }
      this.downloadConvertedFile(file, destinationFormat, blob);
      this.convertedFiles.set(file, blob);
      this.changeDetectorRef.markForCheck();
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'errore non specificato';
      this.snackBar.open(
        `Impossibile convertire "${file.name}": ${reason}`,
        undefined,
        { duration: 5000, politeness: 'assertive' },
      );
      return false;
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
        if (
          ['TXT', 'MD', 'HTML'].includes(sourceFormat) &&
          ['TXT', 'MD', 'HTML'].includes(destinationFormat)
        ) {
          return this.convertTextDocument(file, sourceFormat, destinationFormat);
        }
        return convertDocument(file, sourceFormat, destinationFormat);
      case 'Fogli di calcolo':
        return convertSpreadsheet(file, sourceFormat, destinationFormat);
      case 'Dati':
        return this.convertDataFile(file, sourceFormat, destinationFormat);
      case 'Audio':
        return convertAudio(file);
      case 'Video':
        return convertVideo(file, destinationFormat, this.qualityPercentage);
      case 'Ebook':
        return convertDocument(file, sourceFormat, destinationFormat);
      case 'Archivi':
        return convertArchive(file, destinationFormat);
      case 'Font':
        return convertFont(file, sourceFormat, destinationFormat);
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
    const supportedFormats = ['JSON', 'XML', 'CSV', 'TSV', 'YAML'];
    if (!supportedFormats.includes(sourceFormat) || !supportedFormats.includes(destinationFormat)) {
      throw new Error('nel browser sono convertibili solo JSON, XML, CSV, TSV e YAML');
    }

    const sourceText = await file.text();
    const value = sourceFormat === 'YAML'
      ? (await import('yaml')).parse(sourceText)
      : this.parseDataFile(sourceText, sourceFormat);
    const convertedText = destinationFormat === 'YAML'
      ? (await import('yaml')).stringify(value)
      : this.serializeDataFile(value, destinationFormat);
    const mimeType = destinationFormat === 'JSON'
      ? 'application/json'
      : destinationFormat === 'XML'
        ? 'application/xml'
        : destinationFormat === 'YAML'
          ? 'application/yaml'
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
        ? `"${text.replaceAll('"', '""')}"`
        : text;
    };
    return [headers.map(quote).join(delimiter),
      ...records.map((record) => headers.map((header) => quote(record[header])).join(delimiter))]
      .join('\r\n');
  }

  private parseDelimitedText(text: string, delimiter: string): Record<string, string>[] {
    const state = {
      rows: [] as string[][],
      row: [] as string[],
      cell: '',
      quoted: false,
    };

    for (let index = 0; index < text.length; index++) {
      index = this.parseDelimitedCharacter(text, index, delimiter, state);
    }
    if (state.cell || state.row.length > 0) {
      state.row.push(state.cell);
      state.rows.push(state.row);
    }

    const headers = state.rows.shift() ?? [];
    return state.rows
      .filter((values) => values.some((value) => value !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  private parseDelimitedCharacter(
    text: string,
    index: number,
    delimiter: string,
    state: { rows: string[][]; row: string[]; cell: string; quoted: boolean },
  ): number {
    const character = text[index];
    if (character === '"') {
      if (state.quoted && text[index + 1] === '"') {
        state.cell += '"';
        return index + 1;
      }
      state.quoted = !state.quoted;
    } else if (character === delimiter && !state.quoted) {
      state.row.push(state.cell);
      state.cell = '';
    } else if ((character === '\n' || character === '\r') && !state.quoted) {
      if (character === '\r' && text[index + 1] === '\n') {
        index++;
      }
      state.row.push(state.cell);
      state.rows.push(state.row);
      state.row = [];
      state.cell = '';
    } else {
      state.cell += character;
    }
    return index;
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
      .replaceAll("&", '&amp;')
      .replaceAll("<", '&lt;')
      .replaceAll(">", '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
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
      .replaceAll("&", '&amp;')
      .replaceAll("<", '&lt;')
      .replaceAll(">", '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
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
