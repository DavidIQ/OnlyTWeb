import { Component, HostListener, OnInit, signal } from '@angular/core';
import { Translated } from './shared';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'onlyt.installBannerDismissed';

@Component({
  selector: 'app-install-banner',
  template: `
@if (visible()) {
  <div class="install-banner" role="region" [attr.aria-label]="t('install.title')">
    <div class="install-banner-text">
      <strong>{{ t('install.title') }}</strong>
      <span>{{ deferredPrompt ? t('install.body') : t('install.bodyIos') }}</span>
    </div>
    @if (deferredPrompt) {
      <button type="button" class="install-banner-action" (click)="install()">{{ t('install.action') }}</button>
    }
    <button type="button" class="install-banner-close" (click)="dismiss()" [attr.aria-label]="t('install.dismiss')">×</button>
  </div>
}
`,
})
export class InstallBanner extends Translated implements OnInit {
  protected readonly visible = signal(false);
  protected deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isIos = false;

  ngOnInit(): void {
    const ua = navigator.userAgent;
    this.isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    if (this.isIos) {
      this.refresh();
    }
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    this.deferredPrompt = event as BeforeInstallPromptEvent;
    this.refresh();
  }

  @HostListener('window:appinstalled')
  onInstalled(): void {
    this.deferredPrompt = null;
    this.visible.set(false);
  }

  async install(): Promise<void> {
    const prompt = this.deferredPrompt;
    if (!prompt) {
      return;
    }
    await prompt.prompt();
    await prompt.userChoice;
    this.deferredPrompt = null;
    this.visible.set(false);
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage may be unavailable; the banner just hides for this session.
    }
    this.visible.set(false);
  }

  private refresh(): void {
    this.visible.set(this.isMobile() && !this.isStandalone() && !this.wasDismissed());
  }

  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches;
  }

  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private wasDismissed(): boolean {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
