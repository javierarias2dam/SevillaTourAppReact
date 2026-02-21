// Utilidad para construir el HTML que usará expo-print para generar el PDF.
//
// expo-print no genera PDFs a partir de un "canvas" nativo, sino que renderiza
// internamente HTML/CSS y lo convierte a PDF. Por eso aquí construimos una
// plantilla HTML en vez de un PDF manual: es más compatible en iOS/Android
// y más fácil de mantener con estilos sencillos.
//
// Tipos mínimos necesarios para el informe del tour.
export type PdfTour = {
  title: string;
  description?: string | null;
};

export type PdfStop = {
  title: string;
  description?: string | null;
  stop_order?: number | null;
};

export function buildTourHtml(tour: PdfTour, stops: PdfStop[]): string {
  const safeTitle = tour.title || "Tour sin título";
  const safeDescription = tour.description || "";

  // Logo de la app: por simplicidad usamos un emoji. Si tienes un logo real,
  // puedes reemplazar esto por una etiqueta <img> con un data URI:
  //   const logoSrc = "data:image/png;base64,....";
  //   <img src="${logoSrc}" ... />
  const logo = "🏰";

  // Construimos la lista de paradas.
  const stopsHtml =
    stops && stops.length > 0
      ? stops
          .map((stop, index) => {
            const order =
              typeof stop.stop_order === "number"
                ? stop.stop_order
                : index + 1;
            const title = stop.title || `Parada ${order}`;
            const desc = stop.description || "";

            // Aquí podrías añadir un mini icono por parada, por ejemplo:
            // - Un emoji: 📍, ⭐, 🎧, etc.
            // - O un pequeño <img src="data:image/png;base64,..."> con un icono.
            // Bastaría con incluirlo al principio del <li>.
            return `
              <li class="stop-item">
                <div class="stop-order">#${order}</div>
                <div class="stop-content">
                  <div class="stop-title">${escapeHtml(title)}</div>
                  ${
                    desc
                      ? `<div class="stop-description">${escapeHtml(
                          desc
                        )}</div>`
                      : `<div class="stop-description muted">Sin descripción disponible</div>`
                  }
                </div>
              </li>
            `;
          })
          .join("")
      : `<p class="no-stops">Este tour aún no tiene paradas registradas.</p>`;

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(safeTitle)}</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 24px 20px;
            color: #222222;
            background-color: #ffffff;
          }
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
          }
          .logo {
            font-size: 32px;
            margin-right: 12px;
          }
          .app-name {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1.4px;
            color: #666666;
          }
          .tour-title {
            font-size: 24px;
            font-weight: 700;
            margin: 4px 0 4px 0;
          }
          .tour-description {
            font-size: 14px;
            color: #555555;
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            margin: 16px 0 8px 0;
            border-bottom: 1px solid #eeeeee;
            padding-bottom: 4px;
          }
          .stops-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .stop-item {
            display: flex;
            margin-bottom: 10px;
            padding: 8px 10px;
            border-radius: 6px;
            background-color: #fafafa;
            border: 1px solid #f0f0f0;
          }
          .stop-order {
            font-size: 12px;
            font-weight: 600;
            margin-right: 8px;
            color: #888888;
            min-width: 36px;
          }
          .stop-content {
            flex: 1;
          }
          .stop-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 2px;
          }
          .stop-description {
            font-size: 12px;
            color: #555555;
          }
          .stop-description.muted {
            color: #999999;
            font-style: italic;
          }
          .no-stops {
            font-size: 13px;
            color: #999999;
            font-style: italic;
          }
          .footer {
            margin-top: 24px;
            font-size: 10px;
            color: #aaaaaa;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <header class="header">
          <div class="logo">${logo}</div>
          <div>
            <div class="app-name">Your Seville Tour Guide</div>
            <div class="tour-title">${escapeHtml(safeTitle)}</div>
          </div>
        </header>

        ${
          safeDescription
            ? `<div class="tour-description">${escapeHtml(
                safeDescription
              )}</div>`
            : ""
        }

        <h2 class="section-title">Paradas del tour</h2>
        <ul class="stops-list">
          ${stopsHtml}
        </ul>

        <div class="footer">
          Generado desde la app Your Seville Tour Guide
        </div>
      </body>
    </html>
  `;
}

// Sencillo helper para escapar texto en HTML y evitar problemas con caracteres especiales.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

