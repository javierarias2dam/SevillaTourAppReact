import { Alert } from "react-native";

export type ToastType = "success" | "error" | "info";

// Wrapper sencillo sobre Alert para centralizar títulos y evitar repetir lógica.
export function showToast(type: ToastType, message: string) {
  let title = "Información";

  if (type === "success") title = "Éxito";
  if (type === "error") title = "Error";

  Alert.alert(title, message);
}

