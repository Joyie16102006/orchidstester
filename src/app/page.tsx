"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Zap, 
  Settings2, 
  Activity, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw,
  Layers,
  LineChart,
  Moon,
  Sun,
  MousePointer2,
  GitCommit,
  Share2,
  Download,
  Gauge,
  X,
  Crosshair,
  Maximize2,
  Move
} from "lucide-react";
import { 
  LineChart as ReLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area
} from "recharts";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// --- Types ---
type ComponentType = "resistor" | "inductor" | "capacitor" | "source" | "ground";

interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  value: number; 
  unit: string;
  label: string;
}

interface Wire {
  id: string;
  fromId: string;
  fromTerminal: "left" | "right";
  toId: string;
  toTerminal: "left" | "right";
}

// --- Constants ---
const GRID_SIZE = 20;
const COMPONENT_WIDTH = 100;
const COMPONENT_HEIGHT = 100;

// --- Symbols Components ---
const ResistorSymbol = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={`${className} stroke-current fill-none`} strokeWidth="3" strokeLinecap="square">
    <path d="M0 20 L20 20 L25 10 L35 30 L45 10 L55 30 L65 10 L75 30 L80 20 L100 20" />
  </svg>
);

const InductorSymbol = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={`${className} stroke-current fill-none`} strokeWidth="3" strokeLinecap="round">
    <path d="M0 20 L20 20 C 20 0, 30 0, 30 20 C 30 0, 40 0, 40 20 C 40 0, 50 0, 50 20 C 50 0, 60 0, 60 20 L100 20" />
  </svg>
);

const CapacitorSymbol = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={`${className} stroke-current fill-none`} strokeWidth="3" strokeLinecap="square">
    <path d="M0 20 L45 20 M45 5 L45 35 M55 5 L55 35 M55 20 L100 20" />
  </svg>
);

const SourceSymbol = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`${className} stroke-current fill-none`} strokeWidth="3">
    <circle cx="50" cy="50" r="40" />
    <path d="M30 50 C 30 30, 45 30, 50 50 C 55 70, 70 70, 70 50" />
  </svg>
);

const GroundSymbol = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={`${className} stroke-current fill-none`} strokeWidth="3">
    <path d="M20 0 L20 25 M5 25 L35 25 M10 30 L30 30 M15 35 L25 35" />
  </svg>
);

