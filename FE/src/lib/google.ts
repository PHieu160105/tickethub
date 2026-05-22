const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

type GoogleTokenResponse = {
  access_token?: string
  error?: string
}

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
          }) => GoogleTokenClient
        }
      }
    }
  }
}

let scriptLoadPromise: Promise<void> | null = null

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Không tải được Google Identity Services.')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Không tải được Google Identity Services.'))
      document.head.appendChild(script)
    })
  }

  return scriptLoadPromise
}

export async function signInWithGoogle() {
  if (!googleClientId) {
    throw new Error('Chưa cấu hình Google Client ID cho giao diện.')
  }

  try {
    await loadGoogleIdentityScript()

    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) {
      throw new Error('Google Identity Services chưa sẵn sàng.')
    }

    return await new Promise<string>((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error('Google không trả access token.'))
            return
          }
          resolve(response.access_token)
        },
      })

      tokenClient.requestAccessToken({ prompt: 'select_account' })
    })
  } catch {
    throw new Error('Đăng nhập Google thất bại. Vui lòng kiểm tra mạng hoặc dùng email và mật khẩu.')
  }
}
