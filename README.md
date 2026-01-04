<div align="center"><a name="readme-top"></a>

<img height="120" src="https://embeddr.net/embeddr_logo_transparent.png">

<h1>Embeddr Plugins</h1>
A guide to developing plugins for the Embeddr ecosystem.
</div>

## Overview

Embeddr plugins are React-based modules that can inject UI components, interact with the application state, and perform actions. They are built using Vite and can use the full power of the `@embeddr/react-ui` component library.

## Plugin Lifecycle

*   **Loading**: Plugins are loaded once at application startup.
*   **Singleton**: Each plugin is treated as a singleton instance.
*   **React Lifecycle**: Components registered by plugins are mounted/unmounted based on UI visibility (e.g., when a tab is selected).
*   **Persistence**: Plugins are not hot-unloaded. State stored in React components will reset on unmount, but state in `localStorage` or external stores persists.

## Getting Started

### Quick Start: Your First Plugin

1.  **Create File**: Create `examples/my_plugin/MyPlugin.tsx`.
2.  **Define**: Export a `PluginDefinition` object (see Structure below).
3.  **Register**: Add your plugin to `build-plugins.js`.
4.  **Build**: Run `node build-plugins.js`.
5.  **Load**: The build script automatically copies output to the CLI workspace.
6.  **Verify**: Open Embeddr and check the Zen Toolbox or Settings.

### 1. Structure

A typical plugin consists of a single entry file (e.g., `MyPlugin.tsx`) that exports a `PluginDefinition` object.

```typescript
import type { PluginDefinition, EmbeddrAPI } from "@embeddr/react-ui/types";

const MyComponent: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  return <div>Hello from My Plugin!</div>;
};

export const MyPlugin: PluginDefinition = {
  id: "my.plugin",
  name: "My Plugin",
  description: "A simple example plugin",
  version: "1.0.0",
  components: [
    {
      id: "my-component",
      location: "zen-toolbox-tab",
      label: "My Tab",
      component: MyComponent,
    },
  ],
};

// Register the plugin if loaded in the browser
if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(MyPlugin);
}
```

### 2. Building

Plugins are built as IIFE (Immediately Invoked Function Expression) bundles. We use a custom build script (`build-plugins.js`) that leverages Vite.

To build your plugin, add it to the `plugins` object in `build-plugins.js` and run:

```bash
node build-plugins.js
```

This will generate a `dist/your-plugin/index.js` and `style.css` which can be loaded by Embeddr.

## Backend Development (Python)

Plugins can also include a Python backend to handle API requests, database operations, or other server-side logic.

### 1. Structure

Create a `plugin.py` file in your plugin's directory (alongside the built `index.js`).

```python
from fastapi import APIRouter

def register(router: APIRouter):
    @router.get("/hello")
    def hello():
        return {"message": "Hello from Python!"}
```

### 2. Loading

The Embeddr backend automatically scans for `plugin.py` files. If found, it calls the `register(router)` function.
The router is automatically prefixed with `/api/v1/plugins/{plugin_name}`.

For example, if your plugin folder is named `my-plugin`, the route above would be accessible at:
`GET /api/v1/plugins/my-plugin/hello`

### 3. Example

The **Arcade** plugin demonstrates this by implementing a simple leaderboard system in Python.

## ComfyUI Integration

If your plugin requires custom ComfyUI nodes (e.g., for specific image processing tasks), these are currently handled as standard ComfyUI Custom Nodes.

1.  Create a Python file for your node (e.g., `MyNode.py`).
2.  Register it in the `__init__.py` of the `embeddr-comfyui` package (or your own custom node pack).
3.  Your frontend plugin can then use this node in workflows by referencing its internal name (e.g., `embeddr.MyNode`).

**Example:** The `EmbeddrLoadImageID` node allows ComfyUI to load images directly from the Embeddr library using their ID.

## API Reference (`EmbeddrAPI`)

