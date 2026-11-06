<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/opencode-plugins/main/opencode-thinking/images/demo.gif" alt="Borde arcoíris y brillo lateral demo" width="480">
  <br>
  <sub><em>Animación de borde arcoíris alrededor del área de entrada + brillo lateral</em></sub>
</p>

# @arandevcode/opencode-thinking

> 🇬🇧 Also available in [English](README.md)

Indicadores visuales animados cuando el modelo está procesando — borde arcoíris alrededor del área de entrada y brillo en la barra lateral. Sin configuración necesaria.

<br>
<p align="center">🐟</p>
<p align="center">
  <em>&ldquo;Quien quiera peces que se moje el culo&rdquo;</em>
</p>
<p align="center">
  <sub>— para mi padre, que me enseñó a arremangarme y hacer que las cosas pasen</sub>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/arandevcode"><strong>☕ Invítame un café</strong></a>
  <br>
  <sub><a href="https://github.com/sponsors/arandevcode">❤️ Sponsor en GitHub</a></sub>
</p>

## Instalación

```sh
opencode plugin --global --force @arandevcode/opencode-thinking
```

O instala desde GitHub para seguir el desarrollo más reciente:

```json
// ~/.config/opencode/opencode.json
{
  "plugin": [
    "https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking"
  ]
}
```

## Desinstalación

Tres pasos, en orden:

1. Quita la entrada del plugin en la config de OpenCode (`~/.config/opencode/opencode.json`):

   ```jsonc
   // borra las líneas de @arandevcode/opencode-thinking dentro de "plugin": []
   {
     "plugin": [
       "@arandevcode/opencode-thinking/tui",   // ← eliminar
       "@arandevcode/opencode-thinking/server" // ← eliminar
     ]
   }
   ```

2. Borra el archivo de estado compartido que usa el plugin para TUI ↔ Server:

   ```sh
   rm -f ~/.config/opencode/thinking-visual-state.json
   rm -f ~/.config/opencode/thinking-visual-debug.log
   ```

3. (Opcional) Borra cualquier clon local del repo que hayas usado para seguir el desarrollo:

   ```sh
   rm -rf ./opencode-thinking
   ```

Reinicia OpenCode y el borde arcoíris + el brillo del sidebar desaparecerán.

## Comandos

| Comando | Efecto |
|---|---|
| `/thinking_visual` | Activar/desactivar todos los efectos |
| `/thinking_visual a` | Solo animación de borde |
| `/thinking_visual b` | Solo brillo lateral |
| `/thinking_visual all` | Ambos |
| `/thinking_visual none` | Desactivar |

## Más Información

### Cómo funciona la activación

**Automática** (por defecto): el plugin escucha el estado de la sesión. Cuando opencode comienza a procesar (`session.status === "busy"`), aparecen los efectos arcoíris. Cuando termina (`session.idle`), desaparecen.

**Manual**: usa `/thinking_visual` o alterna modos individuales desde la Paleta de Comandos (`Cmd+K` → "Thinking Visual").

### Estructura del proyecto

```
├── .opencode/
│   ├── opencode.json            ← config del proyecto (activa plugin + slash cmds)
│   └── plugins/
│       ├── opencode-thinking-tui.ts      ← Plugin TUI (efectos visuales)
│       └── opencode-thinking-server.ts   ← Plugin Server (gestiona /thinking_visual)
├── src/                         ← fuente de distribución npm
│   ├── index.ts
│   ├── tui.ts
│   ├── server.ts
│   └── types.ts
├── docs/
│   └── ARCHITECTURE.md
├── example.opencode.json
└── package.json
```

`.opencode/plugins/` permite que el plugin funcione **sin npm install, sin build, sin instalación global** — opencode los carga automáticamente desde el proyecto.

### Instalar en otro proyecto

```jsonc
// .opencode/opencode.json
{
  "plugin": [
    "@arandevcode/opencode-thinking/tui",
    "@arandevcode/opencode-thinking/server"
  ]
}
```

### Desarrollo

```sh
npm install        # instalar dependencias (solo type-check)
npm run build      # compilar src/ → dist/
npm run dev        # compilación continua
```

## Patrones TUI y tema

Los colores se obtienen en vivo de `api.theme.current`, no están hardcodeados. El plugin también vigila la firma del tema (sondeo de 250ms) para que los cambios de tema a mitad de sesión se reflejen en el siguiente re-render.

| Fase | Color del borde y la insignia | Texto de la insignia |
|---|---|---|
| **Trabajando** (el modelo está `busy`) | alterna `theme.warning` ↔ `theme.error` cada 250ms | `WORKING` |
| **Idle** (el modelo está `idle` / `session.idle`) | `theme.success` | `IDLE` |

El mismo color impulsa el borde del título del sidebar mientras el modo visual `b` está activo.

Este patrón sigue la convención `opentui-theme-colors`: claves semánticas de tema (`success` / `warning` / `error`) en lugar de valores de paleta hardcodeados, y `themeSignature()` + `setInterval` para cambios de tema reactivos.

## Licencia

MIT
