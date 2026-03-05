import { initializeApp, type FirebaseOptions, type FirebaseApp } from 'firebase/app'
import { getMessaging, type Messaging } from 'firebase/messaging'

let firebaseApp: FirebaseApp | null = null
let messagingInstance: Messaging | null = null

const getFirebaseConfig = (): FirebaseOptions | null => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    // Firebase is optional: if config is missing, we simply don't initialize it
    return null
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  }
}

export const getFirebaseApp = (): FirebaseApp | null => {
  if (firebaseApp) return firebaseApp

  const config = getFirebaseConfig()
  if (!config) return null

  firebaseApp = initializeApp(config)
  return firebaseApp
}

export const getFirebaseMessaging = (): Messaging | null => {
  if (messagingInstance) return messagingInstance

  if (typeof window === 'undefined') return null
  if (!('Notification' in window)) return null

  const app = getFirebaseApp()
  if (!app) return null

  try {
    messagingInstance = getMessaging(app)
    return messagingInstance
  } catch {
    return null
  }
}

const FCM_SW_PATH = '/firebase-messaging-sw.js'

/**
 * Register the FCM service worker and wait for it to be ready.
 * Call this before getToken() so the SW has time to load and fetch config.
 * Returns the registration to pass to getToken(..., { serviceWorkerRegistration }).
 */
export async function getFcmServiceWorkerRegistration (): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null
  try {
    const reg = await navigator.serviceWorker.register(FCM_SW_PATH, { scope: '/' })
    await reg.ready
    // Give the SW time to run init() and fetch /api/firebase-sw-config
    await new Promise(r => setTimeout(r, 1500))
    return reg
  } catch {
    return null
  }
}

