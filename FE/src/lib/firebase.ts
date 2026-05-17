import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

// Cấu hình Firebase lấy từ biến môi trường Vite, không hard-code khóa vào source code.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) {
    throw new Error('Chưa cấu hình Firebase cho đăng nhập Google. Vui lòng kiểm tra biến môi trường frontend.')
  }

  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user.getIdToken()
  } catch {
    throw new Error('Đăng nhập Google thất bại. Vui lòng thử lại.')
  }
}
