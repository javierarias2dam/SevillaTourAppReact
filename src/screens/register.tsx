import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { supabase } from "../services/supabase";
import { AppInput } from "../components/AppInput";
import { AppButton } from "../components/AppButton";
import { Screen } from "../components/Screen";
import { showToast } from "../components/Toast";
import { colors, spacing, typography } from "../theme";

type RegisterProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Register">;
};

// Expresión regular sencilla para validar formato básico de email.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register({ navigation }: RegisterProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Estado local para mostrar errores específicos debajo de cada campo.
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();

  // Estado de loading separado por acción para deshabilitar y mostrar spinner.
  const [loadingAction, setLoadingAction] = useState<"register" | "login" | null>(
    null
  );

  function validateFields(): boolean {
    let isValid = true;
    setEmailError(undefined);
    setPasswordError(undefined);
    setGeneralError(undefined);

    if (!email.trim()) {
      setEmailError("El email es obligatorio.");
      isValid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Introduce un email válido.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("La contraseña es obligatoria.");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      isValid = false;
    }

    return isValid;
  }

  // Maneja el registro con validaciones previas y feedback visual (errores + loading).
  const handleRegister = async () => {
    if (!validateFields()) {
      return;
    }

    try {
      setLoadingAction("register");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Insertamos el perfil con el email completo
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: authData.user.id,
            username: email.trim(),
          },
        ]);

        if (profileError) throw profileError;

        showToast("success", "Usuario creado correctamente");
        navigation.replace("Tours");
      }
    } catch (err: any) {
      // Mostramos el error de forma visual bajo el formulario y con Alert unificado.
      const message = err?.message ?? "Ha ocurrido un error inesperado.";
      setGeneralError(message);
      showToast("error", message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Maneja el login mostrando loading mientras Supabase responde y errores claros.
  const handleLogin = async () => {
    if (!validateFields()) {
      return;
    }

    try {
      setLoadingAction("login");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      navigation.replace("Tours");
    } catch (err: any) {
      const message = err?.message ?? "Ha ocurrido un error inesperado.";
      setGeneralError(message);
      showToast("error", message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Your Seville Tour Guide</Text>
        <Text style={styles.subtitle}>Accede o crea tu cuenta</Text>
      </View>

      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="tuemail@ejemplo.com"
        errorText={emailError}
      />

      <AppInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Mínimo 6 caracteres"
        errorText={passwordError}
      />

      {generalError ? <Text style={styles.generalError}>{generalError}</Text> : null}

      <View style={styles.buttonsRow}>
        <AppButton
          title="Registrar"
          onPress={handleRegister}
          loading={loadingAction === "register"}
          variant="secondary"
          style={styles.button}
        />
        <AppButton
          title="Entrar"
          onPress={handleLogin}
          loading={loadingAction === "login"}
          variant="primary"
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  generalError: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm as number,
  },
  button: {
    flex: 1,
  },
});

