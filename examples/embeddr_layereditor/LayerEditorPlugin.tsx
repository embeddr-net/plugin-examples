import React, { useState, useRef, useEffect, useCallback } from "react";
import "./layer_editor.css";
import { createPortal } from "react-dom";
import type { PluginDefinition, EmbeddrAPI } from "@embeddr/react-ui/types";
import { DraggablePanel } from "@embeddr/react-ui/components/draggable-panel";
import { useLocalStorage } from "@embeddr/react-ui/hooks";
import { Button } from "@embeddr/react-ui/components/button";
import {
  Layers,
  Trash2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  Plus,
  X,
  Move,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Brush,
  Eraser,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Palette,
  MousePointer2,
  Scan,
} from "lucide-react";
import { ScrollArea } from "@embeddr/react-ui/components/scroll-area";
import { Slider } from "@embeddr/react-ui/components/slider";
import { Input } from "@embeddr/react-ui/components/input";
import { Label } from "@embeddr/react-ui/components/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@embeddr/react-ui/components/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@embeddr/react-ui/components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@embeddr/react-ui/components/dialog";
import { Switch } from "@embeddr/react-ui/components/switch";

// --- Types ---

type Tool = "select" | "hand" | "brush" | "eraser";

interface Layer {
  id: string;
  type: "image" | "paint" | "mask";
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  url: string; // For image: source url, For paint: data url
  imageId?: string; // Only for image layers
}

interface Workspace {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  zoom: number;
  pan: { x: number; y: number };
}

// --- Constants ---

const DEFAULT_WORKSPACE: Workspace = {
  id: "default",
  name: "Untitled-1",
  width: 512,
  height: 512,
  layers: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
};

// --- Component ---

