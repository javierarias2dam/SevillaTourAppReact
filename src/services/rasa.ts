/**
 * Cliente REST para el canal REST de Rasa.
 * La URL debe terminar en /webhooks/rest/webhook
 * Origen: process.env.EXPO_PUBLIC_RASA_URL o extra.rasaUrl desde app.config.js
 */
import Constants from "expo-constants";

function resolveRasaWebhook(): string {
  const fromEnv = process.env.EXPO_PUBLIC_RASA_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const fromExtra = Constants.expoConfig?.extra?.rasaUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) return fromExtra.trim();
  return "";
}

const RASA_WEBHOOK = resolveRasaWebhook();
if (typeof __DEV__ !== "undefined" && __DEV__) {
  console.log("Rasa webhook resolved:", RASA_WEBHOOK);
}

/** Devuelve la URL usada para el webhook (para debug en UI). */
export function getRasaWebhook(): string {
  return RASA_WEBHOOK;
}

export type RasaResponseMessage = {
  text?: string;
  recipient_id?: string;
  [key: string]: unknown;
};

/**
 * Envía un mensaje al bot Rasa y devuelve los textos de la respuesta.
 * El canal REST de Rasa devuelve un array de mensajes; extraemos el campo "text" de cada uno.
 */
const URL_MISSING_MSG =
  "Falta EXPO_PUBLIC_RASA_URL. Copia .env.example a .env y reinicia Expo con -c";

export async function sendMessageToRasa(
  message: string,
  sender = "mobile-user"
): Promise<string[]> {
  const url = RASA_WEBHOOK.trim();
  if (!url) {
    throw new Error(URL_MISSING_MSG);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message }),
    });

    if (!res.ok) {
      throw new Error(`Rasa respondió con estado ${res.status}`);
    }

    const data = (await res.json()) as RasaResponseMessage[];
    if (!Array.isArray(data)) {
      return ["El bot no devolvió una respuesta válida."];
    }

    const texts = data
      .map((m) => m?.text)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    return texts.length > 0 ? texts : ["El bot no tiene respuesta para eso."];
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "No se pudo conectar con el asistente.";
    const isNetworkFailed =
      typeof rawMessage === "string" &&
      rawMessage.toLowerCase().includes("network request failed");
    const message = isNetworkFailed
      ? "No se puede conectar al asistente. Comprueba EXPO_PUBLIC_RASA_URL en .env (usa la IP de tu PC, no localhost) y reinicia con npx expo start -c"
      : rawMessage;
    throw new Error(message);
  }
}
