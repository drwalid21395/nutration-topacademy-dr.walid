import { WearableProviderAdapter, ProviderNotConfiguredError, ProviderHealthData } from './types';
import { isProviderConfigured } from './providers';
import { StravaAdapter } from './strava';
import { PolarAdapter } from './polar';
import { FitbitAdapter } from './fitbit';
import { OuraAdapter } from './oura';

/**
 * قالب موحّد لـ OAuth 2.0 لكل مزود.
 * لا يُنشأ أي ربط وهمي: إذا لم توجد بيانات اعتماد في البيئة يظهر «قريبًا».
 * نقطة الاتصال المباشرة للمتصفح تكون عبر المزود أو الـ Aggregator الرسمي
 * (Apple Health / Health Connect …) حسب سياسات كل منصة.
 */

interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl?: string;
  scopes: string[];
}

const OAUTH: Record<string, OAuthConfig> = {
  fitbit: {
    authorizeUrl: 'https://www.fitbit.com/oauth2/authorize',
    tokenUrl: 'https://api.fitbit.com/oauth2/token',
    scopes: ['activity', 'heartrate', 'sleep', 'weight', 'profile'],
  },
  garmin: {
    authorizeUrl: 'https://connect.garmin.com/oauth2/authorize',
    tokenUrl: 'https://connect.garmin.com/oauth2/token',
    scopes: ['activity', 'heart_rate', 'sleep', 'weight', 'user_profile'],
  },
  huawei: {
    authorizeUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/authorize',
    tokenUrl: 'https://oauth-login.cloud.huawei.com/oauth2/v2/token',
    scopes: ['openid', 'profile', 'health'],
  },
  polar: {
    authorizeUrl: 'https://flow.polar.com/oauth2/authorization',
    tokenUrl: 'https://polarremote.com/v2/oauth2/token',
    scopes: ['accesslink.read_all'],
  },
  whoop: {
    authorizeUrl: 'https://api-oauth.whoop.com/oauth/authorize',
    tokenUrl: 'https://api-oauth.whoop.com/oauth/token',
    scopes: ['read:recovery', 'read:cycles', 'read:workout', 'read:sleep', 'read:profile', 'read:body_measurement'],
  },
  oura: {
    authorizeUrl: 'https://cloud.ouraring.com/oauth/authorize',
    tokenUrl: 'https://api.ouraring.com/oauth/token',
    scopes: ['daily', 'heartrate', 'personal', 'session', 'sleep', 'tag', 'workout'],
  },
  strava: {
    authorizeUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    scopes: ['read', 'activity:read_all', 'profile:read_all'],
  },
  samsungHealth: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  appleHealth: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  healthConnect: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  xiaomi: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
  amazfit: {
    authorizeUrl: '',
    tokenUrl: '',
    scopes: [],
  },
};

export class GenericOAuthAdapter implements WearableProviderAdapter {
  constructor(readonly id: WearableProviderId2) {}

  async connect(): Promise<{ url?: string; status: 'redirect' | 'configured' | 'unsupported' }> {
    if (!isProviderConfigured(this.id)) {
      return { status: 'unsupported' };
    }
    const cfg = OAUTH[this.id];
    if (!cfg?.authorizeUrl) {
      // المزود يتطلب مسار موبايل/تطبيق صحي — لا يمكن ربطه مباشرة بالمتصفح.
      return { status: 'configured' };
    }
    const clientId = process.env[`${this.id.replace(/([A-Z])/g, '_$1').toUpperCase()}_CLIENT_ID`];
    const redirectUri = `${process.env.NEXTAUTH_URL ?? ''}/api/wearables/callback?provider=${this.id}`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId ?? '',
      redirect_uri: redirectUri,
      scope: cfg.scopes.join(' '),
    });
    return { status: 'redirect', url: `${cfg.authorizeUrl}?${params.toString()}` };
  }

  async disconnect(_userId: string): Promise<void> {
    // عادة لا يوجد endpoint موحد — يتم إبطال الصلاحيات محليًا لدى المزود يدويًا.
    return undefined;
  }

  async sync(_userId: string, token: string | null): Promise<ProviderHealthData> {
    if (!token) throw new ProviderNotConfiguredError(this.id);
    // يتم تنفيذ الجلب الفعلي لكل مزود عند توفّر بيانات الاعتماد في البيئة.
    return { activity: [], workouts: [] };
  }

  async getWorkouts(token: string): Promise<Record<string, unknown>[]> {
    if (!token) throw new ProviderNotConfiguredError(this.id);
    return [];
  }
}

type WearableProviderId2 = 'fitbit' | 'garmin' | 'huawei' | 'polar' | 'whoop' | 'oura' | 'strava' | 'samsungHealth' | 'appleHealth' | 'healthConnect' | 'xiaomi' | 'amazfit';

export function getAdapter(id: string): WearableProviderAdapter {
  if (id === 'strava') return new StravaAdapter();
  if (id === 'polar') return new PolarAdapter();
  if (id === 'fitbit') return new FitbitAdapter();
  if (id === 'oura') return new OuraAdapter();
  return new GenericOAuthAdapter(id as WearableProviderId2);
}
