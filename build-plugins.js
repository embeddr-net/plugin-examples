import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const plugins = {
  "embeddr-generatebutton":
    "examples/embeddr_generatebutton/GenerateButtonPlugin.tsx",
  "embeddr-layereditor": "examples/embeddr_layereditor/LayerEditorPlugin.tsx",
  "embeddr-pet": "examples/embeddr_pet/PetPanelPlugin.tsx",
  "embeddr-arcade": "examples/embeddr_arcade/ArcadePlugin.tsx",
  "embeddr-civitai": "examples/embeddr_civitai/CivitaiBrowserPlugin.tsx",
};

async function buildPlugins() {
  for (const [name, entry] of Object.entries(plugins)) {
    console.log(`Building ${name}...`);
    await build({
      configFile: false,
      plugins: [react(), tailwindcss()],
      build: {
        outDir: `dist/${name}`,
        emptyOutDir: true,
        cssCodeSplit: false, // Force CSS to be emitted
        lib: {
          entry: path.resolve(__dirname, entry),
          formats: ["iife"],
          name: "EmbeddrPlugin",
          fileName: () => `index.js`,
        },
        rollupOptions: {
          external: ["react", "react-dom", "@embeddr/react-ui"],
          output: {
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith(".css")) {
                return "style.css";
              }
              return assetInfo.name;
            },
            globals: {
              react: "React",
              "react-dom": "ReactDOM",
              "@embeddr/react-ui": "EmbeddrUI",
            },
            extend: true,
          },
        },
      },
      define: {
        "process.env.NODE_ENV": '"production"',
      },
    });
  }
}

buildPlugins();
