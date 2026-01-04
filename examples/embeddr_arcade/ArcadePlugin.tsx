import React, { useState, useEffect, useRef } from "react";
import "./style.css";
import { createPortal } from "react-dom";
import type { PluginDefinition, EmbeddrAPI } from "@embeddr/react-ui";
import { DraggablePanel } from "@embeddr/react-ui";
import { Button } from "@embeddr/react-ui";
import { Slider } from "@embeddr/react-ui";
import {
  Gamepad2,
  Play,
  RotateCcw,
  Pause,
  Volume2,
  VolumeX,
  ArrowLeft,
  Ghost,
  Grid3X3,
  Apple,
} from "lucide-react";
import tetrisTheme from "./theme.mp3";

// Game Boy Palette
const GB_COLORS = {
  lightest: "#9bbc0f",
  light: "#8bac0f",
  dark: "#306230",
  darkest: "#0f380f",
};

const RetroButton: React.FC<React.ComponentProps<typeof Button>> = ({
  className,
  ...props
}) => (
  <Button
    variant="ghost"
    className={`hover:bg-[#8bac0f] text-[#0f380f] ${className}`}
    {...props}
  />
);

// --- Tetris Game ---

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;
const PREVIEW_SIZE = 20;

const SHAPES = [
  [],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ], // T
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 3],
    [3, 3, 0],
    [0, 0, 0],
  ], // S
  [
    [4, 4, 0],
    [0, 4, 4],
    [0, 0, 0],
  ], // Z
  [
    [0, 0, 5],
    [5, 5, 5],
    [0, 0, 0],
  ], // L
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 0, 0],
    [7, 7, 7, 7],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
];

const createBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const TetrisGame: React.FC<{
  isActive: boolean;
  onExit: () => void;
  api?: EmbeddrAPI;
}> = ({ isActive, onExit, api }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const [volume, setVolume] = useState(0.1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(tetrisTheme);
    audioRef.current.loop = true;
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      if (!paused && !gameOver && isActive) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [volume, isMuted, paused, gameOver, isActive]);

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) setPaused(true);
  }, [isActive]);

  const gameState = useRef({
    board: createBoard(),
    piece: { matrix: [] as number[][], pos: { x: 0, y: 0 }, type: 0 },
    nextPiece: { matrix: [] as number[][], pos: { x: 0, y: 0 }, type: 0 },
    dropCounter: 0,
    lastTime: 0,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
  });

  const resetGame = () => {
    const newBoard = createBoard();
    gameState.current = {
      board: newBoard,
      piece: getRandomPiece(),
      nextPiece: getRandomPiece(),
      dropCounter: 0,
      lastTime: 0,
      score: 0,
      lines: 0,
      level: 1,
      gameOver: false,
      paused: false,
    };
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
  };

  const getRandomPiece = () => {
    const type = Math.floor(Math.random() * 7) + 1;
    const matrix = SHAPES[type];
    return {
      matrix,
      pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 },
      type,
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = GB_COLORS.lightest;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = GB_COLORS.light;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK_SIZE, 0);
      ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK_SIZE);
      ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
      ctx.stroke();
    }

    const drawBlock = (x: number, y: number, color: string) => {
      const px = x * BLOCK_SIZE + 1;
      const py = y * BLOCK_SIZE + 1;
      const size = BLOCK_SIZE - 2;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = GB_COLORS.dark;
      ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
      ctx.fillStyle = color;
      ctx.fillRect(px + 6, py + 6, size - 12, size - 12);
    };

    gameState.current.board.forEach((row, y) =>
      row.forEach((v, x) => v && drawBlock(x, y, GB_COLORS.darkest))
    );

    if (!gameState.current.gameOver) {
      const { matrix, pos } = gameState.current.piece;
      matrix.forEach((row, dy) =>
        row.forEach(
          (v, dx) => v && drawBlock(pos.x + dx, pos.y + dy, GB_COLORS.darkest)
        )
      );
    }
  };

  const drawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = GB_COLORS.lightest;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const matrix = gameState.current.nextPiece.matrix;
    const offsetX = (4 - matrix[0].length) / 2;
    const offsetY = (4 - matrix.length) / 2;

    matrix.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) {
          const px = (x + offsetX) * PREVIEW_SIZE + 1;
          const py = (y + offsetY) * PREVIEW_SIZE + 1;
          const size = PREVIEW_SIZE - 2;
          ctx.fillStyle = GB_COLORS.darkest;
          ctx.fillRect(px, py, size, size);
          ctx.fillStyle = GB_COLORS.dark;
          ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
          ctx.fillStyle = GB_COLORS.darkest;
          ctx.fillRect(px + 4, py + 4, size - 8, size - 8);
        }
      })
    );
  };

  const collide = (arena: number[][], player: any) => {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m[y].length; x++)
        if (m[y][x] && arena[y + o.y]?.[x + o.x] !== 0) return true;
    return false;
  };

  const merge = (
    arena: number[][],
    player: { matrix: number[][]; pos: { x: number; y: number }; type: number }
  ) => {
    player.matrix.forEach((row, y) =>
      row.forEach(
        (v, x) => v && (arena[y + player.pos.y][x + player.pos.x] = player.type)
      )
    );
  };

  const rotate = (matrix: number[][], dir: number) => {
    for (let y = 0; y < matrix.length; ++y)
      for (let x = 0; x < y; ++x)
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    dir > 0 ? matrix.forEach((row) => row.reverse()) : matrix.reverse();
  };

  const playerReset = () => {
    gameState.current.piece = gameState.current.nextPiece;
    gameState.current.nextPiece = getRandomPiece();
    if (collide(gameState.current.board, gameState.current.piece)) {
      gameState.current.gameOver = true;
      setGameOver(true);
      if (api) {
        const url = api.utils.getPluginUrl("highscores/tetris");
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: "Player",
            score: gameState.current.score,
          }),
        }).catch(() => {});
      }
    }
    drawPreview();
  };

  const arenaSweep = () => {
    let cleared = 0;
    outer: for (let y = ROWS - 1; y > 0; --y) {
      if (gameState.current.board[y].every((v) => v)) {
        gameState.current.board.splice(y, 1);
        gameState.current.board.unshift(Array(COLS).fill(0));
        ++y;
        cleared++;
      }
    }
    if (cleared) {
      const points = [0, 40, 100, 300, 1200];
      gameState.current.score += points[cleared] * gameState.current.level;
      gameState.current.lines += cleared;
      const newLevel = Math.floor(gameState.current.lines / 10) + 1;
      if (newLevel !== gameState.current.level) {
        gameState.current.level = newLevel;
        setLevel(newLevel);
      }
      setScore(gameState.current.score);
      setLines(gameState.current.lines);
    }
  };

  const playerDrop = () => {
    gameState.current.piece.pos.y++;
    if (collide(gameState.current.board, gameState.current.piece)) {
      gameState.current.piece.pos.y--;
      merge(gameState.current.board, gameState.current.piece);
      playerReset();
      arenaSweep();
    }
    gameState.current.dropCounter = 0;
  };

  const playerMove = (dir: number) => {
    gameState.current.piece.pos.x += dir;
    if (collide(gameState.current.board, gameState.current.piece))
      gameState.current.piece.pos.x -= dir;
  };

  const playerRotate = (dir: number) => {
    const pos = gameState.current.piece.pos.x;
    let offset = 1;
    rotate(gameState.current.piece.matrix, dir);
    while (collide(gameState.current.board, gameState.current.piece)) {
      gameState.current.piece.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > gameState.current.piece.matrix[0].length) {
        rotate(gameState.current.piece.matrix, -dir);
        gameState.current.piece.pos.x = pos;
        return;
      }
    }
  };

  const dropInterval = () =>
    1000 * Math.max(0.05, 1 - (gameState.current.level - 1) * 0.1);

  const update = (time = 0) => {
    if (gameState.current.gameOver || gameState.current.paused) return;
    const delta = time - gameState.current.lastTime;
    gameState.current.lastTime = time;
    gameState.current.dropCounter += delta;
    if (gameState.current.dropCounter > dropInterval()) playerDrop();
    draw();
    requestAnimationFrame(update);
  };

  useEffect(() => {
    resetGame();
    drawPreview();
    const handleKey = (e: KeyboardEvent) => {
      if (
        gameState.current.gameOver ||
        gameState.current.paused ||
        !isActiveRef.current
      )
        return;
      if (e.keyCode === 37) playerMove(-1);
      else if (e.keyCode === 39) playerMove(1);
      else if (e.keyCode === 40) playerDrop();
      else if (e.keyCode === 81 || e.keyCode === 90) playerRotate(-1);
      else if (e.keyCode === 87 || e.keyCode === 38) playerRotate(1);
      draw();
    };
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(update);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!paused && !gameOver) {
      gameState.current.paused = false;
      gameState.current.lastTime = performance.now();
      requestAnimationFrame(update);
    } else gameState.current.paused = true;
  }, [paused, gameOver]);

  return (
    <div
      className="flex flex-col items-center gap-4 p-4 h-full text-[#0f380f]"
      style={{ backgroundColor: GB_COLORS.lightest }}
    >
      <div className="flex justify-between w-full max-w-md items-center border-b-2 border-[#0f380f] pb-2">
        <RetroButton size="icon-sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4" />
        </RetroButton>
        <div className="flex flex-col text-sm font-mono text-right">
          <div>SCORE: {score.toString().padStart(8, "0")}</div>
          <div>LINES: {lines.toString().padStart(4, "0")}</div>
          <div>LEVEL: {level.toString().padStart(2, "0")}</div>
        </div>
        <div className="flex gap-2">
          <RetroButton
            size="icon-sm"
            onClick={() => {
              if (audioRef.current?.paused && !paused)
                audioRef.current.play().catch(() => {});
              setPaused(!paused);
            }}
          >
            {paused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </RetroButton>
          <RetroButton size="icon-sm" onClick={resetGame}>
            <RotateCcw className="w-4 h-4" />
          </RetroButton>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <div className="relative border-4 border-[#0f380f] rounded bg-[#9bbc0f] shadow-inner">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="block"
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: `linear-gradient(#0f380f 1px, transparent 1px), linear-gradient(90deg, #0f380f 1px, transparent 1px)`,
              backgroundSize: "4px 4px",
            }}
          />
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#9bbc0f]/90">
              <div className="text-2xl font-bold text-[#0f380f] mb-4 font-mono">
                GAME OVER
              </div>
              <Button
                onClick={resetGame}
                className="bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230]"
              >
                TRY AGAIN
              </Button>
            </div>
          )}
          {paused && !gameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#9bbc0f]/80">
              <div className="text-2xl font-bold text-[#0f380f] font-mono animate-pulse">
                PAUSED
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-sm font-mono font-bold">NEXT</div>
          <div className="border-4 border-[#0f380f] rounded bg-[#9bbc0f] p-2">
            <canvas
              ref={previewCanvasRef}
              width={4 * PREVIEW_SIZE}
              height={4 * PREVIEW_SIZE}
              className="block"
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md flex items-center gap-2 px-2 border-t-2 border-[#0f380f] pt-2">
        <RetroButton size="icon-sm" onClick={() => setIsMuted(!isMuted)}>
          {isMuted || volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </RetroButton>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={([v]) => {
            setVolume(v);
            if (v > 0) setIsMuted(false);
          }}
          className="flex-1 [&>span]:bg-[#0f380f]"
        />
      </div>

      <div className="text-xs text-[#306230] text-center font-mono">
        <p>← → MOVE ↓ DROP</p>
        <p>Q/Z OR ↑ ROTATE</p>
      </div>
    </div>
  );
};

// --- Space Invaders Game ---

const INVADER_ROWS = 4;
const INVADER_COLS = 8;
const INVADER_SIZE = 20;
const PLAYER_SIZE = 24;
const BULLET_SIZE = 4;

const SpaceInvadersGame: React.FC<{
  isActive: boolean;
  onExit: () => void;
  api?: EmbeddrAPI;
}> = ({ isActive, onExit, api }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) setPaused(true);
  }, [isActive]);

  const gameState = useRef({
    playerX: 138,
    bullets: [] as { x: number; y: number }[],
    invaders: [] as { x: number; y: number; alive: boolean }[],
    invaderDir: 1,
    invaderStep: 0,
    lastTime: 0,
    gameOver: false,
    paused: false,
    score: 0,
  });

  const resetGame = () => {
    const invaders = [];
    for (let r = 0; r < INVADER_ROWS; r++)
      for (let c = 0; c < INVADER_COLS; c++)
        invaders.push({ x: c * 30 + 30, y: r * 30 + 40, alive: true });
    gameState.current = {
      playerX: 138,
      bullets: [],
      invaders,
      invaderDir: 1,
      invaderStep: 0,
      lastTime: 0,
      gameOver: false,
      paused: false,
      score: 0,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = GB_COLORS.lightest;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Player
    ctx.fillStyle = GB_COLORS.darkest;
    ctx.fillRect(gameState.current.playerX, 450, PLAYER_SIZE, 10);
    ctx.fillRect(gameState.current.playerX + 8, 445, 8, 5);

    // Invaders
    gameState.current.invaders.forEach((inv) => {
      if (inv.alive) {
        ctx.fillStyle = GB_COLORS.darkest;
        ctx.fillRect(inv.x, inv.y, INVADER_SIZE, INVADER_SIZE);
        ctx.fillStyle = GB_COLORS.lightest;
        ctx.fillRect(inv.x + 4, inv.y + 6, 4, 4);
        ctx.fillRect(inv.x + 12, inv.y + 6, 4, 4);
      }
    });

    // Bullets
    ctx.fillStyle = GB_COLORS.dark;
    gameState.current.bullets.forEach((b) =>
      ctx.fillRect(b.x + 10, b.y, BULLET_SIZE, 10)
    );
  };

  const update = (time = 0) => {
    if (gameState.current.gameOver || gameState.current.paused) return;
    const delta = time - gameState.current.lastTime;
    gameState.current.lastTime = time;

    // Bullets
    gameState.current.bullets = gameState.current.bullets.filter((b) => {
      b.y -= 6;
      return b.y > 0;
    });

    // Invaders move
    gameState.current.invaderStep += delta;
    if (gameState.current.invaderStep > 600) {
      gameState.current.invaderStep = 0;
      let edge = false;
      gameState.current.invaders.forEach((inv) => {
        if (inv.alive) {
          inv.x += 15 * gameState.current.invaderDir;
          if (inv.x <= 10 || inv.x >= 260) edge = true;
        }
      });
      if (edge) {
        gameState.current.invaderDir *= -1;
        gameState.current.invaders.forEach((inv) => (inv.y += 20));
      }
    }

    // Collisions
    gameState.current.bullets.forEach((b, bi) => {
      gameState.current.invaders.forEach((inv) => {
        if (
          inv.alive &&
          b.x >= inv.x - 10 &&
          b.x <= inv.x + INVADER_SIZE &&
          b.y >= inv.y &&
          b.y <= inv.y + INVADER_SIZE
        ) {
          inv.alive = false;
          gameState.current.bullets.splice(bi, 1);
          setScore((s) => s + 50);
          gameState.current.score += 50;
        }
      });
    });

    // Game over
    if (gameState.current.invaders.some((inv) => inv.alive && inv.y > 430)) {
      gameState.current.gameOver = true;
      setGameOver(true);
      if (api) {
        const url = api.utils.getPluginUrl("highscores/invaders");
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: "Player",
            score: gameState.current.score,
          }),
        }).catch(() => {});
      }
    }

    draw();
    requestAnimationFrame(update);
  };

  useEffect(() => {
    resetGame();
    const handleKey = (e: KeyboardEvent) => {
      if (
        gameState.current.gameOver ||
        gameState.current.paused ||
        !isActiveRef.current
      )
        return;
      if (e.key === "ArrowLeft")
        gameState.current.playerX = Math.max(
          10,
          gameState.current.playerX - 15
        );
      if (e.key === "ArrowRight")
        gameState.current.playerX = Math.min(
          266,
          gameState.current.playerX + 15
        );
      if (e.key === " ")
        gameState.current.bullets.push({
          x: gameState.current.playerX,
          y: 440,
        });
    };
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(update);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    gameState.current.paused = paused || gameOver;
    if (!paused && !gameOver) requestAnimationFrame(update);
  }, [paused, gameOver]);

  return (
    <div
      className="flex flex-col items-center gap-4 p-4 h-full text-[#0f380f]"
      style={{ backgroundColor: GB_COLORS.lightest }}
    >
      <div className="flex justify-between w-full max-w-[300px] items-center border-b-2 border-[#0f380f] pb-2">
        <RetroButton size="icon-sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4" />
        </RetroButton>
        <div className="text-xl font-bold font-mono">
          SCORE: {score.toString().padStart(6, "0")}
        </div>
        <div className="flex gap-2">
          <RetroButton size="icon-sm" onClick={() => setPaused(!paused)}>
            {paused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </RetroButton>
          <RetroButton size="icon-sm" onClick={resetGame}>
            <RotateCcw className="w-4 h-4" />
          </RetroButton>
        </div>
      </div>

      <div className="relative border-4 border-[#0f380f] rounded bg-[#9bbc0f] shadow-inner">
        <canvas ref={canvasRef} width={300} height={480} className="block" />
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `linear-gradient(#0f380f 1px, transparent 1px), linear-gradient(90deg, #0f380f 1px, transparent 1px)`,
            backgroundSize: "4px 4px",
          }}
        />
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#9bbc0f]/90">
            <div className="text-2xl font-bold text-[#0f380f] mb-4 font-mono">
              GAME OVER
            </div>
            <Button
              onClick={resetGame}
              className="bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230]"
            >
              TRY AGAIN
            </Button>
          </div>
        )}
        {paused && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#9bbc0f]/80">
            <div className="text-2xl font-bold text-[#0f380f] font-mono animate-pulse">
              PAUSED
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-[#306230] text-center font-mono">
        <p>← → MOVE</p>
        <p>SPACE TO SHOOT</p>
      </div>
    </div>
  );
};