Every plugin component receives an `api` prop providing access to the core system.

### Stores (`api.stores`)
Access and modify global application state.

- **`global`**:
  - `selectedImage`: The currently selected image object.
  - `selectImage(image)`: Select an image programmatically.
- **`generation`**:
  - `workflows`: List of available ComfyUI workflows.
  - `selectedWorkflow`: The currently active workflow.
  - `isGenerating`: Boolean status of generation.
  - `generate()`: Trigger the generation process.
  - `setWorkflowInput(nodeId, field, value)`: Update workflow inputs dynamically.

### UI (`api.ui`)
- `activePanelId`: ID of the currently focused panel.
- `isPanelActive(id)`: Check if a panel is active.

### Toast (`api.toast`)
Display notifications to the user.
- `success(msg)`
- `error(msg)`
- `info(msg)`

### Utilities (`api.utils`)
- `backendUrl`: Base URL of the API.
- `uploadImage(file, prompt?, parent_ids?)`: Upload an image to the library.
- `getPluginUrl(path)`: Get a full URL for plugin assets.

### Events (`api.events`)
Subscribe to or emit global events.
- `on(event, listener)`
- `emit(event, data)`
- `off(event, listener)`

**Common Events:**
- `generation:start`
- `generation:complete`
- `image:uploaded`

## Example Plugins

We provide several example plugins to demonstrate different capabilities.

### 1. Layer Editor (`embeddr-layereditor`)
**Demonstrates:** Complex UI, Canvas manipulation, Drag & Drop, State persistence.
- **Key Features:**
  - Uses `DraggablePanel` for a floating window.
  - Implements a full image composition tool with layers (Image, Paint, Mask).
  - Uses `useLocalStorage` to persist workspaces.
  - Interacts with `api.utils.uploadImage` to export compositions.
  - Uses `api.stores.generation.setWorkflowInput` to send images to ComfyUI.

### 2. Pet Panel (`embeddr-pet`)
**Demonstrates:** Event listening, Passive interaction.
- **Key Features:**
  - Listens to `generation:start` and `generation:complete` events.
  - Plays sounds and shows animations based on app state.
  - Uses `api.toast` for notifications.

### 3. Arcade (`embeddr-arcade`)
**Demonstrates:** Full-stack Plugin (React + Python), iframe integration.
- **Key Features:**
  - **Frontend**: Embeds external content (games) and displays a leaderboard.
  - **Backend**: Implements a `plugin.py` with FastAPI routes to store and retrieve high scores in memory.
  - Shows how to fetch data from your own plugin's backend.

### 4. Civitai Browser (`embeddr-civitai`)
**Demonstrates:** External API fetching, Infinite Scroll.
- **Key Features:**
  - Fetches data from the Civitai API.
  - Implements infinite scrolling using `IntersectionObserver`.
  - Drag & Drop integration to import images from the web directly into Embeddr.

### 5. Generate Button (`embeddr-generatebutton`)
**Demonstrates:** Simple action triggers.
- **Key Features:**
  - A simple button that calls `api.stores.generation.generate()`.
  - Shows how to add a component to the `zen-toolbox-action` location.

## Available Hooks & Components

Plugins can import from `@embeddr/react-ui` to use the same design system as the core app.

**Components:**
- `Button`, `Input`, `Slider`, `Switch`
- `Dialog`, `DropdownMenu`, `Tabs`
- `ScrollArea`, `Card`
- `DraggablePanel` (Essential for floating windows)

**Hooks:**
- `useLocalStorage`: Persist state across reloads.
- `useMediaQuery`: Responsive design.

## Locations

When defining a component, you specify a `location`.

*   **`zen-toolbox-tab`**: Adds a tab to the main Zen Mode toolbox (left side).
*   **`zen-toolbox-action`**: Adds a button/component to the action area (bottom/top of toolbox).
*   **`zen-sidebar`**: Adds an item to the sidebar (if available).
*   **`zen-overlay`**: Renders directly on top of the UI (use carefully).

