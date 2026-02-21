import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text, Alert, ActivityIndicator } from "react-native";
import MapView, {
  Marker,
  Region,
  Polyline,
  LongPressEvent,
  Callout,
} from "react-native-maps";
import { supabase } from "../services/supabase";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { AppButton } from "../components/AppButton";
import { colors, spacing, typography } from "../theme";

type Stop = {
  id: string;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
};

type TourMapRouteProp = RouteProp<RootStackParamList, "MapaDetallado">;
type TourMapNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "MapaDetallado"
>;

type TourMapProps = {
  route: TourMapRouteProp;
  navigation: TourMapNavProp;
};

const SEVILLA_CENTER: Region = {
  latitude: 37.3891,
  longitude: -5.9845,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function TourMapScreen({ route, navigation }: TourMapProps) {
  const { tourId, tourTitle } = route.params;

  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    fetchStops();
  }, [tourId]);

  async function fetchStops() {
    try {
      setLoading(true);
      // Leemos también la descripción para mostrarla en el Callout.
      const { data, error } = await supabase
        .from("stops")
        .select("id, title, description, latitude, longitude")
        .eq("tour_id", tourId)
        .order("stop_order");

      if (error) throw error;

      const safeStops: Stop[] =
        data?.map((s: any) => ({
          id: String(s.id),
          title: s.title ?? "Sin título",
          description: s.description ?? "",
          latitude: Number(s.latitude ?? SEVILLA_CENTER.latitude),
          longitude: Number(s.longitude ?? SEVILLA_CENTER.longitude),
        })) ?? [];

      setStops(safeStops);

      // Calculamos el encuadre del mapa:
      // si hay varias paradas usamos fitToCoordinates para que todas entren en pantalla,
      // si solo hay una centramos cerca de ella, y si no hay usamos el centro de Sevilla.
      if (safeStops.length > 0 && mapRef.current) {
        const coords = safeStops.map((s) => ({
          latitude: s.latitude,
          longitude: s.longitude,
        }));

        if (coords.length === 1) {
          const single = coords[0];
          const region: Region = {
            latitude: single.latitude,
            longitude: single.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          mapRef.current.animateToRegion(region, 500);
        } else {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "No se han podido cargar las paradas del tour.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLongPress(event: LongPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    // Permitimos añadir una parada en el punto pulsado.
    Alert.alert(
      "Nueva parada",
      `¿Quieres añadir una parada en:\nLat: ${latitude.toFixed(
        4,
      )}\nLon: ${longitude.toFixed(4)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Añadir",
          onPress: () =>
            navigation.navigate("StopForm", {
              mode: "create",
              tourId,
              latitude,
              longitude,
            }),
        },
      ],
    );
  }

  if (loading && stops.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando paradas...</Text>
      </View>
    );
  }

  if (!loading && stops.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>{tourTitle}</Text>
        <Text style={styles.emptyText}>
          Este tour aún no tiene paradas en el mapa.
        </Text>
        <View style={styles.addButtonContainer}>
          <AppButton
            title="Añadir parada"
            onPress={() =>
              navigation.navigate("StopForm", { mode: "create", tourId })
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.headerTitle}>{tourTitle}</Text>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SEVILLA_CENTER}
        onLongPress={handleLongPress}
      >
        <Polyline
          coordinates={stops.map((s) => ({
            latitude: s.latitude,
            longitude: s.longitude,
          }))}
          strokeColor="blue"
          strokeWidth={3}
        />

        {stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.title}
            onPress={() => setSelectedId(stop.id)}
            pinColor={stop.id === selectedId ? "blue" : "red"}
          >
            {/* Callout interactivo para cada parada.
                Integra datos de Supabase (título y descripción) y permite
                navegar al detalle del tour. */}
            <Callout tooltip>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{stop.title}</Text>
                {stop.description ? (
                  <Text style={styles.calloutDescription} numberOfLines={3}>
                    {stop.description}
                  </Text>
                ) : (
                  <Text style={styles.calloutDescriptionMuted}>
                    Sin descripción disponible
                  </Text>
                )}
                <View style={styles.calloutButtonContainer}>
                  <AppButton
                    title="Ver detalle"
                    variant="primary"
                    onPress={() =>
                      navigation.navigate("TourDetail", {
                        tourId,
                        tourTitle,
                      })
                    }
                  />
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  addButtonContainer: {
    marginTop: spacing.sm,
  },
  headerTitle: {
    ...typography.subtitle,
    fontWeight: "bold",
    padding: spacing.sm,
    color: colors.text,
  },
  map: { flex: 1 },

  calloutContainer: {
    padding: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    maxWidth: 260,
  },
  calloutTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  calloutDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  calloutDescriptionMuted: {
    ...typography.body,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: spacing.sm,
  },
  calloutButtonContainer: {
    marginTop: spacing.xs,
  },
});
