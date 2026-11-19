import { Component, HostListener, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MaterialModule } from './material.module';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MaterialModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('Convertix');
  private installPrompt: BeforeInstallPromptEvent | null = null;

  ngOnInit(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Unable to register the Convertix service worker.', error);
      });
    }
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    this.installPrompt = installEvent;
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.installPrompt = null;
  }

  async downloadApp(): Promise<void> {
    if (!this.installPrompt) {
      window.alert(
        'Per installare Convertix, usa il menu del browser e scegli "Aggiungi alla schermata home" o "Installa app".'
      );
      return;
    }

    await this.installPrompt.prompt();
    await this.installPrompt.userChoice;
    this.installPrompt = null;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}
