# YourSevilleTourGuide

**Autor:** Javier Arias Olanda
**Fecha de creación:** Febrero 2025  
**Última actualización:** Febrero 2025  
**Versión:** v1.0.0

---

## Descripción de la aplicación

**YourSevilleTourGuide** es una aplicación móvil multiplataforma (Android, iOS y web) que funciona como guía turística interactiva de Sevilla. Permite consultar, crear y gestionar tours y sus paradas, visualizar rutas en un mapa y utilizar funciones de accesibilidad como síntesis de voz.

### Objetivo

Ofrecer una herramienta práctica para que usuarios y creadores de contenido puedan:

- Explorar tours temáticos por Sevilla.
- Gestionar tours y paradas (crear, editar, eliminar).
- Ver las rutas en un mapa con las paradas geolocalizadas.
- Compartir o imprimir información en PDF y usar lectura en voz alta.

### Problema que resuelve

- **Para visitantes:** centraliza información de tours en una sola app, con mapa y descripciones, sin depender de folletos o múltiples webs.
- **Para gestores de contenido:** permite mantener catálogos de tours y paradas con imágenes, descripciones y coordenadas desde el móvil.
- **Para usuarios con necesidades de accesibilidad:** integra lectura en voz alta de descripciones.

### Público objetivo

| Perfil              | Uso principal                          |
|---------------------|----------------------------------------|
| Turistas            | Descubrir y seguir tours por Sevilla   |
| Guías / creadores   | Crear y mantener tours y paradas       |
| Usuarios con TTS    | Escuchar descripciones con síntesis de voz |

---

## Características principales

- **Autenticación:** pantalla de acceso (registro/inicio de sesión) con Supabase Auth.
- **Listado de tours:** pantalla principal con todos los tours disponibles.
- **CRUD de tours:** crear, editar y eliminar tours (título, descripción, imagen).
- **CRUD de paradas:** asociar paradas a cada tour (nombre, descripción, coordenadas).
- **Mapa de ruta:** visualización del recorrido y paradas en un mapa interactivo (React Native Maps).
- **Subida de imágenes:** adjuntar imagen a cada tour desde la galería (Supabase Storage).
- **Exportación:** generación de PDF y opción de compartir contenido.
- **Accesibilidad:** lectura en voz alta de descripciones (Expo Speech).
- **Navegación:** flujo con React Navigation (stack) entre listado, detalle, mapa y formularios.
- **Chatbot (Rasa):** asistente turístico para consultas sobre tours y Sevilla (ver sección más abajo).

---

## Chatbot (Rasa)

### Qué hace

Asistente turístico que responde consultas sobre tours y Sevilla mediante un chat integrado en la app. Se conecta al canal REST de Rasa.

### Dónde está el código

| Archivo | Descripción |
|---------|-------------|
| `src/services/rasa.ts` | Cliente REST y resolución de la URL del webhook |
| `src/screens/ChatScreen.tsx` | Pantalla del chat con mensajes y envío |
| `src/components/BottomBar.tsx` | Navegación inferior (Tours, Chat, Perfil) |

### Levantar Rasa (servidor)

**Local —** comando recomendado para aceptar conexiones desde móvil/emulador:

```bash
rasa run --enable-api --cors "*" --port 5005 --host 0.0.0.0
```

- `--host 0.0.0.0` permite conexiones desde la red (no solo localhost).
- Puerto del canal REST: **5005**.

**GitHub Codespaces:**
1. Levanta Rasa en el puerto **5005** dentro del Codespace.
2. En la pestaña **Ports**, publica el puerto 5005 como **Public**.
3. Copia la URL pública y configura en `.env`:
   ```bash
   EXPO_PUBLIC_RASA_URL=https://TU-CODESPACE-xxx-5005.app.github.dev/webhooks/rest/webhook
   ```

### Cómo configurarlo en la app

1. Crea o edita `.env` en la **raíz** del proyecto (junto a `package.json`):

   ```bash
   EXPO_PUBLIC_RASA_URL=http://TU_HOST:5005/webhooks/rest/webhook
   ```

   Sustituye `TU_HOST` por la IP de tu PC (ej. `192.168.0.71`) o la URL pública si usas Codespaces.

2. **Importante:** No uses `localhost` si la app corre en móvil o emulador; pon la IP de tu PC o la URL pública.

3. Reinicia Expo para cargar la variable:

   ```bash
   npx expo start -c
   ```

### Qué URL poner

