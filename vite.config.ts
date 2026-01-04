import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/bundles",
    emptyOutDir: true,
    lib: {
      entry: {
        GenerateButtonPlugin: path.resolve(
          __dirname,
          "examples/GenerateButtonPlugin.tsx"
        ),
        LayerEditorPlugin: path.resolve(
          __dirname,
          "examples/LayerEditorPlugin.tsx"
        ),
        PetPanelPlugin: path.resolve(__dirname, "examples/PetPanelPlugin.tsx"),
        ArcadePlugin: path.resolve(
          __dirname,
          "examples/embeddr_arcade/ArcadePlugin.tsx"
        ),
      },
      formats: ["iife"],
      name: "EmbeddrPlugin",
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "@embeddr/react-ui"],
      output: {
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
