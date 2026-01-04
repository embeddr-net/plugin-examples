import React, { useState, useEffect } from "react";
import "./generate_button.css";
import { Button } from "@embeddr/react-ui";
import {
  Play,
  Loader2,
  Palette,
  Sparkles,
  Zap,
  Gamepad2,
  Heart,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@embeddr/react-ui";
import type { EmbeddrAPI, PluginDefinition } from "@embeddr/react-ui";
import { cn } from "@embeddr/react-ui";

// Helper hook to read plugin settings
const usePluginSetting = <T,>(
  pluginId: string,
  key: string,
  defaultValue: T
): T => {
  const [value, setValue] = useState<T>(() => {
    try {
      const allSettings = JSON.parse(
        localStorage.getItem("zen-plugin-settings") || "{}"
      );
      return allSettings[pluginId]?.[key] ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const allSettings = JSON.parse(
          localStorage.getItem("zen-plugin-settings") || "{}"
        );
        const newValue = allSettings[pluginId]?.[key] ?? defaultValue;
        setValue(newValue);
      } catch {}
    };

    window.addEventListener("local-storage", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("local-storage", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pluginId, key, defaultValue]);

  return value;
};

type Theme = "default" | "pixel" | "kawaii" | "cyber";

const THEMES: Record<
  Theme,
  {
    label: string;
    icon: React.ElementType;
    containerClass: string;
    buttonClass: string;
    textClass: string;
    loader: React.ElementType;
    playIcon: React.ElementType;
  }
> = {
  default: {
    label: "Default",
    icon: Zap,
    containerClass: "bg-transparent",
    buttonClass:
      "bg-primary hover:bg-primary/90 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
    textClass: "text-muted-foreground",
    loader: Loader2,
    playIcon: Play,
  },
  pixel: {
    label: "Retro Pixel",
    icon: Gamepad2,
    containerClass: "bg-transparent font-mono",
    buttonClass:
      "bg-green-600 hover:bg-green-500 border-4 border-b-8 border-green-800 active:border-b-4 active:translate-y-1 rounded-none shadow-none text-white font-black tracking-widest",
    textClass: "text-green-400 font-mono text-[10px] uppercase",
    loader: Loader2,
    playIcon: Play,
  },
  kawaii: {
    label: "Kawaii",
    icon: Heart,
    containerClass: "bg-transparent",
    buttonClass:
      "bg-pink-400 hover:bg-pink-300 border-4 border-white shadow-[0_0_0_4px_rgba(244,114,182,0.5)] rounded-3xl text-white font-bold animate-pulse hover:animate-none",
    textClass: "text-pink-400 font-comic text-xs",
    loader: Sparkles,
    playIcon: Heart,
  },
  cyber: {
    label: "Cyberpunk",
    icon: Zap,
    containerClass: "bg-transparent",
    buttonClass:
      "bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:shadow-[0_0_25px_rgba(6,182,212,0.8)] font-mono tracking-[0.2em] uppercase backdrop-blur-md",
    textClass: "text-cyan-600 font-mono text-[10px] uppercase",
    loader: Loader2,
    playIcon: Zap,
  },
};

const GenerateButtonComponent: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const { isGenerating, selectedWorkflow, generations } = api.stores.generation;

  // Use settings from the plugin system
  const theme = usePluginSetting<Theme>(
    "core.generate-button",
    "theme",
    "default"
  );
  const customText = usePluginSetting<string>(
    "core.generate-button",
    "buttonText",
    ""
  );

  const pendingCount = generations.filter(
    (g) =>
      g.status === "pending" ||
      g.status === "processing" ||
      g.status === "queued"
  ).length;

  const currentTheme = THEMES[theme] || THEMES.default;
  const LoaderIcon = currentTheme.loader;
  const PlayIcon = currentTheme.playIcon;

  // We don't need local state for theme anymore, it's managed by settings
  const handleThemeChange = (newTheme: Theme) => {
    // We can't easily update settings from here without a helper,
    // but the settings dialog handles it.
    // If we want the dropdown to work, we'd need to update localStorage manually
    // to match the format expected by ZenSettingsDialog.
    try {
      const allSettings = JSON.parse(
        localStorage.getItem("zen-plugin-settings") || "{}"
      );
      const newSettings = {
        ...allSettings,
        "core.generate-button": {
          ...(allSettings["core.generate-button"] || {}),
          theme: newTheme,
        },
      };
      localStorage.setItem("zen-plugin-settings", JSON.stringify(newSettings));
      window.dispatchEvent(new Event("local-storage"));
    } catch {}
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-4 gap-2 relative group",
        currentTheme.containerClass
      )}
    >
      {/* Theme Selector - Hidden by default, shown on hover */}
      {/* <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Palette className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(THEMES).map(([key, t]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => handleThemeChange(key as Theme)}
                className="gap-2"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div> */}

      <Button
        variant="default"
        size="lg"
        className={cn(
          "w-full h-full min-h-[60px] text-lg font-bold",
          currentTheme.buttonClass
          // Remove opacity/cursor change so user can queue more
          // isGenerating && 'opacity-80 cursor-not-allowed',
        )}
        onClick={() => api.events.emit("zen:generate")}
        disabled={!selectedWorkflow}
      >
        {isGenerating ? (
          <>
            <LoaderIcon className="mr-2 h-6 w-6 animate-spin" />
            {theme === "pixel"
              ? `QUEUED [${pendingCount}]`
              : theme === "kawaii"
              ? `Cooking! (${pendingCount})`
              : theme === "cyber"
              ? `EXECUTING [${pendingCount}]`
              : `Generating (${pendingCount})`}
          </>
        ) : (
          <>
            <PlayIcon className="mr-2 h-6 w-6 fill-current" />
            {customText ||
              (theme === "pixel"
                ? "START"
                : theme === "kawaii"
                ? "Make Magic!"
                : theme === "cyber"
                ? "INITIALIZE"
                : "Generate")}
          </>
        )}
      </Button>
      {selectedWorkflow && (
        <div
          className={cn(
            "text-center truncate max-w-full px-2",
            currentTheme.textClass
          )}
        >
          {selectedWorkflow.name}
        </div>
      )}
    </div>
  );
};

export const GenerateButtonPlugin: PluginDefinition = {
  id: "core.generate-button",
  name: "Generate Button",
  description: "A movable panel with a large generate button",
  version: "1.0.0",
  settings: [
    {
      key: "buttonText",
      type: "string",
      label: "Button Text",
      description: "Custom text for the generate button",
      defaultValue: "",
    },
    {
      key: "theme",
      type: "select",
      label: "Theme",
      description: "Visual theme for the button",
      defaultValue: "default",
      options: [
        { label: "Default", value: "default" },
        { label: "Retro Pixel", value: "pixel" },
        { label: "Kawaii", value: "kawaii" },
        { label: "Cyberpunk", value: "cyber" },
      ],
    },
  ],
  components: [
    {
      id: "generate-panel",
      location: "zen-overlay",
      label: "Generate",
      component: GenerateButtonComponent,
      defaultSize: { width: 200, height: 120 },
      defaultPosition: {
        x: window.innerWidth - 220,
        y: window.innerHeight - 140,
      },
      options: {
        hideHeader: true,
        transparent: true,
      },
    },
  ],
};

if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(GenerateButtonPlugin);
}
