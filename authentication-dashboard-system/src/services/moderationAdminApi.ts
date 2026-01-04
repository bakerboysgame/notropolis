// src/services/moderationAdminApi.ts
import { config } from '../config/environment';

export interface ModerationSettings {
  id: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  chat_user_prompt: string;
  name_user_prompt: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
  available_models: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface ModerationLogEntry {
  id: string;
  company_id: string;
  company_name: string | null;
  message_content: string;
  model_used: string;
  allowed: number;
  rejection_reason: string | null;
  response_time_ms: number;
  created_at: string;
}

export interface TestResult {
  allowed: boolean;
  reason?: string;
  censored?: string;
  responseTimeMs: number;
  error?: string;
}

export interface AttackMessageEntry {
  id: number;
  message: string;
  message_status: 'pending' | 'approved' | 'rejected';
  trick_type: string;
  created_at: string;
  message_moderated_at: string | null;
  message_rejection_reason: string | null;
  attacker_company_name: string;
  attacker_boss_name: string;
  target_company_name: string;
  building_name: string;
  map_name: string;
  x: number;
  y: number;
}

class ModerationAdminApi {
  private baseUrl = `${config.API_BASE_URL}/api/game/moderation`;

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data.data;
  }

  async getSettings(): Promise<ModerationSettings> {
    return this.fetch('/settings');
  }

  async updateSettings(settings: Partial<ModerationSettings>): Promise<void> {
    await this.fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testMessage(message: string): Promise<TestResult> {
    return this.fetch('/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getLog(options?: { limit?: number; rejectedOnly?: boolean }): Promise<ModerationLogEntry[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.rejectedOnly) params.set('rejected', 'true');
    return this.fetch(`/log?${params}`);
  }

  async getAttackMessages(options?: { status?: 'pending' | 'approved' | 'rejected' | 'all'; limit?: number }): Promise<AttackMessageEntry[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', options.limit.toString());
    return this.fetch(`/attack-messages?${params}`);
  }

  async approveAttackMessage(attackId: number): Promise<void> {
    await this.fetch('/attack-messages/approve', {
      method: 'POST',
      body: JSON.stringify({ attack_id: attackId }),
    });
  }

  async rejectAttackMessage(attackId: number, reason?: string): Promise<void> {
    await this.fetch('/attack-messages/reject', {
      method: 'POST',
      body: JSON.stringify({ attack_id: attackId, reason }),
    });
  }
}

export const moderationAdminApi = new ModerationAdminApi();
