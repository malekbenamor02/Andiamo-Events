import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, handleApiResponse } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import { getFirebaseMessaging, getFcmServiceWorkerRegistration } from "@/lib/firebase";
import { getToken } from "firebase/messaging";
import { Send, Loader2 } from "lucide-react";

interface AppTabProps {
  language: "en" | "fr";
}

export function AppTab({ language }: AppTabProps) {
  const { toast } = useToast();
  const t = language === "en";

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushTarget, setPushTarget] = useState<"topic" | "admins">("admins");
  const [pushTopic, setPushTopic] = useState("admin-notifications");
  const [pushPath, setPushPath] = useState("/admin");
  const [sending, setSending] = useState(false);

  const [deviceCount, setDeviceCount] = useState<{ admins: number } | null>(null);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);

  const loadDeviceCount = useCallback(async () => {
    try {
      const res = await apiFetch(API_ROUTES.NOTIFICATIONS_DEVICE_COUNT);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.admins === "number") {
          setDeviceCount({ admins: data.admins });
          setBackendReachable(true);
        } else {
          setBackendReachable(true);
        }
      } else {
        setDeviceCount(null);
        setBackendReachable(false);
      }
    } catch {
      setDeviceCount(null);
      setBackendReachable(false);
    }
  }, []);

  useEffect(() => {
    loadDeviceCount();
  }, [loadDeviceCount]);

  // Register FCM token for push when App tab is open (admin with permission)
  useEffect(() => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey || typeof window === "undefined" || !("Notification" in window)) return;
    const messaging = getFirebaseMessaging();
    if (!messaging) return;
    const run = async () => {
      try {
        let permission = Notification.permission;
        if (permission === "default") permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast({
            title: t ? "Notifications blocked" : "Notifications bloquées",
            description: t ? "Allow notifications in browser settings to receive push on this device." : "Autorisez les notifications dans les paramètres du navigateur.",
            variant: "destructive",
          });
          return;
        }
        const swReg = await getFcmServiceWorkerRegistration();
        if (!swReg) {
          toast({
            title: t ? "Push not available" : "Push indisponible",
            description: t ? "Service worker failed to load. Ensure the backend is running (npm run server) and refresh." : "Échec du chargement du service worker. Lancez le serveur (npm run server) et actualisez.",
            variant: "destructive",
          });
          return;
        }
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
        if (!token) {
          toast({
            title: t ? "Push not available" : "Push indisponible",
            description: t ? "This device could not register for push (e.g. use HTTPS)." : "Ce périphérique n'a pas pu s'enregistrer (HTTPS requis).",
            variant: "destructive",
          });
          return;
        }
        await apiFetch(API_ROUTES.NOTIFICATIONS_REGISTER, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fcmToken: token, deviceLabel: "Admin" }),
        });
        toast({
          title: t ? "Device registered" : "Appareil enregistré",
          description: t ? "This device will receive push notifications when you send from here." : "Cet appareil recevra les notifications envoyées depuis l'onglet App.",
        });
        loadDeviceCount();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        toast({
          title: t ? "Push registration failed" : "Échec d'enregistrement push",
          description: msg || (t ? "Check HTTPS and try again." : "Vérifiez HTTPS et réessayez."),
          variant: "destructive",
        });
      }
    };
    run();
  }, [t, toast, loadDeviceCount]);

  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      toast({
        title: t ? "Missing fields" : "Champs manquants",
        description: t ? "Title and body are required." : "Le titre et le corps sont requis.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        title: pushTitle.trim(),
        body: pushBody.trim(),
        target: pushTarget,
        path: pushPath || "/admin",
      };
      if (pushTarget === "topic") body.topic = pushTopic.trim() || "admin-notifications";
      const res = await apiFetch(API_ROUTES.NOTIFICATIONS_SEND, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await handleApiResponse(res);
      if (data && (data as { success?: boolean }).success) {
        const sent = (data as { sentCount?: number }).sentCount ?? 0;
        toast({
          title: t ? "Notification sent" : "Notification envoyée",
          description: sent > 0
            ? (t ? `Sent to ${sent} device(s).` : `Envoyée à ${sent} appareil(s).`)
            : (t ? "No admin devices registered. Open this tab and allow notifications to receive push." : "Aucun appareil admin enregistré. Ouvrez cet onglet et autorisez les notifications."),
        });
        setPushTitle("");
        setPushBody("");
        loadDeviceCount();
      } else {
        toast({
          title: t ? "Failed to send" : "Échec d'envoi",
          description: (data as { error?: string })?.error || (t ? "Could not send notification." : "Impossible d'envoyer la notification."),
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: t ? "Error" : "Erreur",
        description: (e as Error)?.message || (t ? "Failed to send notification." : "Échec d'envoi de la notification."),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card style={{ borderColor: "#2A2A2A", background: "#1A1A1A" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "#E21836" }}>
            <Send className="w-5 h-5" />
            {t ? "Send push notification" : "Envoyer une notification push"}
          </CardTitle>
          <CardDescription style={{ color: "#B0B0B0" }}>
            {t ? "Send to admins only or to a topic." : "Envoyer aux admins uniquement ou à un topic."}
            {deviceCount != null && (
              <span className="block mt-2 text-foreground/90">
                {t ? `${deviceCount.admins} admin device(s) registered.` : `${deviceCount.admins} appareil(s) admin enregistré(s).`}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {backendReachable === false && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
              <p className="font-medium">{t ? "Backend not reachable" : "Serveur inaccessible"}</p>
              <p className="mt-1 opacity-90">
                {t
                  ? "Push will not work. Start the backend: run « npm run server » (or « npm run dev:full » for frontend + backend). Then refresh this page."
                  : "Les notifications ne fonctionneront pas. Démarrez le serveur : « npm run server » (ou « npm run dev:full »). Puis actualisez."}
              </p>
            </div>
          )}
          {deviceCount !== null && deviceCount.admins === 0 && backendReachable !== false && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
              <p className="font-medium">{t ? "No devices registered yet" : "Aucun appareil enregistré"}</p>
              <p className="mt-1 opacity-90">
                {t
                  ? "Allow notifications when prompted in this tab to register this device. Then you can send a test push."
                  : "Autorisez les notifications dans cet onglet pour enregistrer cet appareil, puis envoyez un test."}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label style={{ color: "#E5E5E5" }}>{t ? "Title" : "Titre"}</Label>
            <Input
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder={t ? "Notification title" : "Titre de la notification"}
              style={{ background: "#0a0a0a", borderColor: "#2A2A2A", color: "#fff" }}
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: "#E5E5E5" }}>{t ? "Body" : "Corps"}</Label>
            <Textarea
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
              placeholder={t ? "Notification message" : "Message de la notification"}
              rows={3}
              style={{ background: "#0a0a0a", borderColor: "#2A2A2A", color: "#fff" }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: "#E5E5E5" }}>{t ? "Target" : "Cible"}</Label>
              <Select value={pushTarget} onValueChange={(v) => setPushTarget(v as "topic" | "admins")}>
                <SelectTrigger style={{ background: "#0a0a0a", borderColor: "#2A2A2A" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admins">{t ? "Admins only" : "Admins uniquement"}</SelectItem>
                  <SelectItem value="topic">{t ? "Topic" : "Topic"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pushTarget === "topic" && (
              <div className="space-y-2">
                <Label style={{ color: "#E5E5E5" }}>Topic</Label>
                <Input
                  value={pushTopic}
                  onChange={(e) => setPushTopic(e.target.value)}
                  placeholder="admin-notifications"
                  style={{ background: "#0a0a0a", borderColor: "#2A2A2A", color: "#fff" }}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label style={{ color: "#E5E5E5" }}>{t ? "Click path" : "Chemin au clic"}</Label>
            <Input
              value={pushPath}
              onChange={(e) => setPushPath(e.target.value)}
              placeholder="/admin"
              style={{ background: "#0a0a0a", borderColor: "#2A2A2A", color: "#fff" }}
            />
          </div>
          <Button
            onClick={handleSendPush}
            disabled={sending}
            style={{ background: "#E21836", color: "#fff" }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {t ? "Send" : "Envoyer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