export default function ACCircuitAnalyzer() {
  const [components, setComponents] = useState<CircuitComponent[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [frequency, setFrequency] = useState(60); 
  const [wiringFrom, setWiringFrom] = useState<{ id: string, terminal: "left" | "right" } | null>(null);
  const [draggingType, setDraggingType] = useState<ComponentType | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const addComponent = useCallback((type: ComponentType, x: number, y: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    const snapX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snapY = Math.round(y / GRID_SIZE) * GRID_SIZE;
    
    const newComp: CircuitComponent = {
      id,
      type,
      x: snapX,
      y: snapY,
      value: type === "resistor" ? 220 : type === "capacitor" ? 0.00001 : type === "inductor" ? 0.1 : 10,
      unit: type === "resistor" ? "Ω" : type === "capacitor" ? "F" : type === "inductor" ? "H" : "V",
      label: type === "source" ? "SOURCE" : type === "ground" ? "GND" : type.charAt(0).toUpperCase() + (components.filter(c => c.type === type).length + 1),
    };
    setComponents(prev => [...prev, newComp]);
  }, [components]);

  const updateComponentPos = useCallback((id: string, x: number, y: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, x, y } : c));
  }, []);

  const deleteComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
    setWires(prev => prev.filter(w => w.fromId !== id && w.toId !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const deleteWire = (id: string) => {
    setWires(prev => prev.filter(w => w.id !== id));
    if (selectedWireId === id) setSelectedWireId(null);
  };

  const handleTerminalClick = (id: string, terminal: "left" | "right") => {
    if (!wiringFrom) {
      setWiringFrom({ id, terminal });
    } else {
      if (wiringFrom.id !== id) {
        const wireExists = wires.some(w => 
          (w.fromId === wiringFrom.id && w.fromTerminal === wiringFrom.terminal && w.toId === id && w.toTerminal === terminal) ||
          (w.fromId === id && w.fromTerminal === terminal && w.toId === wiringFrom.id && w.toTerminal === wiringFrom.terminal)
        );

        if (!wireExists) {
          const newWire: Wire = {
            id: Math.random().toString(36).substr(2, 9),
            fromId: wiringFrom.id,
            fromTerminal: wiringFrom.terminal,
            toId: id,
            toTerminal: terminal
          };
          setWires(prev => [...prev, newWire]);
        }
      }
      setWiringFrom(null);
    }
  };

  // Advanced Analysis
  const metrics = useMemo(() => {
    const R_sum = components.filter(c => c.type === "resistor").reduce((acc, c) => acc + c.value, 0) || 1e-6;
    const L_sum = components.filter(c => c.type === "inductor").reduce((acc, c) => acc + c.value, 0) || 0;
    const C_sum = components.filter(c => c.type === "capacitor").reduce((acc, c) => acc + (c.value > 0 ? 1/c.value : 0), 0);
    const C_total = C_sum > 0 ? 1 / C_sum : 0;
    
    const V_source = components.find(c => c.type === "source")?.value || 10;
    const w = 2 * Math.PI * frequency;
    const Xl = w * L_sum;
    const Xc = C_total > 0 ? 1 / (w * C_total) : 1e12;
    const X_net = Xl - Xc;
    const Z_mag = Math.sqrt(R_sum**2 + X_net**2);
    const phaseRad = Math.atan2(X_net, R_sum);
    const phaseDeg = phaseRad * (180 / Math.PI);
    const I_peak = V_source / Z_mag;
    const f0 = (L_sum > 0 && C_total > 0) ? 1 / (2 * Math.PI * Math.sqrt(L_sum * C_total)) : 0;
    
    return { R: R_sum, L: L_sum, C: C_total, Xl, Xc, Z_mag, phaseDeg, phaseRad, I_peak, f0, V_source };
  }, [components, frequency]);

  const chartData = useMemo(() => {
    const data = [];
    for (let f = 1; f <= 1000; f += 10) {
      const w = 2 * Math.PI * f;
      const Xl = w * metrics.L;
      const Xc = metrics.C > 0 ? 1 / (w * metrics.C) : 1e12;
      const Z = Math.sqrt(metrics.R**2 + (Xl - Xc)**2);
      data.push({
        frequency: f,
        current: (metrics.V_source / Z) * 1000,
        impedance: Z,
        phase: Math.atan2((Xl - Xc), metrics.R) * (180 / Math.PI)
      });
    }
    return data;
  }, [metrics]);

  return (
    <div className={`flex flex-col h-screen ${isDarkMode ? "dark bg-[#0a0a0a] text-zinc-100" : "bg-[#f0f0f0] text-zinc-900"} transition-colors duration-200 font-mono overflow-hidden select-none`}>
      {/* Ultra-Sharp Industrial Header */}
      <header className="h-14 shrink-0 border-b-2 border-zinc-900 dark:border-zinc-800 bg-white dark:bg-black flex items-center justify-between px-6 z-[100] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Activity className="w-5 h-5 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">
                AC CIRCUIT ANALYZER
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[7px] font-black uppercase tracking-[0.4em] opacity-40">SYSTEM STATUS: ACTIVE</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0">
          <div className="h-10 px-4 border-l border-zinc-200 dark:border-zinc-800 flex flex-col justify-center">
            <span className="text-[8px] font-black text-zinc-400">ENGINE FREQ</span>
            <span className="text-xs font-black">64-BIT SIM</span>
          </div>
          <Button 
            variant="ghost" 
            className="h-14 rounded-none border-x border-zinc-200 dark:border-zinc-800 px-8 font-black uppercase text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            INTERFACE
          </Button>
          <div className="h-14 bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center px-12 font-black uppercase text-[10px] cursor-pointer hover:opacity-90 tracking-widest group">
            <Share2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            LIVE SESSION
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Schematic Toolbox */}
        <aside className="w-64 shrink-0 border-r-2 border-zinc-900 dark:border-zinc-800 bg-white dark:bg-black flex flex-col z-50">
          <div className="p-5 border-b-2 border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Master Components</h3>
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: "resistor", label: "RES", sym: <ResistorSymbol className="w-10" /> },
                { type: "inductor", label: "IND", sym: <InductorSymbol className="w-10" /> },
                { type: "capacitor", label: "CAP", sym: <CapacitorSymbol className="w-10" /> },
                { type: "source", label: "SRC", sym: <SourceSymbol className="w-8" /> },
                { type: "ground", label: "GND", sym: <GroundSymbol className="w-8" /> }
              ].map((comp) => (
                <div
                  key={comp.type}
                  draggable
                  onDragStart={() => setDraggingType(comp.type as ComponentType)}
                  className="flex flex-col items-center justify-center p-3 border-2 border-zinc-100 dark:border-zinc-900 rounded-none hover:border-zinc-900 dark:hover:border-white transition-all cursor-grab active:cursor-grabbing bg-zinc-50 dark:bg-zinc-950 group"
                >
                  <div className="h-10 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                    {comp.sym}
                  </div>
                  <span className="text-[9px] font-black uppercase mt-2 tracking-widest opacity-60 group-hover:opacity-100">{comp.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-5 bg-zinc-50/50 dark:bg-zinc-900/20">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5" /> PRECISION METRICS
              </h3>
              <div className="space-y-1">
                {[
                  { label: "Equiv R", val: metrics.R, unit: "Ω" },
                  { label: "Equiv L", val: metrics.L, unit: "H" },
                  { label: "Equiv C", val: metrics.C * 1e6, unit: "µF" },
                  { label: "Impedance |Z|", val: metrics.Z_mag, unit: "Ω" },
                  { label: "Phase Shift", val: metrics.phaseDeg, unit: "°" },
                  { label: "Peak Current", val: metrics.I_peak, unit: "A" },
                ].map((m, i) => (
                  <div key={i} className="px-4 py-3 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <span className="text-[9px] font-black text-zinc-400 uppercase">{m.label}</span>
                    <span className="text-xs font-black text-zinc-900 dark:text-white">{m.val.toFixed(2)}<span className="ml-1 opacity-40">{m.unit}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 bg-red-600/5 dark:bg-red-500/10 border-t border-zinc-900 dark:border-zinc-800">
             <div className="flex items-center gap-2 mb-2">
               <RotateCcw className="w-3.5 h-3.5 text-red-600 animate-spin-slow" />
               <span className="text-[9px] font-black uppercase tracking-[0.3em] text-red-600">RESONANCE LOCK</span>
             </div>
             <div className="text-xl font-black text-red-600 flex items-baseline gap-1">
               {metrics.f0.toFixed(2)} <span className="text-[10px]">Hz</span>
             </div>
          </div>
        </aside>

        {/* Master Circuit Canvas */}
        <main 
          className="flex-1 relative bg-[#fafafa] dark:bg-[#050505] overflow-hidden group/canvas"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect && draggingType) {
              addComponent(draggingType, e.clientX - rect.left - 50, e.clientY - rect.top - 50);
              setDraggingType(null);
            }
          }}
          ref={canvasRef}
        >
          {/* Advanced Schematic Grid */}
          <div 
            className="absolute inset-0 opacity-[0.4] dark:opacity-[0.6] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(${isDarkMode ? '#111' : '#eee'} 1px, transparent 1px),
                linear-gradient(90deg, ${isDarkMode ? '#111' : '#eee'} 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
            }}
          />
          <div 
            className="absolute inset-0 opacity-[0.2] pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(${isDarkMode ? '#222' : '#ddd'} 1px, transparent 1px),
                linear-gradient(90deg, ${isDarkMode ? '#222' : '#ddd'} 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE * 5}px ${GRID_SIZE * 5}px`
            }}
          />

          {/* Canvas Controls */}
          <div className="absolute top-6 left-6 flex gap-1 z-[60]">
            <div className="flex bg-white dark:bg-black border-2 border-zinc-900 dark:border-zinc-700 shadow-xl overflow-hidden">
              <Button variant="ghost" size="sm" className={`h-10 rounded-none text-[10px] font-black uppercase px-6 ${!wiringFrom ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : ""}`} onClick={() => setWiringFrom(null)}>
                <MousePointer2 className="w-4 h-4 mr-2" /> SELECT
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-10 rounded-none text-[10px] font-black uppercase px-6 border-l border-zinc-900 dark:border-zinc-700 ${wiringFrom ? "bg-red-600 text-white" : ""}`}
              >
                <GitCommit className="w-4 h-4 mr-2" /> {wiringFrom ? "ATTACH TERMINAL" : "WIRING MODE"}
              </Button>
              {(selectedId || selectedWireId) && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-10 rounded-none text-[10px] font-black uppercase px-6 border-l border-zinc-900 dark:border-zinc-700 bg-red-600 text-white hover:bg-red-700"
                  onClick={() => selectedId ? deleteComponent(selectedId) : deleteWire(selectedWireId!)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> DELETE
                </Button>
              )}
            </div>
            <div className="flex bg-white dark:bg-black border-2 border-zinc-900 dark:border-zinc-700 overflow-hidden ml-2 shadow-xl">
               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-900" onClick={() => { setComponents([]); setWires([]); }}>
                 <RotateCcw className="w-4 h-4" />
               </Button>
            </div>
          </div>

          {/* SVG Vector Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
            <defs>
              <filter id="wireGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {wires.map(wire => {
              const from = components.find(c => c.id === wire.fromId);
              const to = components.find(c => c.id === wire.toId);
              if (!from || !to) return null;
              
              const x1 = from.x + (wire.fromTerminal === "left" ? 0 : COMPONENT_WIDTH);
              const y1 = from.y + COMPONENT_HEIGHT / 2;
              const x2 = to.x + (wire.toTerminal === "left" ? 0 : COMPONENT_WIDTH);
              const y2 = to.y + COMPONENT_HEIGHT / 2;

              return (
                <g key={wire.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedWireId(wire.id); setSelectedId(null); }}>
                  <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="transparent" strokeWidth="20" fill="none" />
                  <path 
                    d={`M ${x1} ${y1} L ${x2} ${y2}`} 
                    stroke={selectedWireId === wire.id ? "#ef4444" : (isDarkMode ? "#222" : "#ccc")} 
                    strokeWidth="3" 
                    fill="none" 
                  />
                  {/* High-Contrast Electron Stream */}
                  {isPlaying && metrics.I_peak > 0.005 && (
                    <motion.path 
                      d={`M ${x1} ${y1} L ${x2} ${y2}`} 
                      stroke={isDarkMode ? "#fff" : "#000"} 
                      strokeWidth="2.5" 
                      strokeDasharray="4 20"
                      fill="none"
                      style={{ 
                        filter: "url(#wireGlow)",
                        opacity: 0.8
                      }}
                      animate={{
                        strokeDashoffset: [48, 0]
                      }}
                      transition={{
                        duration: Math.max(0.05, 0.4 / (metrics.I_peak * 5)),
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Component Layer */}
          <AnimatePresence mode="popLayout">
            {components.map((comp) => (
              <motion.div
                key={comp.id}
                layoutId={comp.id}
                drag
                dragMomentum={false}
                dragElastic={0}
                onDragStart={() => setSelectedId(comp.id)}
                onDragEnd={(_, info) => {
                  const newX = Math.round((comp.x + info.offset.x) / GRID_SIZE) * GRID_SIZE;
                  const newY = Math.round((comp.y + info.offset.y) / GRID_SIZE) * GRID_SIZE;
                  updateComponentPos(comp.id, newX, newY);
                }}
                style={{ position: "absolute", left: comp.x, top: comp.y, x: 0, y: 0 }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(comp.id); setSelectedWireId(null); }}
                className={`group z-20 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${
                  selectedId === comp.id ? "z-40" : ""
                }`}
              >
                <div className="relative">
                  {/* Precision Square Terminals */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleTerminalClick(comp.id, "left"); }}
                    className={`absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 bg-white dark:bg-black z-50 transition-colors shadow-sm ${
                      wiringFrom?.id === comp.id && wiringFrom.terminal === "left" ? "bg-red-600 border-red-600 scale-125" : "border-zinc-900 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-white"
                    }`}
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleTerminalClick(comp.id, "right"); }}
                    className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 bg-white dark:bg-black z-50 transition-colors shadow-sm ${
                      wiringFrom?.id === comp.id && wiringFrom.terminal === "right" ? "bg-red-600 border-red-600 scale-125" : "border-zinc-900 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-white"
                    }`}
                  />
                  
                  {/* Industrial Component Box */}
                  <div className={`w-[100px] h-[100px] flex items-center justify-center border-2 bg-white/95 dark:bg-black/95 transition-all relative ${
                    selectedId === comp.id ? "border-zinc-900 dark:border-white ring-[10px] ring-zinc-500/10 shadow-2xl" : "border-zinc-200 dark:border-zinc-800"
                  }`}>
                    {/* Component Info Overlay */}
                    <div className="absolute top-1 left-1 flex flex-col gap-0.5 pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity">
                       <span className="text-[6px] font-black uppercase text-zinc-500">{comp.id.toUpperCase()}</span>
                    </div>

                    <div className="w-16 h-10 flex items-center justify-center text-zinc-900 dark:text-white">
                      {comp.type === "resistor" && <ResistorSymbol />}
                      {comp.type === "inductor" && <InductorSymbol />}
                      {comp.type === "capacitor" && <CapacitorSymbol />}
                      {comp.type === "source" && <SourceSymbol className="w-12 h-12" />}
                      {comp.type === "ground" && <GroundSymbol className="w-12 h-12" />}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{comp.label}</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[11px] font-black bg-zinc-100 dark:bg-zinc-900 px-3 py-1 border-2 border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-white transition-all shadow-sm">
                        {comp.type === "capacitor" ? (comp.value * 1e6).toFixed(1) + "µF" : `${comp.value}${comp.unit}`}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-5 bg-white dark:bg-black border-2 border-zinc-900 dark:border-zinc-700 rounded-none shadow-2xl z-[200]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">PARAM ADJUST</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              value={comp.value} 
                              className="h-10 rounded-none font-black text-sm border-2 border-zinc-900 dark:border-zinc-800 focus-visible:ring-0"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) setComponents(prev => prev.map(c => c.id === comp.id ? { ...c, value: val } : c));
                              }}
                            />
                            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-800 flex items-center justify-center font-black text-[10px]">
                              {comp.unit}
                            </div>
                          </div>
                        </div>
                        <Button variant="destructive" size="sm" className="w-full h-10 rounded-none text-[10px] font-black uppercase bg-red-600 hover:bg-red-700" onClick={() => deleteComponent(comp.id)}>
                          DECOMMISSION UNIT
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </main>

        {/* Analytic Command Center */}
        <aside className="w-[420px] shrink-0 border-l-2 border-zinc-900 dark:border-zinc-800 bg-white dark:bg-black flex flex-col overflow-y-auto">
          <Tabs defaultValue="frequency" className="w-full flex flex-col flex-1">
            <TabsList className="w-full grid grid-cols-2 h-14 bg-zinc-100 dark:bg-zinc-900 rounded-none p-0 gap-0 border-b-2 border-zinc-900 dark:border-zinc-800">
              <TabsTrigger value="frequency" className="text-[10px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white rounded-none h-full transition-all">
                SPECTRUM
              </TabsTrigger>
              <TabsTrigger value="impedance" className="text-[10px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-white dark:data-[state=active]:bg-black data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white rounded-none h-full transition-all">
                COMPLEX Z
              </TabsTrigger>
            </TabsList>
            
            <div className="p-8 flex-1 space-y-10">
              <TabsContent value="frequency" className="mt-0 space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-zinc-900 dark:border-zinc-700 pb-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <LineChart className="w-4 h-4" /> CURRENT SCAN
                    </h4>
                    <Badge variant="outline" className="rounded-none border-zinc-900 dark:border-zinc-700 text-[8px] font-black">UNITS: mA</Badge>
                  </div>
                  <div className="h-[240px] w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]" />
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#222" : "#eee"} />
                        <XAxis dataKey="frequency" fontSize={9} tick={{fill: '#666', fontWeight: 900}} axisLine={false} tickLine={false} />
                        <YAxis fontSize={9} tick={{fill: '#666', fontWeight: 900}} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#000' : '#fff', 
                            border: '2px solid #000', 
                            borderRadius: '0', 
                            fontSize: '10px', 
                            fontWeight: '900',
                            boxShadow: '10px 10px 0px rgba(0,0,0,0.1)'
                          }} 
                        />
                        <Area type="monotone" dataKey="current" stroke="#ef4444" strokeWidth={3} fill="url(#colorCurr)" />
                        {metrics.f0 > 0 && <ReferenceLine x={metrics.f0} stroke="#10b981" strokeWidth={2} label={{ value: 'RESONANCE', position: 'top', fontSize: 9, fontWeight: 900, fill: '#10b981' }} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-widest border-b-2 border-zinc-900 dark:border-zinc-700 pb-2 flex items-center gap-2">
                     <Crosshair className="w-4 h-4" /> PHASOR GEOMETRY
                   </h4>
                   <div className="h-[180px] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 relative">
                      <div className="absolute top-2 left-2 text-[8px] font-black text-zinc-400 uppercase">IMAGINARY (j)</div>
                      <div className="absolute bottom-2 right-2 text-[8px] font-black text-zinc-400 uppercase">REAL (Re)</div>
                      <PhasorDiagram metrics={metrics} />
                   </div>
                </div>
              </TabsContent>

              <TabsContent value="impedance" className="mt-0 space-y-10">
                 <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest border-b-2 border-zinc-900 dark:border-zinc-700 pb-2">IMPEDANCE PROFILE |Z|</h4>
                  <div className="h-[220px] w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#222" : "#eee"} />
                        <XAxis dataKey="frequency" fontSize={9} tick={{fill: '#666', fontWeight: 900}} />
                        <YAxis fontSize={9} tick={{fill: '#666', fontWeight: 900}} />
                        <Line type="monotone" dataKey="impedance" stroke="#f59e0b" strokeWidth={3} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest border-b-2 border-zinc-900 dark:border-zinc-700 pb-2">PHASE CHARACTERISTIC</h4>
                  <div className="h-[220px] w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#222" : "#eee"} />
                        <XAxis dataKey="frequency" fontSize={9} tick={{fill: '#666', fontWeight: 900}} />
                        <YAxis fontSize={9} tick={{fill: '#666', fontWeight: 900}} />
                        <Line type="monotone" dataKey="phase" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </TabsContent>
            </div>

            <div className="mt-auto p-8 bg-zinc-50 dark:bg-[#080808] border-t-2 border-zinc-900 dark:border-zinc-800">
               <div className="space-y-8">
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <Label className="text-[10px] font-black uppercase tracking-widest">DRIVE FREQUENCY</Label>
                     <div className="px-3 py-1 bg-zinc-900 dark:bg-white text-white dark:text-black font-black text-xs">
                       {frequency} Hz
                     </div>
                   </div>
                   <Slider 
                    value={[frequency]} 
                    max={1000} 
                    min={1} 
                    step={1} 
                    onValueChange={(val) => setFrequency(val[0])} 
                    className="cursor-pointer" 
                  />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className={`h-12 rounded-none border-2 transition-all font-black uppercase text-[10px] ${frequency === Math.round(metrics.f0) ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-900 dark:border-zinc-700"}`} 
                      onClick={() => setFrequency(Math.round(metrics.f0))}
                    >
                      LOCK RESONANCE
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-12 rounded-none border-2 border-zinc-900 dark:border-zinc-700 font-black uppercase text-[10px]" 
                      onClick={() => setFrequency(60)}
                    >
                      SYSTEM 60Hz
                    </Button>
                 </div>
               </div>
            </div>
          </Tabs>
        </aside>
      </div>

      {/* Industrial Oscilloscope Footer */}
      <footer className="h-56 shrink-0 border-t-4 border-zinc-900 dark:border-zinc-800 bg-white dark:bg-black px-8 py-6 flex gap-10 z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600" />
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Live Waveform Monitor</h4>
            </div>
            <div className="flex border-2 border-zinc-900 dark:border-zinc-700 overflow-hidden shadow-sm">
               <Button variant="ghost" size="sm" className="h-8 rounded-none px-6 font-black text-[10px] uppercase border-r-2 border-zinc-900 dark:border-zinc-700" onClick={() => setIsPlaying(!isPlaying)}>
                 {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                 {isPlaying ? "HALT" : "RUN"}
               </Button>
               <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setFrequency(60)}>
                 <RotateCcw className="w-3.5 h-3.5" />
               </Button>
            </div>
          </div>
          <div className="flex-1 bg-[#050505] rounded-none border-2 border-zinc-900 dark:border-zinc-800 relative overflow-hidden group/scope">
             <div className="absolute inset-0 pointer-events-none z-10 opacity-30">
               <div className="w-full h-full" style={{ backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
             </div>
             <WaveformCanvas frequency={frequency} isPlaying={isPlaying} metrics={metrics} />
             
             {/* Scope Metadata */}
             <div className="absolute top-4 right-4 flex flex-col gap-1 text-[8px] font-black text-emerald-500/50 uppercase pointer-events-none">
                <span>VERT: 5V/DIV</span>
                <span>TIME: 2ms/DIV</span>
                <span>COUPLING: AC</span>
             </div>

             <div className="absolute bottom-4 left-6 flex gap-6 pointer-events-none">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-1 bg-white" />
                 <span className="text-[8px] font-black uppercase text-white tracking-widest">V(t)</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-1 bg-red-600" />
                 <span className="text-[8px] font-black uppercase text-red-600 tracking-widest">I(t)</span>
               </div>
             </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-6 bg-zinc-900 dark:bg-white" />
             <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">Source Config</h4>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-4 border-2 border-zinc-900 dark:border-zinc-800">
               <div className="text-[8px] font-black text-zinc-500 uppercase mb-2">Effective RMS Output</div>
               <div className="text-2xl font-black italic">
                 {(metrics.V_source * Math.SQRT1_2).toFixed(2)}<span className="text-xs ml-1 font-black opacity-40">VRMS</span>
               </div>
            </div>
            <div className="flex-1 border-2 border-zinc-900 dark:border-zinc-800 p-4 flex flex-col justify-center gap-2">
               <div className="text-[8px] font-black text-zinc-500 uppercase">Phase Angle (System)</div>
               <div className="text-xl font-black text-blue-500">
                 {metrics.phaseDeg.toFixed(1)}°
               </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function WaveformCanvas({ frequency, isPlaying, metrics }: { frequency: number, isPlaying: boolean, metrics: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const render = () => {
      if (isPlaying) timeRef.current += 0.005;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const midY = canvas.height / 2;
      const scaleV = canvas.height / 3.5;
      const scaleI = scaleV * 0.9; 

      // Signal Trace: Voltage
      ctx.beginPath();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255,255,255,0.5)";
      for (let x = 0; x < canvas.width; x++) {
        const t = timeRef.current + x * 0.003;
        const y = midY + Math.sin(2 * Math.PI * frequency * t) * scaleV;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Signal Trace: Current
      ctx.beginPath();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
      for (let x = 0; x < canvas.width; x++) {
        const t = timeRef.current + x * 0.003;
        const y = midY + Math.sin(2 * Math.PI * frequency * t - metrics.phaseRad) * scaleI;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.shadowBlur = 0;

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [frequency, isPlaying, metrics]);

  return <canvas ref={canvasRef} width={1000} height={200} className="w-full h-full opacity-90" />;
}

function PhasorDiagram({ metrics }: { metrics: any }) {
  return (
    <svg viewBox="-60 -60 120 120" className="w-full h-full max-w-[180px] drop-shadow-xl">
      <circle cx="0" cy="0" r="50" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" />
      <circle cx="0" cy="0" r="30" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="-60" y1="0" x2="60" y2="0" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      <line x1="0" y1="-60" x2="0" y2="60" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
      
      {/* Reference Voltage Phasor */}
      <line x1="0" y1="0" x2="50" y2="0" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M 50 0 L 44 -4 L 44 4 Z" fill="currentColor" />
      <text x="52" y="-5" fontSize="6" fontWeight="900" fill="currentColor" className="opacity-50">V</text>
      
      {/* Current Phasor */}
      <g style={{ transform: `rotate(${-metrics.phaseDeg}deg)`, transition: "transform 0.05s linear" }}>
        <line x1="0" y1="0" x2="45" y2="0" stroke="#dc2626" strokeWidth="4" strokeLinecap="square" />
        <path d="M 45 0 L 39 -4 L 39 4 Z" fill="#dc2626" />
        <text x="47" y="-5" fontSize="6" fontWeight="900" fill="#dc2626">I</text>
      </g>

      {/* Phase Angle Arc */}
      <path 
        d={`M 15 0 A 15 15 0 0 ${metrics.phaseDeg > 0 ? 0 : 1} ${15 * Math.cos(metrics.phaseRad)} ${-15 * Math.sin(metrics.phaseRad)}`}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeOpacity="0.5"
      />
    </svg>
  );
}
