import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, "../src/components/upload/UploadScreen.tsx");
const originalSource = fs.readFileSync(srcPath, "utf8");

const previewCardsMatch = originalSource.match(
  /\/\* ─── Stacked preview cards ─── \*\/\s*function PreviewCards\(\) \{[\s\S]*?return \([\s\S]*?  \);\n\}/
);
const previewCardsCode = previewCardsMatch ? previewCardsMatch[0] : "";

const generateTemplate = (vNum: string, chromeCode: string, wrapperClass: string, rightColClass: string) => `
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseClaudeFolder } from "@/lib/parser";
import { generateDemoData } from "@/lib/demo";
import { ParsedData } from "@/types";

interface UploadScreenProps {
  onDataParsed: (data: ParsedData) => void;
}

const LOADING_MESSAGES = [
  "Reading your .claude folder...",
  "Scanning session transcripts...",
  "Crunching the numbers...",
  "Analyzing your habits...",
  "Building your story...",
];

${previewCardsCode}

function TabContentNPM({ active }: { active: boolean }) {
  const [lines, setLines] = useState<number>(0);
  useEffect(() => {
    if (!active) {
      setLines(0);
      return;
    }
    const timeouts = [
      setTimeout(() => setLines(1), 50),
      setTimeout(() => setLines(2), 100),
      setTimeout(() => setLines(3), 150),
      setTimeout(() => setLines(4), 200),
      setTimeout(() => setLines(5), 250),
    ];
    return () => timeouts.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="bg-[#1e1e1e] border border-on-surface/10 rounded-xl p-5 w-full font-mono text-[13px] shadow-xl relative mt-2">
      <div className="flex items-center gap-2 mb-4 opacity-80">
        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
      </div>
      <div className="text-on-surface/80 space-y-1.5 min-h-[140px]">
        <p><span className="text-primary">$</span> npx ccrewind</p>
        {lines >= 1 && <p className="text-primary font-bold tracking-wider mt-2">◆ CC REWIND ◆</p>}
        {lines >= 2 && <p className="text-on-surface/50">Reading ~/.claude...</p>}
        {lines >= 3 && <p>Your character: <span className="text-primary">The Quant</span></p>}
        {lines >= 4 && <p>Claude Elo: <span className="font-bold">847 / 1000</span></p>}
        {lines >= 5 && <p className="text-on-surface/40 mt-3 italic">→ ccrewind.com for the full story</p>}
      </div>
      <div className="mt-4 text-right border-t border-on-surface/10 pt-3">
        <a href="https://www.npmjs.com/package/ccrewind" target="_blank" rel="noreferrer" className="font-label text-primary/80 hover:text-primary text-[10px] uppercase tracking-wider hover:underline transition-colors">View on npm →</a>
      </div>
    </div>
  );
}

function TabContentClaude() {
  const [copied, setCopied] = useState(false);
  const copyCmd = () => {
    navigator.clipboard.writeText("npx ccrewind --setup");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="w-full mt-2">
      <h3 className="font-headline font-bold text-on-surface mb-3 text-lg">Run inside Claude Code</h3>
      <div className="relative bg-[#1e1e1e] border border-on-surface/10 p-3 rounded-xl flex items-center justify-between mb-4 shadow-inner">
        <code className="font-mono text-[13px] text-primary">npx ccrewind --setup</code>
        <button onClick={copyCmd} className="text-on-surface/40 hover:text-primary transition-colors p-1 bg-surface-container-high rounded-md">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>
      <div className="flex gap-2">
        <div className="bg-surface-container-low border border-on-surface/5 p-3 rounded-xl flex-1 text-center font-mono text-[11px] text-on-surface">
          <span className="text-primary/90">/ccrewind</span>
          <span className="block mt-1.5 font-body text-[10px] text-on-surface/40 leading-snug">Terminal stats report</span>
        </div>
        <div className="bg-surface-container-low border border-on-surface/5 p-3 rounded-xl flex-1 text-center font-mono text-[11px] text-on-surface">
          <span className="text-primary/90">/ccrewind-ui</span>
          <span className="block mt-1.5 font-body text-[10px] text-on-surface/40 leading-snug">Opens web UI with auto-detected data</span>
        </div>
      </div>
      <p className="font-label text-[9px] text-on-surface/30 mt-4 text-center uppercase tracking-widest">Registers slash commands in your Claude Code session</p>
    </div>
  );
}

export default function UploadScreenV${vNum}({ onDataParsed }: UploadScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [localAvailable, setLocalAvailable] = useState(false);
  const [showHiddenHelp, setShowHiddenHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<"npm" | "web" | "claude">("web");

  useEffect(() => {
    fetch("/api/local-data/status")
      .then((r) => r.json())
      .then((d: { available: boolean }) => {
        if (d.available) setLocalAvailable(true);
      })
      .catch(() => {});
  }, []);

  const startLoadingCycle = () => {
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingText(LOADING_MESSAGES[idx]);
    }, 1500);
    return interval;
  };

  const handleLocalData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadingText(LOADING_MESSAGES[0]);
    const interval = startLoadingCycle();
    try {
      const res = await fetch("/api/local-data");
      if (!res.ok) throw new Error("Failed to load local data");
      const data: ParsedData = await res.json();
      if (!data.statsCache && data.history.length === 0 && data.sessions.length === 0) {
        throw new Error("No Claude data found in ~/.claude");
      }
      clearInterval(interval);
      setLoadingText("Ready.");
      await new Promise((r) => setTimeout(r, 500));
      onDataParsed(data);
    } catch (e) {
      clearInterval(interval);
      setIsLoading(false);
      setError(e instanceof Error ? e.message : "Failed to load local data");
    }
  }, [onDataParsed]);

  const handleFiles = useCallback(
    async (files: FileList) => {
      setIsLoading(true);
      setError(null);
      setLoadingText(LOADING_MESSAGES[0]);
      const interval = startLoadingCycle();
      try {
        const data = await parseClaudeFolder(files);
        if (!data.statsCache && data.history.length === 0 && data.sessions.length === 0) {
          throw new Error("No Claude data found. Make sure you selected your ~/.claude folder.");
        }
        clearInterval(interval);
        setLoadingText("Ready.");
        await new Promise((r) => setTimeout(r, 500));
        onDataParsed(data);
      } catch (e) {
        clearInterval(interval);
        setIsLoading(false);
        setError(e instanceof Error ? e.message : "Failed to parse data");
      }
    },
    [onDataParsed]
  );

  const handleDemo = useCallback(() => {
    setIsLoading(true);
    setLoadingText("Loading demo data...");
    fetch("/demo-data.json")
      .then((r) => r.json())
      .then((data) => {
        setLoadingText("Ready.");
        setTimeout(() => onDataParsed(data), 400);
      })
      .catch(() => {
        const demoData = generateDemoData();
        setLoadingText("Ready.");
        setTimeout(() => onDataParsed(demoData), 400);
      });
  }, [onDataParsed]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
  };

  const TabContentWeb = () => (
    <div className="flex flex-col gap-3 w-full mt-2">
      {localAvailable ? (
        <button
          onClick={handleLocalData}
          className="w-full bg-primary hover:bg-primary/90 text-on-primary rounded-2xl px-8 py-4 font-headline font-bold text-base transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 text-left"
        >
          Use your local data
          <p className="text-on-primary/55 text-[11px] font-normal mt-0.5">
            ~/.claude auto-detected on this machine
          </p>
        </button>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full bg-primary hover:bg-primary/90 text-on-primary rounded-2xl px-8 py-4 font-headline font-bold text-base transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
        >
          Upload ~/.claude folder
        </button>
      )}

      <div className="flex gap-2">
        {localAvailable && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex-1 bg-surface-container-low hover:bg-surface-container border border-on-surface/8 text-on-surface/60 hover:text-on-surface rounded-xl px-4 py-3 font-label text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
          >
            Upload folder
          </button>
        )}
        <button
          onClick={handleDemo}
          className="flex-1 bg-surface-container-low hover:bg-surface-container border border-on-surface/8 text-on-surface/60 hover:text-on-surface rounded-xl px-4 py-3 font-label text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
        >
          Try demo
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="inline-flex items-center gap-1.5 text-on-surface/25">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-label text-[9px] font-bold tracking-widest uppercase">
            Your data stays local
          </span>
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHiddenHelp(!showHiddenHelp)}
            className="group cursor-pointer font-label text-[9px] font-bold tracking-wider uppercase text-on-surface/35 hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="underline underline-offset-2 decoration-on-surface/20 group-hover:decoration-primary transition-colors">
              Can&apos;t see .claude?
            </span>
            <motion.span
              animate={{ rotate: showHiddenHelp ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="opacity-50 group-hover:opacity-100"
            >
              ↓
            </motion.span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showHiddenHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-1"
          >
            <div className="bg-surface-container-low/80 border border-on-surface/6 rounded-xl px-4 py-3 space-y-2">
              <p className="font-label text-[9px] font-bold tracking-[0.2em] uppercase text-on-surface/30 mb-2">
                Show hidden files first:
              </p>
              {[
                { os: "macOS", hint: "Cmd + Shift + .", note: "in Finder" },
                { os: "Windows", hint: "View → Show → Hidden items", note: "" },
                { os: "Linux", hint: "Ctrl + H", note: "in file manager" },
              ].map(({ os, hint, note }) => (
                <div key={os} className="flex items-center gap-2">
                  <span className="font-label text-[9px] font-bold text-primary/70 w-12">{os}</span>
                  <code className="font-mono text-[10px] text-on-surface/50 bg-surface-container-high/50 px-2 py-0.5 rounded">
                    {hint}
                  </code>
                  {note && <span className="font-label text-[9px] text-on-surface/25">{note}</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="fixed inset-0 grain-texture" />
      <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[130px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-8 relative z-10"
          >
            <div className="relative w-24 h-24">
              <motion.div className="absolute inset-0 border-2 border-primary/20 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
              <motion.div className="absolute inset-2 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full" animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
              <motion.div className="absolute inset-4 border-2 border-t-transparent border-r-primary border-b-transparent border-l-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={loadingText} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-label text-sm tracking-widest uppercase text-on-surface/60">
                {loadingText}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row items-center gap-12 md:gap-16"
          >
            <div className="${wrapperClass}">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="text-center md:text-left mb-8 w-full">
                <h1 className="font-headline font-extrabold tracking-tighter leading-[0.88] text-[clamp(3rem,6vw,5.5rem)]">
                  <span className="text-on-surface">Claude Code</span><br/>
                  <span className="text-primary text-glow">Rewind.</span>
                </h1>
                <p className="font-body text-base md:text-lg italic text-on-surface/35 mt-4 max-w-sm mx-auto md:mx-0">
                  Connect your data. Get your character. Share your stats.
                </p>
              </motion.div>

              ${chromeCode}

            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="${rightColClass}">
              <PreviewCards />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="border-2 border-dashed border-primary rounded-3xl px-16 py-12 text-center">
              <p className="font-headline text-2xl font-extrabold text-primary">Drop it like it&apos;s hot</p>
              <p className="font-body text-sm italic text-on-surface/40 mt-2">release to upload your ~/.claude folder</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4">
            <p className="font-label text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        // @ts-ignore webkitdirectory is non-standard
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
`;