// --- Snake Game ---

const SNAKE_BLOCK = 16;
const SNAKE_COLS = 18;
const SNAKE_ROWS = 24;

const SnakeGame: React.FC<{
  isActive: boolean;
  onExit: () => void;
  api?: EmbeddrAPI;
}> = ({ isActive, onExit, api }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) setPaused(true);
  }, [isActive]);

  const gameState = useRef({
    snake: [{ x: 9, y: 12 }] as { x: number; y: number }[],
    food: { x: 5, y: 5 },
    dx: 1,
    dy: 0,
    lastTime: 0,
    gameOver: false,
    paused: false,
    score: 0,
  });

  const resetGame = () => {
    gameState.current = {
      snake: [{ x: 9, y: 12 }],
      food: {
        x: Math.floor(Math.random() * SNAKE_COLS),
        y: Math.floor(Math.random() * SNAKE_ROWS),
      },
      dx: 1,
      dy: 0,
      lastTime: 0,
      gameOver: false,
      paused: false,
      score: 0,
    };
    setScore(0);
    setGameOver(false);
    setPaused(false);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = GB_COLORS.lightest;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = GB_COLORS.light;
    ctx.lineWidth = 1;
    for (let i = 0; i <= SNAKE_COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * SNAKE_BLOCK, 0);
      ctx.lineTo(i * SNAKE_BLOCK, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= SNAKE_ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * SNAKE_BLOCK);
      ctx.lineTo(canvas.width, i * SNAKE_BLOCK);
      ctx.stroke();
    }

    // Snake
    gameState.current.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? GB_COLORS.dark : GB_COLORS.darkest;
      ctx.fillRect(
        seg.x * SNAKE_BLOCK + 2,
        seg.y * SNAKE_BLOCK + 2,
        SNAKE_BLOCK - 4,
        SNAKE_BLOCK - 4
      );
    });

    // Food
    ctx.fillStyle = "#8bac0f";
    ctx.fillRect(
      gameState.current.food.x * SNAKE_BLOCK + 4,
      gameState.current.food.y * SNAKE_BLOCK + 4,
      SNAKE_BLOCK - 8,
      SNAKE_BLOCK - 8
    );
  };

  const update = (time = 0) => {
    if (gameState.current.gameOver || gameState.current.paused) return;
    const delta = time - gameState.current.lastTime;
    if (delta < 150) {
      requestAnimationFrame(update);
      return;
    }
    gameState.current.lastTime = time;

    const head = {
      x: gameState.current.snake[0].x + gameState.current.dx,
      y: gameState.current.snake[0].y + gameState.current.dy,
    };

    // Wall collision
    if (
      head.x < 0 ||
      head.x >= SNAKE_COLS ||
      head.y < 0 ||
      head.y >= SNAKE_ROWS ||
      gameState.current.snake.some(
        (seg) => seg.x === head.x && seg.y === head.y
      )
    ) {
      gameState.current.gameOver = true;
      setGameOver(true);
      if (api) {
        const url = api.utils.getPluginUrl("highscores/snake");
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player: "Player",
            score: gameState.current.score,
          }),
        }).catch(() => {});
      }
      return;
    }

    gameState.current.snake.unshift(head);

    // Eat food
    if (
      head.x === gameState.current.food.x &&
      head.y === gameState.current.food.y
    ) {
      setScore((s) => s + 10);
      gameState.current.score += 10;
      gameState.current.food = {
        x: Math.floor(Math.random() * SNAKE_COLS),
        y: Math.floor(Math.random() * SNAKE_ROWS),
      };
    } else {
      gameState.current.snake.pop();
    }

    draw();
    requestAnimationFrame(update);
  };

  useEffect(() => {
    resetGame();
    const handleKey = (e: KeyboardEvent) => {
      if (
        gameState.current.gameOver ||
        gameState.current.paused ||
        !isActiveRef.current
      )
        return;
      if (e.key === "ArrowUp" && gameState.current.dy === 0) {
        gameState.current.dx = 0;
        gameState.current.dy = -1;
      }
      if (e.key === "ArrowDown" && gameState.current.dy === 0) {
        gameState.current.dx = 0;
        gameState.current.dy = 1;
      }
      if (e.key === "ArrowLeft" && gameState.current.dx === 0) {
        gameState.current.dx = -1;
        gameState.current.dy = 0;
      }
      if (e.key === "ArrowRight" && gameState.current.dx === 0) {
        gameState.current.dx = 1;
        gameState.current.dy = 0;
      }
    };
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(update);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    gameState.current.paused = paused || gameOver;
    if (!paused && !gameOver) requestAnimationFrame(update);
  }, [paused, gameOver]);

  return (
    <div
      className="flex flex-col items-center gap-4 p-4 h-full text-[#0f380f]"
      style={{ backgroundColor: GB_COLORS.lightest }}
    >
      <div className="flex justify-between w-full max-w-[300px] items-center border-b-2 border-[#0f380f] pb-2">
        <RetroButton size="icon-sm" onClick={onExit}>
          <ArrowLeft className="w-4 h-4" />
        </RetroButton>
        <div className="text-xl font-bold font-mono">
          SCORE: {score.toString().padStart(5, "0")}
        </div>
        <div className="flex gap-2">
          <RetroButton size="icon-sm" onClick={() => setPaused(!paused)}>
            {paused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </RetroButton>
          <RetroButton size="icon-sm" onClick={resetGame}>
            <RotateCcw className="w-4 h-4" />
          </RetroButton>
        </div>
      </div>

      <div className="relative border-4 border-[#0f380f] rounded bg-[#9bbc0f] shadow-inner">
        <canvas
          ref={canvasRef}
          width={SNAKE_COLS * SNAKE_BLOCK}
          height={SNAKE_ROWS * SNAKE_BLOCK}
          className="block"
        />
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#9bbc0f]/90">
            <div className="text-2xl font-bold text-[#0f380f] mb-4 font-mono">
              GAME OVER
            </div>
            <Button
              onClick={resetGame}
              className="bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230]"
            >
              PLAY AGAIN
            </Button>
          </div>
        )}
        {paused && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#9bbc0f]/80">
            <div className="text-2xl font-bold text-[#0f380f] font-mono animate-pulse">
              PAUSED
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-[#306230] text-center font-mono">
        <p>ARROW KEYS TO MOVE</p>
        <p>GROW BY EATING FOOD</p>
      </div>
    </div>
  );
};

