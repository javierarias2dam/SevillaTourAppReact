import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Screen } from "../components/Screen";
import { AppInput } from "../components/AppInput";
import { AppButton } from "../components/AppButton";
import { showToast } from "../components/Toast";
import { supabase } from "../services/supabase";
import { colors, spacing, typography } from "../theme";

type StopFormRouteProp = RouteProp<RootStackParamList, "StopForm">;
type StopFormNavProp = NativeStackNavigationProp<RootStackParamList, "StopForm">;

type Props = {
  route: StopFormRouteProp;
  navigation: StopFormNavProp;
};

type StopRow = {
  id: string;
  tour_id: string;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  stop_order?: number | null;
};

// Formulario para crear y editar paradas (stops) de un tour.
// - Valida título y que lat/lon sean números válidos.
// - En modo create, si stop_order está vacío, asigna último + 1.
// - En modo edit, carga la parada y hace update.
export default function StopFormScreen({ route, navigation }: Props) {
  const { mode, tourId, stopId, latitude: initialLat, longitude: initialLon } =
    route.params;
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState(
    initialLat != null ? String(initialLat) : ""
  );
  const [longitude, setLongitude] = useState(
    initialLon != null ? String(initialLon) : ""
  );
  const [stopOrder, setStopOrder] = useState("");

  const [titleError, setTitleError] = useState<string | undefined>();
  const [coordsError, setCoordsError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // Carga la parada desde Supabase en modo edición.
  useEffect(() => {
    const loadStop = async () => {
      if (!isEdit || !stopId) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("stops")
          .select(
            "id, tour_id, title, description, latitude, longitude, stop_order"
          )
          .eq("id", stopId)
          .single();

        if (error) throw error;

        const stop = data as StopRow;
        setTitle(stop.title ?? "");
        setDescription(stop.description ?? "");
        setLatitude(String(stop.latitude ?? ""));
        setLongitude(String(stop.longitude ?? ""));
        setStopOrder(
          typeof stop.stop_order === "number" ? String(stop.stop_order) : ""
        );
      } catch (err: any) {
        const message =
          err?.message ?? "No se han podido cargar los datos de la parada.";
        showToast("error", message);
      } finally {
        setLoading(false);
      }
    };

    loadStop();
  }, [isEdit, stopId]);

  const validate = () => {
    let ok = true;
    setTitleError(undefined);
    setCoordsError(undefined);

    if (!title.trim()) {
      setTitleError("El título es obligatorio.");
      ok = false;
    }

    const lat = Number(latitude.replace(",", "."));
    const lon = Number(longitude.replace(",", "."));

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setCoordsError("Latitud y longitud deben ser números válidos.");
      ok = false;
    }

    return { ok, lat, lon };
  };

  // Obtiene el siguiente stop_order disponible para el tour.
  const getNextOrder = async (): Promise<number> => {
    const { data, error } = await supabase
      .from("stops")
      .select("stop_order")
      .eq("tour_id", tourId)
      .order("stop_order", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const last = data?.[0]?.stop_order;
    if (typeof last === "number") {
      return last + 1;
    }
    return 1;
  };

  const handleSave = async () => {
    const { ok, lat, lon } = validate();
    if (!ok) return;

    try {
      setLoading(true);

      let finalOrder: number;
      if (stopOrder.trim()) {
        const parsed = Number(stopOrder);
        finalOrder = Number.isNaN(parsed) ? 1 : parsed;
      } else {
        // En create (o si se deja vacío), calculamos el siguiente orden disponible.
        finalOrder = await getNextOrder();
      }

      if (isEdit && stopId) {
        const { error } = await supabase
          .from("stops")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            latitude: lat,
            longitude: lon,
            stop_order: finalOrder,
          })
          .eq("id", stopId);

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
        showToast("success", "Parada actualizada correctamente");
      } else {
        const { error } = await supabase.from("stops").insert([
          {
            tour_id: tourId,
            title: title.trim(),
            description: description.trim() || null,
            latitude: lat,
            longitude: lon,
            stop_order: finalOrder,
          },
        ]);

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
              "Error de permisos: La política RLS de Supabase está bloqueando la creación. " +
              "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
            );
          }
          throw error;
        }
        showToast("success", "Parada creada correctamente");
      }

      // Al volver atrás, TourDetail recarga la lista con useFocusEffect.
      navigation.goBack();
    } catch (err: any) {
      const message =
        err?.message ?? "No se han podido guardar los datos de la parada.";
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>
        {isEdit ? "Editar parada" : "Añadir nueva parada"}
      </Text>

      <AppInput
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Nombre de la parada"
        errorText={titleError}
      />

      <AppInput
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Descripción breve (opcional)"
        multiline
      />

      <AppInput
        label="Latitud"
        value={latitude}
        onChangeText={setLatitude}
        keyboardType="numeric"
        placeholder="Ej: 37.3891"
      />

      <AppInput
        label="Longitud"
        value={longitude}
        onChangeText={setLongitude}
        keyboardType="numeric"
        placeholder="Ej: -5.9845"
        errorText={coordsError}
      />

      <AppInput
        label="Orden (opcional)"
        value={stopOrder}
        onChangeText={setStopOrder}
        keyboardType="numeric"
        placeholder="Si lo dejas vacío, se usa el último + 1"
      />

      <AppButton
        title={isEdit ? "Guardar cambios" : "Crear parada"}
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
});