const LayerEditorComponent: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const [isOpen, setIsOpen] = useState(false);

  // State
  const [workspaces, setWorkspaces] = useLocalStorage<Workspace[]>(
    "layer-editor-workspaces-v2",
    [DEFAULT_WORKSPACE]
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useLocalStorage<string>(
    "layer-editor-active-workspace",
    "default"
  );

  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    existingId: string | null;
    file: File | null;
  }>({ open: false, existingId: null, file: null });

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasFitRef = useRef(false);

  // Computed
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeLayer = activeWorkspace.layers.find(
    (l) => l.id === selectedLayerId
  );

  // Auto-fit on open
  useEffect(() => {
    if (isOpen && !hasFitRef.current && canvasRef.current) {
      setTimeout(() => {
        fitToScreen();
        hasFitRef.current = true;
      }, 100);
    }
  }, [isOpen]);

  // --- Workspace Management ---

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const addWorkspace = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newWorkspace: Workspace = {
      ...DEFAULT_WORKSPACE,
      id: newId,
      name: `Untitled-${workspaces.length + 1}`,
    };
    setWorkspaces([...workspaces, newWorkspace]);
    setActiveWorkspaceId(newId);
  };

  const closeWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return;
    const newWorkspaces = workspaces.filter((w) => w.id !== id);
    setWorkspaces(newWorkspaces);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[newWorkspaces.length - 1].id);
    }
  };

  // --- Layer Management ---

  const addLayer = (layer: Layer) => {
    updateWorkspace(activeWorkspaceId, {
      layers: [...activeWorkspace.layers, layer],
    });
    setSelectedLayerId(layer.id);
  };

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    updateWorkspace(activeWorkspaceId, {
      layers: activeWorkspace.layers.map((l) =>
        l.id === layerId ? { ...l, ...updates } : l
      ),
    });
  };

  const deleteLayer = (layerId: string) => {
    updateWorkspace(activeWorkspaceId, {
      layers: activeWorkspace.layers.filter((l) => l.id !== layerId),
    });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const moveLayerOrder = (index: number, direction: "up" | "down") => {
    const layers = [...activeWorkspace.layers];
    if (direction === "up" && index < layers.length - 1) {
      [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    } else if (direction === "down" && index > 0) {
      [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    }
    updateWorkspace(activeWorkspaceId, { layers });
  };

  const addPaintLayer = () => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type: "paint",
      name: `Paint Layer ${
        activeWorkspace.layers.filter((l) => l.type === "paint").length + 1
      }`,
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      width: activeWorkspace.width,
      height: activeWorkspace.height,
      opacity: 1,
      url: "", // Empty initially
    };
    addLayer(newLayer);
  };

  const addMaskLayer = () => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type: "mask",
      name: `Mask Layer ${
        activeWorkspace.layers.filter((l) => l.type === "mask").length + 1
      }`,
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      width: activeWorkspace.width,
      height: activeWorkspace.height,
      opacity: 0.5,
      url: "",
    };
    addLayer(newLayer);
    setActiveTool("brush");
  };

  // --- Interaction Handlers ---

  const fitToScreen = () => {
    if (!canvasRef.current) return;
    const containerW = canvasRef.current.clientWidth;
    const containerH = canvasRef.current.clientHeight;
    const padding = 40;

    const scaleX = (containerW - padding) / activeWorkspace.width;
    const scaleY = (containerH - padding) / activeWorkspace.height;
    const newZoom = Math.min(scaleX, scaleY);

    updateWorkspace(activeWorkspaceId, {
      zoom: newZoom,
      pan: { x: 0, y: 0 },
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Pan if Ctrl is held (inverse of standard, but maybe useful if they want to scroll?)
      // Actually user said "we want the scroll to zoom in and out".
      // Let's make Wheel = Zoom, Ctrl+Wheel = Pan? Or just Wheel = Zoom always.
      // Standard is Wheel=Pan, Ctrl+Wheel=Zoom. User wants Wheel=Zoom.
      // So let's make Wheel=Zoom.
      // What about Pan? Middle click or Space+Drag is already implemented.
      // So we don't strictly need wheel to pan.
      // Let's just make wheel zoom always for now as requested.
    }

    const delta = -e.deltaY;
    const scaleFactor = delta > 0 ? 1.1 : 0.9;
    const newZoom = Math.min(
      Math.max(0.1, activeWorkspace.zoom * scaleFactor),
      10
    );
    updateWorkspace(activeWorkspaceId, { zoom: newZoom });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    // Middle click or Space+Click or Hand tool -> Pan
    if (e.button === 1 || activeTool === "hand" || e.shiftKey) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Brush Tool
    if (activeTool === "brush" || activeTool === "eraser") {
      if (
        activeLayer &&
        (activeLayer.type === "paint" || activeLayer.type === "mask") &&
        !activeLayer.locked &&
        activeLayer.visible
      ) {
        startPainting(e);
      } else {
        api.toast.error(
          "Select a visible, unlocked paint or mask layer to draw"
        );
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      if (activeTool === "hand" || e.button === 1 || e.shiftKey) {
        updateWorkspace(activeWorkspaceId, {
          pan: {
            x: activeWorkspace.pan.x + dx,
            y: activeWorkspace.pan.y + dy,
          },
        });
      }

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }

    if (activeTool === "brush" || activeTool === "eraser") {
      continuePainting(e);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    stopPainting();
  };

  // --- Painting Logic ---

  const getCanvasPoint = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Calculate position relative to the viewport center/pan
    // This is tricky because of the transforms.
    // Easiest way: The event target might be the layer itself if we pointer-events it?
    // But we have a wrapper.

    // Let's reverse the transform:
    // screen -> client -> relative to container center -> unpan -> unzoom -> relative to canvas origin

    // Container center
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Unpan
    const unpannedX = dx - activeWorkspace.pan.x;
    const unpannedY = dy - activeWorkspace.pan.y;

    // Unzoom
    const unzoomedX = unpannedX / activeWorkspace.zoom;
    const unzoomedY = unpannedY / activeWorkspace.zoom;

    // Relative to canvas origin (which is centered at 0,0 in unzoomed space if we center it)
    // We center the canvas div: transform: translate(-50%, -50%)
    // So 0,0 is the center of the canvas.
    // Top-left is -width/2, -height/2

    const x = unzoomedX + activeWorkspace.width / 2;
    const y = unzoomedY + activeWorkspace.height / 2;

    return { x, y };
  };

  const startPainting = (e: React.MouseEvent) => {
    if (
      !activeLayer ||
      (activeLayer.type !== "paint" && activeLayer.type !== "mask")
    )
      return;
    isDraggingRef.current = true;

    // We need to draw on a temporary canvas or directly on the layer?
    // Since we store data URL, we need to load it into a canvas, draw, then save back.
    // Optimization: Keep a ref to the active paint canvas context if possible.
    // For now, let's assume the layer renders a <canvas> and we can get its context via ref or ID.

    const canvas = document.getElementById(
      `paint-canvas-${activeLayer.id}`
    ) as HTMLCanvasElement;
    if (!canvas) return;

    paintCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getCanvasPoint(e);
    // Adjust for layer position
    const lx = point.x - activeLayer.x;
    const ly = point.y - activeLayer.y;

    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle =
      activeLayer.type === "mask"
        ? "rgba(255, 0, 0, 1)"
        : activeTool === "eraser"
        ? "rgba(0,0,0,1)"
        : brushColor;
    ctx.lineWidth = brushSize;
    if (activeTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const continuePainting = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !paintCanvasRef.current) return;
    if (activeTool !== "brush" && activeTool !== "eraser") return;

    const ctx = paintCanvasRef.current.getContext("2d");
    if (!ctx) return;

    const point = getCanvasPoint(e);
    const lx = point.x - (activeLayer?.x || 0);
    const ly = point.y - (activeLayer?.y || 0);

    ctx.lineTo(lx, ly);
    ctx.stroke();
  };

  const stopPainting = () => {
    if (paintCanvasRef.current && activeLayer) {
      // Save state
      const url = paintCanvasRef.current.toDataURL();
      updateLayer(activeLayer.id, { url });
      paintCanvasRef.current = null;
    }
  };

  // --- Drag & Drop Import ---

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imageId = e.dataTransfer.getData("application/embeddr-image-id");
    const externalUrl =
      e.dataTransfer.getData("application/external-image-url") ||
      e.dataTransfer.getData("text/plain");

    const point = {
      x: activeWorkspace.width / 2 - 100,
      y: activeWorkspace.height / 2 - 100,
    }; // Default center

    if (imageId) {
      const newLayer: Layer = {
        id: Math.random().toString(36).substr(2, 9),
        type: "image",
        name: `Image ${imageId}`,
        visible: true,
        locked: false,
        imageId,
        url: `${api.utils.backendUrl}/images/${imageId}/file`,
        x: point.x,
        y: point.y,
        width: 200,
        height: 200,
        opacity: 1,
      };
      addLayer(newLayer);
      api.toast.success("Image added");
    } else if (
      externalUrl &&
      (externalUrl.startsWith("http") || externalUrl.startsWith("data:"))
    ) {
      try {
        api.toast.info("Importing...");
        const res = await fetch(externalUrl);
        const blob = await res.blob();
        const file = new File([blob], "dropped.png", { type: blob.type });
        const uploaded = await api.utils.uploadImage(file, "Dropped Image");

        const newLayer: Layer = {
          id: Math.random().toString(36).substr(2, 9),
          type: "image",
          name: "Dropped Image",
          visible: true,
          locked: false,
          imageId: uploaded.id,
          url: `${api.utils.backendUrl}/images/${uploaded.id}/file`,
          x: point.x,
          y: point.y,
          width: 200,
          height: 200,
          opacity: 1,
        };
        addLayer(newLayer);
        api.toast.success("Image added");
      } catch (err) {
        console.error(err);
        api.toast.error("Failed to import");
      }
    }
  };

  // --- Export ---

  const handleExportSuccess = (uploaded: {
    id: string | number;
    image_url?: string;
  }) => {
    // Emit event for image explorer
    api.events.emit("image:uploaded", uploaded);

    // Set as input
    const { selectedWorkflow, setWorkflowInput } = api.stores.generation;
    if (selectedWorkflow) {
      const inputs = selectedWorkflow.meta?.exposed_inputs || [];
      const imageInput = inputs.find(
        (i: any) =>
          i.type === "image" ||
          i.type === "image_id" ||
          i.field === "image_url" ||
          i.field === "image_id"
      );

      if (imageInput) {
        const imgUrl =
          uploaded.image_url ||
          `${api.utils.backendUrl}/images/${uploaded.id}/file`;
        if (imageInput.type === "image_id" || imageInput.field === "image_id") {
          setWorkflowInput(imageInput.node_id, "image_id", uploaded.id);
        } else {
          setWorkflowInput(imageInput.node_id, imageInput.field, imgUrl);
        }
        setWorkflowInput(imageInput.node_id, "_preview", imgUrl);
        api.toast.success("Composition set as input!");
      } else {
        api.toast.success("Uploaded to library");
      }
    } else {
      api.toast.success("Uploaded to library");
    }
  };

  const uploadFile = async (file: File, force = false) => {
    const parentIds = activeWorkspace.layers
      .map((l) => l.imageId)
      .filter(Boolean) as string[];

    const formData = new FormData();
    formData.append("file", file);
    formData.append("prompt", activeWorkspace.name);
    if (parentIds.length > 0) {
      formData.append("parent_ids", JSON.stringify(parentIds));
    }
    if (force || allowDuplicates) {
      formData.append("force", "true");
    }

    const res = await fetch(`${api.utils.backendUrl}/images/upload`, {
      method: "POST",
      body: formData,
    });

    if (res.status === 409) {
      const data = await res.json();
      setDuplicateDialog({
        open: true,
        existingId: data.existing_image.id,
        file,
      });
      return;
    }

    if (!res.ok) throw new Error(res.statusText);

    const uploaded = await res.json();
    handleExportSuccess(uploaded);
  };

  const exportImage = async () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = activeWorkspace.width;
      canvas.height = activeWorkspace.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No context");

      // Fill background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw layers (Image and Paint)
      for (const layer of activeWorkspace.layers) {
        if (!layer.visible) continue;
        if (layer.type === "mask") continue;

        ctx.globalAlpha = layer.opacity;

        if (layer.type === "image" || (layer.type === "paint" && layer.url)) {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
              ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
              resolve();
            };
            img.onerror = reject;
            img.src = layer.url;
          });
        }
      }

      // Apply Masks (Destination Out)
      ctx.globalCompositeOperation = "destination-out";
      for (const layer of activeWorkspace.layers) {
        if (!layer.visible) continue;
        if (layer.type !== "mask") continue;

        if (layer.url) {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
              ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
              resolve();
            };
            img.onerror = reject;
            img.src = layer.url;
          });
        }
      }
      ctx.globalCompositeOperation = "source-over";

      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/png")
      );
      if (!blob) throw new Error("Failed to blob");

      const file = new File(
        [blob],
        `${activeWorkspace.name}-${Date.now()}.png`,
        { type: "image/png" }
      );

      await uploadFile(file);
    } catch (e) {
      console.error(e);
      api.toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDuplicateAction = async (
    action: "use_existing" | "create_copy"
  ) => {
    if (action === "use_existing" && duplicateDialog.existingId) {
      const id = duplicateDialog.existingId;
      const url = `${api.utils.backendUrl}/images/${id}/file`;
      handleExportSuccess({ id, image_url: url });
    } else if (action === "create_copy") {
      if (duplicateDialog.file) {
        setIsExporting(true);
        try {
          await uploadFile(duplicateDialog.file, true);
        } catch (e) {
          console.error(e);
          api.toast.error("Export failed");
        } finally {
          setIsExporting(false);
        }
      }
    }
    setDuplicateDialog({ open: false, existingId: null, file: null });
  };

  return (
    <>
      <div className="p-2 space-y-2">
        <Button
          variant={isOpen ? "secondary" : "outline"}
          className="w-full justify-start"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Layers className="w-4 h-4 mr-2" />
          {isOpen ? "Close Editor" : "Open Layer Editor"}
        </Button>
      </div>

      {isOpen &&
        createPortal(
          <DraggablePanel
            id="layer-editor-main"
            title="Layer Editor"
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            defaultPosition={{ x: 100, y: 50 }}
            defaultSize={{ width: 1000, height: 800 }}
            className="absolute z-50 flex flex-col"
          >
            {/* Top Bar: Workspaces & Tools */}
            <div className="h-12 border-b bg-muted/30 flex items-center px-2 gap-2 shrink-0">
              <div className="flex-1 flex items-center overflow-hidden">
                <ScrollArea orientation="horizontal" className="w-full">
                  <div className="flex items-center gap-1">
                    {workspaces.map((w) => (
                      <div
                        key={w.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-b-2 transition-colors ${
                          activeWorkspaceId === w.id
                            ? "bg-background border-primary font-medium"
                            : "hover:bg-muted border-transparent text-muted-foreground"
                        }`}
                        onClick={() => setActiveWorkspaceId(w.id)}
                      >
                        {w.name}
                        <X
                          className="w-3 h-3 opacity-50 hover:opacity-100"
                          onClick={(e) => closeWorkspace(w.id, e)}
                        />
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={addWorkspace}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </ScrollArea>
              </div>

              <div className="flex items-center gap-1 border-l pl-2">
                <Button
                  variant={activeTool === "select" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setActiveTool("select")}
                  title="Move / Select (V)"
                >
                  <Move className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "hand" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setActiveTool("hand")}
                  title="Pan (H or Space)"
                >
                  <Hand className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "brush" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setActiveTool("brush")}
                  title="Brush (B)"
                >
                  <Brush className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTool === "eraser" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setActiveTool("eraser")}
                  title="Eraser (E)"
                >
                  <Eraser className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="w-8 h-8 p-0"
                    >
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: brushColor }}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                      <Label>Brush Color</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          "#ffffff",
                          "#000000",
                          "#ff0000",
                          "#00ff00",
                          "#0000ff",
                          "#ffff00",
                          "#00ffff",
                          "#ff00ff",
                        ].map((c) => (
                          <div
                            key={c}
                            className="w-6 h-6 rounded-full border cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                            onClick={() => setBrushColor(c)}
                          />
                        ))}
                      </div>
                      <Input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        className="h-8"
                      />
                      <Label>Brush Size: {brushSize}px</Label>
                      <Slider
                        value={[brushSize]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={([v]) => setBrushSize(v)}
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar: Layers */}
              <div className="w-64 border-r bg-muted/10 flex flex-col shrink-0">
                <div className="p-2 border-b flex items-center justify-between">
                  <span className="text-xs font-medium">Layers</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={addPaintLayer}
                      title="New Paint Layer"
                    >
                      <Palette className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={addMaskLayer}
                      title="New Mask Layer"
                    >
                      <Scan className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {[...activeWorkspace.layers].reverse().map((layer, i) => {
                      const index = activeWorkspace.layers.length - 1 - i;
                      return (
                        <div
                          key={layer.id}
                          className={`group flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                            selectedLayerId === layer.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted border-transparent"
                          }`}
                          onClick={() => setSelectedLayerId(layer.id)}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-5 w-5 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLayer(layer.id, {
                                visible: !layer.visible,
                              });
                            }}
                          >
                            {layer.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-muted-foreground" />
                            )}
                          </Button>

                          <div className="w-8 h-8 bg-muted rounded overflow-hidden shrink-0 border flex items-center justify-center">
                            {layer.type === "image" ? (
                              <img
                                src={layer.url}
                                className="w-full h-full object-cover"
                              />
                            ) : layer.type === "mask" ? (
                              <Scan className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Palette className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {layer.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {layer.type} • {Math.round(layer.opacity * 100)}%
                            </div>
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 flex items-center">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLayer(layer.id, {
                                  locked: !layer.locked,
                                });
                              }}
                            >
                              {layer.locked ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Unlock className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-5 w-5 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLayer(layer.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {selectedLayerId && activeLayer && (
                  <div className="p-3 border-t bg-muted/20 space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Opacity</span>
                        <span>{Math.round(activeLayer.opacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[activeLayer.opacity]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={([v]) =>
                          updateLayer(activeLayer.id, { opacity: v })
                        }
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() =>
                          moveLayerOrder(
                            activeWorkspace.layers.indexOf(activeLayer),
                            "up"
                          )
                        }
                      >
                        <ArrowUp className="w-3 h-3 mr-1" /> Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() =>
                          moveLayerOrder(
                            activeWorkspace.layers.indexOf(activeLayer),
                            "down"
                          )
                        }
                      >
                        <ArrowDown className="w-3 h-3 mr-1" /> Down
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Canvas Area */}
              <div
                className="flex-1 bg-[#1a1a1a] relative overflow-hidden flex items-center justify-center"
                ref={canvasRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  cursor:
                    activeTool === "hand"
                      ? "grab"
                      : activeTool === "brush"
                      ? "crosshair"
                      : "default",
                }}
              >
                {/* Viewport Transform Wrapper */}
                <div
                  style={{
                    transform: `translate(${activeWorkspace.pan.x}px, ${activeWorkspace.pan.y}px) scale(${activeWorkspace.zoom})`,
                    transformOrigin: "center",
                    transition: isDraggingRef.current
                      ? "none"
                      : "transform 0.1s ease-out",
                  }}
                >
                  {/* The Canvas */}
                  <div
                    className="relative bg-white shadow-2xl"
                    style={{
                      width: activeWorkspace.width,
                      height: activeWorkspace.height,
                      backgroundImage:
                        "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                    }}
                  >
                    {activeWorkspace.layers.map((layer) => {
                      if (!layer.visible) return null;

                      const isSelected = selectedLayerId === layer.id;

                      return (
                        <div
                          key={layer.id}
                          className={`absolute ${
                            activeTool === "select" && isSelected
                              ? "ring-1 ring-primary"
                              : ""
                          }`}
                          style={{
                            left: layer.x,
                            top: layer.y,
                            width: layer.width,
                            height: layer.height,
                            opacity: layer.opacity,
                            pointerEvents:
                              activeTool === "select" && !layer.locked
                                ? "auto"
                                : "none",
                          }}
                          onMouseDown={(e) => {
                            if (activeTool !== "select") return;
                            e.stopPropagation();
                            setSelectedLayerId(layer.id);

                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startLayerX = layer.x;
                            const startLayerY = layer.y;

                            const handleMove = (ev: MouseEvent) => {
                              const dx =
                                (ev.clientX - startX) / activeWorkspace.zoom;
                              const dy =
                                (ev.clientY - startY) / activeWorkspace.zoom;
                              updateLayer(layer.id, {
                                x: startLayerX + dx,
                                y: startLayerY + dy,
                              });
                            };

                            const handleUp = () => {
                              window.removeEventListener(
                                "mousemove",
                                handleMove
                              );
                              window.removeEventListener("mouseup", handleUp);
                            };

                            window.addEventListener("mousemove", handleMove);
                            window.addEventListener("mouseup", handleUp);
                          }}
                        >
                          {layer.type === "image" ? (
                            <img
                              src={layer.url}
                              className="w-full h-full object-fill pointer-events-none"
                              draggable={false}
                            />
                          ) : (
                            <canvas
                              id={`paint-canvas-${layer.id}`}
                              width={layer.width}
                              height={layer.height}
                              className="w-full h-full pointer-events-none"
                              ref={(el) => {
                                if (el && layer.url) {
                                  const ctx = el.getContext("2d");
                                  const img = new Image();
                                  img.onload = () => ctx?.drawImage(img, 0, 0);
                                  img.src = layer.url;
                                }
                              }}
                            />
                          )}

                          {/* Resize Handles (only for select tool) */}
                          {activeTool === "select" &&
                            isSelected &&
                            !layer.locked && (
                              <div
                                className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-se-resize border border-white"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const startX = e.clientX;
                                  const startY = e.clientY;
                                  const startW = layer.width;
                                  const startH = layer.height;

                                  const handleResize = (ev: MouseEvent) => {
                                    const dx =
                                      (ev.clientX - startX) /
                                      activeWorkspace.zoom;
                                    const dy =
                                      (ev.clientY - startY) /
                                      activeWorkspace.zoom;
                                    updateLayer(layer.id, {
                                      width: Math.max(10, startW + dx),
                                      height: Math.max(10, startH + dy),
                                    });
                                  };

                                  const handleUp = () => {
                                    window.removeEventListener(
                                      "mousemove",
                                      handleResize
                                    );
                                    window.removeEventListener(
                                      "mouseup",
                                      handleUp
                                    );
                                  };

                                  window.addEventListener(
                                    "mousemove",
                                    handleResize
                                  );
                                  window.addEventListener("mouseup", handleUp);
                                }}
                              />
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Zoom Indicator */}
                <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs border flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-4 w-4"
                    onClick={fitToScreen}
                    title="Fit to Screen"
                  >
                    <Maximize className="w-3 h-3" />
                  </Button>
                  <div className="w-px h-3 bg-border mx-1" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-4 w-4"
                    onClick={() =>
                      updateWorkspace(activeWorkspaceId, {
                        zoom: activeWorkspace.zoom * 0.9,
                      })
                    }
                  >
                    <ZoomOut className="w-3 h-3" />
                  </Button>
                  <span className="w-12 text-center">
                    {Math.round(activeWorkspace.zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-4 w-4"
                    onClick={() =>
                      updateWorkspace(activeWorkspaceId, {
                        zoom: activeWorkspace.zoom * 1.1,
                      })
                    }
                  >
                    <ZoomIn className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Right Sidebar: Properties / Export */}
              <div className="w-48 border-l bg-muted/10 flex flex-col shrink-0 p-3 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Canvas Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={activeWorkspace.width}
                      onChange={(e) =>
                        updateWorkspace(activeWorkspaceId, {
                          width: parseInt(e.target.value) || 512,
                        })
                      }
                    />
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={activeWorkspace.height}
                      onChange={(e) =>
                        updateWorkspace(activeWorkspaceId, {
                          height: parseInt(e.target.value) || 512,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Workspace Name</Label>
                  <Input
                    className="h-7 text-xs"
                    value={activeWorkspace.name}
                    onChange={(e) =>
                      updateWorkspace(activeWorkspaceId, {
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Allow Duplicates</Label>
                  <Switch
                    checked={allowDuplicates}
                    onCheckedChange={setAllowDuplicates}
                    className="scale-75"
                  />
                </div>

                <div className="flex-1" />

                <Button
                  className="w-full"
                  onClick={() => exportImage()}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3 mr-2" />
                  )}
                  Export
                </Button>
              </div>
            </div>
          </DraggablePanel>,
          document.body
        )}

      <Dialog
        open={duplicateDialog.open}
        onOpenChange={(open) =>
          !open && setDuplicateDialog((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Image Detected</DialogTitle>
            <DialogDescription>
              This image already exists in your library. Do you want to use the
              existing image or create a new copy?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDuplicateAction("use_existing")}
            >
              Use Existing
            </Button>
            <Button onClick={() => handleDuplicateAction("create_copy")}>
              Create Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const LayerEditorPlugin: PluginDefinition = {
  id: "core.layer-editor",
  name: "Layer Editor",
  description: "Advanced composition tool with layers and painting",
  version: "2.0.0",
  components: [
    {
      id: "layer-editor-launcher",
      location: "zen-toolbox-tab",
      label: "Editor",
      component: LayerEditorComponent,
    },
  ],
};

if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(LayerEditorPlugin);
}
