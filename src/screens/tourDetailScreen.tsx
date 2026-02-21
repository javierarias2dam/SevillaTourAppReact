import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { showToast } from "../components/Toast";
import { supabase } from "../services/supabase";
import { colors, spacing, typography } from "../theme";
// Para generar PDFs y compartirlos usamos expo-print y expo-sharing.
// Si no están instalados en el proyecto, ejecuta en la raíz:
//   npx expo install expo-print expo-sharing
// expo-print genera el PDF a partir de HTML, por lo que construimos
// una plantilla HTML en utils/pdf.ts.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildTourHtml } from "../utils/pdf";
// Para usar Text-to-Speech necesitamos instalar expo-speech en el proyecto.
// Si aún no está instalado, ejecuta en la raíz del proyecto:
//   npx expo install expo-speech
// o bien añade "expo-speech" a las dependencias de package.json y vuelve a instalar.
// IMPORTANTE: expo-speech actualmente no expone una API real de pause/resume, solo stop().
// Más abajo simulamos la pausa deteniendo la locución y manteniendo estado en la UI.
import * as Speech from "expo-speech";

type TourDetailRouteProp = RouteProp<RootStackParamList, "TourDetail">;
type TourDetailNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "TourDetail"
>;

type Props = {
  route: TourDetailRouteProp;
  navigation: TourDetailNavProp;
};

type Tour = {
  id: string;
  title: string;
  description?: string | null;
  // URL pública de la imagen del tour (si existe).
  imageUrl?: string | null;
};

type Stop = {
  id: string;
  tour_id: string;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  stop_order: number;
};