**Behavioral Notes:**
*   **Multiple Plugins**: Multiple plugins can register components to the same location.
*   **Ordering**: Currently, items are rendered in the order they are loaded.
*   **Cardinality**: A single plugin can register multiple components to different (or the same) locations.

## Development Guidelines

### Best Practices

1.  **Scoped CSS**: Use unique class names or CSS modules if possible (though Tailwind is preferred and supported).
2.  **State Management**: Use `React.useState` for local state and `useLocalStorage` for persistent user preferences.
3.  **Error Handling**: Wrap async operations (like uploads) in try/catch blocks and use `api.toast.error` to inform the user.
4.  **Performance**: Avoid heavy computations in the main render loop. Use `useMemo` and `useCallback`.
5.  **Cleanup**: If you register global event listeners in `useEffect`, always return a cleanup function to remove them.

### Common Pitfalls (What NOT to do)

*   **Direct DOM Manipulation**: Avoid accessing the DOM directly (e.g., `document.getElementById`). Always use React refs.
*   **Blocking the UI**: Do not perform synchronous heavy operations. The UI runs on a single thread.
*   **Hardcoded URLs**: Never hardcode API URLs (e.g., `localhost:8000`). Always use `api.utils.backendUrl` or relative paths.
*   **Overwriting Global Styles**: Be extremely careful with global CSS. Your styles might break the main application layout.
*   **Ignoring Mobile**: Remember that the sidebar and toolbox might be viewed on smaller screens. Test your responsive layout.

### Versioning & Compatibility

*   **Semantic Versioning**: Plugins should follow semantic versioning (major.minor.patch).
*   **API Stability**: The `EmbeddrAPI` is currently in **Alpha**. Breaking changes may occur.
*   **Dependencies**: If your plugin relies on specific Python packages, list them clearly in your documentation. There is currently no automated dependency resolution for plugins.
*   **Locking**: We recommend testing your plugin against the specific version of Embeddr you are targeting.

## Packages

[![pypi version][pypi-image]][pypi-url]
[![embeddr-core version][embeddr-core-image]][embedd-core-url]
[![embeddr-frontend][embeddr-frontend-image]][embedd-frontend-url]
[![embeddr-react-ui version][embeddr-react-ui-image]][embedd-react-ui-url]

[![license][license-image]][license-url]


[pypi-image]: https://img.shields.io/pypi/v/embeddr-cli?style=flat-square&&logo=Python&logoColor=%23ffd343&label=cli&labelColor=%232f2f2f&color=%234f4f4f
[pypi-url]: https://pypi.org/project/embeddr-cli

[embeddr-core-image]: https://img.shields.io/pypi/v/embeddr-core?style=flat-square&logo=Python&logoColor=%23ffd343&label=core&labelColor=%232f2f2f&color=%234f4f4f
[embedd-core-url]: https://pypi.org/project/embeddr-core

[embeddr-react-ui-image]: https://img.shields.io/npm/v/%40embeddr%2Freact-ui?style=flat-square&logo=React&logoColor=%61DBFB&label=react-ui&labelColor=%232f2f2f&color=%234f4f4f
[embedd-react-ui-url]: https://www.npmjs.com/package/@embeddr/react-ui

[embeddr-frontend-image]: https://img.shields.io/npm/v/%40embeddr%2Freact-ui?style=flat-square&logo=React&logoColor=%61DBFB&label=frontend&labelColor=%232f2f2f&color=%234f4f4f
[embedd-frontend-url]: https://github.com/embeddr-net/embeddr-frontend

[license-image]: https://img.shields.io/github/license/embeddr-net/embeddr-cli?style=flat-square&logoColor=%232f2f2f&labelColor=%232f2f2f&color=%234f4f4f
[license-url]: https://pypi.org/project/embeddr-cli
