import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface TimerInfo {
  talkId: number;
  meeting: string;
  talkKey: string;
  talkTitle: string;
  meetingSectionNameInternal: string;
  meetingSectionNameLocalised: string;
  originalDurationSecs: number;
  modifiedDurationSecs: number | null;
  adaptedDurationSecs: number | null;
  actualDurationSecs: number;
  completedTimeSecs: number | null;
  countUp: boolean;
  closingSecs: number;
  startTime: number | null;
  endTime: number | null;
}

export interface TimerStatus {
  talkId: number | null;
  targetSeconds: number;
  isRunning: boolean;
  timeElapsed: string;
  elapsedSeconds: number;
  elapsedPrecise?: number;
  closingSecs: number;
}

export interface TimersResponse {
  status: TimerStatus;
  timerInfo: TimerInfo[];
}

export type AdaptiveMode = 'none' | 'oneWay' | 'twoWay';

export interface SettingsData {
  countUpByDefault: boolean;
  allowCountUpToggle: boolean;
  circuitVisit: boolean;
  congregationLanguage: 'en' | 'es' | 'pt' | 'fr' | 'it';
  midweekStart: string;
  midweekEnd: string;
  weekendDay: number;
  weekendStart: string;
  weekendEnd: string;
  adaptiveMode: AdaptiveMode;
}

export type MeetingSettingsChanges = Partial<
  Pick<SettingsData, 'circuitVisit' | 'congregationLanguage' | 'midweekStart' | 'midweekEnd' | 'weekendDay' | 'weekendStart' | 'weekendEnd' | 'adaptiveMode'>
>;

export interface ReportInfo {
  from: string;
  recipients: string[];
}

export interface ReportImage {
  cid: string;
  data: string;
}

export interface ReportEmail {
  recipients: string[];
  subject: string;
  html: string;
  images: ReportImage[];
}

export interface MidweekOptions {
  isCircuitVisit: boolean;
}

export interface SchedulePreviewItem {
  talkId: number;
  talkKey: string;
  talkTitle: string;
  meetingSectionNameInternal: string;
  originalDurationSecs: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Relative to <base href>, so the API is found wherever the app is hosted.
  private readonly baseUrl = 'api/v1';

  constructor(private readonly http: HttpClient) {}

  getAuth(): Promise<{ authenticated: boolean }> {
    return firstValueFrom(this.http.get<{ authenticated: boolean }>(`${this.baseUrl}/auth`));
  }

  login(pin: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/auth`, { pin }));
  }

  getMidweekPreview(options: MidweekOptions): Promise<{ items: SchedulePreviewItem[] }> {
    return firstValueFrom(
      this.http.get<{ items: SchedulePreviewItem[] }>(`${this.baseUrl}/schedule/midweek`, {
        params: { isCircuitVisit: String(options.isCircuitVisit) },
      }),
    );
  }

  importMidweek(options: MidweekOptions, replace = false): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/schedule/midweek`, { ...options, replace }));
  }

  getTimers(): Promise<TimersResponse> {
    return firstValueFrom(this.http.get<TimersResponse>(`${this.baseUrl}/timers`));
  }

  getSettings(): Promise<SettingsData> {
    return firstValueFrom(this.http.get<SettingsData>(`${this.baseUrl}/settings`));
  }

  getReportInfo(): Promise<ReportInfo> {
    return firstValueFrom(this.http.get<ReportInfo>(`${this.baseUrl}/report`));
  }

  clearReportRecipients(): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/report/recipients`));
  }

  sendReport(report: ReportEmail): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/report/email`, report));
  }

  updateSettings(changes: MeetingSettingsChanges): Promise<SettingsData> {
    return firstValueFrom(this.http.put<SettingsData>(`${this.baseUrl}/settings`, changes));
  }

  deleteTalk(talkId: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/schedule/talks/${talkId}`));
  }

  startTimer(talkId: number): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/timers/${talkId}`, {}));
  }

  resetTimers(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/timers/reset`, {}));
  }

  stopTimer(talkId: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/timers/${talkId}`));
  }

  updateTimer(
    talkId: number,
    changes: { actualDurationSecs?: number; countUp?: boolean },
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${this.baseUrl}/timers/${talkId}`, changes),
    );
  }
}
