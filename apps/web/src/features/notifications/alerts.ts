import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertText, type Notification, type PushConfig, type User } from "@chatty/shared";
import { api } from "../../lib/api";
import { meQueryKey } from "../auth/api";

// Pop-up alerts (Web Push). The service worker in public/sw.js shows them.
// They're per device: turning them on here doesn't turn them on elsewhere.

export type PopupState =
  /** This browser can't do pop-ups (on iPhone, only once the app is added to the home screen). */
  | "unsupported"
  /** The server has no push keys. */
  | "unavailable"
  /** The user said no to the browser's permission prompt. */
  | "blocked"
  | "off"
  | "on";

const popupKey = ["alerts", "popups"] as const;

const supported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

let registration: Promise<ServiceWorkerRegistration> | undefined;

/** Registers the service worker once; called at startup so existing pop-ups keep working. */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | undefined {
  if (!supported()) return undefined;
  registration ??= navigator.serviceWorker.register("/sw.js");
  return registration;
}

async function currentSubscription() {
  return (await registerServiceWorker())?.pushManager.getSubscription() ?? null;
}

/** The VAPID key arrives base64url-encoded; the browser wants the raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function popupState(): Promise<PopupState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const sub = Notification.permission === "granted" ? await currentSubscription() : null;
  if (sub) {
    // Keep the server's copy current; browsers occasionally rotate subscriptions.
    void api.post("/push/subscriptions", sub.toJSON() as Record<string, unknown>).catch(() => {});
    return "on";
  }
  const { publicKey } = await api.get<PushConfig>("/push/config");
  return publicKey ? "off" : "unavailable";
}

export function usePopupState() {
  return useQuery({ queryKey: popupKey, queryFn: popupState, staleTime: Infinity });
}

async function turnOnPopups(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Pop-ups are blocked in your browser settings");
  const { publicKey } = await api.get<PushConfig>("/push/config");
  if (!publicKey) throw new Error("Pop-ups aren't available right now");
  const reg = await registerServiceWorker()!;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await api.post("/push/subscriptions", sub.toJSON() as Record<string, unknown>);
}

/** Stops pop-ups on this device. Also used at logout, so the next person doesn't get yours. */
export async function turnOffPopups(): Promise<void> {
  if (!supported()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await sub.unsubscribe();
  await api.delete("/push/subscriptions", { endpoint: sub.endpoint }).catch(() => {});
}

export function useSetPopups() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => (on ? turnOnPopups() : turnOffPopups()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: popupKey }),
  });
}

/**
 * While a tab is open the server sends notifications over the socket instead
 * of pushing them, so a tab in the background shows the pop-up itself.
 */
export async function popUpIfHidden(n: Notification): Promise<void> {
  if (!document.hidden || !supported() || Notification.permission !== "granted") return;
  const sub = await currentSubscription();
  if (!sub) return;
  const alert = alertText(n);
  const reg = await registerServiceWorker()!;
  await reg.showNotification(alert.title, {
    body: alert.body,
    tag: alert.tag,
    icon: "/logo192.png",
    data: { url: alert.url },
  });
}

export function useSetEmailAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailAlerts: boolean) => api.put<User>("/users/me/alerts", { emailAlerts }),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useUnsubscribe() {
  return useMutation({
    mutationFn: (token: string) => api.post<void>("/alerts/unsubscribe", { token }),
  });
}
