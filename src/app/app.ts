import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, MeetingSettingsChanges, MidweekOptions, SchedulePreviewItem, SettingsData, TimerInfo, TimerStatus } from './api.service';
import { TranslationKey } from './i18n';
import { I18nService } from './i18n.service';
import { buildReportEmail } from './report-html';

const LAST_MINUTE_SECONDS = 60;
const COUNSEL_ALLOWED_SECONDS = 60;

type MeetingKind = 'midweek' | 'weekend';

interface ProgressRow {
  counsel: boolean;
  heading: { key: string; text: string } | null;
  theme: string;
  state: 'done' | 'running' | 'pending';
  title: string;
  duration: number;
  times: string;
  remaining: number | null;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  timerInfo: TimerInfo[] = [];
  status: TimerStatus | null = null;
  settings: SettingsData | null = null;
  selectedTalkId: number | null = null;
  readonly isDisplayMode = window.location.pathname === '/display';
  readonly isProgressMode = window.location.pathname === '/progress';
  currentTime = new Date();
  errorMessage: TranslationKey | '' = '';
  loading = true;
  setupOptions: MidweekOptions = { isCircuitVisit: false };
  previewItems: SchedulePreviewItem[] = [];
  previewFailed = false;
  importing = false;
  scheduleLoaded = false;
  showSettings = false;
  settingsDraft: MeetingSettingsChanges | null = null;
  settingsError: TranslationKey | '' = '';
  toastVisible = false;
  toastText: TranslationKey = 'settings.saved';
  showReport = false;
  reportFrom = '';
  reportRecipients = '';
  reportError: TranslationKey | '' = '';
  sendingReport = false;
  authenticated: boolean | null = null;
  pinValue = '';
  pinError: TranslationKey | '' = '';
  pinBusy = false;
  savingSettings = false;
  private toastHandle: number | undefined;
  private refreshHandle: number | undefined;
  private clockHandle: number | undefined;
  private previewRequest = 0;
  private readonly storageListener = (): void => {
    if (!this.isProgressMode && this.i18n.syncFromStorage()) {
      this.changeDetector.markForCheck();
    }
  };

  constructor(
    private readonly api: ApiService,
    private readonly changeDetector: ChangeDetectorRef,
    readonly i18n: I18nService,
  ) {}

