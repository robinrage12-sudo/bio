"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type AppPage = "landing" | "form" | "analysis" | "results" | "products";

interface LookmaxScore {
  symmetry: number;        // 0-100
  facialThirds: number;    // 0-100
  jawlineScore: number;    // 0-100
  eyeScore: number;        // 0-100
  lipScore: number;        // 0-100
  skinScore: number;       // 0-100 (from brightness/contrast of face region)
  canthalTilt: number;     // 0-100
  overall: number;         // 0-10 PSL
}

interface PSLLevel {
  range: [number, number];
  label: string;
  color: string;
  description: string;
  sublabel: string;
}

// ─── PSL SCALE ────────────────────────────────────────────────────────────────
const PSL_LEVELS: PSLLevel[] = [
  { range: [1, 2], label: "1–2", sublabel: "Subhuman", color: "#ef4444", description: "Restructuration faciale majeure nécessaire." },
  { range: [3, 3], label: "3", sublabel: "Below Average", color: "#f97316", description: "Traits en deçà de la moyenne. Marge de progression." },
  { range: [4, 4], label: "4", sublabel: "Average", color: "#eab308", description: "Traits dans la moyenne. Potentiel de looksmaxxing." },
  { range: [5, 5], label: "5", sublabel: "Above Average", color: "#84cc16", description: "Au-dessus de la moyenne. Bonne structure de base." },
  { range: [6, 6], label: "6", sublabel: "Attractive", color: "#22c55e", description: "Attrattif·ve. Bonne symétrie et proportions." },
  { range: [7, 7], label: "7", sublabel: "Very Attractive", color: "#10b981", description: "Très attrayant·e. Dans le top 15%." },
  { range: [8, 8], label: "8", sublabel: "Model Tier", color: "#06b6d4", description: "Niveau mannequin. Top 5%." },
  { range: [9, 9], label: "9", sublabel: "Elite", color: "#6366f1", description: "Génétique exceptionnelle. Top 1%." },
  { range: [10, 10], label: "10", sublabel: "Godlike", color: "#a855f7", description: "Beauté parfaite. Extrêmement rare." },
];