const v1Chrome = `
              <div className="w-full max-w-md">
                <div className="flex gap-2 mb-6 bg-surface-container-low/40 p-1.5 rounded-[1.25rem] border border-on-surface/5">
                  {(["npm", "web", "claude"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="relative flex-1 py-3 px-4 rounded-xl font-label text-[11px] font-bold tracking-widest uppercase transition-colors"
                      style={{ color: activeTab === t ? "#ffffff" : "rgba(250,249,245,0.4)" }}
                    >
                      {activeTab === t && (
                        <motion.div layoutId="pill" className="absolute inset-0 rounded-xl bg-primary" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                      )}
                      <span className="relative z-10">{t === "npm" ? "npm package" : t === "web" ? "web" : "claude code"}</span>
                    </button>
                  ))}
                </div>
                <div className="min-h-[220px]">
                  {activeTab === "npm" && <TabContentNPM active={true} />}
                  {activeTab === "web" && <TabContentWeb />}
                  {activeTab === "claude" && <TabContentClaude />}
                </div>
              </div>
`;

const v2Chrome = `
              <div className="w-full max-w-md">
                <div className="flex gap-8 mb-8 border-b border-on-surface/10 pb-3">
                  {(["npm", "web", "claude"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="relative pb-3 -mb-3 font-label text-[11px] font-extrabold tracking-[0.15em] uppercase transition-all"
                      style={{ 
                        color: activeTab === t ? "#faf9f5" : "rgba(250,249,245,0.35)",
                      }}
                    >
                      {activeTab === t && (
                        <motion.div layoutId="underline" className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary" />
                      )}
                      <span>{t === "npm" ? "npm package" : t === "web" ? "web" : "claude code"}</span>
                    </button>
                  ))}
                </div>
                <div className="min-h-[220px]">
                  {activeTab === "npm" && <TabContentNPM active={true} />}
                  {activeTab === "web" && <TabContentWeb />}
                  {activeTab === "claude" && <TabContentClaude />}
                </div>
              </div>
`;

