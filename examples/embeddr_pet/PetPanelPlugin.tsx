import React, { useState, useEffect } from "react";
import "./pet_panel.css";
import { createPortal } from "react-dom";
import type { PluginDefinition, EmbeddrAPI } from "@embeddr/react-ui";
import { DraggablePanel } from "@embeddr/react-ui";
import { Button } from "@embeddr/react-ui";
import { Switch } from "@embeddr/react-ui";
import { Label } from "@embeddr/react-ui";
import { Cat, Fish, Volume2 } from "lucide-react";

// --- Sound Logic ---

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Nice "ding" sound
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Failed to play sound", e);
  }
};

// --- Pet Component ---

const PET_FRAMES = {
  idle: ["( ^_^ )", "( -_- )", "( ^_^ )", "( O_O )"],
  generating: ["( >_< )", "( <_> )", "( >_< )", "( <_> )"],
  happy: ["( ^o^ )", "( ^_^ )", "( ^o^ )", "( ^_^ )"],
};

const PetPanel: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [frame, setFrame] = useState(0);
  const [mood, setMood] = useState<"idle" | "generating" | "happy">("idle");
  const isGenerating = api.stores.generation.isGenerating;

  useEffect(() => {
    const unsub = api.events.on("pet:feed", () => {
      setMood("happy");
      setTimeout(() => setMood("idle"), 2000);
    });
    return unsub;
  }, [api.events]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isGenerating) {
      setMood("generating");
    } else if (mood === "generating") {
      setMood("happy");
      timeoutId = setTimeout(() => setMood("idle"), 2000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isGenerating]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Button
        variant={isOpen ? "secondary" : "outline"}
        className="w-full justify-start"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Cat className="w-4 h-4 mr-2" />
        {isOpen ? "Close Pet" : "Open Pet"}
      </Button>

      {isOpen &&
        createPortal(
          <DraggablePanel
            id="pet-panel"
            title="Desktop Pet"
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            defaultPosition={{ x: 100, y: 100 }}
            defaultSize={{ width: 200, height: 150 }}
            className="absolute z-50"
          >
            <div className="flex flex-col items-center justify-center h-full bg-background p-4">
              <div className="text-2xl font-mono font-bold mb-4">
                {PET_FRAMES[mood][frame]}
              </div>
              <div className="text-xs text-muted-foreground">
                {mood === "idle"
                  ? "Waiting..."
                  : mood === "generating"
                  ? "Working hard!"
                  : "Done!"}
              </div>
            </div>
          </DraggablePanel>,
          document.body
        )}
    </>
  );
};

// --- Action Components ---

const SoundConfigAction: React.FC<{ api: EmbeddrAPI }> = () => {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("pet-plugin-sound") === "true"
  );

  const toggle = (checked: boolean) => {
    setEnabled(checked);
    localStorage.setItem("pet-plugin-sound", String(checked));
    if (checked) playBeep(); // Preview
  };

  return (
    <div className="flex items-center justify-between space-x-2">
      <Label htmlFor="sound-mode" className="flex flex-col space-y-1">
        <span>Enable Sound</span>
        <span className="font-normal text-xs text-muted-foreground">
          Play a ding when done
        </span>
      </Label>
      <Switch id="sound-mode" checked={enabled} onCheckedChange={toggle} />
    </div>
  );
};

const FeedPetAction: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const feed = () => {
    api.toast.success("Yum! The pet is happy.");
    // We could dispatch an event here if we had a proper event bus
    api.events.emit("pet:feed");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Give the pet a treat to keep morale high during long generations.
      </p>
      <Button size="sm" onClick={feed} className="w-full">
        <Fish className="w-4 h-4 mr-2" />
        Feed Treat
      </Button>
    </div>
  );
};

// --- Plugin Definition ---

export const PetPanelPlugin: PluginDefinition = {
  id: "examples.pet-panel",
  name: "Desktop Pet",
  description: "A cute companion that reacts to your workflow",
  version: "1.0.0",
  author: "Embeddr",

  initialize: (api) => {
    console.log("[PetPanelPlugin] Initializing");
    // Subscribe to events to play sound
    const unsub = api.events.on("generation:complete", () => {
      console.log("[PetPanelPlugin] Received generation:complete event");
      const soundEnabled = localStorage.getItem("pet-plugin-sound") === "true";

      if (soundEnabled) {
        playBeep();
      }
    });

    return () => {
      console.log("[PetPanelPlugin] Cleaning up");
      unsub();
    };
  },

  components: [
    {
      id: "pet-panel-toggle",
      location: "zen-toolbox-tab",
      label: "Pet",
      component: PetPanel,
    },
  ],

  actions: [
    {
      id: "sound-config",
      location: "zen-toolbox-action",
      label: "Sound Settings",
      icon: Volume2,
      component: SoundConfigAction,
    },
    {
      id: "feed-pet",
      location: "zen-toolbox-action",
      label: "Feed Pet",
      icon: Fish,
      component: FeedPetAction,
    },
  ],
};

if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(PetPanelPlugin);
}
