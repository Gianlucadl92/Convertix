import { ChangeDetectorRef, Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSliderThumb } from '@angular/material/slider';
import { MaterialModule } from '../material.module';

@Component({
  imports: [MaterialModule, MatSliderThumb],
  selector: 'app-riduci-peso-immagine',
  styleUrl: './riduci-peso-immagine.css',
  templateUrl: './riduci-peso-immagine.html',
})
export class RiduciPesoImmagine {
  readonly imageAccept =
    '.jpg,.jpeg,.png,.webp';
  readonly supportedFormatsText =
    'Formati supportati: JPG, PNG, WEBP.';

  queuedFiles: File[] = [];
  isDragging = false;
  qualityPercentage = 50;
  private readonly compressedFiles = new Map<File, Blob>();
  private readonly pendingFiles = new Set<File>();
  private readonly compressionPromises = new Map<File, Promise<Blob>>();
  private readonly failedFiles = new Set<File>();
  private compressionGeneration = 0;

  constructor(
    private readonly snackBar: MatSnackBar,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  get isReductionReady(): boolean {
    return this.queuedFiles.length > 0;
  }

  get hasCompressionErrors(): boolean {
    return this.queuedFiles.some((file) => this.failedFiles.has(file));
  }

  get totalQueuedSize(): number {
    return this.queuedFiles.reduce((total, file) => total + file.size, 0);
  }

  get totalOutputSize(): number | null {
    if (this.queuedFiles.length === 0) {
      return null;
    }

    if (!this.queuedFiles.every((file) => this.compressedFiles.has(file))) {
      return null;
    }

    return this.queuedFiles.reduce(
      (total, file) => total + (this.compressedFiles.get(file)?.size ?? 0),
      0,
    );
  }

  getOutputSize(file: File): number | null {
    return this.compressedFiles.get(file)?.size ?? null;
  }

  getSavedSize(file: File): number | null {
    const outputSize = this.getOutputSize(file);
    return outputSize === null ? null : Math.max(0, file.size - outputSize);
  }

  getCompressionStatus(file: File): string {
    return this.failedFiles.has(file) ? 'Non disponibile' : 'Calcolo...';
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

    return `${new Intl.NumberFormat('it-IT', {
      maximumFractionDigits: 1,
    }).format(value)} ${units[unitIndex]}`;
  }

  updateQualityPercentage(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement && Number.isFinite(target.valueAsNumber)) {
      if (target.valueAsNumber === this.qualityPercentage) {
        return;
      }

      this.qualityPercentage = target.valueAsNumber;
      this.compressionGeneration++;
      this.compressedFiles.clear();
      this.pendingFiles.clear();
      this.compressionPromises.clear();
      this.failedFiles.clear();
      this.prepareQueuedFiles();
      this.changeDetectorRef.markForCheck();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.addFiles(Array.from(input.files ?? []));
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
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  removeFileFromQueue(index: number): void {
    const removedFile = this.queuedFiles[index];
    this.queuedFiles = this.queuedFiles.filter((_, fileIndex) => fileIndex !== index);
    if (removedFile && !this.queuedFiles.includes(removedFile)) {
      this.compressedFiles.delete(removedFile);
      this.pendingFiles.delete(removedFile);
      this.compressionPromises.delete(removedFile);
      this.failedFiles.delete(removedFile);
    }
    this.changeDetectorRef.markForCheck();
  }

  async reduceFiles(): Promise<void> {
    if (this.queuedFiles.length === 0) {
      return;
    }

    let convertedCount = 0;
    for (const file of [...this.queuedFiles]) {
      try {
        let compressedFile = this.compressedFiles.get(file);
        if (!compressedFile) {
          const compressionPromise = this.compressionPromises.get(file);
          if (compressionPromise) {
            compressedFile = await compressionPromise;
          } else {
            await this.prepareAndWaitForFile(file);
            compressedFile = this.compressedFiles.get(file);
          }
        }
        if (!compressedFile) {
          throw new Error('Immagine compressa non disponibile');
        }
        this.downloadCompressedFile(file, compressedFile);
        this.removeFileFromQueue(this.queuedFiles.indexOf(file));
        convertedCount++;
      } catch {
        this.snackBar.open(
          `Impossibile ridurre "${file.name}"`,
          undefined,
          { duration: 3000, politeness: 'assertive' },
        );
      }
    }

    if (convertedCount > 0) {
      this.snackBar.open(
        convertedCount === 1
          ? 'Immagine ridotta e scaricata'
          : `${convertedCount} immagini ridotte e scaricate`,
        undefined,
        { duration: 3000, politeness: 'polite' },
      );
    }
  }

  private addFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter((file) => this.isSupportedImage(file));
    const hasUnsupportedFiles = imageFiles.length !== files.length;
    if (hasUnsupportedFiles) {
      this.snackBar.open(
        'Error: Stai tentando di caricare un file non supportato',
        undefined,
        { duration: 3000, politeness: 'assertive' },
      );
    }

    if (imageFiles.length === 0) {
      return;
    }

    this.queuedFiles = [...this.queuedFiles, ...imageFiles];
    this.prepareQueuedFiles(imageFiles);
    this.changeDetectorRef.markForCheck();
    if (!hasUnsupportedFiles) {
      this.snackBar.open(
        imageFiles.length === 1
          ? 'Immagine caricata'
          : `${imageFiles.length} immagini caricate`,
        undefined,
        { duration: 3000, politeness: 'polite' },
      );
    }
  }

  private isSupportedImage(file: File): boolean {
    const extension = file.name.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '');
  }