| Dónde corre Rasa | Dónde corre la app | URL |
|------------------|--------------------|-----|
| Tu PC | Emulador o móvil | `http://TU_IP:5005/webhooks/rest/webhook` |
| Codespaces | Cualquiera | `https://TU-URL-5005.../webhooks/rest/webhook` |

La URL **debe terminar** en `/webhooks/rest/webhook`.

### Troubleshooting

- **No conecta desde móvil:** Revisa firewall, red compartida y que Rasa escuche en `0.0.0.0`. Alternativa: usar [GitHub Codespaces](https://github.com/javierarias2dam/SevillaTourAppReact) y publicar el puerto 5005 como Public.
- **"Network request failed":** No uses `localhost` en móvil. Usa la IP de tu PC (`ipconfig` en Windows, `ifconfig` en Mac/Linux).
- **Sigue saliendo CAMBIA_ESTA_IP:** 1) `.env` en la raíz; 2) archivo llamado `.env` (no `.env.txt`); 3) reiniciar con `npx expo start -c`.
- **Si Rasa no está levantado:** La app muestra mensaje amigable y botón "Reintentar"; no crashea.

### Evidencia UX

- En modo debug, el chat muestra la **Rasa URL** que está usando.
- Incluye botón **Reintentar** ante errores de conexión.

---

## Tecnologías utilizadas

| Área           | Tecnología              | Uso principal                    |
|----------------|-------------------------|----------------------------------|
| Framework      | React Native + Expo 54  | App multiplataforma              |
| Lenguaje       | TypeScript 5.9          | Tipado estático                  |
| Navegación     | React Navigation 7     | Stack de pantallas               |
| Backend / BBDD | Supabase                | Auth, base de datos, Storage     |
| Mapas          | react-native-maps       | Visualización de rutas           |
| UI / UX        | Componentes custom     | Screen, AppInput, AppButton, Toast |
| Imágenes       | expo-image-picker      | Selección desde galería          |
| Voz            | expo-speech            | Síntesis de voz                  |
| PDF / compartir| expo-print, expo-sharing| Exportar y compartir              |

> [!NOTE]
> Se recomienda Node.js 20 LTS o superior para desarrollo local.

---

## Estructura del proyecto

```
YourSevilleTourGuide/
├── App.tsx                 # Punto de entrada y configuración del stack de navegación
├── app.config.js           # Configuración Expo (carga .env y extra.rasaUrl)
├── index.ts                # Entrada de Expo
├── package.json
├── README.md
├── assets/                 # Recursos estáticos (imágenes, fuentes, etc.)
└── src/
    ├── components/         # Componentes reutilizables
    │   ├── AppButton.tsx
    │   ├── AppInput.tsx
    │   ├── BottomBar.tsx       # Pie de página (Tours, Chat, Perfil)
    │   ├── Screen.tsx
    │   └── Toast.tsx
    ├── screens/            # Pantallas de la aplicación
    │   ├── register.tsx        # Login / registro
    │   ├── ChatScreen.tsx      # Chat con asistente Rasa
    │   ├── tourScreen.tsx      # Lista de tours
    │   ├── tourDetailScreen.tsx # Detalle de un tour y sus paradas
    │   ├── tourFormScreen.tsx  # Crear / editar tour (con imagen)
    │   ├── tourMapScreen.tsx   # Mapa con ruta y paradas
    │   ├── ProfileScreen.tsx   # Perfil de usuario
    │   └── stopFormScreen.tsx  # Crear / editar parada
    ├── services/
    │   ├── rasa.ts          # Cliente REST para el chatbot Rasa
    │   └── supabase.ts      # Cliente y configuración de Supabase
    ├── theme.ts             # Colores, espaciado y tipografía
    └── utils/
        └── pdf.ts           # Utilidades para generación de PDF
```

---

## Dependencias del proyecto

Todas las dependencias se instalan automáticamente al ejecutar `npm install` en la raíz del proyecto. A continuación se listan las que debe tener el proyecto para funcionar correctamente.

### Requisitos del sistema (instalación manual)

