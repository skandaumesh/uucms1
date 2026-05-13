import upstash from '@/lib/upstash';

export interface UUCMS_Session {
  aspNetSessionId: string;
  requestVerificationToken: string;
  cookies: string[];
}

export class SessionManager {
  private static SESSION_PREFIX = 'uucms:session:';
  private static CSRF_PREFIX = 'uucms:csrf:';

  static async saveSession(studentId: string, session: UUCMS_Session, ttl: number = 604800) {
    await upstash.set(`${this.SESSION_PREFIX}${studentId}`, JSON.stringify(session), { ex: ttl });
  }

  static async getSession(studentId: string): Promise<UUCMS_Session | null> {
    const data: any = await upstash.get(`${this.SESSION_PREFIX}${studentId}`);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
  }

  static async saveCSRF(studentId: string, token: string, ttl: number = 604800) {
    await upstash.set(`${this.CSRF_PREFIX}${studentId}`, token, { ex: ttl });
  }

  static async getCSRF(studentId: string): Promise<string | null> {
    return await upstash.get(`${this.CSRF_PREFIX}${studentId}`);
  }

  static async clearSession(studentId: string) {
    await upstash.del(`${this.SESSION_PREFIX}${studentId}`);
    await upstash.del(`${this.CSRF_PREFIX}${studentId}`);
  }
}
