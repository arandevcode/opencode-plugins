<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-quota-extended/images/opencode_quota_extended_sidebar.png" alt="Barra lateral TUI" width="420">
  <br>
  <sub><em>-sidebar example-</em></sub>
</p>

# @arandevcode/opencode-quota-extended

> 🇬🇧 Also available in [English](README.md)

Tarjetas de uso de cuota para la barra lateral TUI — barras de progreso por ventana con colores de semáforo para OpenAI, GitHub Copilot y OpenCode Go.

- Barra de progreso para cada ventana de cuota (5h móvil, semanal, mensual, code review...)
- Muestra cuándo se reinicia — tiempo restante y fecha exacta
- Indicador de salud por colores (verde = ok, naranja = advertencia, rojo = crítico)
- OpenCode Go capable!

Inspirado por [`@slkiser/opencode-quota`](https://github.com/slkiser/opencode-quota). Ambos coexisten sin conflicto.

<br>
<p align="center">🐟  <em>&ldquo;Quien quiera peces que se moje el culo&rdquo;</em>  <sub>— para mi padre, que me enseñó a arremangarme y hacer que las cosas pasen</sub>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/arandevcode"><strong>☕ Invítame un café</strong></a>
  <br>
  <sub><a href="https://github.com/sponsors/arandevcode">❤️ Sponsor en GitHub</a></sub>
</p>

## Instalación

```sh
opencode plugin --global --force @arandevcode/opencode-quota-extended
```

O instala desde GitHub para seguir el desarrollo más reciente:

```json
// ~/.config/opencode/opencode.json
{
  "plugin": [
    "https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended"
  ]
}
```

## Desinstalación

Cuatro pasos, en orden:

1. Quita la entrada del plugin en la config de OpenCode (`~/.config/opencode/opencode.json`):

   ```jsonc
   // borra las líneas de @arandevcode/opencode-quota-extended dentro de "plugin": []
   {
     "plugin": [
       "@arandevcode/opencode-quota-extended", // ← eliminar
       "@arandevcode/opencode-quota-extended/tui",  // ← eliminar
       "@arandevcode/opencode-quota-extended/server" // ← eliminar
     ]
   }
   ```

2. Borra la sidecar de config opcional y el archivo de credenciales de OpenCode Go (solo si los creaste):

   ```sh
   rm -f ~/.config/opencode/opencode-quota-extended.json
   rm -rf ~/.config/opencode/opencode-quota
   ```

3. (Opcional) Borra el binario CLI global si lo instalaste:

   ```sh
   npm rm -g @arandevcode/opencode-quota-extended
   ```

4. (Opcional) Borra cualquier clon local del repo que hayas usado para seguir el desarrollo:

   ```sh
   rm -rf ./opencode-quota-extended
   ```

Reinicia OpenCode y el panel de Quota desaparecerá. **Nota:** el plugin **no** toca `~/.local/share/opencode/auth.json` — tus tokens de auth nunca se modifican.

## CLI

Visualiza la cuota desde la terminal sin abrir el TUI:

```sh
npx opencode-quota            # ejecutar vía npm (sin instalar)
opencode-quota                # si está instalado globalmente
node bin/quota.mjs            # desde el directorio del repo (sin build)
npm run quota                 # desde el directorio del repo
```

<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-quota-extended/images/opencode_quota_extended_cli.png" alt="Salida CLI" width="620">
  <br>
  <sub><em>-cli example-</em></sub>
</p>

Colores de semáforo: verde (ok), naranja (advertencia), rojo (error). Todos los colores vienen del tema activo de OpenCode — se adaptan automáticamente a la paleta del usuario.

## Configuración

Archivo sidecar opcional en `~/.config/opencode/opencode-quota-extended.json`:

| Campo | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `enabledProviders` | string[] | `["openai","github-copilot","opencode-go"]` | Proveedores a consultar |
| `refreshIntervalMs` | int | `60000` | Intervalo de sondeo |
| `cardsSidebar.order` | int | `145` | Posición en la barra lateral (menor = más arriba) |

## Más Información

### Cómo funciona

Registra un plugin TUI que renderiza un panel `sidebar_content` en la posición 145, mostrando tarjetas de cuota para cada proveedor activo. Cada proveedor obtiene datos de cuota independientemente desde su propia API.

| Proveedor | Ventanas | Fuente de autenticación |
|---|---|---|
| **OpenAI** | 5h móvil, Semanal, Code Review | `auth.json` → entrada `openai` / `chatgpt` |
| **GitHub Copilot** | Solicitudes Premium (ventana única) | `auth.json` → entrada `github-copilot` |
| **OpenCode Go** | 5h, Semanal, Mensual | Archivo de configuración o vars de entorno |

Colores de semáforo: ≥50% `theme.success` (verde), 25-49% `theme.warning` (naranja), <25% `theme.error` (rojo).

### Autenticación

Lee credenciales del archivo de autenticación de OpenCode (`~/.local/share/opencode/auth.json`). **No** almacena, solicita ni distribuye secretos.

**OpenCode Go** requiere configuración adicional — es un poco tricky porque no hay API oficial todavía.

Crea `~/.config/opencode/opencode-quota/opencode-go.json`:

```json
{
  "workspaceId": "wrk_abc123...",
  "authCookie": "Fe26.2..."
}
```

| Campo | Descripción | Cómo obtenerlo |
|---|---|---|
| `workspaceId` | ID de tu workspace en OpenCode | Entra en [opencode.ai/go](https://opencode.ai/go). La URL es `https://opencode.ai/workspace/wrk_XXX/go` — copia la parte `wrk_XXX`. |
| `authCookie` | Cookie de sesión para autenticación | Abre DevTools (F12) → Application → Cookies → `opencode.ai` → busca la cookie `auth` (empieza con `Fe26.2...`). O ejecuta en la consola: `document.cookie.match(/(?:^\|;\s*)auth=([^;]+)/)?.[1]` |

**Múltiples workspaces/cuentas:** cualquier archivo `opencode-go-<sufijo>.json` en el mismo directorio añade una sección extra `Opencode GO (<sufijo>)` (p. ej. `opencode-go-work.json` → **Opencode GO (work)**). El `opencode-go.json` base siempre se muestra como **OpenCode Go**.

```sh
# p. ej. un segundo workspace
cp ~/.config/opencode/opencode-quota/opencode-go.json \
   ~/.config/opencode/opencode-quota/opencode-go-work.json
# luego edita workspaceId/authCookie dentro de opencode-go-work.json
```

**Setup automatizado** (recomendado):
```sh
npm run setup
```
Te solicita ambos valores y crea el archivo automáticamente. También muestra un bookmarklet que puedes arrastrar a la barra de favoritos y pinchar en opencode.ai para extraer la auth cookie con un clic.

**Consejo:** mantén una pestaña del navegador con sesión iniciada en opencode.ai mientras usas este plugin — la auth cookie puede expirar.

### Relación con [`@slkiser/opencode-quota`](https://github.com/slkiser/opencode-quota)

**Sin dependencia.** Ambos plugins obtienen cuota independientemente y renderizan sus propios paneles laterales. Puedes tener uno, ambos o ninguno — no interfieren.

### Solución de problemas

- **El panel no aparece**: `grep '@arandevcode/opencode-quota-extended' ~/.local/share/opencode/log/*.log`
- **OpenCode Go muestra "skipped"**: confirma que el archivo sidecar o vars de entorno están configurados
- **Bug antiguo de pinning `@opentui/solid`**: usa `^0.4.1 || ^0.5.0` y reinstala limpio (`rm -rf node_modules && npm ci`)

### Desarrollo

```sh
npm run build        # compilar TS + copiar assets TUI
npm run build:watch  # modo watch
npm test             # vitest
npm run typecheck    # type-check sin emitir
```

### Patrones TUI y tema

Los colores se obtienen en vivo de `api.theme.current`. El mapeo de semáforo respeta el tema:

| Restante | Color (clave de tema) | Hex por defecto (AMOLED) |
|---|---|---|
| ≥50% | `theme.success` (verde) | `#00ff88` |
| 25-49% | `theme.warning` (naranja) | `#ffea00` |
| <25% | `theme.error` (rojo) | `#ff1744` |

La barra de progreso sigue el patrón gauge de `opentui-theme-colors`: un `<text>` por celda, `bg={themeColor}` en las celdas llenas y `bg={theme.backgroundElement}` en las vacías, con la etiqueta de porcentaje en primer plano con contraste correcto (`backgroundPanel` en lleno, `textMuted` en vacío). Es el mismo patrón que la barra de contexto en `@arandevcode/opencode-stats`.

La barra de ratio antigua con `flexGrow` y los hex hardcodeados (`#6b8e23`, `#ffa500`, `#ff6b6b`) ya no existen.

### Estructura del proyecto

```
src/
  index.ts            # Plugin module (entrada server)
  server.ts           # Plugin server (mínimo, sin herramientas)
  tui.tsx             # Plugin TUI: slot sidebar_content
  config/             # defaults, schema, loader
  lib/                # types, auth, http, formatting, credential resolver
  providers/          # openai.ts, copilot.ts, opencode-go.ts, registry.ts
  ui/                 # SidebarPanel, cards, progress-bar
tests/                # tests unitarios vitest
```

## Licencia

MIT