  ngOnInit(): void {
    window.addEventListener('storage', this.storageListener);
    if (this.isDisplayMode || this.isProgressMode) {
      this.authenticated = true;
    } else {
      void this.checkAuth();
    }
    void this.refresh();
    this.refreshHandle = window.setInterval(() => void this.refresh(), 1000);
    if (this.isDisplayMode) {
      this.clockHandle = window.setInterval(() => {
        this.currentTime = new Date();
        this.changeDetector.markForCheck();
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.storageListener);
    if (this.refreshHandle !== undefined) {
      window.clearInterval(this.refreshHandle);
    }
    if (this.clockHandle !== undefined) {
      window.clearInterval(this.clockHandle);
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  onLanguageChange(code: string): void {
    // On the progress page the choice only lasts for this visit.
    this.i18n.setLanguage(code, !this.isProgressMode);
    this.changeDetector.markForCheck();
  }

  talkTitle(talk: { talkKey: string; talkTitle: string }): string {
    const key = `talk.${talk.talkKey}`;
    return this.i18n.has(key) ? this.t(key) : talk.talkTitle;
  }

  sectionName(sectionInternal: string): string {
    const key = `section.${sectionInternal.toLowerCase()}`;
    return this.i18n.has(key) ? this.t(key) : sectionInternal;
  }

  // The progress page uses the full workbook headings rather than the short section labels.
  private progressSectionName(sectionInternal: string): string {
    const key = `progress.section.${sectionInternal.toLowerCase()}`;
    return this.i18n.has(key) ? this.t(key) : this.sectionName(sectionInternal);
  }

  // Mid-week parts take their section's colour; each weekend part has its own colour and glyph.
  private progressTheme(item: TimerInfo): string {
    if (item.meeting === 'midweek') {
      return item.meetingSectionNameInternal.toLowerCase();
    }
    const weekendThemes: Record<string, string> = { publicTalk: 'public', watchtower: 'watchtower', concludingCo: 'concludingco' };
    return weekendThemes[item.talkKey] ?? '';
  }

  get hasMidweekSchedule(): boolean {
    return this.timerInfo.some((talk) => talk.meeting === 'midweek');
  }

  get showSetup(): boolean {
    return this.scheduleLoaded && !this.hasMidweekSchedule && !this.isDisplayMode && !this.isProgressMode;
  }

  get clockText(): string {
    return this.formatClock(this.currentTime.getTime() / 1000, false);
  }

  // A running timer's meeting wins, then the meeting used most recently, otherwise today's meeting.
  get activeMeeting(): MeetingKind {
    const running = this.timerInfo.find((talk) => talk.talkId === this.status?.talkId);
    if (this.isRunning && running) {
      return running.meeting as MeetingKind;
    }
    // A meeting with timings recorded in the last 12 hours stays in view even on the other meeting's day.
    const cutoff = Date.now() / 1000 - 12 * 3600;
    const latest = this.timerInfo.reduce<TimerInfo | null>(
      (best, talk) => (talk.startTime !== null && talk.startTime > cutoff && (!best || talk.startTime > (best.startTime ?? 0)) ? talk : best),
      null,
    );
    if (latest) {
      return latest.meeting as MeetingKind;
    }
    return this.settings && new Date().getDay() === this.settings.weekendDay ? 'weekend' : 'midweek';
  }

  get visibleTimers(): TimerInfo[] {
    return this.timerInfo.filter((talk) => talk.meeting === this.activeMeeting);
  }

  get meetingTimes(): string {
    if (!this.settings) {
      return '';
    }
    const weekend = this.activeMeeting === 'weekend';
    const start = weekend ? this.settings.weekendStart : this.settings.midweekStart;
    const end = weekend ? this.settings.weekendEnd : this.settings.midweekEnd;
    return `${this.formatClockTime(start)} – ${this.formatClockTime(end)}`;
  }

  get weekdayOptions(): { value: number; name: string }[] {
    const formatter = new Intl.DateTimeFormat(this.i18n.language, { weekday: 'long' });
    // 2024-01-07 was a Sunday, matching Date.getDay() numbering.
    return Array.from({ length: 7 }, (_, value) => ({
      value,
      name: formatter.format(new Date(2024, 0, 7 + value)),
    }));
  }

  async checkAuth(): Promise<void> {
    try {
      this.authenticated = (await this.api.getAuth()).authenticated;
    } catch {
      this.authenticated = false;
    }
    if (this.authenticated) {
      void this.loadPreview();
    }
    this.changeDetector.markForCheck();
  }

  async submitPin(): Promise<void> {
    if (this.pinValue.length !== 4 || this.pinBusy) {
      return;
    }
    this.pinBusy = true;
    this.pinError = '';
    try {
      await this.api.login(this.pinValue);
      this.authenticated = true;
      this.pinValue = '';
      void this.loadPreview();
    } catch (error) {
      this.pinError = error instanceof HttpErrorResponse && error.status === 429 ? 'error.pin_locked' : 'error.invalid_pin';
      this.pinValue = '';
    } finally {
      this.pinBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  openSettings(): void {
    if (!this.settings) {
      return;
    }
    const { midweekStart, midweekEnd, weekendDay, weekendStart, weekendEnd, adaptiveMode } = this.settings;
    this.settingsDraft = { midweekStart, midweekEnd, weekendDay, weekendStart, weekendEnd, adaptiveMode };
    this.settingsError = '';
    this.showSettings = true;
  }

  cancelSettings(): void {
    this.showSettings = false;
    this.settingsDraft = null;
    this.settingsError = '';
  }

  async saveSettings(): Promise<void> {
    const draft = this.settingsDraft;
    if (!draft || this.savingSettings) {
      return;
    }
    this.savingSettings = true;
    this.settingsError = '';
    try {
      this.settings = await this.api.updateSettings(draft);
      this.showSettings = false;
      this.settingsDraft = null;
      this.errorMessage = '';
      this.showToast('settings.saved');
      await this.refresh();
    } catch (error) {
      this.settingsError = this.errorText(error);
    } finally {
      this.savingSettings = false;
      this.changeDetector.markForCheck();
    }
  }

  async openReport(): Promise<void> {
    this.reportError = '';
    this.reportFrom = `MeetingReport@${window.location.hostname}`;
    this.reportRecipients = '';
    this.showReport = true;
    try {
      const info = await this.api.getReportInfo();
      this.reportFrom = info.from;
      this.reportRecipients = info.recipients.join(', ');
    } catch {
      // The form still works without saved recipients.
    }
    this.changeDetector.markForCheck();
  }

  closeReport(): void {
    this.showReport = false;
    this.reportError = '';
  }

  async sendReport(preview: HTMLElement): Promise<void> {
    if (this.sendingReport) {
      return;
    }
    const recipients = this.reportRecipients
      .split(/[,;\s]+/)
      .map((address) => address.trim())
      .filter((address) => address !== '');
    const valid = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
    if (recipients.length === 0 || recipients.some((address) => !valid.test(address))) {
      this.reportError = 'error.invalid_recipients';
      return;
    }
    this.sendingReport = true;
    this.reportError = '';
    try {
      const report = await buildReportEmail(preview);
      const title = this.i18n.t(this.activeMeeting === 'weekend' ? 'progress.titleWeekend' : 'progress.titleMidweek');
      await this.api.sendReport({ recipients, subject: title, html: report.html, images: report.images });
      this.showReport = false;
      this.showToast('report.sent');
    } catch (error) {
      this.reportError = this.errorText(error);
    } finally {
      this.sendingReport = false;
      this.changeDetector.markForCheck();
    }
  }

  private showToast(text: TranslationKey): void {
    this.toastText = text;
    window.clearTimeout(this.toastHandle);
    this.toastVisible = true;
    this.toastHandle = window.setTimeout(() => {
      this.toastVisible = false;
      this.changeDetector.markForCheck();
    }, 3000);
  }

  async updateSetting(changes: MeetingSettingsChanges): Promise<void> {
    if (!this.settings) {
      return;
    }
    const previous = this.settings;
    this.settings = { ...previous, ...changes };
    this.savingSettings = true;
    try {
      this.settings = await this.api.updateSettings(changes);
      await this.refresh();
    } catch (error) {
      this.settings = previous;
      this.errorMessage = this.errorText(error);
    } finally {
      this.savingSettings = false;
      this.changeDetector.markForCheck();
    }
  }

  async removeTalk(talk: TimerInfo): Promise<void> {
    if (this.isRunning) {
      return;
    }
    if (!window.confirm(this.t('schedule.confirmRemove', { title: this.talkTitle(talk) }))) {
      return;
    }
    await this.runAction(() => this.api.deleteTalk(talk.talkId));
  }

  private formatClockTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(2024, 0, 1, hours, minutes));
  }

  // Mirrors the Windows timing report, but lists every part of the meeting in schedule order:
  // finished parts show their actual time, the running part ticks live, and the rest show their
  // planned length. Counsel time is inferred from the gap after each finished student talk.
  get progressRows(): ProgressRow[] {
    const items = this.visibleTimers;
    const runningId = this.isRunning ? this.status?.talkId : null;
    const hasRun = (item: TimerInfo): boolean => item.startTime !== null && item.endTime !== null && item.endTime - item.startTime > 20;
    const rows: ProgressRow[] = [];
    items.forEach((item, index) => {
      const title = this.talkTitle(item);
      // Only the mid-week meeting is split into sections; the weekend has a single run of parts.
      const heading =
        item.meeting === 'midweek' && item.meetingSectionNameInternal !== items[index - 1]?.meetingSectionNameInternal
          ? { key: item.meetingSectionNameInternal.toLowerCase(), text: this.progressSectionName(item.meetingSectionNameInternal) }
          : null;
      const theme = this.progressTheme(item);
      if (item.talkId === runningId) {
        rows.push({
          counsel: false,
          heading,
          theme,
          state: 'running',
          title,
          duration: this.elapsedSeconds,
          times: item.startTime === null ? '' : `(${this.formatClock(item.startTime)} - )`,
          remaining: item.actualDurationSecs - this.elapsedSeconds,
        });
        return;
      }
      if (!hasRun(item)) {
        rows.push({ counsel: false, heading, theme, state: 'pending', title, duration: item.actualDurationSecs, times: '', remaining: null });
        return;
      }

      const start = item.startTime as number;
      const end = item.endTime as number;
      rows.push({
        counsel: false,
        heading,
        theme,
        state: 'done',
        title,
        duration: Math.round(end - start),
        times: `(${this.formatClock(start)} - ${this.formatClock(end)})`,
        remaining: item.actualDurationSecs - Math.round(end - start),
      });
      const next = items[index + 1];
      if (item.talkKey.startsWith('ministry') && next && next.startTime !== null && next.startTime >= end && (hasRun(next) || next.talkId === runningId)) {
        const counsel = this.normaliseCounsel(next.startTime - end);
        rows.push({
          counsel: true,
          heading: null,
          theme: '',
          state: 'done',
          title: this.t('progress.counsel'),
          duration: counsel,
          times: '',
          remaining: COUNSEL_ALLOWED_SECONDS - counsel,
        });
      }
    });
    return rows;
  }

  formatRemaining(remaining: number): string {
    const prefix = remaining === 0 ? '' : remaining > 0 ? '- ' : '+ ';
    const absolute = Math.abs(remaining);
    return `${prefix}${String(Math.floor(absolute / 60) % 60).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  }

  private normaliseCounsel(gapSeconds: number): number {
    let counsel = Math.max(0, gapSeconds);
    const reduced = counsel - 20;
    if (reduced > 5) {
      counsel = reduced;
    }
    return Math.ceil(counsel / 5) * 5;
  }

  private formatClock(epochSeconds: number, withPeriod = true): string {
    const formatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
    const date = new Date(epochSeconds * 1000);
    if (withPeriod) {
      return formatter.format(date);
    }
    return formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'dayPeriod')
      .map((part) => part.value)
      .join('')
      .trim();
  }

  get previewTotalSeconds(): number {
    return this.previewItems.reduce((total, item) => total + item.originalDurationSecs, 0);
  }

  async loadPreview(): Promise<void> {
    const request = ++this.previewRequest;
    try {
      const preview = await this.api.getMidweekPreview(this.setupOptions);
      if (request === this.previewRequest) {
        this.previewItems = preview.items;
        this.previewFailed = false;
      }
    } catch {
      if (request === this.previewRequest) {
        this.previewFailed = true;
      }
    }
    this.changeDetector.markForCheck();
  }

  async importMidweek(): Promise<void> {
    this.importing = true;
    this.changeDetector.markForCheck();
    try {
      await this.api.importMidweek(this.setupOptions);
      await this.refresh();
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.importing = false;
      this.changeDetector.markForCheck();
    }
  }

  get selectedTalk(): TimerInfo | undefined {
    return this.timerInfo.find((talk) => talk.talkId === this.selectedTalkId);
  }

  get isRunning(): boolean {
    return this.status?.isRunning ?? false;
  }

  get elapsedSeconds(): number {
    return this.status?.elapsedSeconds ?? 0;
  }

  get actualDurationSeconds(): number {
    return this.selectedTalk?.actualDurationSecs ?? 0;
  }

  get displayedSeconds(): number {
    if (this.selectedTalk?.countUp) {
      return this.elapsedSeconds;
    }
    if (this.isOvertime) {
      return this.elapsedSeconds - this.actualDurationSeconds;
    }
    return this.actualDurationSeconds - this.elapsedSeconds;
  }

  get isOvertime(): boolean {
    return this.isRunning && this.elapsedSeconds >= this.actualDurationSeconds;
  }

  get isClosing(): boolean {
    return (
      this.isRunning &&
      !this.isOvertime &&
      this.actualDurationSeconds - this.elapsedSeconds <= LAST_MINUTE_SECONDS
    );
  }

  get progressPercent(): number {
    if (this.actualDurationSeconds <= 0) {
      return 0;
    }
    return Math.min(100, (this.elapsedSeconds / this.actualDurationSeconds) * 100);
  }

  async refresh(): Promise<void> {
    try {
      const [timers, settings] = await Promise.all([
        this.api.getTimers(),
        this.api.getSettings(),
      ]);
      this.timerInfo = timers.timerInfo;
      this.status = timers.status;
      if (!this.savingSettings) {
        this.settings = settings;
      }
      this.scheduleLoaded = true;

      const runningTalkId = timers.status.talkId;
      const visible = this.visibleTimers;
      if (runningTalkId !== null) {
        this.selectedTalkId = runningTalkId;
      } else if (
        this.selectedTalkId === null ||
        !visible.some((talk) => talk.talkId === this.selectedTalkId)
      ) {
        this.selectedTalkId = visible[0]?.talkId ?? null;
      }

      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = this.errorText(error);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  selectTalk(talkId: number): void {
    if (!this.isRunning) {
      this.selectedTalkId = talkId;
    }
  }

  async startTimer(): Promise<void> {
    const talkId = this.selectedTalkId;
    if (talkId === null) {
      return;
    }
    await this.runAction(() => this.api.startTimer(talkId));
  }

  async stopTimer(): Promise<void> {
    const talkId = this.status?.talkId;
    if (talkId === null || talkId === undefined) {
      return;
    }
    await this.runAction(() => this.api.stopTimer(talkId));
    const visible = this.visibleTimers;
    const currentIndex = visible.findIndex((talk) => talk.talkId === talkId);
    const nextTalk = visible[currentIndex + 1];
    this.selectedTalkId = nextTalk?.talkId ?? visible[0]?.talkId ?? null;
    this.changeDetector.markForCheck();
  }

  async adjustDuration(deltaSeconds: number): Promise<void> {
    const talk = this.selectedTalk;
    if (!talk || this.isRunning) {
      return;
    }
    const newDuration = Math.max(0, talk.actualDurationSecs + deltaSeconds);
    await this.updateTalk({ actualDurationSecs: newDuration });
  }

  async toggleCountUp(): Promise<void> {
    if (!this.selectedTalk || this.isRunning || !this.settings?.allowCountUpToggle) {
      return;
    }
    await this.updateTalk({ countUp: !this.selectedTalk.countUp });
  }

  formatTimer(seconds: number): string {
    const absoluteSeconds = Math.abs(Math.trunc(seconds));
    const minutes = Math.floor(absoluteSeconds / 60);
    const remainingSeconds = absoluteSeconds % 60;
    return `${seconds < 0 ? '-' : ''}${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  trackTalk(_index: number, talk: TimerInfo): number {
    return talk.talkId;
  }

  private async updateTalk(changes: {
    actualDurationSecs?: number;
    countUp?: boolean;
  }): Promise<void> {
    const talkId = this.selectedTalkId;
    if (talkId === null) {
      return;
    }
    await this.runAction(() => this.api.updateTimer(talkId, changes));
  }

  private async runAction(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      await this.refresh();
    } catch (error) {
      this.errorMessage = this.errorText(error);
      this.changeDetector.markForCheck();
    }
  }

  private errorText(error: unknown): TranslationKey {
    if (error instanceof HttpErrorResponse) {
      if (error.error?.code === 'auth_required') {
        this.authenticated = false;
      }
      const key = `error.${String(error.error?.code)}`;
      if (this.i18n.has(key)) {
        return key;
      }
    }
    return 'error.generic';
  }
}