const LeaderboardView: React.FC<{ onBack: () => void; api: EmbeddrAPI }> = ({
  onBack,
  api,
}) => {
  const [scores, setScores] = useState<{ player: string; score: number }[]>([]);
  const [game, setGame] = useState("tetris");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = api.utils.getPluginUrl(`highscores/${game}`);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setScores(data.scores);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [game, api]);

  return (
    <div
      className="flex flex-col items-center h-full p-4 text-[#0f380f] w-full"
      style={{ backgroundColor: GB_COLORS.lightest }}
    >
      <div className="flex justify-between w-full items-center border-b-2 border-[#0f380f] pb-2 mb-4">
        <RetroButton size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </RetroButton>
        <div className="text-xl font-bold font-mono">HIGH SCORES</div>
        <div className="w-8" />
      </div>

      <div className="flex gap-2 mb-4">
        {["tetris", "invaders", "snake"].map((g) => (
          <Button
            key={g}
            size="sm"
            className={`font-mono text-xs ${
              game === g
                ? "bg-[#0f380f] text-[#9bbc0f]"
                : "bg-transparent text-[#0f380f] border border-[#0f380f]"
            }`}
            onClick={() => setGame(g)}
          >
            {g.toUpperCase()}
          </Button>
        ))}
      </div>

      <div className="w-full max-w-xs border-2 border-[#0f380f] p-2 bg-[#8bac0f] min-h-[300px]">
        {loading ? (
          <div className="text-center font-mono animate-pulse mt-10">
            LOADING...
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center font-mono mt-10">NO SCORES YET</div>
        ) : (
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-[#0f380f]">
                <th className="text-left p-1">RANK</th>
                <th className="text-left p-1">NAME</th>
                <th className="text-right p-1">SCORE</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={i} className="even:bg-[#9bbc0f]/50">
                  <td className="p-1">{i + 1}</td>
                  <td className="p-1">{s.player}</td>
                  <td className="p-1 text-right">{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- Arcade Menu ---

const ArcadeMenu: React.FC<{
  onSelectGame: (game: string) => void;
  onShowLeaderboard: () => void;
}> = ({ onSelectGame, onShowLeaderboard }) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-8 p-8 text-[#0f380f]"
      style={{ backgroundColor: GB_COLORS.lightest }}
    >
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-black font-mono tracking-tighter">
          EMBEDDR
        </h1>
        <h2 className="text-3xl font-bold font-mono tracking-widest text-[#306230]">
          ARCADE
        </h2>
        <div className="text-sm font-mono text-[#306230] mt-4 animate-pulse">
          SELECT GAME
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 w-full max-w-[260px]">
        <Button
          className="h-20 text-2xl font-mono bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230] border-4 border-[#0f380f] shadow-[6px_6px_0px_0px_#306230] transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
          onClick={() => onSelectGame("tetris")}
        >
          <Grid3X3 className="w-8 h-8 mr-3" />
          TETRIS
        </Button>

        <Button
          className="h-20 text-2xl font-mono bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230] border-4 border-[#0f380f] shadow-[6px_6px_0px_0px_#306230] transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
          onClick={() => onSelectGame("invaders")}
        >
          <Ghost className="w-8 h-8 mr-3" />
          INVADERS
        </Button>

        <Button
          className="h-20 text-2xl font-mono bg-[#0f380f] text-[#9bbc0f] hover:bg-[#306230] border-4 border-[#0f380f] shadow-[6px_6px_0px_0px_#306230] transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
          onClick={() => onSelectGame("snake")}
        >
          <Apple className="w-8 h-8 mr-3" />
          SNAKE
        </Button>

        <Button
          className="h-12 text-lg font-mono bg-transparent text-[#0f380f] hover:bg-[#8bac0f] border-2 border-[#0f380f] shadow-[4px_4px_0px_0px_#306230] transform hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
          onClick={onShowLeaderboard}
        >
          LEADERBOARD
        </Button>
      </div>

      <div className="text-xs font-mono text-[#306230] mt-4 animate-bounce">
        ↑ ↓ OR CLICK TO CHOOSE
      </div>
    </div>
  );
};

// --- Main Plugin Component ---

const ArcadePluginComponent: React.FC<{ api: EmbeddrAPI }> = ({ api }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const handleExit = () => setActiveGame(null);

  // Local focus state for keybinds
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="embeddr-plugin-scope">
      <Button
        variant={isOpen ? "secondary" : "outline"}
        className="w-full justify-start"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Gamepad2 className="w-4 h-4 mr-2" />
        {isOpen ? "Close Arcade" : "Open Arcade"}
      </Button>

      {isOpen &&
        createPortal(
          <div className="embeddr-plugin-scope">
            <DraggablePanel
              id="arcade-panel"
              title="Embeddr Arcade"
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              defaultPosition={{ x: 300, y: 80 }}
              defaultSize={{ width: 400, height: 700 }}
              className="absolute z-50"
              onFocus={() => setIsFocused(true)}
            >
              <div
                className="w-full h-full outline-none"
                tabIndex={-1}
                onFocus={() => setIsFocused(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsFocused(false);
                  }
                }}
                ref={(el) => {
                  // Auto-focus when panel opens to enable keybinds immediately
                  if (el && isOpen && !isFocused) {
                    el.focus();
                  }
                }}
              >
                {activeGame === "tetris" ? (
                  <TetrisGame
                    isActive={isFocused}
                    onExit={handleExit}
                    api={api}
                  />
                ) : activeGame === "invaders" ? (
                  <SpaceInvadersGame
                    isActive={isFocused}
                    onExit={handleExit}
                    api={api}
                  />
                ) : activeGame === "snake" ? (
                  <SnakeGame
                    isActive={isFocused}
                    onExit={handleExit}
                    api={api}
                  />
                ) : activeGame === "leaderboard" ? (
                  <LeaderboardView onBack={handleExit} api={api} />
                ) : (
                  <ArcadeMenu
                    onSelectGame={setActiveGame}
                    onShowLeaderboard={() => setActiveGame("leaderboard")}
                  />
                )}
              </div>
            </DraggablePanel>
          </div>,
          document.body
        )}
    </div>
  );
};

export const ArcadePlugin: PluginDefinition = {
  id: "embeddr-arcade",
  name: "Embeddr Arcade",
  description: "Retro arcade with Tetris, Space Invaders, and Snake",
  version: "2.1.0",
  author: "Embeddr",
  components: [
    {
      id: "arcade-launcher",
      location: "zen-toolbox-tab",
      label: "Arcade",
      component: ArcadePluginComponent,
    },
  ],
};

if (typeof window !== "undefined" && (window as any).Embeddr) {
  (window as any).Embeddr.registerPlugin(ArcadePlugin);
}
