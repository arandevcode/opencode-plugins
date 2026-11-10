# Arquitectura de opencode-thinking

## Visión general

El plugin tiene una entrada TUI y una entrada Server. En OpenCode 1.x son dos procesos que se comunican por un archivo de estado; en OpenCode 2 el host entrega ambos contextos y el adaptador comparte la misma máquina de estados.

```
┌──────────────────────────────────────────────────────────────┐
│                         opencode TUI                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  src/tui.tsx                                           │  │
│  │  • Slots: prompt, barra superior, sidebar              │  │
│  │  • Banda WORKING / WAITING / IDLE                       │  │
│  │  • Animación de spinner y color (solo WORKING)          │  │
│  │  • Keymap y toasts                                     │  │
│  └───────────────┬──────────────────────────────┬─────────┘  │
│                  │ v1: eventos + árbol          │ v2: bridge  │
│                  ▼                              ▼            │
│  ┌────────────────────────────┐  ┌─────────────────────────┐ │
│  │ src/state.ts               │  │ src/v2.ts               │ │
│  │ prioridad + debounce       │◄─│ store/family/shells     │ │
│  └────────────────────────────┘  └─────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │ poll 2 s (solo modos a/b)
                            ▼
              ┌─────────────────────────────┐
              │ thinking-visual-state.json  │
              └──────────────┬──────────────┘
                             │ escribe
              ┌──────────────▼──────────────┐
              │  src/server.ts              │
              │  /thinking_visual           │
              │  config + command hook (v1) │
              │  command transform (v2)     │
              └─────────────────────────────┘
```

## Comunicación entre procesos

En OpenCode 1.x los plugins TUI y Server corren en procesos separados y no comparten memoria. El comando `/thinking_visual` escribe `~/.config/opencode/thinking-visual-state.json` (o `$XDG_CONFIG_HOME/opencode/...`) y el TUI lo sondea cada 2 segundos.

```json
{ "a": true, "b": true }
```

El archivo solo contiene los dos modos visuales (`a` = borde/banda, `b` = sidebar). No contiene el estado WORKING/WAITING/IDLE: ese se calcula en vivo y nunca se escribe en disco.

## Detección del estado

### OpenCode 1.x

El TUI escucha el bus de eventos del host:

- `session.status` → `busy` o `retry` marcan la sesión como activa; `idle` la marca inactiva.
- `session.idle` → marca la sesión inactiva.
- `session.created` / `session.updated` → guardan `parentID` para reconstruir el árbol.
- `session.deleted` → elimina la sesión de los mapas.

La sesión enfocada se obtiene de los props de los slots (`session_id` en `session_prompt` y `sidebar_title`). Desde ella se sube por `parentID` hasta la raíz y se recorre el árbol con `session.children()` (BFS, máximo 100 sesiones) para incluir subagentes anidados. También se consulta `api.state.session.status(id)` al cargar cada sesión, de modo que un subagente que ya estaba corriendo al abrir el TUI no se pierda.

OpenCode 1.x no expone al plugin TUI una señal fiable de shell en background: los eventos `session.next.shell.*` no distinguen background ni garantizan el ciclo de vida. Por eso en v1 `WAITING` no existe y el estado pasa de `WORKING` a `IDLE`.

### OpenCode 2

El adaptador `src/v2.ts` construye un snapshot de datos:

- `data.session.list()` y `data.session.family(focus)` dan las sesiones cargadas y su familia.
- `data.session.get(id)` aporta `parentID` de la raíz y de los ancestros.
- `data.session.status(id)` devuelve `running` o `idle`.
- `data.shell.list(location)` devuelve los shells vivos de la ubicación de la sesión enfocada; cuentan los que pertenecen a ese árbol y siguen en estado `running`.

Además, el bridge de eventos traduce `session.execution.started/succeeded/failed/interrupted` y `session.created/updated/deleted` a la misma interfaz que usa v1, y `startV2Pump()` refresca el snapshot cada 250 ms y cuando llega un evento. La sesión enfocada sale de `ui.router.current()`; si no está disponible, de los props del slot.

`data.session.sync(focus, { children: true })` carga los hijos conocidos al cambiar de conversación. Los eventos de sesión hacen un pump inmediato para que `WORKING` no espere al siguiente tick.

## Máquina de estados

`src/state.ts` es la única fuente de verdad. La prioridad es:

1. **WORKING**: hay al menos una sesión activa en el árbol de la conversación enfocada (el turno principal o cualquier subagente, en primer plano o background, a cualquier profundidad).
2. **WAITING**: no hay sesiones activas, pero queda al menos un shell en background en ese árbol. El texto es `TASK` o `N TASKS`.
3. **IDLE**: no hay nada en marcha ni pendiente.

Las sesiones de otra raíz se descartan con `rootOf()`/`isInTree()`. Un cambio de foco se aplica de inmediato; también se aplica de inmediato cualquier entrada en `WORKING`.

