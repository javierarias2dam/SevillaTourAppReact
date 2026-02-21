import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Screen } from "../components/Screen";
import { AppInput } from "../components/AppInput";
import { AppButton } from "../components/AppButton";
import { showToast } from "../components/Toast";
import { supabase } from "../services/supabase";
import { colors, spacing, typography } from "../theme";
// Para elegir imágenes de la galería usamos expo-image-picker.
import * as ImagePicker from "expo-image-picker";

type TourFormRouteProp = RouteProp<RootStackParamList, "TourForm">;
type TourFormNavProp = NativeStackNavigationProp<RootStackParamList, "TourForm">;

type Props = {
  route: TourFormRouteProp;
  navigation: TourFormNavProp;
};

type TourRow = {
  id: string;
  title: string;
  description?: string | null;
  // Campo opcional en la tabla "tours" para guardar la URL pública de la imagen.
  // Es posible que no exista en todos los esquemas; por eso el código
  // maneja también una tabla auxiliar "tour_images" como fallback.
  image_url?: string | null;
};

// Formulario reutilizable para crear y editar tours.
// - En modo "create" hace un insert en Supabase.
// - En modo "edit" hace un update sobre el tour existente.
// La pantalla de lista (`ToursScreen`) se refresca al volver porque
// usamos `useFocusEffect` allí para recargar los datos.
export default function TourFormScreen({ route, navigation }: Props) {
  const { mode, tourId } = route.params;
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
   // URL pública de la imagen asociada a este tour (si existe).
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Si estamos en modo edición, cargamos los datos del tour desde Supabase.
  useEffect(() => {
    const loadTour = async () => {
      if (!isEdit || !tourId) return;

      try {
        setLoading(true);
        // Intentamos primero leer un posible campo image_url en la tabla tours.
        // Si el schema no lo tiene, hacemos fallback a una consulta sin ese campo.
        let tourData: any = null;
        let imageFromColumn: string | null = null;

        const { data, error } = await supabase
          .from("tours")
          .select("id, title, description, image_url")
          .eq("id", tourId)
          .single();

        if (error) {
          const code = (error as any).code as string | undefined;
          const message = (error as any).message as string | undefined;

          const isMissingColumn =
            code === "42703" ||
            (message && message.includes('column "image_url"'));

          if (isMissingColumn) {
            // Fallback: repetimos la consulta sin image_url para no romper
            const { data: dataNoImage, error: errorNoImage } = await supabase
              .from("tours")
              .select("id, title, description")
              .eq("id", tourId)
              .single();

            if (errorNoImage) throw errorNoImage;
            tourData = dataNoImage;
          } else {
            throw error;
          }
        } else {
          tourData = data;
          imageFromColumn = (data as any)?.image_url ?? null;
        }

        // Intentamos también leer desde la tabla auxiliar "tour_images" si existe.
        // Esta tabla permite almacenar histórico de imágenes por tour.
        // Si la tabla aún no existe en tu proyecto, esta consulta fallará pero
        // lo ignoramos para no romper el flujo.
        //
        // Ejemplo de SQL para crearla (ajusta tipos según tu schema real):
        //
        //   -- Tabla auxiliar para imágenes de tours (si no usas campo image_url)
        //   create table if not exists public.tour_images (
        //     id uuid primary key default gen_random_uuid(),
        //     tour_id uuid references public.tours(id) on delete cascade,
        //     url text not null,
        //     created_at timestamptz not null default now()
        //   );
        //
        let imageFromAux: string | null = null;
        try {
          const { data: imagesData, error: imagesError } = await supabase
            .from("tour_images")
            .select("tour_id, url, created_at")
            .eq("tour_id", tourId)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!imagesError && imagesData && imagesData.length > 0) {
            imageFromAux = (imagesData[0] as any)?.url ?? null;
          }
        } catch {
          // Si la tabla no existe u ocurre otro error, simplemente
          // no usamos imágenes auxiliares y continuamos.
        }

        const tour = tourData as TourRow;
        setTitle(tour.title ?? "");
        setDescription(tour.description ?? "");
        setImageUrl(imageFromColumn || imageFromAux);
      } catch (err: any) {
        const message =
          err?.message ?? "No se han podido cargar los datos del tour.";
        showToast("error", message);
      } finally {
        setLoading(false);
      }
    };

    loadTour();
  }, [isEdit, tourId]);

  const validate = () => {
    let ok = true;
    setTitleError(undefined);

    if (!title.trim()) {
      setTitleError("El título es obligatorio.");
      ok = false;
    }

    return ok;
  };

  // Guarda el tour en Supabase. Si es creación -> insert, si es edición -> update.
  // Al terminar correctamente vuelve atrás; la lista se actualizará al ganar foco.
  const handleSave = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      if (isEdit && tourId) {
        const { error } = await supabase
          .from("tours")
          .update({
            title: title.trim(),
            description: description.trim() || null,
          })
          .eq("id", tourId);

        if (error) {
          // Detectamos errores comunes de RLS
          const errorMessage = error.message || "";
          const errorCode = (error as any).code || "";
          
          if (
            errorMessage.includes("row-level security") ||
            errorMessage.includes("RLS") ||
            errorCode === "42501"
          ) {
            throw new Error(
              "Error de permisos: La política RLS de Supabase está bloqueando la actualización. " +
              "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
            );
          }
          throw error;
        }
        showToast("success", "Tour actualizado correctamente");
      } else {
        // Construimos el payload con todos los campos que tu schema requiere.
        // Si tu tabla tours tiene columnas NOT NULL sin default, añádelas aquí.
        const payload: any = {
          title: title.trim(),
          description: description.trim() || null,
          city: "Sevilla",
          language: "es", // Idioma por defecto para la app de Sevilla
        };

        const { error } = await supabase.from("tours").insert([payload]);

        if (error) {
          const errorMessage = error.message || "";
          const errorCode = (error as any).code || "";

          // Detectamos errores de RLS para dar mensaje más claro
          if (
            errorMessage.includes("row-level security") ||
            errorMessage.includes("RLS") ||
            errorCode === "42501"
          ) {
            throw new Error(
              "Error de permisos: La política RLS de Supabase está bloqueando la creación. " +
                "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
            );
          }

          // Detectamos errores de columnas NOT NULL sin valor
          if (
            errorMessage.includes("null value in column") ||
            errorMessage.includes("violates not-null constraint")
          ) {
            // Extraemos el nombre de la columna del mensaje de error
            const columnMatch = errorMessage.match(/column "([^"]+)"/);
            const columnName = columnMatch ? columnMatch[1] : "desconocida";
            
            throw new Error(
              `La columna "${columnName}" es NOT NULL y requiere un valor. ` +
              `Si es "city", ve a Supabase → Table Editor → tours → columna city → ` +
              `cambia el Default de 'NOT NULL'::text a 'Sevilla' (texto sin comillas dobles). ` +
              `O haz la columna nullable si no es obligatoria.`
            );
          }

          // Si el error es que la columna city no existe, intentamos sin city
          const isMissingCityColumn =
            errorCode === "42703" ||
            errorMessage.includes('column "city" does not exist') ||
            errorMessage.includes("column \"city\" does not exist");

          if (isMissingCityColumn) {
            // Reintentamos sin city
            const { error: retryError } = await supabase
              .from("tours")
              .insert([
                {
                  title: title.trim(),
                  description: description.trim() || null,
                },
              ]);

            if (retryError) {
              throw retryError;
            }
          } else {
            // Para cualquier otro error, mostramos el mensaje real de Supabase
            throw error;
          }
        }

        showToast("success", "Tour creado correctamente");
      }

      navigation.goBack();
    } catch (err: any) {
      const message =
        err?.message ?? "No se han podido guardar los datos del tour.";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  // Guarda la URL de la imagen en la base de datos.
  // 1) Intenta actualizar el campo image_url en la tabla "tours" (si existe).
  // 2) Si ese campo no existe, hace fallback a insertar una fila en "tour_images".
  //
  // NOTA: este enfoque permite que el código funcione aunque tu schema real
  // use solo la columna image_url, solo la tabla tour_images o ambos.
  const saveTourImageUrl = async (tourIdToUse: string, url: string) => {
    // Primer intento: actualizar columna image_url en "tours".
    const { error: updateError } = await supabase
      .from("tours")
      .update({ image_url: url })
      .eq("id", tourIdToUse);

    if (!updateError) return;

    const code = (updateError as any).code as string | undefined;
    const message = (updateError as any).message as string | undefined;

    const isMissingColumn =
      code === "42703" ||
      (message &&
        (message.includes('column "image_url"') ||
          (message.includes("image_url") && message.includes("schema cache"))));

    if (!isMissingColumn) {
      // Si el error es otro (por ejemplo constraint), lo propagamos.
      throw updateError;
    }

    // Fallback: insertamos en tabla auxiliar "tour_images".
    // Ver comentario anterior con ejemplo de SQL para crearla.
    const { error: insertError } = await supabase.from("tour_images").insert([
      {
        tour_id: tourIdToUse,
        url,
      },
    ]);

    if (insertError) {
      // Si también falla este paso (por ejemplo tabla inexistente),
      // lanzamos el error para que el flujo de subida muestre feedback.
      throw insertError;
    }
  };

  // Maneja el flujo completo de selección + subida de imagen a Supabase Storage.
  // - Abre la galería con expo-image-picker.
  // - Sube la imagen al bucket "tour-images" con path: `${tourId}/${timestamp}.jpg`.
  // - Obtiene la URL pública y la guarda en BD usando saveTourImageUrl.
  //
  // IMPORTANTE (setup en Supabase):
  // - Crea en el dashboard de Supabase un bucket de Storage llamado "tour-images".
  //   * Dashboard -> Storage -> New bucket -> Name: "tour-images".
  //   * Puedes marcarlo como público o definir políticas RLS que permitan
  //     al rol anónimo hacer SELECT (lectura) sobre los objetos.
  // - Asegúrate de que la URL base del proyecto y la anon key estén bien
  //   configuradas en tu cliente Supabase (services/supabase.ts).
  const handleUploadImage = async () => {
    if (!isEdit || !tourId) {
      showToast(
        "info",
        "Primero guarda el tour y luego podrás subir una imagen."
      );
      return;
    }

    try {
      setUploadingImage(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true, // Evita fetch(uri) que falla con "Network request failed" en RN
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        showToast("error", "No se ha podido obtener la imagen seleccionada.");
        return;
      }

      // Usamos base64 del picker (no fetch(uri), que falla con file:///content:// en RN).
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
      const filePath = `${tourId}/${fileName}`;

      // Subimos el archivo al bucket "tour-images".
      const { error: uploadError } = await supabase.storage
        .from("tour-images")
        .upload(filePath, bytes, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("tour-images")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error("No se ha podido obtener la URL pública de la imagen.");
      }

      await saveTourImageUrl(tourId, publicUrl);
      setImageUrl(publicUrl);
      showToast("success", "Imagen subida correctamente");
    } catch (err: any) {
      const message =
        err?.message ??
        "No se ha podido subir la imagen. Revisa la configuración de Supabase Storage.";
      showToast("error", message);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>
        {isEdit ? "Editar tour" : "Crear nuevo tour"}
      </Text>

      <AppInput
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Nombre del tour"
        errorText={titleError}
      />

      <AppInput
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Descripción breve (opcional)"
        multiline
      />

      {isEdit && tourId ? (
        <>
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <Text style={styles.imageHint}>Imagen actual del tour</Text>
            </View>
          ) : (
            <Text style={styles.imageHint}>
              Este tour todavía no tiene imagen.
            </Text>
          )}

          <AppButton
            title="Subir imagen"
            onPress={handleUploadImage}
            loading={uploadingImage}
            style={styles.uploadButton}
          />
        </>
      ) : (
        <Text style={styles.imageHint}>
          Primero crea el tour para poder subir una imagen asociada.
        </Text>
      )}

      <AppButton
        title={isEdit ? "Guardar cambios" : "Crear tour"}
        onPress={handleSave}
        loading={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  imagePreviewContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  imageHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  uploadButton: {
    marginBottom: spacing.md,
  },
});

