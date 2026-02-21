import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../services/supabase";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Screen } from "../components/Screen";
import { AppButton } from "../components/AppButton";
import { BottomBar } from "../components/BottomBar";
import { showToast } from "../components/Toast";
import { colors, spacing, typography } from "../theme";

type Tour = {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string;
  // URL pública de la imagen del tour (si existe).
  imageUrl?: string | null;
  // Marcas derivadas de tablas auxiliares:
  // - favorites: si el usuario actual ha marcado este tour como favorito.
  // - visited_tours: si el usuario ha completado/visitado este tour.
  isFavorite?: boolean;
  isVisited?: boolean;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Tours">;
};

export default function ToursScreen({ navigation }: Props) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(
    null,
  );

  // Carga la lista de tours desde Supabase.
  // Se usa tanto al entrar por primera vez como al hacer pull-to-refresh
  // o cuando la pantalla vuelve a estar enfocada tras crear/editar un tour.
  const fetchTours = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      // Obtenemos el usuario actual para poder cruzar con favoritos/visitados.
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;
      const userId = userData.user?.id;

      // 1) Intentamos leer también la columna image_url de la tabla tours.
      //    Si el schema no la tiene, hacemos fallback a la consulta original.
      let toursRaw: any[] = [];

      const { data, error: dbError } = await supabase
        .from("tours")
        .select("id, title, description, created_at, image_url")
        .order("created_at", { ascending: false });

      if (dbError) {
        const code = (dbError as any).code as string | undefined;
        const message = (dbError as any).message as string | undefined;

        const isMissingColumn =
          code === "42703" ||
          (message && message.includes('column "image_url"'));

        if (isMissingColumn) {
          // Fallback: repetimos la consulta sin image_url para no romper.
          const { data: dataNoImage, error: errorNoImage } = await supabase
            .from("tours")
            .select("id, title, description, created_at")
            .order("created_at", { ascending: false });

          if (errorNoImage) throw errorNoImage;
          toursRaw = dataNoImage ?? [];
        } else {
          throw dbError;
        }
      } else {
        toursRaw = data ?? [];
      }

      // 2) Intentamos complementar con una tabla auxiliar "tour_images" si existe.
      //    Esta tabla permite guardar una o varias imágenes por tour.
      const tourIds = toursRaw.map((t: any) => t.id).filter(Boolean);
      const latestTourImages: Record<string, string> = {};

      if (tourIds.length > 0) {
        try {
          const { data: imagesData, error: imagesError } = await supabase
            .from("tour_images")
            .select("tour_id, url, created_at")
            .in("tour_id", tourIds)
            .order("created_at", { ascending: false });

          if (!imagesError && imagesData) {
            for (const img of imagesData as any[]) {
              const tid = String(img.tour_id);
              // Nos quedamos con la imagen más reciente por tour.
              if (!latestTourImages[tid]) {
                latestTourImages[tid] = img.url;
              }
            }
          }
        } catch {
          // Si la tabla no existe u ocurre otro error, simplemente
          // no usamos imágenes auxiliares y continuamos.
        }
      }

      // 3) Si tenemos userId, leemos favoritos y tours visitados para este usuario.
      // Tablas esperadas en Supabase:
      //   create table if not exists public.favorites (
      //     id uuid primary key default gen_random_uuid(),
      //     user_id uuid references auth.users(id) on delete cascade,
      //     tour_id uuid references public.tours(id) on delete cascade,
      //     created_at timestamptz not null default now(),
      //     unique (user_id, tour_id)
      //   );
      //
      //   create table if not exists public.visited_tours (
      //     id uuid primary key default gen_random_uuid(),
      //     user_id uuid references auth.users(id) on delete cascade,
      //     tour_id uuid references public.tours(id) on delete cascade,
      //     visited_at timestamptz not null default now(),
      //     unique (user_id, tour_id)
      //   );
      //
      // Si aún no las has creado, puedes usar este SQL (adaptándolo a tu schema)
      // en el panel de SQL de Supabase. Si no existen, las consultas de abajo
      // fallarán, pero están envueltas en try/catch para que la app no rompa.
      const favoriteIds = new Set<string>();
      const visitedIds = new Set<string>();

      if (userId) {
        try {
          const { data: favData, error: favError } = await supabase
            .from("favorites")
            .select("tour_id")
            .eq("user_id", userId);

          if (!favError && favData) {
            favData.forEach((row: any) => {
              if (row?.tour_id) favoriteIds.add(String(row.tour_id));
            });
          }
        } catch {
          // Si la tabla favorites no existe, simplemente no marcamos favoritos.
        }

        try {
          const { data: visitedData, error: visitedError } = await supabase
            .from("visited_tours")
            .select("tour_id")
            .eq("user_id", userId);

          if (!visitedError && visitedData) {
            visitedData.forEach((row: any) => {
              if (row?.tour_id) visitedIds.add(String(row.tour_id));
            });
          }
        } catch {
          // Si la tabla visited_tours no existe, no marcamos tours visitados.
        }
      }

      // 4) Mapeamos a tipo Tour con tipado robusto y aplicamos prioridad:
      //    image_url de la tabla tours > última entrada en tour_images.
      const safeData: Tour[] =
        toursRaw?.map((t: any) => {
          const tourId = String(t.id);
          const imageFromColumn = (t as any)?.image_url ?? null;
          const imageFromAux = latestTourImages[tourId] ?? null;

          return {
            id: tourId,
            title: t.title ?? "Sin título",
            description: t.description ?? "",
            created_at: t.created_at,
            imageUrl: imageFromColumn || imageFromAux,
            isFavorite: favoriteIds.has(tourId),
            isVisited: visitedIds.has(tourId),
          };
        }) ?? [];

      setTours(safeData);
    } catch (err: any) {
      const message = err?.message ?? "No se han podido cargar los tours.";
      setError(message);
      showToast("error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refrescamos la lista cada vez que la pantalla gana foco
  // para reflejar cambios tras crear/editar tours.
  useFocusEffect(
    useCallback(() => {
      fetchTours();
    }, [fetchTours]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTours();
  };

  // Eliminación de un tour con actualización optimista de la UI:
  // quitamos el tour de la lista primero y, si algo falla, lo restauramos.
  const handleDelete = (tourId: string) => {
    Alert.alert(
      "Eliminar tour",
      "¿Seguro que quieres eliminar este tour?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const previousTours = [...tours];
            setTours((current) => current.filter((t) => t.id !== tourId));

            try {
              const { error: dbError, data } = await supabase
                .from("tours")
                .delete()
                .eq("id", tourId)
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

              // Verificamos que realmente se eliminó
              if (!data || data.length === 0) {
                const { data: checkData } = await supabase
                  .from("tours")
                  .select("id")
                  .eq("id", tourId)
                  .maybeSingle();
                
                if (checkData) {
                  throw new Error(
                    "El tour no se eliminó. Probablemente hay un problema con las políticas RLS. " +
                    "Consulta SUPABASE_SETUP.md para configurar las políticas correctamente."
                  );
                }
              }

              showToast("success", "Tour eliminado correctamente");
            } catch (err: any) {
              const message =
                err?.message ?? "No se ha podido eliminar el tour.";
              // Restauramos la lista previa si algo falla en Supabase
              setTours(previousTours);
              showToast("error", message);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleToggleFavorite = async (tourId: string) => {
    if (togglingFavoriteId) return;

    try {
      setTogglingFavoriteId(tourId);

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw (
          userError || new Error("Debes iniciar sesión para usar favoritos.")
        );
      }

      const userId = userData.user.id;

      const current = tours.find((t) => t.id === tourId);
      const isCurrentlyFavorite = current?.isFavorite;

      if (!isCurrentlyFavorite) {
        const { error: insertError } = await supabase.from("favorites").insert([
          {
            user_id: userId,
            tour_id: tourId,
          },
        ]);

        if (insertError) {
          // Detectamos si el error es porque la tabla no existe
          const errorMessage = insertError.message || "";
          const errorCode = (insertError as any).code || "";
          
          if (
            errorCode === "42P01" ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("no existe") ||
            errorMessage.includes("schema cache")
          ) {
            throw new Error(
              "La tabla 'favorites' no existe. Por favor, créala en Supabase usando el SQL proporcionado en SUPABASE_SETUP.md"
            );
          }
          throw insertError;
        }
        setTours((prev) =>
          prev.map((t) => (t.id === tourId ? { ...t, isFavorite: true } : t)),
        );
        showToast("success", "Tour añadido a favoritos.");
      } else {
        const { error: deleteError } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("tour_id", tourId);

        if (deleteError) {
          // Detectamos si el error es porque la tabla no existe
          const errorMessage = deleteError.message || "";
          const errorCode = (deleteError as any).code || "";
          
          if (
            errorCode === "42P01" ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("no existe") ||
            errorMessage.includes("schema cache")
          ) {
            throw new Error(
              "La tabla 'favorites' no existe. Por favor, créala en Supabase usando el SQL proporcionado en SUPABASE_SETUP.md"
            );
          }
          throw deleteError;
        }
        setTours((prev) =>
          prev.map((t) => (t.id === tourId ? { ...t, isFavorite: false } : t)),
        );
        showToast("success", "Tour quitado de favoritos.");
      }
    } catch (err: any) {
      const message =
        err?.message ?? "No se ha podido actualizar el estado de favorito.";
      showToast("error", message);
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  const filteredTours = favoritesOnly
    ? tours.filter((t) => t.isFavorite)
    : tours;

  const renderItem = ({ item }: { item: Tour }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text
            style={[
              styles.favoriteIcon,
              item.isFavorite && styles.favoriteIconActive,
            ]}
            // Usamos un simple emoji para representar el estado de favorito.
            // Esto mejora la experiencia porque el usuario puede marcar rápidamente
            // qué tours quiere consultar o repetir más adelante.
            onPress={() => handleToggleFavorite(item.id)}
          >
            {item.isFavorite ? "★" : "☆"}
          </Text>
        </View>

        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : null}

        {item.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : (
          <Text style={styles.cardDescriptionMuted}>
            Sin descripción disponible
          </Text>
        )}

        <View style={styles.cardButtonsRow}>
          <AppButton
            title="Detalle"
            variant="secondary"
            onPress={() =>
              navigation.navigate("TourDetail", {
                tourId: item.id,
                tourTitle: item.title,
              })
            }
            style={styles.cardButton}
          />
          <AppButton
            title="Editar"
            variant="primary"
            onPress={() =>
              navigation.navigate("TourForm", {
                mode: "edit",
                tourId: item.id,
              })
            }
            style={styles.cardButton}
          />
          <AppButton
            title="Eliminar"
            variant="secondary"
            onPress={() => handleDelete(item.id)}
            style={styles.cardButton}
          />
        </View>

        <View style={styles.mapButtonContainer}>
          <AppButton
            title="Ver mapa"
            onPress={() =>
              navigation.navigate("MapaDetallado", {
                tourId: item.id,
                tourTitle: item.title,
              })
            }
          />
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={styles.mainContent}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Tus tours</Text>
          <Text style={styles.headerSubtitle}>
            Marca favoritos y filtra para planificar mejor tus visitas.
          </Text>
        </View>
        <AppButton
          title="Crear tour"
          variant="primary"
          onPress={() =>
            navigation.navigate("TourForm", {
              mode: "create",
            })
          }
        />
      </View>

      <View style={styles.filtersRow}>
        <Text
          style={[styles.filterChip, favoritesOnly && styles.filterChipActive]}
          onPress={() => setFavoritesOnly((prev) => !prev)}
        >
          {favoritesOnly ? "Mostrar todos" : "Solo favoritos"}
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredTours}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            tours.length === 0 ? styles.emptyListContainer : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No hay tours todavía. Crea tu primer tour.
            </Text>
          }
        />
      )}
      </View>
      <BottomBar
        activeTab="tours"
        onNavigate={(route) => navigation.navigate(route)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mainContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  cardImage: {
    width: "100%",
    height: 160,
    borderRadius: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filtersRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: spacing.sm,
  },
  filterChip: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.muted,
    color: colors.textSecondary,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: (colors as any).onPrimary || "#ffffff",
  },

  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardDescriptionMuted: {
    ...typography.body,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: spacing.sm,
  },
  cardButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    gap: spacing.xs as number,
  },
  cardButton: {
    flex: 1,
  },
  mapButtonContainer: {
    alignItems: "flex-end",
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
  favoriteIcon: {
    fontSize: 22,
    paddingHorizontal: spacing.xs,
    color: colors.muted,
  },
  favoriteIconActive: {
    color: colors.primary,
  },
});
