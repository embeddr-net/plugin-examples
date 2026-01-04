import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  ScrollArea,
  EmbeddrAPI,
  PluginDefinition,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Switch,
  Input,
} from "@embeddr/react-ui";
import {
  Loader2,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Heart,
  MessageCircle,
  AlertTriangle,
  Search,
} from "lucide-react";

interface CivitaiImage {
  id: number;
  url: string;
  hash: string;
  width: number;
  height: number;
  nsfw: boolean;
  nsfwLevel: "None" | "Soft" | "Mature" | "X";
  createdAt: string;
  username: string;
  stats: {
    cryCount: number;
    laughCount: number;
    likeCount: number;
    heartCount: number;
    commentCount: number;
  };
  meta: any;
}

interface CivitaiResponse {
  items: CivitaiImage[];
  metadata: {
    nextCursor?: number;
    nextPage?: string;
  };
}

type SortOption = "Most Reactions" | "Most Comments" | "Newest";
type PeriodOption = "AllTime" | "Year" | "Month" | "Week" | "Day";

const CivitaiBrowserComponent: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const [images, setImages] = useState<CivitaiImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>("Most Reactions");
  const [period, setPeriod] = useState<PeriodOption>("Week");
  const [nsfw, setNsfw] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);

  const fetchImages = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "20",
          sort,
          period,
          nsfw: nsfw ? "true" : "false",
        });

        if (!reset && nextCursor) {
          params.append("cursor", nextCursor.toString());
        }

        const res = await fetch(
          `https://civitai.com/api/v1/images?${params.toString()}`
        );
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data: CivitaiResponse = await res.json();

        if (reset) {
          setImages(data.items);
        } else {
          setImages((prev) => [...prev, ...data.items]);
        }
        setNextCursor(data.metadata.nextCursor);
      } catch (err) {
        console.error("Failed to fetch images", err);
        api.toast.error("Failed to fetch images from Civitai");
      } finally {
        setLoading(false);
      }
    },
    [sort, period, nsfw, nextCursor, loading, api]
  );

  const [username, setUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // Initial load and reset when filters change
  useEffect(() => {
    setImages([]);
    setNextCursor(undefined);
    
    const doFetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: "20",
                sort,
                period,
                nsfw: nsfw ? "true" : "false",
            });
            
            if (debouncedUsername) params.append("username", debouncedUsername);

            const res = await fetch(`https://civitai.com/api/v1/images?${params.toString()}`);
            const data = await res.json();
            setImages(data.items);
            setNextCursor(data.metadata.nextCursor);
        } catch(e) {
            console.error(e);
            api.toast.error("Failed to fetch images");
        } finally {
            setLoading(false);
        }
    };
    doFetch();
  }, [sort, period, nsfw, debouncedUsername]);

  const handleLoadMore = () => {
    if (nextCursor) {
        const doFetch = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    limit: "20",
                    sort,
                    period,
                    nsfw: nsfw ? "true" : "false",
                    cursor: nextCursor.toString()
                });
                
                if (debouncedUsername) params.append("username", debouncedUsername);

                const res = await fetch(`https://civitai.com/api/v1/images?${params.toString()}`);
                const data = await res.json();
                setImages(prev => [...prev, ...data.items]);
                setNextCursor(data.metadata.nextCursor);
            } catch(e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        doFetch();
    }
  };

  // Intersection Observer for Infinite Scroll
  const observerTarget = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [nextCursor, loading]);

  const handleDragStart = (e: React.DragEvent, img: CivitaiImage) => {
    e.dataTransfer.setData("text/plain", img.url);
    e.dataTransfer.setData("application/external-image-url", img.url);
    e.dataTransfer.effectAllowed = "copy";
    
    const dragImg = new Image();
    dragImg.src = img.url;
    e.dataTransfer.setDragImage(dragImg, 0, 0);
  };

  const handleImport = async (img: CivitaiImage) => {
    try {
      api.toast.info("Importing image...");
      // Civitai images might need a proxy if CORS is strict, but usually they are on CDN
      const res = await fetch(img.url);
      const blob = await res.blob();
      const file = new File([blob], `civitai-${img.id}.png`, { type: "image/png" });
      await api.utils.uploadImage(file, `Civitai: ${img.id} by ${img.username}`);
      api.toast.success("Image imported to library");
    } catch (err) {
      console.error(err);
      api.toast.error("Failed to import image (CORS?)");
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground">
      {/* Filters Header */}
      <div className="p-3 border-b space-y-3 bg-muted/20">
        {/* Search Inputs */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Username</Label>
          <div className="relative">
            <Input 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="User..."
              className="h-7 text-xs pr-6"
            />
            {username && (
              <button 
                onClick={() => setUsername("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-[10px] text-muted-foreground mb-1 block">Sort</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Most Reactions">Most Reactions</SelectItem>
                <SelectItem value="Most Comments">Most Comments</SelectItem>
                <SelectItem value="Newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-[10px] text-muted-foreground mb-1 block">Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Day">Day</SelectItem>
                <SelectItem value="Week">Week</SelectItem>
                <SelectItem value="Month">Month</SelectItem>
                <SelectItem value="Year">Year</SelectItem>
                <SelectItem value="AllTime">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Switch 
                    id="nsfw-mode" 
                    checked={nsfw} 
                    onCheckedChange={setNsfw}
                    className="scale-75 origin-left"
                />
                <Label htmlFor="nsfw-mode" className="text-xs cursor-pointer">NSFW</Label>
            </div>
            <Button 
                variant="ghost" 
                size="icon-sm" 
                className="h-6 w-6" 
                onClick={() => {
                    setImages([]);
                    setNextCursor(undefined);
                    // Force re-fetch by toggling a dummy state or just relying on the effect
                    // Since we cleared images, the user sees a clear.
                    // We can force a re-fetch by resetting sort to itself which triggers the effect
                    setSort(s => s); 
                }}
            >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0" type="always">
        <div className="p-2 grid grid-cols-2 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-[2/3] rounded-md overflow-hidden border bg-muted cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, img)}
            >
              <img
                src={img.url}
                alt={`By ${img.username}`}
                className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${img.nsfw && !nsfw ? 'blur-xl' : ''}`}
                loading="lazy"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <div className="flex items-center justify-between text-white/80 text-[10px] mb-2">
                    <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3 fill-current" /> {img.stats.heartCount + img.stats.likeCount}
                    </span>
                    <span className="truncate max-w-[60px]">@{img.username}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 text-[10px] w-full"
                  onClick={() => handleImport(img)}
                >
                  <Download className="h-3 w-3 mr-1" /> Import
                </Button>
              </div>

              {/* NSFW Badge */}
              {img.nsfw && (
                <div className="absolute top-1 right-1 bg-red-500/80 text-white text-[8px] px-1 rounded">
                    {img.nsfwLevel}
                </div>
              )}
            </div>
          ))}
          
          {/* Infinite Scroll Trigger */}
          <div ref={observerTarget} className="col-span-2 h-4" />

          {loading && (
            <div className="col-span-2 flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && images.length === 0 && (
            <div className="col-span-2 text-center py-8 text-muted-foreground text-xs">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No images found
            </div>
          )}

          {!loading && images.length > 0 && nextCursor && (
             <div className="col-span-2 p-2 text-center text-xs text-muted-foreground">
                Scroll for more...
             </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export const CivitaiBrowserPlugin: PluginDefinition = {
  id: "core.civitai-browser",
  name: "Civitai Browser",
  description: "Browse and import community images from Civitai",
  version: "1.0.0",
  components: [
    {
      id: "civitai-panel",
      location: "zen-overlay",
      label: "Civitai Feed",
      component: CivitaiBrowserComponent,
      defaultSize: { width: 340, height: 600 },
      defaultPosition: { x: 50, y: 100 },
    },
  ],
};

if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(CivitaiBrowserPlugin);
}