| Herramienta   | Versión recomendada | Descripción / enlace |
|---------------|---------------------|----------------------|
| **Node.js**   | 20 LTS o superior   | [nodejs.org](https://nodejs.org/) — entorno de ejecución JavaScript |
| **npm**       | Incluido con Node   | Gestor de paquetes; no suele instalarse por separado |
| **Expo Go**   | Última disponible   | App en el móvil para probar con `npm start` (opcional) |

### Dependencias npm (producción)

Estas dependencias se instalan con `npm install` y están en `package.json`:

| Paquete | Uso en el proyecto |
|---------|--------------------|
| `@react-navigation/native` | Navegación entre pantallas |
| `@react-navigation/native-stack` | Navegador en stack (pilas) |
| `@react-navigation/stack` | Componentes de navegación tipo stack |
| `@supabase/supabase-js` | Cliente para Auth, base de datos y Storage |
| `expo` | Framework y runtime de Expo (SDK 54) |
| `expo-file-system` | Acceso al sistema de archivos (lectura de imágenes) |
| `expo-image-picker` | Selección de imágenes desde galería o cámara |
| `expo-print` | Generación e impresión de PDF |
| `expo-sharing` | Compartir contenido (PDF, enlaces) |
| `expo-speech` | Síntesis de voz (lectura en voz alta) |
| `expo-status-bar` | Control de la barra de estado del dispositivo |
| `react` | Librería base de React |
| `react-dom` | Renderizado en web |
| `react-native` | Framework para apps nativas |
| `react-native-gesture-handler` | Gestos táctiles (requerido por navegación) |
| `react-native-maps` | Mapas y visualización de rutas |
| `react-native-safe-area-context` | Áreas seguras en pantalla (notch, etc.) |
| `react-native-screens` | Pantallas nativas optimizadas (navegación) |
| `react-native-web` | Soporte web de React Native |

### Dependencias de desarrollo (devDependencies)

| Paquete | Uso en el proyecto |
|---------|--------------------|
| `@types/react` | Tipos TypeScript para React |
| `typescript` | Compilador y comprobación de tipos |

### Comando para instalar todo

```bash
npm install
```

Con este comando se instalan todas las dependencias anteriores (producción y desarrollo) a partir del `package.json`. No es necesario instalar cada paquete por separado.

> [!NOTE]
> Si usas **Expo** y quieres asegurarte de versiones compatibles con el SDK, puedes ejecutar `npx expo install` después de clonar; Expo ajustará las versiones si hace falta.

---

## Guía de instalación

1. **Requisitos previos**
   - [Node.js](https://nodejs.org/) 20 LTS o superior.
   - [npm](https://www.npmjs.com/) (incluido con Node.js).
   - Cuenta en [Expo](https://expo.dev/) (opcional, para builds en la nube).
   - Proyecto en [Supabase](https://supabase.com/) con tablas `tours`, `stops` y, opcionalmente, `tour_images`; bucket de Storage `tour-images`.

2. **Clonar el repositorio**
   ```bash
   git clone https://github.com/javierarias2dam/SevillaTourAppReact.git
   cd SevillaTourAppReact
   ```

3. **Instalar dependencias**
   ```bash
   npm install
   ```

4. **Configurar Supabase**
   - Crear un proyecto en [Supabase](https://supabase.com/dashboard).
   - Obtener la URL del proyecto y la clave anónima (anon key) en *Settings → API*.
   - Editar `src/services/supabase.ts` y sustituir `SUPABASE_URL` y la clave por los de tu proyecto.

   ```typescript
   const SUPABASE_URL = "https://tu-proyecto.supabase.co";
   const SUPABASE_KEY = "tu-anon-key";
   ```

5. **Configurar base de datos (si aplica)**
   - Crear en Supabase las tablas `tours` y `stops` (y `tour_images` si se usa).
   - Configurar políticas RLS para Auth y Storage según tu modelo de permisos.
   - Para eliminar tours con paradas asociadas, usar `ON DELETE CASCADE` en la FK de `stops.tour_id`.

---

## Guía de ejecución

| Comando           | Descripción                          |
|-------------------|--------------------------------------|
| `npm start`       | Inicia el servidor de desarrollo Expo |
| `npm run android` | Inicia la app en emulador/dispositivo Android |
| `npm run ios`     | Inicia la app en simulador iOS (solo macOS) |
| `npm run web`     | Ejecuta la versión web en el navegador |

Ejemplo para desarrollo local:

```bash
npm start
```

Después, escanear el código QR con la app **Expo Go** en el móvil o abrir en emulador/simulador según las opciones del menú.

> [!NOTE]
> En Android/iOS es necesario tener configurado el entorno correspondiente (Android Studio / Xcode) para emuladores. La opción más rápida suele ser usar un dispositivo físico con Expo Go.

---

## Ejemplos de uso

**Iniciar sesión y ver tours**
1. Abrir la app y completar registro o inicio de sesión en la pantalla de acceso.
2. En la pantalla principal se listan los tours. Pulsar uno para ver su detalle.

**Crear un tour y añadir imagen**
1. Desde la lista de tours, acceder a la opción de crear tour (según implementación en la UI).
2. Rellenar título y descripción, guardar.
3. En edición del tour, usar "Subir imagen" y elegir una foto de la galería.

**Ver la ruta en el mapa**
1. En el detalle de un tour, abrir "Mapa de la Ruta" (o equivalente).
2. El mapa muestra las paradas del tour; se puede navegar por la ruta.

**Escuchar descripción**
1. En detalle de tour o parada, usar la opción de lectura en voz alta (si está disponible en la pantalla).
2. La app utilizará la síntesis de voz del dispositivo para leer el texto.

---

## Convenciones de commits

Este proyecto sigue **[Conventional Commits](https://www.conventionalcommits.org/)** para mantener un historial claro y permitir generación de changelogs.

### Formato

```
<tipo>[alcance opcional]: <descripción corta>

[cuerpo opcional]

[pie opcional]
```

### Tipos habituales

| Tipo     | Uso                                      |
|----------|------------------------------------------|
| `feat`   | Nueva funcionalidad                      |
| `fix`    | Corrección de bug                        |
| `docs`   | Cambios solo en documentación            |
| `style`  | Formato, espacios, sin cambio de lógica |
| `refactor` | Refactorización sin añadir feature ni fix |
| `test`   | Añadir o modificar tests                 |
| `chore`  | Tareas de mantenimiento, deps, config    |

### Ejemplos

```bash
feat: agregar validación de formulario de tour
```

```bash
fix: corregir error "Network request failed" al subir imagen desde galería
```

```bash
docs: actualizar README con guía de instalación de Supabase
```

### Ejemplo de commit bien estructurado

- **Asunto:** una sola línea, modo imperativo, menos de 72 caracteres.
- **Cuerpo:** línea en blanco después del asunto; explicar el *qué* y el *por qué*.
- **Pie:** referencias a issues si aplica.

```
feat: agregar validación de formulario de tour

Se implementa validación en campos obligatorios (título y descripción)
para evitar envío de datos incompletos a Supabase y mejorar la UX.

Fixes #12
```

---

## Buenas prácticas utilizadas

- **Tipado:** TypeScript en todo el proyecto y tipos centralizados para navegación (`RootStackParamList`).
- **Componentes reutilizables:** `Screen`, `AppInput`, `AppButton`, `Toast` para consistencia y mantenibilidad.
- **Tema centralizado:** colores, espaciado y tipografía en `theme.ts` para un diseño coherente.
- **Servicios separados:** cliente de Supabase en `services/supabase.ts` para facilitar cambios de configuración.
- **Manejo de errores:** mensajes claros al usuario (toasts) y manejo de errores de Supabase (RLS, columnas faltantes).
- **Fallbacks:** soporte tanto para columna `tours.image_url` como para tabla `tour_images` si el esquema no tiene la columna.
- **Conventional Commits:** historial de commits legible y trazable.

---

## Posibles mejoras futuras

- [ ] Soporte para múltiples idiomas (i18n).
- [ ] Modo offline con caché local de tours y paradas.
- [ ] Notificaciones push para novedades o recordatorios de tours.
- [ ] Favoritos e historial de tours visitados.
- [ ] Filtros y búsqueda en la lista de tours.
- [ ] Tests unitarios y de integración (Jest, React Native Testing Library).
- [ ] CI/CD para builds y despliegue (EAS Build / GitHub Actions).
- [ ] Mejora de accesibilidad (etiquetas de screen reader, contraste, tamaños táctiles).

---

## Licencia

Este proyecto se distribuye bajo licencia **MIT**. Ver el archivo `LICENSE` en el repositorio para más detalles.

---

## Contacto

**Javier Arias Olanda**  
- Repositorio: [GitHub - SevillaTourAppReact](https://github.com/javierarias2dam/SevillaTourAppReact)  
- Email: javierarias2dam@gmail.com  

---

*Documentación generada para el módulo de desarrollo de aplicaciones. YourSevilleTourGuide — Guía turística de Sevilla.*

---

## Publicar cambios en GitHub

Cuando actualices la documentación u otros archivos:

```bash
git status
git add README.md
git commit -m "docs: actualizar documentación"
git push
```

> No ejecutes `git push` sin revisar los cambios.
