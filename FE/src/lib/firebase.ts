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

export async function signInWithGoogle() {
  /**
   * Đăng nhập Google qua Firebase chỉ khi người dùng thật sự bấm nút Google.
   *
   * Đầu vào:
   * - Không nhận tham số. Hàm đọc cấu hình Firebase từ biến môi trường Vite.
   *
   * Đầu ra:
   * - Chuỗi mã định danh Firebase để máy chủ xác minh và đổi sang JWT nội bộ.
   *
   * Cách hoạt động:
   * - Kiểm tra đủ cấu hình trước, tránh khởi tạo Firebase rỗng.
   * - Nạp Firebase động để ứng dụng không tự gọi dịch vụ cấp mã Google khi vừa mở trang.
   * - Nếu đăng nhập thất bại hoặc mạng Google bị chặn, trả lỗi tiếng Việt cho giao diện.
   */

  if (!isFirebaseConfigured()) {
    throw new Error('Chưa cấu hình Firebase cho đăng nhập Google. Vui lòng kiểm tra biến môi trường giao diện.')
  }

  try {
    const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, inMemoryPersistence, setPersistence, signInWithPopup }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ])
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
    const auth = getAuth(app)
    auth.languageCode = 'vi'
    await setPersistence(auth, inMemoryPersistence)
    const googleProvider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, googleProvider)
    return result.user.getIdToken()
  } catch {
    throw new Error('Đăng nhập Google thất bại. Vui lòng kiểm tra mạng hoặc dùng email và mật khẩu.')
  }
}
