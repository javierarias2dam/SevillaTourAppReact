import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { supabase } from "../services/supabase";
import { BottomBar } from "../components/BottomBar";
import { showToast } from "../components/Toast";
import { colors, spacing, typography } from "../theme";

// Mismo bucket que las imágenes de tours; ruta avatars/{userId}/ para no crear otro bucket.
const AVATAR_BUCKET = "tour-images";
const AVATAR_PATH_PREFIX = "avatars";

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Perfil">;
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!error && data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      } else {
        // Columna avatar_url puede no existir; dejamos avatarUrl en null.
        setAvatarUrl(null);
      }
    } catch {
      setAvatarUrl(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handlePickAvatar = async () => {
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        showToast("error", "Debes iniciar sesión para cambiar la foto.");
        return;
      }
      const userId = userData.user.id;

      setUploadingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        showToast("error", "No se ha podido obtener la imagen seleccionada.");
        return;
      }

      const base64 = (asset as any).base64;
      if (!base64) {
        showToast("error", "No se ha podido leer la imagen. Prueba de nuevo.");
        return;
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const fileExt = "jpg";
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${AVATAR_PATH_PREFIX}/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error("No se ha podido obtener la URL pública de la imagen.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) {
        const msg = (updateError as any).message ?? "";
        if (
          msg.includes("avatar_url") ||
          (updateError as any).code === "42703"
        ) {
          showToast(
            "info",
            "Añade la columna avatar_url a la tabla profiles en Supabase para guardar la foto.",
          );
        } else {
          throw updateError;
        }
      } else {
        showToast("success", "Foto de perfil actualizada");
      }

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      const message =
        err?.message ??
        "No se ha podido subir la imagen. Revisa Storage en Supabase.";
      showToast("error", message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigation.replace("Register");
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>
          Gestiona tu cuenta y cierra sesión cuando quieras.
        </Text>

        <TouchableOpacity
          style={styles.avatarTouchable}
          onPress={handlePickAvatar}
          disabled={uploadingImage}
        >
          {uploadingImage ? (
            <View style={[styles.avatarCircle, styles.avatarPlaceholder]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarCircle}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarCircle, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>+ Foto</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Toca para elegir foto de galería</Text>

        <AppButton
          title="Cerrar sesión"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </View>
      <BottomBar
        activeTab="profile"
        onNavigate={(route) => navigation.navigate(route)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  avatarTouchable: {
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  signOutButton: {
    alignSelf: "flex-start",
  },
});