const v3Chrome = `
              <div className="w-full max-w-md rounded-2xl overflow-hidden border border-on-surface/10 bg-[rgba(0,0,0,0.25)] flex flex-col">
                <div className="flex border-b border-on-surface/10 bg-black/20">
                  {(["npm", "web", "claude"] as const).map((t, idx) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={\`relative flex-1 py-3.5 px-3 flex items-center justify-center gap-2 font-mono text-[11px] transition-colors \${idx !== 0 ? 'border-l border-on-surface/10' : ''} \${activeTab === t ? 'bg-white/5' : 'hover:bg-white/5'}\`}
                      style={{ color: activeTab === t ? "#faf9f5" : "rgba(250,249,245,0.5)" }}
                    >
                      {activeTab === t && (
                        <motion.div layoutId="v3-top-border" className="absolute left-0 right-0 top-0 h-[2px] bg-primary" />
                      )}
                      {t === "npm" ? (
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                      ) : t === "web" ? (
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      ) : (
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                      )}
                      <span>{t === "npm" ? "npm package" : t === "web" ? "web" : "claude code"}</span>
                      {activeTab === t && <div className="absolute left-0 right-0 bottom-[-1px] h-[1px] bg-[rgba(23,23,23,1)] z-10" />}
                    </button>
                  ))}
                </div>
                <div className="p-5 min-h-[240px]">
                  {activeTab === "npm" && <TabContentNPM active={true} />}
                  {activeTab === "web" && <TabContentWeb />}
                  {activeTab === "claude" && <TabContentClaude />}
                </div>
              </div>
`;

