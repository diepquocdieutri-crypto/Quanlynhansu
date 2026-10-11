import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

let dbInstance: Firestore | null = null;
try {
  dbInstance = getFirestore(app);
} catch (err) {
  console.warn('Firestore initialization notice:', err);
}
export const db = dbInstance;

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));

// In-memory token storage backed by sessionStorage and localStorage for active session continuity
const SESSION_TOKEN_KEY = 'ccty_google_access_token';
const SESSION_TOKEN_TS_KEY = 'ccty_google_access_token_ts';

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Custom Error type for Google OAuth errors
export class GoogleAuthError extends Error {
  public status: number;
  public isAuthError = true;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'GoogleAuthError';
    this.status = status;
  }
}

type TokenChangeListener = (token: string | null) => void;
type AuthExpiredListener = (detail: { status: number; message: string }) => void;

const tokenChangeListeners: TokenChangeListener[] = [];
const authExpiredListeners: AuthExpiredListener[] = [];

export const onTokenChange = (cb: TokenChangeListener) => {
  tokenChangeListeners.push(cb);
  return () => {
    const idx = tokenChangeListeners.indexOf(cb);
    if (idx >= 0) tokenChangeListeners.splice(idx, 1);
  };
};

export const onGoogleAuthExpired = (cb: AuthExpiredListener) => {
  authExpiredListeners.push(cb);
  return () => {
    const idx = authExpiredListeners.indexOf(cb);
    if (idx >= 0) authExpiredListeners.splice(idx, 1);
  };
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      const now = String(Date.now());
      sessionStorage.setItem(SESSION_TOKEN_TS_KEY, now);
      localStorage.setItem(SESSION_TOKEN_TS_KEY, now);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_TS_KEY);
      localStorage.removeItem(SESSION_TOKEN_TS_KEY);
    }
  }
  tokenChangeListeners.forEach(cb => {
    try { cb(token); } catch (e) { console.warn(e); }
  });
};

export const clearAccessToken = () => {
  setCachedAccessToken(null);
};

export const notifyGoogleAuthExpired = (message = 'Mã lỗi 401 (Invalid authentication credentials): Phiên làm việc Google đã hết hạn.') => {
  clearAccessToken();
  authExpiredListeners.forEach(cb => {
    try { cb({ status: 401, message }); } catch (e) { console.warn(e); }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        // If user is authenticated in Firebase but access token is missing or expired
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearAccessToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể nhận Access Token từ Google. Vui lòng thử lại.');
    }

    setCachedAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Đăng nhập Google thất bại:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
  }

  // Kiểm tra thời hạn token (Google OAuth token thông thường hết hạn sau 3600s = 60 phút, kiểm tra mốc 55 phút)
  if (cachedAccessToken) {
    const tsStr = sessionStorage.getItem(SESSION_TOKEN_TS_KEY) || localStorage.getItem(SESSION_TOKEN_TS_KEY);
    if (tsStr) {
      const ts = parseInt(tsStr, 10);
      if (!isNaN(ts) && Date.now() - ts > 55 * 60 * 1000) {
        console.warn('⚠️ Google Access Token đã vượt quá 55 phút (sắp hoặc đã hết hạn). Tự động dọn dẹp để yêu cầu cấp mới.');
        clearAccessToken();
        return null;
      }
    }
  }

  return cachedAccessToken;
};

export const ensureAccessToken = async (): Promise<string> => {
  const existing = await getAccessToken();
  if (existing) return existing;
  const res = await googleSignIn();
  if (!res?.accessToken) {
    throw new GoogleAuthError(
      'Mã lỗi 401 (Thiếu xác thực): Chưa kết nối tài khoản Google hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại Google.',
      401
    );
  }
  return res.accessToken;
};

export const refreshGoogleToken = async (): Promise<string> => {
  clearAccessToken();
  const res = await googleSignIn();
  if (!res?.accessToken) {
    throw new GoogleAuthError(
      'Mã lỗi 401: Không thể làm mới phiên đăng nhập Google. Vui lòng thử lại.',
      401
    );
  }
  return res.accessToken;
};

/**
 * Fetch wrapper chuẩn hóa việc truyền Header: Authorization: Bearer <token>
 * Tự động bắt lỗi 401 (Invalid authentication credentials) và xử lý đăng nhập lại.
 */
export const fetchWithGoogleAuth = async (
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  const token = await getAccessToken();
  if (!token) {
    clearAccessToken();
    notifyGoogleAuthExpired('Mã lỗi 401 (Thiếu thông tin xác thực): Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn.');
    throw new GoogleAuthError(
      'Mã lỗi 401: Thiếu Access Token xác thực Google. Vui lòng đăng nhập lại tài khoản Google để cấp quyền lưu trữ.',
      401
    );
  }

  const cleanToken = token.trim();
  const bearerHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    'Authorization': bearerHeader,
  };

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (netErr: any) {
    throw new Error(`Lỗi kết nối mạng đến Google APIs: ${netErr.message || 'Không thể gửi yêu cầu'}`);
  }

  // Tự động bắt lỗi 401 (Invalid authentication credentials / Expired Token)
  if (response.status === 401) {
    clearAccessToken();
    notifyGoogleAuthExpired('Mã lỗi 401 (Invalid authentication credentials): Phiên đăng nhập Google đã hết hạn.');
    throw new GoogleAuthError(
      'Mã lỗi 401 (Invalid authentication credentials): Phiên xác thực Google OAuth2 đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại tài khoản Google để làm mới quyền truy cập.',
      401
    );
  }

  return response;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  clearAccessToken();
};