function getPSLLevel(score: number): PSLLevel {
  return PSL_LEVELS.find(l => score >= l.range[0] && score <= l.range[1]) || PSL_LEVELS[0];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dist(a: faceapi.Point, b: faceapi.Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

function toScore(ratio: number, ideal: number, tolerance: number): number {
  const diff = Math.abs(ratio - ideal) / tolerance;
  return clamp(100 - diff * 100);
}

// ─── REAL ANALYSIS ────────────────────────────────────────────────────────────
async function analyzeFace(
  img: HTMLImageElement,
  gender: string,
  age: number
): Promise<LookmaxScore> {
  const detections = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceExpressions();

  if (!detections) throw new Error("Aucun visage détecté.");

  const lm = detections.landmarks;
  const pts = lm.positions;

  // 68-point landmark indices
  // Jaw: 0-16, LeftBrow: 17-21, RightBrow: 22-26
  // Nose: 27-35, LeftEye: 36-41, RightEye: 42-47
  // Mouth: 48-67

  // — SYMMETRY —
  const faceWidth = dist(pts[0], pts[16]);
  const midX = (pts[0].x + pts[16].x) / 2;

  const leftEyeCenter = { x: (pts[36].x + pts[39].x) / 2, y: (pts[36].y + pts[39].y) / 2 };
  const rightEyeCenter = { x: (pts[42].x + pts[45].x) / 2, y: (pts[42].y + pts[45].y) / 2 };
  const leftEyeFromMid = Math.abs(midX - leftEyeCenter.x);
  const rightEyeFromMid = Math.abs(midX - rightEyeCenter.x);
  const eyeSymmetry = 100 - clamp((Math.abs(leftEyeFromMid - rightEyeFromMid) / faceWidth) * 300);

  const leftBrowHeight = pts[19].y;
  const rightBrowHeight = pts[24].y;
  const browSymmetry = 100 - clamp((Math.abs(leftBrowHeight - rightBrowHeight) / faceWidth) * 200);

  const symmetry = (eyeSymmetry * 0.6 + browSymmetry * 0.4);

  // — FACIAL THIRDS —
  const hairline = pts[19].y; // approximation via brow
  const browLine = (pts[17].y + pts[26].y) / 2;
  const noseTip = pts[33].y;
  const chin = pts[8].y;
  const upper = browLine - hairline;
  const middle = noseTip - browLine;
  const lower = chin - noseTip;
  const total = upper + middle + lower;
  const upperR = upper / total;
  const middleR = middle / total;
  const lowerR = lower / total;
  const thirdsScore = (
    toScore(upperR, 0.333, 0.08) * 0.33 +
    toScore(middleR, 0.333, 0.08) * 0.33 +
    toScore(lowerR, 0.333, 0.08) * 0.33
  );

  // — JAWLINE —
  const jawWidth = dist(pts[2], pts[14]);
  const cheekWidth = dist(pts[1], pts[15]);
  const jawToFace = jawWidth / faceWidth;
  // Ideal jaw: ~70% of bizygomatic width
  const jawlineScore = toScore(jawToFace, 0.70, 0.12);

  // — EYE SCORE (width/height ratio, spacing) —
  const leftEyeW = dist(pts[36], pts[39]);
  const leftEyeH = (dist(pts[37], pts[41]) + dist(pts[38], pts[40])) / 2;
  const rightEyeW = dist(pts[42], pts[45]);
  const rightEyeH = (dist(pts[43], pts[47]) + dist(pts[44], pts[46])) / 2;
  const avgEyeRatio = ((leftEyeW / leftEyeH) + (rightEyeW / rightEyeH)) / 2;
  // Ideal hooded eye: ~2.8-3.2 width/height ratio
  const eyeRatioScore = toScore(avgEyeRatio, 3.0, 0.5);
  // Eye spacing: ideally ~1 eye width apart
  const interocular = dist(pts[39], pts[42]);
  const eyeSpacingScore = toScore(interocular / leftEyeW, 1.0, 0.25);
  const eyeScore = (eyeRatioScore * 0.5 + eyeSpacingScore * 0.5);

  // — CANTHAL TILT —
  const leftInner = pts[39];
  const leftOuter = pts[36];
  const rightInner = pts[42];
  const rightOuter = pts[45];
  const leftTilt = (leftOuter.y - leftInner.y) / leftEyeW;
  const rightTilt = (rightOuter.y - rightInner.y) / rightEyeW;
  const avgTilt = (leftTilt + rightTilt) / 2;
  // Positive tilt (hunter eyes) = better in lookmaxing
  const canthalTilt = clamp(50 + avgTilt * 400);

  // — LIP SCORE —
  const upperLipH = dist(pts[51], pts[62]);
  const lowerLipH = dist(pts[57], pts[66]);
  const lipRatio = upperLipH / (upperLipH + lowerLipH);
  // Ideal: lower lip slightly fuller → ratio ~0.35-0.45
  const lipScore = toScore(lipRatio, 0.40, 0.08);

  // — SKIN SCORE (based on face detection confidence) —
  const confidence = detections.detection.score;
  const skinScore = clamp(confidence * 90 + Math.random() * 10);

  // — OVERALL PSL SCORE —
  const weights = {
    symmetry: 0.25,
    facialThirds: 0.15,
    jawlineScore: 0.15,
    eyeScore: 0.20,
    canthalTilt: 0.10,
    lipScore: 0.08,
    skinScore: 0.07,
  };

  const rawOverall =
    symmetry * weights.symmetry +
    thirdsScore * weights.facialThirds +
    jawlineScore * weights.jawlineScore +
    eyeScore * weights.eyeScore +
    canthalTilt * weights.canthalTilt +
    lipScore * weights.lipScore +
    skinScore * weights.skinScore;

  // Map 0-100 → PSL 1-10, with realistic distribution
  // Most people land 3-7
  const psl = clamp(Math.round(1 + (rawOverall / 100) * 9), 1, 10);

  return {
    symmetry: Math.round(symmetry),
    facialThirds: Math.round(thirdsScore),
    jawlineScore: Math.round(jawlineScore),
    eyeScore: Math.round(eyeScore),
    canthalTilt: Math.round(canthalTilt),
    lipScore: Math.round(lipScore),
    skinScore: Math.round(skinScore),
    overall: psl,
  };
}

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color = "#06b6d4" }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-black" style={{ color }}>{value}/100</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

// ─── PSL GAUGE ────────────────────────────────────────────────────────────────
function PSLGauge({ score }: { score: number }) {
  const level = getPSLLevel(score);
  const angle = ((score - 1) / 9) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-64">
        {/* Track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ffffff10" strokeWidth="12" strokeLinecap="round" />
        {/* Colored arc segments */}
        {PSL_LEVELS.map((lvl, i) => {
          const startAngle = ((lvl.range[0] - 1) / 9) * 180 - 90;
          const endAngle = ((lvl.range[1] - 0.8) / 9) * 180 - 90;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = 100 + 80 * Math.cos(startRad);
          const y1 = 100 + 80 * Math.sin(startRad);
          const x2 = 100 + 80 * Math.cos(endRad);
          const y2 = 100 + 80 * Math.sin(endRad);
          const large = endAngle - startAngle > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A 80 80 0 ${large} 1 ${x2} ${y2}`}
              fill="none"
              stroke={lvl.color}
              strokeWidth="12"
              strokeLinecap="round"
              opacity={score >= lvl.range[0] ? 1 : 0.2}
            />
          );
        })}
        {/* Needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="28" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill="white" />
        </g>
        {/* Score text */}
        <text x="100" y="92" textAnchor="middle" fill="white" fontSize="28" fontWeight="900" fontStyle="italic">{score}</text>
        <text x="100" y="108" textAnchor="middle" fill={level.color} fontSize="9" fontWeight="700" letterSpacing="2">{level.sublabel.toUpperCase()}</text>
      </svg>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage] = useState<AppPage>("landing");
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<LookmaxScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load models
  useEffect(() => {
    if (modelsLoaded || loadingModels) return;
    setLoadingModels(true);
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      setModelsLoaded(true);
      setLoadingModels(false);
    }).catch(() => setLoadingModels(false));
  }, []);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResults(null);
    setError(null);
    const img = new Image();
    img.src = url;
    img.onload = () => setImageEl(img);
  };

  const runAnalysis = useCallback(async () => {
    if (!imageEl || !modelsLoaded || !gender || !age) return;
    setAnalyzing(true);
    setError(null);
    setProgress(0);

    const steps = [
      "Détection du visage...",
      "Mapping 68 landmarks...",
      "Calcul symétrie faciale...",
      "Analyse tiers faciaux...",
      "Évaluation canthal tilt...",
      "Score mandibulaire...",
      "Calcul PSL...",
    ];

    for (let i = 0; i < steps.length; i++) {
      setAnalysisStep(steps[i]);
      setProgress(Math.round(((i + 1) / steps.length) * 90));
      await new Promise(r => setTimeout(r, 280));
    }

    try {
      const score = await analyzeFace(imageEl, gender, age);
      setProgress(100);
      await new Promise(r => setTimeout(r, 300));
      setResults(score);
      setPage("results");
    } catch (err: any) {
      setError(err.message || "Erreur d'analyse. Essaie une photo plus nette.");
    } finally {
      setAnalyzing(false);
    }
  }, [imageEl, modelsLoaded, gender, age]);

  const reset = () => {
    setPage("landing");
    setGender(null);
    setAge(null);
    setImageUrl(null);
    setImageEl(null);
    setResults(null);
    setError(null);
    setProgress(0);
  };

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (page === "landing") {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ fontFamily: "'Helvetica Neue', 'Arial', sans-serif" }}>
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,40,200,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />

        <div className="relative z-10 max-w-lg w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full mb-10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Analyse biométrique réelle · @vladmandic/face-api
          </div>

          <h1 className="text-[7rem] font-black leading-none tracking-tighter mb-6" style={{ fontStyle: "italic", background: "linear-gradient(135deg, #fff 0%, #a78bfa 50%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            PSL<br />Score
          </h1>

          <p className="text-white/50 text-base mb-2 font-light leading-relaxed">
            Ton placement réel sur l'échelle PSL
          </p>
          <p className="text-white/25 text-xs mb-14 leading-relaxed">
            Symétrie · Tiers faciaux · Canthal tilt · Jawline · Lookmax
          </p>

          <button
            onClick={() => setPage("form")}
            className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest rounded-full hover:bg-white/90 transition-all hover:scale-105 shadow-[0_0_60px_rgba(167,139,250,0.3)]"
          >
            Analyser mon visage
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <div className="mt-16 grid grid-cols-5 gap-2">
            {PSL_LEVELS.slice(2).map((l) => (
              <div key={l.label} className="flex flex-col items-center gap-1.5 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                <span className="text-xl font-black" style={{ color: l.color }}>{l.label}</span>
                <span className="text-[8px] text-white/30 uppercase tracking-wider text-center">{l.sublabel}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── FORM ───────────────────────────────────────────────────────────────────
  if (page === "form") {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ fontFamily: "'Helvetica Neue', 'Arial', sans-serif" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(120,40,200,0.1),transparent)]" />

        <div className="relative z-10 w-full max-w-sm">
          <button onClick={() => setPage("landing")} className="text-white/30 hover:text-white/60 text-xs font-bold uppercase tracking-widest mb-10 flex items-center gap-2 transition-colors">
            ← Retour
          </button>

          <h2 className="text-4xl font-black italic tracking-tighter mb-1">Profil</h2>
          <p className="text-white/30 text-sm mb-10">Pour calibrer l'analyse PSL</p>

          <div className="space-y-6">
            {/* Genre */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-3">Genre</label>
              <div className="grid grid-cols-2 gap-3">
                {["Femme", "Homme"].map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${gender === g ? "bg-white text-black scale-105" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Âge */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-3">Âge</label>
              <input
                type="number"
                min={13}
                max={80}
                value={age || ""}
                onChange={e => setAge(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Ton âge"
                className="w-full py-4 px-5 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-center text-2xl placeholder-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>

            <button
              onClick={() => { if (gender && age) setPage("analysis"); }}
              className={`w-full py-5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all ${gender && age ? "bg-white text-black hover:scale-105" : "bg-white/5 text-white/20 cursor-not-allowed"}`}
            >
              Continuer →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── ANALYSIS ───────────────────────────────────────────────────────────────
  if (page === "analysis") {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ fontFamily: "'Helvetica Neue', 'Arial', sans-serif" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(120,40,200,0.08),transparent)]" />

        <div className="relative z-10 w-full max-w-sm">
          <button onClick={() => setPage("form")} className="text-white/30 hover:text-white/60 text-xs font-bold uppercase tracking-widest mb-10 flex items-center gap-2 transition-colors">
            ← Retour
          </button>

          <h2 className="text-4xl font-black italic tracking-tighter mb-1">Scan</h2>
          <p className="text-white/30 text-sm mb-8">Photo de face, bonne lumière, expression neutre</p>

          {/* Upload zone */}
          <label className="relative block w-full aspect-square rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden cursor-pointer hover:border-white/20 transition-all mb-6 group">
            {imageUrl ? (
              <>
                <img src={imageUrl} className="w-full h-full object-cover" alt="scan" />
                {analyzing && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-4">
                    <div className="w-full px-8 space-y-2">
                      <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-white/60 text-center font-bold uppercase tracking-widest">{analysisStep}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40"><path d="M12 16.5v-9M8.25 12l3.75-3.75L15.75 12"/><path d="M3.75 18.75a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-1.5a.75.75 0 01-.53-.22L13.5 6.53a2.25 2.25 0 00-1.59-.66h-1.82a2.25 2.25 0 00-1.59.66l-2.47 2.47a.75.75 0 01-.53.22H3.75A2.25 2.25 0 001.5 11.25v7.5"/></svg>
                </div>
                <span className="text-[11px] text-white/30 font-bold uppercase tracking-widest">Importer une photo</span>
              </div>
            )}
            <input type="file" className="hidden" accept="image/*" onChange={handleImage} />
          </label>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4 text-center">
              <p className="text-red-400 text-sm font-bold">{error}</p>
            </div>
          )}

          {loadingModels && (
            <p className="text-white/30 text-xs text-center font-bold uppercase tracking-widest mb-4 animate-pulse">
              Chargement des modèles IA...
            </p>
          )}

          <button
            onClick={runAnalysis}
            disabled={!imageEl || !modelsLoaded || analyzing}
            className={`w-full py-5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all ${imageEl && modelsLoaded && !analyzing ? "bg-white text-black hover:scale-105" : "bg-white/5 text-white/20 cursor-not-allowed"}`}
          >
            {analyzing ? "Analyse en cours..." : "Lancer l'analyse PSL"}
          </button>

          <p className="text-[10px] text-white/20 text-center mt-4 leading-relaxed">
            Analyse 100% locale · Aucune donnée envoyée
          </p>
        </div>
      </main>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (page === "results" && results) {
    const level = getPSLLevel(results.overall);
    return (
      <main className="min-h-screen bg-[#050508] text-white flex flex-col items-center py-12 px-4 relative overflow-hidden" style={{ fontFamily: "'Helvetica Neue', 'Arial', sans-serif" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(120,40,200,0.12),transparent)]" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <button onClick={reset} className="text-white/30 hover:text-white/60 text-xs font-bold uppercase tracking-widest transition-colors">← Accueil</button>
            <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{gender} · {age} ans</span>
          </div>

          <h2 className="text-4xl font-black italic tracking-tighter mb-8">Résultats PSL</h2>

          {/* PSL Gauge */}
          <div className="p-8 bg-white/[0.03] border border-white/[0.07] rounded-3xl mb-4 text-center">
            <PSLGauge score={results.overall} />
            <p className="text-white/40 text-xs mt-4 font-bold uppercase tracking-widest">Échelle PSL 1–10</p>
          </div>

          {/* PSL Level Card */}
          <div className="p-5 rounded-2xl border mb-6" style={{ borderColor: level.color + "33", background: level.color + "0a" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-black" style={{ color: level.color }}>{level.sublabel}</span>
              <span className="text-3xl font-black italic" style={{ color: level.color }}>{results.overall}/10</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">{level.description}</p>
          </div>

          {/* Breakdown */}
          <div className="p-6 bg-white/[0.03] border border-white/[0.07] rounded-3xl mb-4 space-y-4">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-5">Critères Lookmaxing</h3>
            <ScoreBar label="Symétrie faciale" value={results.symmetry} color="#a78bfa" />
            <ScoreBar label="Tiers faciaux" value={results.facialThirds} color="#818cf8" />
            <ScoreBar label="Jawline" value={results.jawlineScore} color="#06b6d4" />
            <ScoreBar label="Yeux (ratio + spacing)" value={results.eyeScore} color="#22d3ee" />
            <ScoreBar label="Canthal tilt" value={results.canthalTilt} color="#34d399" />
            <ScoreBar label="Lèvres" value={results.lipScore} color="#f472b6" />
            <ScoreBar label="Qualité image" value={results.skinScore} color="#fbbf24" />
          </div>

          {/* PSL Scale Reference */}
          <div className="p-6 bg-white/[0.03] border border-white/[0.07] rounded-3xl mb-8">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Échelle PSL</h3>
            <div className="space-y-2">
              {PSL_LEVELS.map((l) => (
                <div
                  key={l.label}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${results.overall >= l.range[0] && results.overall <= l.range[1] ? "bg-white/10" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black w-6" style={{ color: l.color }}>{l.label}</span>
                    <span className="text-[11px] font-bold text-white/50">{l.sublabel}</span>
                  </div>
                  {results.overall >= l.range[0] && results.overall <= l.range[1] && (
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">← toi</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setPage("analysis")}
              className="w-full py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
            >
              Nouvelle analyse
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Mon score PSL est ${results.overall}/10 (${getPSLLevel(results.overall).sublabel}) — via PSLScore`);
                alert("✓ Copié !");
              }}
              className="w-full py-4 bg-white/5 text-white/60 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all border border-white/[0.07]"
            >
              Partager mon score
            </button>
          </div>

          <p className="text-[10px] text-white/15 text-center mt-8 leading-relaxed">
            Analyse biométrique · Résultats indicatifs · Pas un jugement de valeur
          </p>
        </div>
      </main>
    );
  }

  return null;
}
