import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Register from "./src/screens/register";
import ToursScreen from "./src/screens/tourScreen";
import TourMapScreen from "./src/screens/tourMapScreen";
import TourDetailScreen from "./src/screens/tourDetailScreen";
import TourFormScreen from "./src/screens/tourFormScreen";
import StopFormScreen from "./src/screens/stopFormScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

// Tipado centralizado de la navegación de la app.
// Aquí declaramos todas las rutas del stack y los parámetros que reciben.
export type RootStackParamList = {
  // Pantalla de autenticación (login/registro)
  Register: undefined;
  // Lista de tours disponibles
  Tours: undefined;
  // Mapa detallado de un tour concreto
  MapaDetallado: { tourId: string; tourTitle: string };
  // Detalle de un tour (lista de paradas, acciones CRUD)
  TourDetail: { tourId: string; tourTitle: string };
  // Formulario para crear o editar un tour
  TourForm: { mode: "create" | "edit"; tourId?: string };
  // Formulario para crear o editar una parada (stop) de un tour.
  // Los parámetros latitude/longitude son opcionales y se usan
  // para pre-rellenar el formulario al crear desde el mapa.
  StopForm: {
    mode: "create" | "edit";
    tourId: string;
    stopId?: string;
    latitude?: number;
    longitude?: number;
  };
  // Tabs del pie de página (footer)
  Chat: undefined;
  Perfil: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Register">
        {/* Acceso a la aplicación: login/registro con Supabase */}
        <Stack.Screen
          name="Register"
          component={Register}
          options={{ title: "Acceso" }}
        />

        {/* Pantalla principal con la lista de tours */}
        <Stack.Screen
          name="Tours"
          component={ToursScreen}
          options={{ title: "Tours en Sevilla" }}
        />

        {/* Mapa interactivo que muestra la ruta de un tour */}
        <Stack.Screen
          name="MapaDetallado"
          component={TourMapScreen}
          options={{ title: "Mapa de la Ruta" }}
        />

        {/* Detalle de un tour: resumen e interacción con sus paradas */}
        <Stack.Screen
          name="TourDetail"
          component={TourDetailScreen}
          options={{ title: "Detalle del Tour" }}
        />

        {/* Formulario reutilizable para crear y editar tours */}
        <Stack.Screen
          name="TourForm"
          component={TourFormScreen}
          options={{ title: "Editar / Crear Tour" }}
        />

        {/* Formulario para crear y editar paradas (stops) de un tour */}
        <Stack.Screen
          name="StopForm"
          component={StopFormScreen}
          options={{ title: "Editar / Crear Parada" }}
        />

        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: "Chat" }}
        />

        <Stack.Screen
          name="Perfil"
          component={ProfileScreen}
          options={{ title: "Perfil" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