  private prepareQueuedFiles(files: File[] = this.queuedFiles): void {
    const generation = this.compressionGeneration;
    for (const file of files) {
      if (this.compressedFiles.has(file) || this.pendingFiles.has(file)) {
        continue;
      }

      this.pendingFiles.add(file);
      const compressionPromise = this.createCompressedFile(file)
        .then((compressedFile) => {
          if (generation === this.compressionGeneration && this.queuedFiles.includes(file)) {
            this.compressedFiles.set(file, compressedFile);
            this.changeDetectorRef.markForCheck();
          }
          return compressedFile;
        })
        .catch(() => {
          if (generation === this.compressionGeneration && this.queuedFiles.includes(file)) {
            this.failedFiles.add(file);
            this.changeDetectorRef.markForCheck();
            this.snackBar.open(
              `Impossibile preparare "${file.name}"`,
              undefined,
              { duration: 3000, politeness: 'assertive' },
            );
          }
          throw new Error(`Impossibile preparare "${file.name}"`);
        })
        .finally(() => {
          if (generation === this.compressionGeneration) {
            this.pendingFiles.delete(file);
            this.compressionPromises.delete(file);
            this.changeDetectorRef.markForCheck();
          }
        });
      this.compressionPromises.set(file, compressionPromise);
    }
  }

  private async prepareAndWaitForFile(file: File): Promise<void> {
    this.prepareQueuedFiles([file]);
    const compressionPromise = this.compressionPromises.get(file);
    if (!compressionPromise) {
      return;
    }

    try {
      await compressionPromise;
    } catch {
      // L'errore viene mostrato dal flusso di preparazione e dalla singola immagine.
    }
  }

  private async createCompressedFile(file: File): Promise<Blob> {
    const mimeType = this.getMimeType(file);
    if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new Error('Formato non elaborabile dal browser');
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('Canvas non disponibile');
    }

    try {
      context.drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Errore conversione'))),
        mimeType,
        this.qualityPercentage / 100,
      );
    });

    if (blob.type !== mimeType) {
      throw new Error('Formato di output non supportato dal browser');
    }
    return blob;
  }

  private downloadCompressedFile(file: File, blob: Blob): void {
    const extension = this.getExtension(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}-ridotta.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private getMimeType(file: File): string | null {
    if (file.type) {
      return file.type;
    }

    const extension = this.getExtension(file);
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return null;
    }
  }

  private getExtension(file: File): string {
    const extension = file.name.toLowerCase().split('.').pop();
    return extension === 'jpeg' ? 'jpg' : (extension ?? '');
  }
}