Solo se retrasa la **salida** de `WORKING` 400 ms. Motivo: un subagente en primer plano puede emitir su `idle` unos milisegundos antes de que el padre vuelva a estar `busy`, y una tarea en background terminada despierta la sesión con un turno nuevo. Sin esa ventana, la banda parpadearía a `IDLE` o `WAITING` entre ambos momentos. El temporizador de asentamiento se ejecuta cada 100 ms.

## Colores según estado

Los colores vienen del tema activo (`api.theme.current` en v1, `context.theme` adaptado en v2):

| Estado | Color del borde y la insignia | Texto |
|---|---|---|
| Working | cicla `theme.primary` → `theme.accent` → `theme.success` → `theme.error` cada 250 ms | `WORKING` |
| Waiting | `theme.warning` sólido | `WAITING · TASK` / `WAITING · 2 TASKS` |
| Idle | `theme.success` sólido | `IDLE` |

`theme.warning` no participa en la rotación de WORKING para que el ámbar quede reservado a `WAITING`. La animación del spinner (120 ms) y del color (250 ms) solo corre en WORKING.

## Slots

| Versión | Slot | Qué renderiza |
|---|---|---|
| OpenCode 1.x | `session_prompt` | Envuelve `api.ui.Prompt` con un borde heavy y una insignia encima. La estructura del prompt es constante; el estado solo cambia props. |
| OpenCode 1.x | `home_prompt` | Igual, en la pantalla de inicio. |
| OpenCode 1.x | `sidebar_title` | Estado del sidebar, si el modo `b` está activo. No dibuja el borde completo. |
| OpenCode 2 | `session.composer.top` | Barra a todo el ancho con borde heavy y la insignia; OpenCode 2 no permite envolver el composer. |
| OpenCode 2 | `home.footer.status` | Banda en la pantalla de inicio. |
| OpenCode 2 | `sidebar.footer` | Estado antes de la línea `cwd:branch`; el borde del sidebar se aplica caminando el árbol de render. |

Los slots de prompt construyen el `Prompt` una sola vez con `untrack`: los signals de animación solo actualizan el wrapper. Esto evita remontar el prompt cada 120-250 ms y conserva el foco y el contador de `Esc` para interrumpir.

## Comando slash `/thinking_visual`

En OpenCode 1.x el server plugin registra el comando desde el hook `config` con `template: ""`, intercepta `command.execute.before`, parsea `input.arguments` y vacía `output.parts` para que el LLM no reciba el comando.

En OpenCode 2 `setup()` usa `ctx.command.transform()` para añadir el mismo comando; `execute()` parsea los argumentos y escribe el archivo de estado.

| Args | Modos activados |
|---|---|
| *(vacío)* | a, b |
| `a` | a |
| `b` | b |
| `all` | a, b |
| `none` | *(ninguno)* |

## Keymap commands

Se registran dos comandos en el layer `opencode-thinking`:

| ID | Nombre (Cmd+K) |
|---|---|
| `opencode-thinking.toggle-a` | Thinking Visual: Toggle Border |
| `opencode-thinking.toggle-b` | Thinking Visual: Toggle Sidebar |

Se escuchan vía `api.event.on("tui.command.execute")` en v1; en v2 el adaptador registra el layer con `context.keymap.layer()`.

## Dependencias

- `@opencode-ai/plugin` — tipos para TUI y Server plugins
- `solid-js` — reactividad (`createSignal`) para las animaciones del TUI
- `@opentui/core` — `TextAttributes` y primitivas de render
- `node:fs` / `node:path` — IPC por archivo JSON y estado de modos
- `node:test` — tests de la máquina de estados y de los adaptadores

No hay dependencias nuevas para el cálculo del estado.

## Flujo completo de usuario

```
1. Usuario escribe /thinking_visual a en el prompt
2. OpenCode reconoce el comando registrado por el plugin
3. Server v1 intercepta command.execute.before; v2 ejecuta el command transform
4. El plugin escribe { "a": true, "b": false } en el archivo de estado
5. El TUI detecta el cambio (poll 2 s) y actualiza los modos
6. El usuario envía un turno; el TUI enfoca su sesión
7. session.status / execution.started marca la sesión como activa
8. Si hay subagentes, sus sesiones hijas también cuentan: la banda sigue WORKING
9. Al terminar el último descendiente, tras 400 ms, pasa a WAITING (si hay shell
   background en v2) o a IDLE
```

## Limitaciones conocidas

- OpenCode 1.x no ofrece `WAITING` fiable: no hay monitor, cron ni shell background identificable desde la API del plugin TUI.
- OpenCode 2 solo reporta `WAITING` para shells en background; no hay monitores ni despertares programados.
- OpenCode 2 no permite envolver el composer, así que la banda es una barra a todo el ancho.
- El borde del sidebar en v2 se aplica sobre el árbol de render del host: se busca el panel alto anclado al borde derecho, no un ancho fijo. La decoración se mantiene durante los reflows transitorios y se reintenta cada 120 ms; nunca lanza errores al host. En terminales estrechas OpenCode oculta el sidebar y no hay borde que dibujar.
- Un plugin ya cargado no se sustituye en una sesión en marcha: hay que reiniciar OpenCode tras actualizar.