const v4Chrome = `
              <div className="w-full flex gap-6 mt-4">
                <div className="w-[72px] shrink-0 flex flex-col gap-3 border-r border-on-surface/10 pr-2">
                  {(["npm", "web", "claude"] as const).map((t) => (
                    <button
                      key={t}
                      title={t === "npm" ? "npm package" : t === "web" ? "web" : "claude code"}
                      onClick={() => setActiveTab(t)}
                      className={\`relative w-14 h-14 rounded-xl flex items-center justify-center transition-colors \${activeTab === t ? 'bg-primary/10 text-primary' : 'text-on-surface/40 hover:bg-surface-container-low hover:text-on-surface'}\`}
                    >
                      {activeTab === t && (
                        <motion.div layoutId="v4-left-border" className="absolute left-[-2px] top-2 bottom-2 w-[3px] rounded-r-md bg-primary" />
                      )}
                      {t === "npm" ? (
                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                      ) : t === "web" ? (
                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      ) : (
                         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-[220px] max-w-sm">
                  {activeTab === "npm" && <TabContentNPM active={true} />}
                  {activeTab === "web" && <TabContentWeb />}
                  {activeTab === "claude" && <TabContentClaude />}
                </div>
              </div>
`;

const v5Chrome = `
              <div className="w-full max-w-md">
                <div className="relative flex w-full h-[52px] bg-[rgba(0,0,0,0.3)] rounded-2xl border border-on-surface/10 p-1.5 mb-6 shadow-inner">
                  {(["npm", "web", "claude"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="relative flex-1 flex items-center justify-center z-10"
                    >
                      <span className={\`font-label text-[11px] font-bold tracking-widest uppercase transition-colors duration-300 \${activeTab === t ? 'text-[#111111]' : 'text-on-surface/50'}\`}>
                        {t === "npm" ? "npm package" : t === "web" ? "web" : "claude code"}
                      </span>
                      {activeTab === t && (
                        <motion.div 
                          layoutId="segment" 
                          className="absolute inset-0 bg-[#f4f4f5] rounded-xl z-[-1] shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                  ))}
                </div>
                <div className="min-h-[220px]">
                  {activeTab === "npm" && <TabContentNPM active={true} />}
                  {activeTab === "web" && <TabContentWeb />}
                  {activeTab === "claude" && <TabContentClaude />}
                </div>
              </div>
`;

fs.writeFileSync(
  path.join(__dirname, "../src/components/upload/UploadScreenV1.tsx"),
  generateTemplate(
    "1",
    v1Chrome,
    "flex-1 flex flex-col items-center md:items-start w-full max-w-lg",
    "shrink-0 hidden md:block"
  )
);
fs.writeFileSync(
  path.join(__dirname, "../src/components/upload/UploadScreenV2.tsx"),
  generateTemplate(
    "2",
    v2Chrome,
    "flex-1 flex flex-col items-center md:items-start w-full max-w-lg",
    "shrink-0 hidden md:block"
  )
);
fs.writeFileSync(
  path.join(__dirname, "../src/components/upload/UploadScreenV3.tsx"),
  generateTemplate(
    "3",
    v3Chrome,
    "flex-1 flex flex-col items-center md:items-start w-full max-w-lg",
    "shrink-0 hidden md:block"
  )
);
fs.writeFileSync(
  path.join(__dirname, "../src/components/upload/UploadScreenV4.tsx"),
  generateTemplate(
    "4",
    v4Chrome,
    "flex-1 flex flex-col items-center md:items-start w-full max-w-lg",
    "shrink-0 hidden md:block"
  )
);
fs.writeFileSync(
  path.join(__dirname, "../src/components/upload/UploadScreenV5.tsx"),
  generateTemplate(
    "5",
    v5Chrome,
    "flex-1 flex flex-col items-center md:items-start w-full max-w-lg",
    "shrink-0 hidden md:block"
  )
);

console.log("Successfully generated 5 variants (fixed Next.js TS issues).");