// Pantalla de detalle de un tour.
// - Carga la información del tour desde Supabase.
// - Carga y muestra la lista de paradas (stops) ordenadas por stop_order.
// - Permite CRUD de paradas (añadir, editar, eliminar).
// - Permite reordenar paradas con botones subir/bajar (intercambiando stop_order).
export default function TourDetailScreen({ route, navigation }: Props) {
  const { tourId, tourTitle } = route.params;

  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingStopId, setSpeakingStopId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false); // Pausa SIMULADA, porque expo-speech no tiene pause/resume real.
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isVisited, setIsVisited] = useState(false);
  const [markingVisited, setMarkingVisited] = useState(false);

  const loadTourAndStops = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // 1) Cargamos datos del tour desde Supabase, intentando también leer image_url.
      //    Si el schema no tiene ese campo, hacemos fallback a la consulta original.
      let tourRow: any = null;
      let imageFromColumn: string | null = null;

      const { data: tourWithImage, error: tourError } = await supabase
        .from("tours")
        .select("id, title, description, image_url")
        .eq("id", tourId)
        .single();

      if (tourError) {
        const code = (tourError as any).code as string | undefined;
        const message = (tourError as any).message as string | undefined;

        const isMissingColumn =
          code === "42703" ||
          (message && message.includes('column "image_url"'));

        if (isMissingColumn) {
          // Fallback: repetimos la consulta sin image_url para no romper.
          const { data: tourNoImage, error: tourNoImageError } = await supabase
            .from("tours")
            .select("id, title, description")
            .eq("id", tourId)
            .single();

          if (tourNoImageError) throw tourNoImageError;
          tourRow = tourNoImage;
        } else {
          throw tourError;
        }
      } else {
        tourRow = tourWithImage;
        imageFromColumn = (tourWithImage as any)?.image_url ?? null;
      }

      // Intentamos complementar con tabla auxiliar "tour_images" si existe,
      // cogiendo la imagen más reciente asociada a este tour.
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

      const safeTour: Tour = {
        id: String(tourRow.id),
        title: tourRow.title ?? tourTitle,
        description: tourRow.description ?? "",
        imageUrl: imageFromColumn || imageFromAux,
      };
      setTour(safeTour);

      // 2) Cargamos paradas del tour ordenadas por stop_order.
      const { data: stopsData, error: stopsError } = await supabase
        .from("stops")
        .select(
          "id, tour_id, title, description, latitude, longitude, stop_order",
        )
        .eq("tour_id", tourId)
        .order("stop_order", { ascending: true });

      if (stopsError) throw stopsError;

      const safeStops: Stop[] =
        stopsData?.map((s: any, index: number) => ({
          id: String(s.id),
          tour_id: String(s.tour_id ?? tourId),
          title: s.title ?? `Parada ${index + 1}`,
          description: s.description ?? "",
          latitude: Number(s.latitude ?? 0),
          longitude: Number(s.longitude ?? 0),
          stop_order:
            typeof s.stop_order === "number" ? s.stop_order : index + 1,
        })) ?? [];

      setStops(safeStops);

      // 3) Comprobamos si el usuario actual ha marcado este tour como visitado.
      // Tabla auxiliar recomendada en Supabase (si no existe, puedes crearla):
      //
      //   create table if not exists public.visited_tours (
      //     id uuid primary key default gen_random_uuid(),
      //     user_id uuid references auth.users(id) on delete cascade,
      //     tour_id uuid references public.tours(id) on delete cascade,
      //     visited_at timestamptz not null default now(),
      //     unique (user_id, tour_id)
      //   );
      //
      // Esto mejora la experiencia porque permite a cada usuario llevar un
      // registro personal de los tours que ya ha realizado, similar a un
      // "historial" o "checklist" de viajes.
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (!userError && userData.user) {
          const userId = userData.user.id;
          const { data: visitedRows, error: visitedError } = await supabase
            .from("visited_tours")
            .select("id")
            .eq("user_id", userId)
            .eq("tour_id", tourId)
            .maybeSingle();

          if (!visitedError && visitedRows) {
            setIsVisited(true);
          } else {
            setIsVisited(false);
          }
        } else {
          setIsVisited(false);
        }
      } catch {
        // Si la tabla visited_tours no existe o hay cualquier problema de schema,
        // simplemente no marcamos el tour como visitado para no romper la UI.
        setIsVisited(false);
      }
    } catch (err: any) {
      const message =
        err?.message ?? "No se ha podido cargar la información del tour.";
      setError(message);
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  }, [tourId, tourTitle]);

  // Recargamos los datos siempre que la pantalla gana foco
  // (por ejemplo, después de crear/editar una parada).
  useFocusEffect(
    useCallback(() => {
      loadTourAndStops();

      // Al ganar foco limpiamos cualquier locución previa por seguridad.
      return () => {
        Speech.stop();
        setSpeakingStopId(null);
        setIsPaused(false);
      };
    }, [loadTourAndStops]),
  );

  const stopSpeechCompletely = () => {
    Speech.stop();
    setSpeakingStopId(null);
    setIsPaused(false);
  };

  const handlePlayStop = (stop: Stop) => {
    // Siempre detenemos cualquier locución anterior antes de empezar una nueva.
    Speech.stop();

    // Si no hay descripción, solo leemos el título (requisito de feedback).
    const hasDescription =
      typeof stop.description === "string" &&
      stop.description.trim().length > 0;
    const textToSpeak = hasDescription
      ? `${stop.title}. ${stop.description}`
      : stop.title;

    setSpeakingStopId(stop.id);
    setIsPaused(false);

    Speech.speak(textToSpeak, {
      language: "es-ES",
      onDone: () => {
        // Cuando termina de leer, limpiamos el estado de forma automática.
        setSpeakingStopId((current) => (current === stop.id ? null : current));
        setIsPaused(false);
      },
      onStopped: () => {
        // onStopped se dispara cuando llamamos a Speech.stop().
        // No limpiamos speakingStopId aquí porque lo hacemos explícitamente
        // en stopSpeechCompletely o en la lógica de "pausa" simulada.
      },
      onError: () => {
        setSpeakingStopId((current) => (current === stop.id ? null : current));
        setIsPaused(false);
      },
    });
  };

  const handlePauseStop = (stopId: string) => {
    if (speakingStopId !== stopId) return;
    if (isPaused) return;

    // IMPORTANTE: expo-speech no soporta pausa/reanudación real.
    // Aquí "pausa" se SIMULA deteniendo la locución con Speech.stop()
    // y manteniendo un flag isPaused para la UI. Si el usuario pulsa "Play"
    // de nuevo, el texto se volverá a leer desde el principio.
    Speech.stop();
    setIsPaused(true);
  };

  const handleStopStop = (stopId: string) => {
    if (speakingStopId !== stopId) return;
    stopSpeechCompletely();
  };

  const handleMarkAsVisited = async () => {
    if (markingVisited) return;

    try {
      setMarkingVisited(true);

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw (
          userError || new Error("Debes iniciar sesión para marcar un tour.")
        );
      }

      const userId = userData.user.id;

      // Insertamos (o en caso de existir, simplemente dejamos el registro).
      // Gracias a la restricción unique(user_id, tour_id) evitamos duplicados.
      const { error: insertError } = await supabase
        .from("visited_tours")
        .upsert(
          [
            {
              user_id: userId,
              tour_id: tourId,
            },
          ],
          {
            onConflict: "user_id,tour_id",
          },
        );

      if (insertError) throw insertError;

      setIsVisited(true);
      showToast(
        "success",
        "Has marcado este tour como visitado. ¡Buen recuerdo para tu historial!",
      );
    } catch (err: any) {
      const message =
        err?.message ?? "No se ha podido marcar el tour como visitado.";
      showToast("error", message);
    } finally {
      setMarkingVisited(false);
    }
  };

  // Genera un PDF con los datos del tour y sus paradas usando expo-print
  // a partir de una plantilla HTML (buildTourHtml), y luego abre el diálogo
  // de compartir/guardar con expo-sharing.
  //
  // Usamos HTML porque expo-print internamente renderiza HTML/CSS para
  // producir el PDF, lo que asegura mejor compatibilidad entre plataformas
  // y nos permite maquetar fácilmente el contenido (logo, títulos, lista, etc.).
  const handleGeneratePdf = async () => {
    if (!tour) {
      showToast("error", "No se ha podido generar el PDF sin datos del tour.");
      return;
    }

    try {
      setPdfError(null);
      setPdfLoading(true);

      const html = buildTourHtml(
        {
          title: tour.title,
          description: tour.description,
        },
        stops.map((s) => ({
          title: s.title,
          description: s.description,
          stop_order: s.stop_order,
        })),
      );

      const { uri } = await Print.printToFileAsync({
        html,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        showToast(
          "info",
          "El dispositivo no soporta la ventana de compartir para PDFs.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Compartir tour "${tour.title}"`,
      });

      showToast("success", "PDF generado correctamente.");
    } catch (err: any) {
      const message =
        err?.message ?? "No se ha podido generar el PDF del tour.";
      setPdfError(message);
      showToast("error", message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDeleteStop = (stopId: string) => {
    Alert.alert(
      "Eliminar parada",
      "¿Seguro que quieres eliminar esta parada?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const previousStops = [...stops];
            setStops((current) => current.filter((s) => s.id !== stopId));

            try {
              const { error: dbError, data } = await supabase
                .from("stops")
                .delete()
                .eq("id", stopId)
                .select();

              if (dbError) {
                // Detectamos errores comunes de RLS o permisos
                const errorMessage = dbError.message || "";
                const errorCode = (dbError as any).code || "";
                
                if (
                  errorMessage.includes("row-level security") ||
                  errorMessage.includes("RLS") ||
                  errorCode === "42501"
                ) {
                  throw new Error(
                    "Error de permisos: La política RLS de Supabase está bloqueando la eliminación. " +
                    "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
                  );
                }
                throw dbError;
              }

              // Verificamos que realmente se eliminó (data debería contener el registro eliminado)
              // Si no hay data pero tampoco hay error, puede ser un problema de RLS silencioso
              if (!data || data.length === 0) {
                // Intentamos verificar si la parada aún existe
                const { data: checkData } = await supabase
                  .from("stops")
                  .select("id")
                  .eq("id", stopId)
                  .maybeSingle();
                
                if (checkData) {
                  throw new Error(
                    "La parada no se eliminó. Probablemente hay un problema con las políticas RLS. " +
                    "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
                  );
                }
              }

              showToast("success", "Parada eliminada correctamente");
            } catch (err: any) {
              const message =
                err?.message ?? "No se ha podido eliminar la parada.";
              setStops(previousStops);
              showToast("error", message);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Reordenación simple intercambiando stop_order con la parada anterior o siguiente.
  const handleMove = async (index: number, direction: "up" | "down") => {
    if (loadingReorder) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === stops.length - 1) return;

    const otherIndex = direction === "up" ? index - 1 : index + 1;
    const current = stops[index];
    const other = stops[otherIndex];

    if (!current || !other) return;

    const originalStops = [...stops];

    // Actualizamos en memoria el orden
    const newStops = [...stops];
    newStops[index] = { ...other };
    newStops[otherIndex] = { ...current };
    setStops(newStops);

    try {
      setLoadingReorder(true);

      // Persistimos en Supabase intercambiando stop_order de ambas filas.
      const { error: error1 } = await supabase
        .from("stops")
        .update({ stop_order: other.stop_order })
        .eq("id", current.id);

      const { error: error2 } = await supabase
        .from("stops")
        .update({ stop_order: current.stop_order })
        .eq("id", other.id);

      if (error1 || error2) {
        throw error1 || error2;
      }
    } catch (err: any) {
      const message = err?.message ?? "No se ha podido reordenar la parada.";
      setStops(originalStops);
      showToast("error", message);
    } finally {
      setLoadingReorder(false);
    }
  };

  const renderStop = ({ item, index }: { item: Stop; index: number }) => {
    const isCurrentSpeaking = speakingStopId === item.id && !isPaused;
    const isCurrentPaused = speakingStopId === item.id && isPaused;

    return (
      <View
        style={[
          styles.stopCard,
          isCurrentSpeaking && styles.stopCardSpeaking,
          isCurrentPaused && styles.stopCardPaused,
        ]}
      >
        <View style={styles.stopHeaderRow}>
          <Text style={styles.stopTitle}>
            {index + 1}. {item.title}
          </Text>
          <Text style={styles.stopOrderText}>Orden: {item.stop_order}</Text>
        </View>

        {item.description ? (
          <Text style={styles.stopDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : (
          <Text style={styles.stopDescriptionMuted}>
            Sin descripción disponible
          </Text>
        )}

        <Text style={styles.stopCoords}>
          ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
        </Text>

        {(isCurrentSpeaking || isCurrentPaused) && (
          <Text style={styles.stopSpeakingStatus}>
            {isCurrentSpeaking ? "Leyendo..." : "En pausa (simulada)"}
          </Text>
        )}

        <View style={styles.stopButtonsRow}>
          <AppButton
            title="Play"
            variant="primary"
            onPress={() => handlePlayStop(item)}
            style={styles.stopButton}
          />
          <AppButton
            title="Pause"
            variant="secondary"
            onPress={() => handlePauseStop(item.id)}
            disabled={speakingStopId !== item.id || isPaused}
            style={styles.stopButton}
          />
          <AppButton
            title="Stop"
            variant="secondary"
            onPress={() => handleStopStop(item.id)}
            disabled={speakingStopId !== item.id}
            style={styles.stopButton}
          />
        </View>

        <View style={styles.stopButtonsRow}>
          <AppButton
            title="Editar"
            variant="primary"
            onPress={() =>
              navigation.navigate("StopForm", {
                mode: "edit",
                tourId,
                stopId: item.id,
              })
            }
            style={styles.stopButton}
          />
          <AppButton
            title="Eliminar"
            variant="secondary"
            onPress={() => handleDeleteStop(item.id)}
            style={styles.stopButton}
          />
        </View>

        <View style={styles.stopReorderRow}>
          <AppButton
            title="Subir"
            variant="secondary"
            onPress={() => handleMove(index, "up")}
            disabled={index === 0 || loadingReorder}
            style={styles.stopReorderButton}
          />
          <AppButton
            title="Bajar"
            variant="secondary"
            onPress={() => handleMove(index, "down")}
            disabled={index === stops.length - 1 || loadingReorder}
            style={styles.stopReorderButton}
          />
        </View>
      </View>
    );
  };

  if (loading && !tour) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {tour?.imageUrl ? (
          <Image
            source={{ uri: tour.imageUrl }}
            style={styles.tourImage}
            resizeMode="cover"
          />
        ) : null}

        <Text style={styles.title}>{tour?.title ?? tourTitle}</Text>
        {tour?.description ? (
          <Text style={styles.subtitle}>{tour.description}</Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.addButtonContainer}>
          <AppButton
            title="Añadir parada"
            onPress={() =>
              navigation.navigate("StopForm", { mode: "create", tourId })
            }
            style={styles.primaryActionButton}
          />
          <AppButton
            title="Generar PDF"
            variant="secondary"
            onPress={handleGeneratePdf}
            loading={pdfLoading}
            style={styles.secondaryActionButton}
          />
        </View>

        <View style={styles.visitedRow}>
          <AppButton
            title={isVisited ? "Visitado" : "Marcar como visitado"}
            variant={isVisited ? "secondary" : "primary"}
            onPress={handleMarkAsVisited}
            loading={markingVisited}
            style={styles.visitedButton}
          />
          {isVisited ? (
            <Text style={styles.visitedLabel}>
              ✅ Has completado este tour. Esto se guarda por usuario para
              mejorar tu experiencia y recordar qué ya has visitado.
            </Text>
          ) : (
            <Text style={styles.visitedLabel}>
              Marca el tour como visitado cuando lo completes para llevar un
              registro personal.
            </Text>
          )}
        </View>

        {pdfError ? <Text style={styles.pdfErrorText}>{pdfError}</Text> : null}

        {loading && tour ? (
          <View style={styles.loadingStopsContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        <FlatList
          data={stops}
          keyExtractor={(item) => item.id}
          renderItem={renderStop}
          contentContainerStyle={
            stops.length === 0 ? styles.emptyListContainer : undefined
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Este tour aún no tiene paradas. Añade la primera.
            </Text>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tourImage: {
    width: "100%",
    height: 220,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.title,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  addButtonContainer: {
    flexDirection: "row",
    gap: spacing.xs as number,
    marginBottom: spacing.md,
  },
  primaryActionButton: {
    flex: 1,
  },
  secondaryActionButton: {
    flex: 1,
  },
  loadingStopsContainer: {
    marginBottom: spacing.sm,
  },
  stopCard: {
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  stopHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  stopTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  stopOrderText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  stopDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  stopDescriptionMuted: {
    ...typography.body,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  stopCoords: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  stopButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.xs as number,
  },
  stopButton: {
    flex: 1,
  },
  stopReorderRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.xs as number,
  },
  stopReorderButton: {
    flex: 0.4,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
  },
  pdfErrorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  visitedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs as number,
    marginBottom: spacing.md,
  },
  visitedButton: {
    flex: 0.8,
  },
  visitedLabel: {
    flex: 1.2,
    ...typography.caption,
    color: colors.textSecondary,
  },

  stopCardSpeaking: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stopCardPaused: {
    borderWidth: 1,
    borderColor: colors.muted,
  },
  stopSpeakingStatus: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
});
