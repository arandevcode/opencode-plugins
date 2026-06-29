# Arquitectura de opencode-thinking

## Visión general

El plugin usa **dos procesos** de opencode que se comunican vía archivo compartido:

```
┌──────────────────────────────────────────────────────────┐
│                    opencode TUI                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  opencode-thinking-tui.ts                          │  │
│  │  ────────────────                                   │  │
│  │  • Escucha session.status / session.idle            │  │
│  │  • Renderiza slots (prompt, sidebar)         │  │
│  │  • Poll ~/.config/opencode/thinking-visual-state.json │  │
│  │  • Keymap commands (Cmd+K)                          │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │ poll cada 2s
                            ▼
              ┌─────────────────────────┐
              │  thinking-visual-state  │  ← archivo JSON
              │  .json                  │
              └────────┬────────────────┘
                       │ escribe
              ┌────────▼────────────────┐
│                    opencode Server                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  opencode-thinking-server.ts                       │  │
│  │  ─────────────────                                  │  │
│  │  • Hook: command.execute.before                     │  │
│  │  • Detecta /thinking_visual por input.command         │  │
│  │  • Parsea args (a/b/c/all/none)                     │  │
│  │  • Escribe estado al .json                          │  │
│  │  • Cancela el comando (output.parts = [])           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Comunicación entre procesos (IPC)

Los plugins TUI y Server corren en procesos separados. No comparten memoria ni API.

**Solución**: archivo JSON en `~/.config/opencode/thinking-visual-state.json`.

| Plugin | Rol |
|--------|-----|
| **Server** | Escribe el archivo cuando intercepta `/thinking_visual` |
| **TUI** | Lee el archivo al iniciarse y lo pollcea cada 2s |

El contenido del archivo:
```json
{ "a": true, "b": true }
```

## Detección de "pensando"

El TUI plugin escucha dos eventos:

- **`session.status`** → cuando `event.status === "busy"` el modelo está procesando
- **`session.idle`** → el modelo terminó

En ese momento se inician/detienen:
- `setInterval` para el spinner (120ms)
- `setInterval` para la animación del borde (50ms, incrementa hue 15°)

## Slots del TUI

Cada modo visual usa un slot diferente del sistema de `@opentui/solid`:

| Modo | Slot(s) | Qué renderiza |
|------|---------|---------------|
| a | `session_prompt`, `home_prompt` | `<box borderStyle="heavy" borderColor={rainbow}>` envuelve al `api.ui.Prompt`. También añade un spinner vía `hint` y un cartel "WORKING" sobre el textarea. |
| b | `sidebar_title` | `<box borderStyle="heavy" borderColor={rainbow}>` envuelve al título del sidebar. |

## Comando slash `/thinking_visual`

### Configuración en `.opencode/opencode.json`
```json
{
  "plugin": [
    "./plugins/opencode-thinking-tui.ts",
    "./plugins/opencode-thinking-server.ts"
  ]
}
```

El server plugin registra `/thinking_visual` dinámicamente desde el hook `config` con `template: ""`.

### Intercepción
El server plugin tiene el hook `command.execute.before` que:
1. Revisa `input.command === "thinking_visual"`
2. Parsea `input.arguments` (`a`, `b`, `all`, `none`, combinaciones)
3. Escribe el estado al JSON compartido
4. Vacía `output.parts` y corta el flujo para que el LLM nunca vea el comando

### Parámetros

| Args | Modos activados |
|------|----------------|
| *(vacío)* | a, b |
| `a` | a |
| `b` | b |
| `all` | a, b |
| `none` | *(ninguno)* |

## Keymap commands

Se registran 2 comandos en el layer `opencode-thinking`:

| ID | Nombre (Cmd+K) |
|----|----------------|
| `opencode-thinking.toggle-a` | Thinking Visual: Toggle Border |
| `opencode-thinking.toggle-b` | Thinking Visual: Toggle Sidebar |

Se escuchan via `api.event.on("tui.command.execute")`.

## Dependencias

- `@opencode-ai/plugin` — tipos para TUI y Server plugins
- `solid-js` — reactivity (createSignal) para animaciones vía JSX en el TUI
- `node:fs` — IPC via archivo JSON

## Flujo completo de usuario

```
1. Usuario escribe `/thinking_visual a` en el prompt
2. opencode reconoce el slash command registrado por el plugin
3. Server plugin intercepta vía `command.execute.before` usando `input.arguments`
4. Server plugin escribe `{ "a": true, "b": false }` al .json
5. Server plugin cancela el envío al LLM
6. TUI plugin detecta el cambio en el .json (poll 2s)
7. TUI plugin actualiza modes en memoria
8. En la próxima sesión "busy", solo se muestra el modo a
```
