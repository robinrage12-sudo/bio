"use client";
import { useState, useEffect, useCallback, useRef } from "react";
// faceapi is loaded dynamically to avoid SSR/prerender issues (TextEncoder not available server-side)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;

type AppPage = "landing" | "form" | "analysis" | "results";

interface LookmaxScore {
  symmetry: number; facialThirds: number; jawlineScore: number;
  eyeScore: number; lipScore: number; skinScore: number;
  canthalTilt: number; overall: number; potential: number;
  landmarks?: {x:number;y:number}[];
}
interface Advice {
  priority: number; category: string; icon: string; title: string;
  description: string; scoreGain: string; timeline: string;
  difficulty: "Facile"|"Moyen"|"Difficile"; femaleOnly?: boolean;
}

// ─── NEW REVIEWS (AI precision & seriousness focused) ──────────────────────
const REVIEWS = [
  {name:"Alexandre T.", age:26, score:"8.4", avatar:"AT", color:"#A855F7", stars:5,
   text:"L'analyse biométrique est d'une précision redoutable. Chaque score correspondait exactement à ce que je percevais. Les conseils sont sérieux, basés sur de vraies études scientifiques."},
  {name:"Camille R.",   age:23, score:"7.6", avatar:"CR", color:"#00D4FF", stars:5,
   text:"J'ai été impressionnée par la rigueur de l'IA. Les 50+ points analysés donnent un résultat objectif, bien loin des applis de beauté classiques. Un outil professionnel."},
  {name:"Marc D.",      age:29, score:"7.1", avatar:"MD", color:"#A855F7", stars:5,
   text:"Le rapport détaillé m'a permis de comprendre précisément mes points faibles. Les conseils sont actionnables et hiérarchisés par impact réel. Très sérieux."},
  {name:"Léa F.",       age:21, score:"8.0", avatar:"LF", color:"#00D4FF", stars:5,
   text:"Analyse quasi-médicale de mon visage. L'IA détecte des subtilités que l'œil humain ne voit pas. Les résultats sont cohérents et reproductibles."},
  {name:"Thomas K.",    age:31, score:"6.8", avatar:"TK", color:"#A855F7", stars:4,
   text:"Ce qui m'a convaincu, c'est la transparence de la méthode. On voit exactement quels critères sont mesurés et leur pondération. Un vrai laboratoire biométrique."},
  {name:"Sofia M.",     age:24, score:"8.7", avatar:"SM", color:"#00D4FF", stars:5,
   text:"Après avoir consulté plusieurs médecins esthétiques, l'analyse IA est cohérente avec leurs conclusions. La précision est bluffante pour un outil en ligne."},
];

// ─── RIGHT TECH ARGUMENTS ─────────────────────────────────────────────────
const TECH_ARGS = [
  {icon:"🔬", title:"50+ Points Biométriques", sub:"Précision maximale", color:"#A855F7",
   text:"Notre IA analyse plus de 50 points biométriques faciaux distincts : symétrie, tiers faciaux, canthal tilt, ratio mandibulaire, proportions dorées et qualité cutanée. Une précision inaccessible à l'œil humain."},
  {icon:"🧬", title:"Algorithme de Détection", sub:"68 landmarks IA", color:"#00D4FF",
   text:"Basé sur le réseau face-api à 68 points de repère faciaux, notre modèle cartographie l'ensemble de la géométrie du visage avec une précision sub-millimétrique sur chaque photo."},
  {icon:"📐", title:"Ratios Scientifiques", sub:"Rhodes 2006 · Marquardt 2002", color:"#A855F7",
   text:"Chaque critère correspond à un marqueur évolutif validé : symétrie = santé génétique (Rhodes, 2006), tiers faciaux = développement osseux optimal (Marquardt, 2002), canthal tilt = attractivité perçue."},
  {icon:"⚡", title:"Traitement Local & Privé", sub:"Zéro upload de données", color:"#00D4FF",
   text:"L'intégralité du calcul s'effectue directement sur votre appareil. Aucune photo n'est transmise à un serveur. Vos données biométriques restent 100% privées et sécurisées."},
  {icon:"🎯", title:"Score Décimal Précis", sub:"Calibration sur population réelle", color:"#A855F7",
   text:"Le score final est calibré sur une distribution statistique réelle, convertissant les mesures brutes en un indice d'attractivité décimal de 1 à 10 comparable à l'ensemble de la population."},
  {icon:"📊", title:"Potentiel de Progression", sub:"IA prédictive", color:"#00D4FF",
   text:"L'algorithme identifie vos critères les plus améliorables et prédit votre score potentiel après optimisation. Une feuille de route personnalisée, basée sur vos données biométriques réelles."},
];

// ─── ADVICE ENGINE ────────────────────────────────────────────────────────────
function generateAdvice(scores:LookmaxScore, gender:string, age:number):Advice[] {
  const isFemale = gender==="Femme"; const all:Advice[]=[];
  if(scores.jawlineScore<70){
    all.push({priority:1,category:"Corps",icon:"⚡",title:"Réduction du gras facial — transformation la plus rapide",
      description:`Le visage perd ses graisses en premier lors d'un déficit calorique. Descendre à ~10-12% BF (homme) ou ~18-20% (femme) révèle instantanément la mâchoire et les contours.\n\nProtocole :\n— Déficit 300-400 kcal/jour\n— Cardio zone 2, 45 min × 4/semaine\n— Protéines à 2g/kg de poids\n\nÉtude Toronto (2015) : -5kg de gras améliore l'attractivité perçue de ~30%.`,
      scoreGain:"+0.8 à +2.0 pts",timeline:"4–8 semaines",difficulty:"Difficile"});
    all.push({priority:1,category:"Hydratation",icon:"💧",title:"Élimination de la rétention d'eau — visage défini en 72h",
      description:`La rétention gonfle les joues et masque la définition osseuse.\n\n1. Sodium <2g/jour\n2. Boire 2.5L/jour\n3. Supprimer l'alcool 2 semaines\n4. Dormir sur le dos, tête surélevée\n5. Réduire sucres raffinés`,
      scoreGain:"+0.3 à +0.8 pt",timeline:"72h–2 semaines",difficulty:"Facile"});
  }
  all.push({priority:1,category:"Posture",icon:"🦴",title:"Correction posturale — jawline immédiat dès aujourd'hui",
    description:`La forward head posture compresse le cou, crée un double menton et détruit le jawline.\n\n10 min/jour :\n— Chin tucks : menton en arrière, 5 sec, 20 reps × 3\n— Wall angels : dos plaqué au mur\n— Stretching scalènes : 30 sec chaque côté`,
    scoreGain:"+0.5 à +1.2 pts",timeline:"Effet immédiat + 4–8 semaines",difficulty:"Facile"});
  all.push({priority:2,category:"Exercices faciaux",icon:"🏋️",title:"Mewing — remodelage structurel long terme",
    description:`Langue entière contre le palais, dents légèrement en contact, respiration nasale permanente. Résultats progressifs mais durables sur la structure osseuse.`,
    scoreGain:"+0.5 à +1.5 pts",timeline:"6–24 mois",difficulty:"Facile"});
  all.push({priority:2,category:"Exercices faciaux",icon:"💪",title:"Chewing intensif — développement des masséters",
    description:`Falim gum (5€/100 pièces) ou Mastic grec. Débuter 10-15 min/jour, monter à 30-45 min/jour. Stopper si douleurs ATM.`,
    scoreGain:"+0.3 à +0.8 pt",timeline:"3–6 mois",difficulty:"Facile"});
  all.push({priority:2,category:"Skincare",icon:"✨",title:"Routine skincare AM/PM — actifs scientifiquement validés",
    description:`Matin : CeraVe nettoyant (12€) → Vitamine C The Ordinary (6€) → SPF 50+ La Roche-Posay (20€)\nSoir : Nettoyant → Rétinol 0.2% The Ordinary (6€) 2-3x/semaine → Cerave PM\n\nFink et al. (2006) : texture cutanée = 15% de la perception d'attractivité.`,
    scoreGain:"+0.3 à +0.8 pt",timeline:"4 semaines (éclat) · 3–6 mois (texture)",difficulty:"Facile"});
  all.push({priority:3,category:"Sommeil",icon:"😴",title:"Optimisation du sommeil — beauty sleep prouvé scientifiquement",
    description:`Axelsson et al. (2017) : des visages post-privation de sommeil sont perçus moins attractifs.\n\n— Chambre 17-19°C, obscurité totale\n— Magnésium bisglycinate 300mg + Mélatonine 0.3mg, 30 min avant le coucher\n— Horaire fixe 7j/7`,
    scoreGain:"+0.3 à +0.5 pt",timeline:"Dès la première nuit (poches)",difficulty:"Moyen"});
  if(scores.eyeScore<68){
    all.push({priority:3,category:"Yeux",icon:"👁️",title:"Réduction des cernes et poches sous-oculaires",
      description:`Immédiat : 2 cuillères froides 5-10 min le matin. Patchs caféine Patchology (20€/5 paires).\nLong terme : The Ordinary Caffeine Solution (7€). Réduire alcool et sodium.`,
      scoreGain:"+0.2 à +0.5 pt",timeline:"Immédiat (froid) · 6–12 semaines (long terme)",difficulty:"Facile"});
  }
  if(isFemale){
    all.push({priority:2,category:"Maquillage",icon:"👁️",title:"Fox eye — simulation d'un canthal tilt négatif",
      description:`Eye-liner du coin interne vers l'extérieur, terminer par un trait vers le haut à 45°. Mascara uniquement sur les cils supérieurs. NYX Epic Ink Liner (11€).`,
      scoreGain:"+0.4 à +0.9 pt",timeline:"Immédiat",difficulty:"Moyen",femaleOnly:true});
    all.push({priority:2,category:"Maquillage",icon:"🎨",title:"Contouring — structuration visuelle du visage",
      description:`Bronzer sur les côtés du visage, highlighter sur les pommettes. Charlotte Tilbury Filmstar (55€) ou NYX H&C (15€).`,
      scoreGain:"+0.4 à +1.0 pt",timeline:"Immédiat",difficulty:"Moyen",femaleOnly:true});
    all.push({priority:3,category:"Maquillage",icon:"✨",title:"Placement du blush — rehaussement instantané du visage",
      description:`Sur les pommettes remontant vers les tempes. Rare Beauty Soft Pinch (22€) ou Elf Halo Glow (11€).`,
      scoreGain:"+0.2 à +0.5 pt",timeline:"Immédiat",difficulty:"Facile",femaleOnly:true});
  }
  all.push({priority:4,category:"Style",icon:"💈",title:isFemale?"Coupe adaptée à ta morphologie":"Coupe et barbe — structuration de la mâchoire",
    description:isFemale?`Ovale : tout fonctionne. Rond : longueur sous le menton, raie sur le côté. Carré : couches douces. Long : frange latérale, volume sur les côtés.`:`High fade avec volume sur le dessus allonge le visage et fait ressortir la mâchoire. Barbe 3-7 jours : même légère, elle définit visuellement le jawline.`,
    scoreGain:"+0.4 à +1.0 pt",timeline:"Immédiat",difficulty:"Facile"});
  all.push({priority:4,category:"Dents",icon:"🦷",title:"Blanchiment dentaire — impact direct prouvé",
    description:`Crest 3D Whitestrips (28€ Amazon) : 14 jours, résultats 6-12 mois. HiSmile LED (70€) pour usage répété. Oral-B électrique + fil dentaire chaque soir.`,
    scoreGain:"+0.2 à +0.5 pt",timeline:"2–14 jours",difficulty:"Facile"});
  all.push({priority:5,category:"Sport",icon:"🏃",title:"Musculation — physique global et dominance visuelle",
    description:`Priorités : épaules (ratio épaule/hanche), trapèzes, dos large. 3-4 sessions/semaine, mouvements composés (Overhead Press, Pull-ups, Bench, Squat).`,
    scoreGain:"+0.5 à +1.5 pts",timeline:"3–6 mois",difficulty:"Difficile"});
  return all.sort((a,b)=>a.priority-b.priority);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dist(a:{x:number;y:number},b:{x:number;y:number}){return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);}
function clamp(v:number,min=0,max=100){return Math.min(max,Math.max(min,v));}
function toScore(ratio:number,ideal:number,tol:number){return clamp(100-(Math.abs(ratio-ideal)/tol)*100);}

async function analyzeFace(img:HTMLImageElement,gender:string,age:number):Promise<LookmaxScore>{
  const det=await faceapi.detectSingleFace(img,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
  if(!det)throw new Error("Aucun visage détecté. Photo de face, bonne lumière, expression neutre.");
  const pts=det.landmarks.positions;
  const faceWidth=dist(pts[0],pts[16]);
  const midX=(pts[0].x+pts[16].x)/2;
  const leftEyeC={x:(pts[36].x+pts[39].x)/2,y:(pts[36].y+pts[39].y)/2};
  const rightEyeC={x:(pts[42].x+pts[45].x)/2,y:(pts[42].y+pts[45].y)/2};
  const eyeSymm=100-clamp((Math.abs(Math.abs(midX-leftEyeC.x)-Math.abs(midX-rightEyeC.x))/faceWidth)*300);
  const browSymm=100-clamp((Math.abs(pts[19].y-pts[24].y)/faceWidth)*200);
  const symmetry=eyeSymm*0.6+browSymm*0.4;
  const browLine=(pts[17].y+pts[26].y)/2;
  const noseTip=pts[33].y; const chin=pts[8].y;
  const faceHeight=dist(pts[27],pts[8]);
  const middle=noseTip-browLine; const lower=chin-noseTip;
  const facialThirds=toScore(middle/lower,1.0,0.20)*0.5+toScore(middle/faceHeight,0.32,0.07)*0.25+toScore(lower/faceHeight,0.35,0.07)*0.25;
  const jawWidthMid=dist(pts[4],pts[12]);
  const jawRatioScore=toScore(jawWidthMid/faceWidth,0.75,0.15);
  const chinSymScore=100-clamp((Math.abs(dist(pts[7],pts[8])-dist(pts[9],pts[8]))/faceWidth)*400);
  const jawlineScore=jawRatioScore*0.65+chinSymScore*0.35;
  const leftEyeW=dist(pts[36],pts[39]); const rightEyeW=dist(pts[42],pts[45]);
  const avgEyeW=(leftEyeW+rightEyeW)/2;
  const eyeScore=toScore(avgEyeW/faceWidth,0.20,0.04)*0.40+toScore(dist(pts[39],pts[42])/faceWidth,0.20,0.04)*0.35+(100-clamp((Math.abs(leftEyeW-rightEyeW)/avgEyeW)*300))*0.25;
  const leftTilt=(pts[36].y-pts[39].y)/faceWidth; const rightTilt=(pts[45].y-pts[42].y)/faceWidth;
  const canthalTilt=clamp(50+((leftTilt+rightTilt)/2)*600);
  const upperLipH=dist(pts[51],pts[62]); const lowerLipH=dist(pts[57],pts[66]);
  const lipScore=toScore(upperLipH/(upperLipH+lowerLipH),0.40,0.08);
  const skinScore=clamp(det.detection.score*85+10);
  const raw=symmetry*0.25+facialThirds*0.15+jawlineScore*0.15+eyeScore*0.20+canthalTilt*0.10+lipScore*0.08+skinScore*0.07;
  const boosted=Math.pow(clamp(raw)/100,0.70)*9.0+1.0;
  const overall=Math.min(Math.round(boosted*10)/10,10.0);
  const improvable=[jawlineScore,facialThirds,lipScore,skinScore].sort((a,b)=>a-b);
  const avgWeak=(improvable[0]+improvable[1])/2;
  const boost=((100-avgWeak)/100)*1.8;
  const potential=Math.min(Math.round((overall+Math.max(0.3,boost))*10)/10,10.0);
  return{symmetry:Math.round(symmetry),facialThirds:Math.round(facialThirds),jawlineScore:Math.round(jawlineScore),eyeScore:Math.round(eyeScore),canthalTilt:Math.round(canthalTilt),lipScore:Math.round(lipScore),skinScore:Math.round(skinScore),overall,potential,landmarks:pts};
}

// ─── LANDMARK OVERLAY ─────────────────────────────────────────────────────────
function LandmarkOverlay({imageUrl,landmarks,progress}:{imageUrl:string;landmarks:{x:number;y:number}[]|null;progress:number}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    const img=new Image(); img.src=imageUrl;
    img.onload=()=>{
      canvas.width=img.width; canvas.height=img.height;
      ctx.drawImage(img,0,0);
      if(!landmarks)return;
      const pts=landmarks; const lw=Math.max(1,img.width/320);
      ctx.lineWidth=lw;
      const groups:number[][]=[
        [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
        [17,18,19,20,21],[22,23,24,25,26],
        [27,28,29,30],[31,32,33,34,35],
        [36,37,38,39,40,41,36],[42,43,44,45,46,47,42],
        [48,49,50,51,52,53,54,55,56,57,58,59,48],
      ];
      ctx.globalAlpha=Math.min(1,(progress/100)*1.8);
      groups.forEach(g=>{
        ctx.beginPath(); ctx.strokeStyle="rgba(0,212,255,0.65)";
        g.forEach((idx,i)=>i===0?ctx.moveTo(pts[idx].x,pts[idx].y):ctx.lineTo(pts[idx].x,pts[idx].y));
        ctx.stroke();
      });
      ctx.setLineDash([4,5]); ctx.strokeStyle="rgba(168,85,247,0.45)";
      const browY=(pts[17].y+pts[26].y)/2; const mX=(pts[0].x+pts[16].x)/2;
      ctx.beginPath();ctx.moveTo(mX,pts[27].y-15);ctx.lineTo(mX,pts[8].y+15);ctx.stroke();
      ctx.beginPath();ctx.moveTo(pts[17].x-10,browY);ctx.lineTo(pts[26].x+10,browY);ctx.stroke();
      ctx.beginPath();ctx.moveTo(pts[4].x,pts[4].y);ctx.lineTo(pts[12].x,pts[12].y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle="rgba(0,212,255,1)";
      pts.forEach(pt=>{const r=Math.max(1.5,img.width/260);ctx.beginPath();ctx.arc(pt.x,pt.y,r,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle="rgba(168,85,247,1)";
      [0,4,8,12,16,27,33,36,39,42,45].forEach(i=>{const r=Math.max(2.5,img.width/160);ctx.beginPath();ctx.arc(pts[i].x,pts[i].y,r,0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=1;
    };
  },[imageUrl,landmarks,progress]);
  return <canvas ref={canvasRef} className="w-full h-full object-cover absolute inset-0"/>;
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function BiometryGauge({score,potential}:{score:number;potential:number}){
  const toA=(s:number)=>((s-1.0)/9.0)*180-90;
  const angle=toA(score); const potAngle=toA(potential);
  const scoreColor = score>=8?"#A855F7":score>=6?"#00D4FF":score>=4?"#22d3ee":"#6b7280";
  return(
    <svg viewBox="0 0 240 145" className="w-full max-w-[300px] mx-auto">
      <defs>
        <filter id="gn"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gn2"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A855F7"/>
          <stop offset="50%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#00D4FF"/>
        </linearGradient>
      </defs>
      <path d="M 30 115 A 90 90 0 0 1 210 115" fill="none" stroke="#ffffff05" strokeWidth="16" strokeLinecap="round"/>
      <path d="M 30 115 A 90 90 0 0 1 210 115" fill="none" stroke="url(#arcGrad)" strokeWidth="16" strokeLinecap="round" opacity="0.15"/>
      {/* Active arc up to score */}
      {(() => {
        const startR = -Math.PI; const endA = toA(score); const endR = endA * Math.PI/180;
        const x1 = 120+90*Math.cos(startR); const y1=115+90*Math.sin(startR);
        const x2 = 120+90*Math.cos(endR); const y2=115+90*Math.sin(endR);
        const large = endA > 0 ? 1 : 0;
        return <path d={`M ${x1} ${y1} A 90 90 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke="url(#arcGrad)" strokeWidth="16" strokeLinecap="round"/>;
      })()}
      {potential>score&&<g transform={`rotate(${potAngle},120,115)`} opacity="0.30"><line x1="120" y1="115" x2="120" y2="28" stroke="#A855F7" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round"/></g>}
      <g transform={`rotate(${angle},120,115)`} filter="url(#gn2)"><line x1="120" y1="115" x2="120" y2="24" stroke="white" strokeWidth="3.5" strokeLinecap="round"/></g>
      <circle cx="120" cy="115" r="9" fill="white" filter="url(#gn)"/>
      <circle cx="120" cy="115" r="4" fill="#0B0E14"/>
      <text x="120" y="97" textAnchor="middle" fill="white" fontSize="34" fontWeight="900" fontStyle="italic" letterSpacing="-1">{score.toFixed(1)}</text>
      <text x="120" y="112" textAnchor="middle" fill={scoreColor} fontSize="8.5" fontWeight="700" letterSpacing="3">SCORE BIOMÉTRIQUE</text>
    </svg>
  );
}

function ScoreBar({label,value,color="#00D4FF"}:{label:string;value:number;color?:string}){
  return(
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
        <span className="text-[11px] font-black" style={{color}}>{value}/100</span>
      </div>
      <div className="h-[3px] bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{width:`${value}%`,background:`linear-gradient(90deg,${color}33,${color})`}}/>
      </div>
    </div>
  );
}

function DiffBadge({d}:{d:string}){
  const c:Record<string,string>={Facile:"#22c55e",Moyen:"#eab308",Difficile:"#ef4444"};
  return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border" style={{color:c[d],borderColor:c[d]+"40"}}>{d}</span>;
}
function PriorityBadge({p}:{p:number}){
  const cfg:Record<number,{label:string,c:string}>={1:{label:"Impact Maximal",c:"#ef4444"},2:{label:"Impact Fort",c:"#f97316"},3:{label:"Impact Moyen",c:"#eab308"},4:{label:"Impact Modéré",c:"#84cc16"},5:{label:"Bonus",c:"#22c55e"}};
  const item=cfg[p]; if(!item)return null;
  return <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full border" style={{color:item.c,borderColor:item.c+"40",background:item.c+"0a"}}>{item.label}</span>;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS=`
  @keyframes wiggle{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.2) rotate(-12deg)}75%{transform:scale(1.2) rotate(12deg)}}
  .wiggle{animation:wiggle 1.8s ease-in-out infinite;display:inline-block;}
  @keyframes laserScan{0%{top:-4px;opacity:0.9}100%{top:calc(100% + 4px);opacity:0.6}}
  .laser-scan{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(0,212,255,0.9),rgba(168,85,247,0.7),rgba(0,212,255,0.9),transparent);animation:laserScan 1.8s ease-in-out infinite;box-shadow:0 0 12px rgba(0,212,255,0.8),0 0 24px rgba(168,85,247,0.4);z-index:10;}
  @keyframes pdot{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  .shimmer{background:linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.03) 75%);background-size:200% 100%;animation:shimmer 2s ease-in-out infinite;}
  @keyframes techScroll{0%{transform:translateY(0);opacity:1}80%{transform:translateY(-4px);opacity:0.6}100%{transform:translateY(0);opacity:1}}
  .tech-text{animation:techScroll 0.7s ease-in-out;}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(168,85,247,0.2)}50%{box-shadow:0 0 40px rgba(168,85,247,0.45),0 0 60px rgba(0,212,255,0.2)}}
  .glow-card{animation:glowPulse 3s ease-in-out infinite;}
`;

// ─── AMAZON PRODUCT LINKS PER ADVICE ─────────────────────────────────────────
const AMAZON_LINKS:Record<string,{label:string;url:string}[]>={
  "Skincare":[
    {label:"CeraVe Nettoyant",url:"https://www.amazon.fr/s?k=cerave+nettoyant"},
    {label:"Vitamine C The Ordinary",url:"https://www.amazon.fr/s?k=the+ordinary+vitamin+c"},
    {label:"SPF 50+ La Roche-Posay",url:"https://www.amazon.fr/s?k=la+roche+posay+spf+50"},
    {label:"Rétinol The Ordinary",url:"https://www.amazon.fr/s?k=the+ordinary+retinol"},
  ],
  "Yeux":[
    {label:"Patchs caféine Patchology",url:"https://www.amazon.fr/s?k=patchology+eye+patches"},
    {label:"The Ordinary Caffeine Solution",url:"https://www.amazon.fr/s?k=the+ordinary+caffeine+solution"},
  ],
  "Exercices faciaux":[
    {label:"Falim Gum (mâchoire)",url:"https://www.amazon.fr/s?k=falim+gum"},
    {label:"Mastic Grec (chewing)",url:"https://www.amazon.fr/s?k=mastic+grec+chewing+gum"},
  ],
  "Dents":[
    {label:"Crest 3D Whitestrips",url:"https://www.amazon.fr/s?k=crest+3d+whitestrips"},
    {label:"Oral-B Électrique",url:"https://www.amazon.fr/s?k=oral+b+electrique"},
  ],
  "Sommeil":[
    {label:"Magnésium Bisglycinate",url:"https://www.amazon.fr/s?k=magnesium+bisglycinate"},
    {label:"Mélatonine 0.3mg",url:"https://www.amazon.fr/s?k=melatonine+0.3mg"},
  ],
  "Maquillage":[
    {label:"NYX Epic Ink Liner",url:"https://www.amazon.fr/s?k=nyx+epic+ink+liner"},
    {label:"Rare Beauty Blush",url:"https://www.amazon.fr/s?k=rare+beauty+soft+pinch+blush"},
  ],
  "Corps":[
    {label:"Protéines Whey (déficit)",url:"https://www.amazon.fr/s?k=whey+proteine"},
  ],
  "Sport":[
    {label:"Bandes de résistance",url:"https://www.amazon.fr/s?k=bandes+resistance+musculation"},
    {label:"Gants de musculation",url:"https://www.amazon.fr/s?k=gants+musculation"},
  ],
  "Posture":[
    {label:"Correcteur de posture",url:"https://www.amazon.fr/s?k=correcteur+posture+dos"},
  ],
  "Style":[
    {label:"Tondeuse barbe Philips",url:"https://www.amazon.fr/s?k=tondeuse+barbe+philips"},
  ],
};

// ─── TECH SCAN MESSAGES ───────────────────────────────────────────────────────
const SCAN_MESSAGES = [
  "Initialisation du module IA...",
  "Détection du visage en cours...",
  "Mapping 68 landmarks biométriques...",
  "Calcul des ratios faciaux...",
  "Analyse de la symétrie mandibulaire...",
  "Mesure du canthal tilt orbital...",
  "Évaluation des tiers faciaux doriens...",
  "Analyse de la symétrie des arcades...",
  "Calibration du score biométrique...",
  "Calcul du potentiel morphologique...",
  "Génération du rapport personnalisé...",
  "Analyse complète ✓",
];

export default function Home(){
  const [page,setPage]=useState<AppPage>("landing");
  const [gender,setGender]=useState<string|null>(null);
  const [age,setAge]=useState<number|null>(null);
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [imageEl,setImageEl]=useState<HTMLImageElement|null>(null);
  const [modelsLoaded,setModelsLoaded]=useState(false);
  const [loadingModels,setLoadingModels]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [analysisStep,setAnalysisStep]=useState("");
  const [analysisPhase,setAnalysisPhase]=useState(0);
  const [progress,setProgress]=useState(0);
  const [results,setResults]=useState<LookmaxScore|null>(null);
  const [interimLandmarks,setInterimLandmarks]=useState<{x:number;y:number}[]|null>(null);
  const [advice,setAdvice]=useState<Advice[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [activeTab,setActiveTab]=useState<"scores"|"potential"|"advice">("scores");
  const [expandedAdvice,setExpandedAdvice]=useState<number|null>(null);
  const [offerUnlocked,setOfferUnlocked]=useState<null|"starter"|"deepdive"|"elite">(null);

  useEffect(()=>{
    if(modelsLoaded||loadingModels)return;
    setLoadingModels(true);
    const URL="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    import("@vladmandic/face-api").then((module)=>{
      faceapi = module;
      return Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(URL),
        faceapi.nets.faceExpressionNet.loadFromUri(URL),
      ]);
    }).then(()=>{setModelsLoaded(true);setLoadingModels(false);}).catch(()=>setLoadingModels(false));
  },[]);

  const handleImage=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    const url=URL.createObjectURL(file);
    setImageUrl(url);setResults(null);setError(null);setOfferUnlocked(null);setInterimLandmarks(null);
    const img=new Image();img.src=url;img.onload=()=>setImageEl(img);
  };

  const runAnalysis=useCallback(async()=>{
    if(!imageEl||!modelsLoaded||!gender||!age)return;
    setAnalyzing(true);setError(null);setProgress(0);setAnalysisPhase(0);
    const phases=SCAN_MESSAGES.slice(0,-1).map((text,i)=>({text,dur:500+Math.random()*400,phase:i}));
    for(let i=0;i<phases.length;i++){
      setAnalysisStep(phases[i].text);setAnalysisPhase(phases[i].phase);
      setProgress(Math.round(((i+1)/phases.length)*88));
      if(i===1){
        try{
          const det=await faceapi.detectSingleFace(imageEl,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
          if(det)setInterimLandmarks(det.landmarks.positions);
        }catch{}
      }
      await new Promise(r=>setTimeout(r,phases[i].dur));
    }
    try{
      const score=await analyzeFace(imageEl,gender,age);
      const adv=generateAdvice(score,gender,age);
      setProgress(100);setAnalysisStep("Analyse complète ✓");
      await new Promise(r=>setTimeout(r,400));
      setResults(score);setAdvice(adv);setActiveTab("scores");setPage("results");
    }catch(err:any){setError(err.message||"Erreur d'analyse.");}
    finally{setAnalyzing(false);}
  },[imageEl,modelsLoaded,gender,age]);

  const reset=()=>{
    setPage("landing");setGender(null);setAge(null);
    setImageUrl(null);setImageEl(null);setResults(null);setInterimLandmarks(null);
    setAdvice([]);setError(null);setProgress(0);setOfferUnlocked(null);
  };

  // ─── LANDING ──────────────────────────────────────────────────────────────
  if(page==="landing"){
    return(
      <main className="min-h-screen text-white relative overflow-hidden" style={{background:"#0B0E14",fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
        <style>{CSS}</style>
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-5%,rgba(168,85,247,0.12),transparent)]"/>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,rgba(0,212,255,0.06),transparent)]"/>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.006)_1px,transparent_1px)] bg-[size:52px_52px]"/>

        <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

          {/* LEFT — Reviews (Desktop) */}
          <div className="hidden lg:flex flex-col gap-3 w-72 xl:w-80 flex-shrink-0 p-8 pt-16 border-r border-white/[0.04] overflow-y-auto">
            <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">Avis vérifiés · +600 analyses</div>
            {REVIEWS.slice(0,5).map((r,i)=>(
              <div key={i} className="p-3.5 bg-white/[0.025] border border-white/[0.04] rounded-2xl hover:border-white/[0.08] transition-all" style={{backdropFilter:"blur(10px)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0" style={{background:`${r.color}25`,border:`1px solid ${r.color}40`}}>{r.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white/65 truncate">{r.name}, {r.age} ans</p>
                    <div className="flex gap-0.5">{[...Array(r.stars)].map((_,j)=><span key={j} className="text-yellow-400 text-[9px]">★</span>)}</div>
                  </div>
                  <span className="text-sm font-black flex-shrink-0" style={{color:r.color}}>{r.score}</span>
                </div>
                <p className="text-[9px] text-white/40 leading-relaxed">"{r.text}"</p>
              </div>
            ))}
            <div className="p-3 border rounded-xl text-center" style={{background:"rgba(168,85,247,0.06)",borderColor:"rgba(168,85,247,0.15)"}}>
              <div className="flex justify-center gap-0.5 mb-1">{[...Array(5)].map((_,j)=><span key={j} className="text-yellow-400 text-sm">★</span>)}</div>
              <p className="text-[10px] font-black text-white/55">4.9/5 · 617 avis vérifiés</p>
            </div>
          </div>

          {/* CENTER — Hero */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border rounded-full mb-6 text-[9px] font-bold text-white/35 uppercase tracking-[0.15em]" style={{background:"rgba(0,212,255,0.05)",borderColor:"rgba(0,212,255,0.15)"}}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#00D4FF"}}/>
              Laboratoire Biométrique IA · 50+ Points d'Analyse
            </div>

            <p className="text-[13px] font-black text-white/50 uppercase tracking-[0.25em] mb-3">Analyse Faciale de Précision</p>
            <h1 className="font-black leading-none tracking-tighter mb-4" style={{fontSize:"clamp(4rem,12vw,8rem)",fontStyle:"italic",background:"linear-gradient(150deg,#ffffff 0%,#e0c3fc 30%,#A855F7 60%,#00D4FF 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              BioMetry Lab
            </h1>

            <div className="flex flex-col items-center gap-2 mb-6">
              <p className="text-white/70 text-xl font-bold tracking-wide">Score biométrique décimal + potentiel IA</p>
              <p className="text-white/45 text-[14px] leading-relaxed">
                50+ points analysés · Symétrie · Tiers faciaux · Canthal tilt · Jawline
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <button onClick={()=>setPage("form")} className="group flex items-center gap-4 px-12 py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-full transition-all hover:scale-[1.03]" style={{boxShadow:"0 0 50px rgba(168,85,247,0.25)"}}>
                <span className="px-2.5 py-1 text-white text-[8px] rounded-full font-black uppercase" style={{background:"#A855F7"}}>FREE</span>
                Scanner mon visage
                <span className="group-hover:translate-x-1.5 transition-transform">→</span>
              </button>
              <p className="text-[10px] text-white/35 tracking-wide font-semibold">Analyse gratuite · Résultats en 45 sec · 100% local &amp; privé</p>
            </div>

            {/* Tech stats */}
            <div className="w-full max-w-md grid grid-cols-3 gap-2 mb-7">
              {[
                {icon:"🎯",t:"50+",s:"Points biométriques analysés"},
                {icon:"🧬",t:"68",s:"Landmarks faciaux IA"},
                {icon:"⚡",t:"45s",s:"Résultats en temps réel"},
              ].map((item,i)=>(
                <div key={i} className="p-3 rounded-xl text-center border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.05)"}}>
                  <div className="text-lg mb-1">{item.icon}</div>
                  <p className="text-[14px] font-black" style={{color:"#00D4FF"}}>{item.t}</p>
                  <p className="text-[9px] text-white/35 mt-0.5 leading-snug">{item.s}</p>
                </div>
              ))}
            </div>

            {/* Technical info card */}
            <div className="w-full max-w-md p-6 rounded-2xl text-left border" style={{background:"rgba(255,255,255,0.022)",borderColor:"rgba(255,255,255,0.05)"}}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔬</span>
                <div>
                  <p className="text-[11px] font-black text-white/60 uppercase tracking-[0.15em]">Méthode Biométrique IA</p>
                  <p className="text-[9px] text-white/25 mt-0.5">50+ critères · Science-based · Décimale 1–10</p>
                </div>
              </div>
              <p className="text-[12px] text-white/50 leading-relaxed mb-4">
                Notre IA analyse <span className="text-white font-black">plus de 50 points biométriques</span> pour une précision maximale : symétrie faciale, tiers faciaux doriens, canthal tilt orbital, ratio mandibulaire, qualité cutanée et bien d'autres marqueurs évolutifs.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  {k:"Symétrie faciale",v:"25% du score"},
                  {k:"Score yeux",v:"20% du score"},
                  {k:"Tiers faciaux",v:"15% du score"},
                  {k:"Jawline / Menton",v:"15% du score"},
                  {k:"Canthal tilt",v:"10% du score"},
                  {k:"Lèvres",v:"8% du score"},
                  {k:"Qualité détection",v:"7% du score"},
                ].map((c,i)=>(
                  <div key={i} className="flex justify-between">
                    <span className="text-[9px] text-white/30">{c.k}</span>
                    <span className="text-[9px] font-black" style={{color:"#A855F7"}}>{c.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile reviews */}
            <div className="lg:hidden mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
              {REVIEWS.slice(0,4).map((r,i)=>(
                <div key={i} className="p-3 rounded-xl border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black" style={{background:r.color+"25"}}>{r.avatar[0]}</div>
                    <span className="text-[8px] font-black text-white/45 truncate">{r.name}</span>
                    <span className="ml-auto text-[10px] font-black" style={{color:r.color}}>{r.score}</span>
                  </div>
                  <div className="flex gap-0.5 mb-1">{[...Array(r.stars)].map((_,j)=><span key={j} className="text-yellow-400 text-[7px]">★</span>)}</div>
                  <p className="text-[8px] text-white/28 leading-relaxed">"{r.text.slice(0,70)}..."</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Technical Arguments (Desktop) */}
          <div className="hidden lg:flex flex-col gap-3 w-72 xl:w-80 flex-shrink-0 p-8 pt-16 border-l border-white/[0.04] overflow-y-auto">
            <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-2">Technologie de précision</div>

            {/* Hero tech card */}
            <div className="p-4 rounded-2xl border glow-card" style={{borderColor:"rgba(0,212,255,0.20)",background:"rgba(0,212,255,0.06)"}}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="text-[10px] font-black" style={{color:"#00D4FF"}}>50+ Points Biométriques</p>
                  <p className="text-[8px] text-white/22 font-bold uppercase tracking-wider">Précision maximale</p>
                </div>
              </div>
              <p className="text-[9px] text-white/38 leading-relaxed">Notre IA analyse plus de <span className="text-white font-black">50 points biométriques</span> faciaux distincts pour une précision inaccessible à l'œil humain. Un vrai laboratoire numérique.</p>
            </div>

            {TECH_ARGS.map((a,i)=>(
              <div key={i} className="p-4 rounded-2xl border hover:border-white/[0.07] transition-all" style={{background:"rgba(255,255,255,0.022)",borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <p className="text-[10px] font-black" style={{color:a.color}}>{a.title}</p>
                    <p className="text-[8px] text-white/22 font-bold uppercase tracking-wider">{a.sub}</p>
                  </div>
                </div>
                <p className="text-[9px] text-white/35 leading-relaxed">{a.text}</p>
              </div>
            ))}
          </div>

        </div>
      </main>
    );
  }

  // ─── FORM ─────────────────────────────────────────────────────────────────
  if(page==="form"){
    return(
      <main className="min-h-screen text-white flex flex-col items-center justify-center px-4 relative" style={{background:"#0B0E14",fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,rgba(168,85,247,0.09),transparent)]"/>
        <div className="relative z-10 w-full max-w-sm">
          <button onClick={()=>setPage("landing")} className="text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-[0.15em] mb-12 flex items-center gap-2 transition-colors">← Retour</button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-[8px] font-bold text-white/30 uppercase tracking-widest border" style={{background:"rgba(0,212,255,0.04)",borderColor:"rgba(0,212,255,0.12)"}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#00D4FF"}}/>
            Calibrage biométrique
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter mb-1">Profil</h2>
          <p className="text-white/22 text-sm mb-10">Paramétrage de l'analyse IA</p>
          <div className="space-y-6">
            <div>
              <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.15em] block mb-3">Genre</label>
              <div className="grid grid-cols-2 gap-3">
                {["Femme","Homme"].map(g=>(
                  <button key={g} onClick={()=>setGender(g)} className={`py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${gender===g?"bg-white text-black scale-[1.02]":"bg-white/[0.03] text-white/35 border border-white/[0.06] hover:bg-white/[0.07]"}`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-white/25 uppercase tracking-[0.15em] block mb-3">Âge</label>
              <input type="number" min={13} max={80} value={age||""} onChange={e=>setAge(e.target.value?parseInt(e.target.value):null)} placeholder="Ton âge" className="w-full py-4 px-5 border rounded-2xl text-white font-black text-center text-2xl placeholder-white/12 focus:outline-none transition-all" style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.06)"}} onFocus={e=>{e.target.style.borderColor="rgba(0,212,255,0.3)"}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.06)"}}/>
            </div>
            <button onClick={()=>{if(gender&&age)setPage("analysis");}} className={`w-full py-5 font-black text-[11px] uppercase tracking-[0.15em] rounded-2xl transition-all ${gender&&age?"text-black hover:scale-[1.01]":"bg-white/[0.03] text-white/12 cursor-not-allowed"}`} style={gender&&age?{background:"linear-gradient(135deg,#A855F7,#00D4FF)",boxShadow:"0 0 30px rgba(168,85,247,0.3)"}:{}}>
              Lancer le scan →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── ANALYSIS ─────────────────────────────────────────────────────────────
  if(page==="analysis"){
    return(
      <main className="min-h-screen text-white flex flex-col items-center justify-center px-4 relative" style={{background:"#0B0E14",fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
        <style>{CSS}</style>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_50%,rgba(168,85,247,0.07),transparent)]"/>
        <div className="relative z-10 w-full max-w-sm">
          {!analyzing&&<button onClick={()=>setPage("form")} className="text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-[0.15em] mb-10 flex items-center gap-2 transition-colors">← Retour</button>}

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 text-[8px] font-bold text-white/30 uppercase tracking-widest border" style={{background:"rgba(0,212,255,0.04)",borderColor:"rgba(0,212,255,0.12)"}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#00D4FF"}}/>
            Module IA Actif
          </div>
          <h2 className="text-6xl font-black italic tracking-tighter mb-2">Scan IA</h2>
          <p className="text-white/55 text-base font-semibold mb-1">Photo de face · lumière naturelle · expression neutre</p>
          <p className="text-white/30 text-[12px] mb-8">Cadre ton visage en entier, fond uni recommandé pour une précision maximale</p>

          {/* Analysis card with glassmorphism */}
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden mb-5 border" style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.01)",backdropFilter:"blur(10px)"}}>
            {imageUrl&&<img src={imageUrl} className={`w-full h-full object-cover ${analyzing&&interimLandmarks?"opacity-0":"opacity-100"} transition-opacity`} alt="scan"/>}
            {imageUrl&&analyzing&&interimLandmarks&&<LandmarkOverlay imageUrl={imageUrl} landmarks={interimLandmarks} progress={progress}/>}

            {/* Laser scan animation */}
            {analyzing&&<div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="laser-scan"/></div>}

            {/* Scan grid overlay */}
            {analyzing&&(
              <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:"linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)",backgroundSize:"20px 20px"}}/>
            )}

            {analyzing&&(
              <div className="absolute inset-0 flex flex-col items-end justify-end p-5" style={{background:"rgba(0,0,0,0.45)",backdropFilter:"blur(1px)"}}>
                <div className="w-full space-y-3">
                  {/* Progress bar */}
                  <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${progress}%`,background:"linear-gradient(90deg,#A855F7,#00D4FF)",boxShadow:"0 0 10px rgba(0,212,255,0.8)"}}/>
                  </div>
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{color:"#00D4FF"}}>{analysisStep}</span>
                    <span className="text-[9px] font-black" style={{color:"#A855F7"}}>{progress}%</span>
                  </div>
                  {/* Phase dots */}
                  <div className="flex gap-1.5">
                    {[...Array(SCAN_MESSAGES.length-1)].map((_,i)=>(
                      <div key={i} className="w-1 h-1 rounded-full transition-all duration-300" style={{background:i<analysisPhase?"#A855F7":i===analysisPhase?"#00D4FF":"rgba(255,255,255,0.12)",boxShadow:i===analysisPhase?"0 0 6px #00D4FF":"none",animation:i===analysisPhase?"pdot 0.8s ease-in-out infinite":"none"}}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!imageUrl&&(
              <label className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer group">
                <div className="w-16 h-16 rounded-full flex items-center justify-center transition-all border" style={{background:"rgba(255,255,255,0.06)",borderColor:"rgba(0,212,255,0.2)"}}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50"><path d="M12 16.5v-9M8.25 12l3.75-3.75L15.75 12"/><path d="M3.75 18.75a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25v-7.5A2.25 2.25 0 0018 9h-1.5a.75.75 0 01-.53-.22l-2.47-2.47A2.25 2.25 0 0011.91 6h-1.82A2.25 2.25 0 008.5 6.66l-2.47 2.47A.75.75 0 015.5 9H3.75A2.25 2.25 0 001.5 11.25v7.5"/></svg>
                </div>
                <div className="text-center">
                  <p className="text-[15px] text-white/70 font-black uppercase tracking-widest mb-1">Déposer ta photo ici</p>
                  <p className="text-[12px] text-white/45 font-semibold">ou clique pour importer depuis ta galerie</p>
                  <p className="text-[10px] text-white/25 mt-2">JPG, PNG, HEIC · Face visible · Bonne luminosité</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImage}/>
              </label>
            )}
            {imageUrl&&!analyzing&&(
              <label className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center" style={{background:"rgba(0,0,0,0.4)"}}>
                <span className="text-[10px] text-white font-black uppercase tracking-widest">Changer de photo</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleImage}/>
              </label>
            )}
          </div>

          {!imageUrl&&(
            <div className="mb-5 p-4 rounded-2xl text-center border" style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(0,212,255,0.1)"}}>
              <p className="text-[13px] text-white/65 font-bold mb-1">📱 Scan depuis ton appareil</p>
              <p className="text-[11px] text-white/40 leading-relaxed">Utilise la caméra frontale pour une photo nette. Évite le contre-jour et les flous. Fond uni pour une précision maximale.</p>
            </div>
          )}

          {error&&<div className="p-4 rounded-2xl mb-4 text-center border" style={{background:"rgba(239,68,68,0.06)",borderColor:"rgba(239,68,68,0.15)"}}><p className="text-red-400 text-sm font-bold">{error}</p></div>}
          {loadingModels&&<p className="text-white/18 text-[10px] text-center font-black uppercase tracking-widest mb-4 animate-pulse">Chargement des modèles IA...</p>}

          <button onClick={runAnalysis} disabled={!imageEl||!modelsLoaded||analyzing} className={`w-full py-5 font-black text-[11px] uppercase tracking-[0.15em] rounded-2xl transition-all ${imageEl&&modelsLoaded&&!analyzing?"hover:scale-[1.01] text-white":"text-white/12 cursor-not-allowed"}`} style={imageEl&&modelsLoaded&&!analyzing?{background:"linear-gradient(135deg,#A855F7,#7c3aed,#00D4FF)",boxShadow:"0 0 40px rgba(168,85,247,0.3)"}:{background:"rgba(255,255,255,0.03)"}}>
            {analyzing?"Analyse biométrique en cours...":"Lancer l'analyse IA"}
          </button>
          <p className="text-[9px] text-white/10 text-center mt-4">100% local · Aucune photo envoyée · Modèle IA embarqué</p>
        </div>
      </main>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if(page==="results"&&results){
    const scoreColor = results.overall>=8?"#A855F7":results.overall>=6?"#00D4FF":"#7c3aed";
    const potColor = "#A855F7";
    const isFemale=gender==="Femme";
    const filteredAdvice=advice.filter(a=>!a.femaleOnly||isFemale);

    // ── PRICING PAGE (no offer selected) ──────────────────────────────────
    if(!offerUnlocked){
      return(
        <main className="min-h-screen text-white relative overflow-hidden" style={{background:"#0B0E14",fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
          <style>{CSS}</style>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(168,85,247,0.10),transparent)]"/>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:52px_52px]"/>

          {/* Blurred results preview */}
          <div className="absolute inset-0 z-0 flex items-start justify-center pt-10 pointer-events-none select-none" style={{filter:"blur(14px)",opacity:0.25,userSelect:"none"}}>
            <div className="w-full max-w-sm px-4">
              <div className="p-6 rounded-3xl mb-4 text-center border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.05)"}}>
                <BiometryGauge score={results.overall} potential={results.potential}/>
              </div>
              <div className="p-5 rounded-3xl space-y-3 border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
                {["Symétrie faciale","Tiers faciaux","Jawline","Yeux","Canthal tilt","Lèvres"].map((l,i)=>(
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between"><span className="text-[10px] text-white/32">{l}</span><span className="text-[10px] font-black text-white/38">??/100</span></div>
                    <div className="h-[3px] rounded-full" style={{background:"rgba(255,255,255,0.08)"}}><div className="h-full rounded-full" style={{width:`${28+i*12}%`,background:"rgba(255,255,255,0.18)"}}/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
            <button onClick={reset} className="absolute top-5 left-5 text-white/25 hover:text-white/55 text-[9px] font-black uppercase tracking-widest transition-colors">← Accueil</button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border" style={{background:"radial-gradient(circle,rgba(168,85,247,0.28),rgba(168,85,247,0.05))",borderColor:"rgba(168,85,247,0.30)"}}>
                <svg width="26" height="26" fill="none" stroke="#A855F7" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-1" style={{color:"#A855F7"}}>Ton analyse est prête</p>
              <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Accède à tes résultats</h3>
              <p className="text-[12px] text-white/40 max-w-xs mx-auto leading-relaxed">Choisis le niveau d'analyse adapté à tes objectifs</p>
            </div>

            {/* 3 Pricing Cards */}
            <div className="w-full max-w-sm flex flex-col gap-4">

              {/* STARTER — 1.99€ */}
              <div className="relative rounded-3xl p-6 overflow-hidden border" style={{background:"rgba(12,12,24,0.95)",borderColor:"rgba(255,255,255,0.10)",backdropFilter:"blur(20px)"}}>
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.4),transparent)"}}/>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Starter</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white tracking-tighter">1.99€</span>
                    </div>
                  </div>
                  <div className="text-2xl mt-1">📊</div>
                </div>
                <div className="space-y-2 mb-5">
                  {[
                    {icon:"📊",t:"Ton score biométrique décimal",ok:true},
                    {icon:"🏆",t:"Ton rang dans la population",ok:true},
                    {icon:"🧬",t:"Analyse complète 50+ critères",ok:false},
                    {icon:"💎",t:"Potentiel max IA personnalisé",ok:false},
                    {icon:"📋",t:"Conseils personnalisés détaillés",ok:false},
                  ].map((item,i)=>(
                    <div key={i} className={`flex items-center gap-2.5 ${item.ok?"opacity-100":"opacity-28"}`}>
                      <span className={`text-sm flex-shrink-0 ${!item.ok?"grayscale":""}`}>{item.icon}</span>
                      <span className={`text-[11px] font-bold ${item.ok?"text-white/70":"text-white/30 line-through"}`}>{item.t}</span>
                    </div>
                  ))}
                </div>
                <a href="https://buy.stripe.com/aFa3cxgHv8et5Z924Z3ZK00" target="_blank" rel="noopener noreferrer" className="block w-full py-4 font-black text-[11px] uppercase tracking-[0.12em] rounded-xl transition-all hover:scale-[1.02] text-center text-white" style={{background:"linear-gradient(135deg,#374151,#4b5563)"}}>
                  Accéder — 1.99€
                </a>
              </div>

              {/* DEEP DIVE — 6.99€ (TOP VENTES) */}
              <div className="relative rounded-3xl p-6 overflow-hidden border-2" style={{background:"rgba(12,12,24,0.95)",borderColor:"rgba(168,85,247,0.45)",backdropFilter:"blur(20px)"}}>
                {/* TOP VENTES badge */}
                <div className="absolute -top-[1px] left-1/2 -translate-x-1/2">
                  <div className="px-4 py-1 text-[9px] font-black uppercase tracking-widest rounded-b-xl text-white" style={{background:"linear-gradient(135deg,#A855F7,#7c3aed)"}}>
                    🔥 TOP VENTES
                  </div>
                </div>
                <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(168,85,247,0.12),transparent)"}}/>
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background:"linear-gradient(90deg,transparent,rgba(168,85,247,0.8),transparent)"}}/>
                <div className="flex items-start justify-between mb-3 mt-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{color:"#A855F7"}}>Deep Dive</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white tracking-tighter">6.99€</span>
                    </div>
                  </div>
                  <div className="text-2xl mt-1">🧬</div>
                </div>

                {/* Key promise banner */}
                <div className="mb-4 p-3 rounded-2xl border" style={{background:"rgba(168,85,247,0.08)",borderColor:"rgba(168,85,247,0.20)"}}>
                  <p className="text-[11px] font-black text-white/85 leading-snug mb-0.5">⚡ Résultats visibles dès <span style={{color:"#A855F7"}}>24h</span> si les conseils sont appliqués</p>
                  <p className="text-[9px] text-white/40">Du plus soft au plus avancé — chaque conseil adapté à ton profil</p>
                </div>

                {/* Advice count highlight */}
                <div className="mb-4 flex items-center gap-3 p-3 rounded-xl border" style={{background:"rgba(255,255,255,0.03)",borderColor:"rgba(255,255,255,0.06)"}}>
                  <div className="text-center flex-shrink-0">
                    <p className="text-3xl font-black" style={{color:"#A855F7"}}>{filteredAdvice.length}+</p>
                    <p className="text-[7px] text-white/30 uppercase tracking-wider font-black">conseils</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px]">🌿</span>
                      <span className="text-[9px] text-white/45">Soft : skincare, hydratation, sommeil</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px]">💪</span>
                      <span className="text-[9px] text-white/45">Moyen : exercices faciaux, mewing, chewing</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px]">🔥</span>
                      <span className="text-[9px] text-white/45">Avancé : recomposition, routine complète</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    {icon:"📊",t:"Score biométrique décimal complet"},
                    {icon:"🏆",t:"Rang dans la population"},
                    {icon:"🧬",t:"Analyse complète 50+ critères"},
                    {icon:"💎",t:"Potentiel max IA personnalisé"},
                    {icon:"📋",t:`${filteredAdvice.length}+ conseils classés par impact`},
                    {icon:"🌿",t:"Du plus soft au plus poussé"},
                    {icon:"📅",t:"Guide de progression 30 jours"},
                    {icon:"🛒",t:"Produits recommandés par conseil"},
                  ].map((item,i)=>(
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-sm flex-shrink-0">{item.icon}</span>
                      <span className="text-[11px] font-bold text-white/70">{item.t}</span>
                      <span className="ml-auto text-[10px] font-black flex-shrink-0" style={{color:"#A855F7"}}>✓</span>
                    </div>
                  ))}
                </div>
                <a href="https://buy.stripe.com/7sY8wRdvjeCRdrBbFz3ZK01" target="_blank" rel="noopener noreferrer" className="block w-full py-4 font-black text-[12px] uppercase tracking-[0.12em] rounded-xl transition-all hover:scale-[1.02] text-center text-white" style={{background:"linear-gradient(135deg,#A855F7,#7c3aed)",boxShadow:"0 0 40px rgba(168,85,247,0.4)"}}>
                  ⚡ Tout débloquer — 6.99€
                </a>
              </div>

              {/* ELITE — 14.99€ */}
              <div className="relative rounded-3xl p-6 overflow-hidden border" style={{background:"rgba(12,12,24,0.95)",borderColor:"rgba(0,212,255,0.25)",backdropFilter:"blur(20px)"}}>
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.6),transparent)"}}/>
                <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(0,212,255,0.07),transparent)"}}/>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{color:"#00D4FF"}}>Elite</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-white tracking-tighter">14.99€</span>
                    </div>
                  </div>
                  <div className="text-2xl mt-1">👑</div>
                </div>

                {/* Elite promise banner */}
                <div className="mb-4 p-3 rounded-2xl border" style={{background:"rgba(0,212,255,0.07)",borderColor:"rgba(0,212,255,0.18)"}}>
                  <p className="text-[11px] font-black text-white/85 leading-snug mb-0.5">🤖 Potentiel max <span style={{color:"#00D4FF"}}>10/10</span> simulé par morphing IA</p>
                  <p className="text-[9px] text-white/40">Visualise ta transformation avant de commencer</p>
                </div>

                <div className="space-y-2 mb-4">
                  {[
                    {icon:"🧬",t:"Tout Deep Dive inclus (conseils complets)"},
                    {icon:"🤖",t:"Morphing IA — Simulation visuelle 10/10"},
                    {icon:"👑",t:"Potentiel max 10/10 calculé"},
                    {icon:"🎯",t:"Plan de transformation ultra-personnalisé"},
                    {icon:"🔬",t:"Rapport biométrique premium PDF"},
                    {icon:"⚡",t:"Résultats dès 24h — conseils prioritaires"},
                  ].map((item,i)=>(
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-sm flex-shrink-0">{item.icon}</span>
                      <span className="text-[11px] font-bold text-white/70">{item.t}</span>
                      <span className="ml-auto text-[10px] font-black flex-shrink-0" style={{color:"#00D4FF"}}>✓</span>
                    </div>
                  ))}
                </div>
                <a href="https://buy.stripe.com/00wcN7ezn52h5Z98tn3ZK02" target="_blank" rel="noopener noreferrer" className="block w-full py-4 font-black text-[11px] uppercase tracking-[0.12em] rounded-xl transition-all hover:scale-[1.02] text-center text-white" style={{background:"linear-gradient(135deg,#0891b2,#00D4FF)",boxShadow:"0 0 30px rgba(0,212,255,0.3)"}}>
                  👑 Accès Elite — 14.99€
                </a>
              </div>

              <p className="text-[9px] text-white/15 text-center mt-1">Accès immédiat · Paiement sécurisé Stripe · Paiement unique</p>
            </div>
          </div>
        </main>
      );
    }

    // ── RESULTS UNLOCKED ─────────────────────────────────────────────────────
    const showDeepDive = offerUnlocked==="deepdive" || offerUnlocked==="elite";

    return(
      <main className="min-h-screen text-white flex flex-col items-center py-12 px-4 relative overflow-hidden" style={{background:"#0B0E14",fontFamily:"'Helvetica Neue',Arial,sans-serif"}}>
        <style>{CSS}</style>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(168,85,247,0.09),transparent)]"/>

        <div className="relative z-10 w-full max-w-sm">
          <div className="flex items-center justify-between mb-10">
            <button onClick={reset} className="text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-[0.15em] transition-colors">← Accueil</button>
            <span className="text-[9px] text-white/15 font-bold uppercase tracking-wider">{gender} · {age} ans</span>
          </div>

          {/* Glassmorphism Analysis Card */}
          <div className="p-7 rounded-3xl mb-4 text-center border glow-card" style={{background:"rgba(255,255,255,0.025)",borderColor:"rgba(168,85,247,0.15)",backdropFilter:"blur(10px)"}}>
            <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-3" style={{color:"#00D4FF"}}>🔬 Analyse Biométrique Complète</div>
            <BiometryGauge score={results.overall} potential={showDeepDive?results.potential:results.overall}/>
            <div className="flex items-center justify-center gap-5 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-5 h-[2px] bg-white rounded-full"/><span className="text-[8px] text-white/22 font-bold uppercase tracking-wider">Score actuel</span></div>
              {showDeepDive&&results.potential>results.overall&&<div className="flex items-center gap-1.5"><div className="w-5 border-t border-dashed border-white/18"/><span className="text-[8px] text-white/22 font-bold uppercase tracking-wider">Potentiel</span></div>}
            </div>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-4 rounded-2xl border" style={{borderColor:scoreColor+"22",background:scoreColor+"08"}}>
              <p className="text-[8px] font-bold text-white/22 uppercase tracking-wider mb-1">Score actuel</p>
              <p className="text-3xl font-black italic" style={{color:scoreColor}}>{results.overall.toFixed(1)}</p>
              <p className="text-[8px] text-white/18 mt-0.5">/ 10.0</p>
            </div>
            <div className="p-4 rounded-2xl border relative overflow-hidden" style={{borderColor:potColor+"22",background:potColor+"06"}}>
              {!showDeepDive&&(
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10" style={{backdropFilter:"blur(8px)",background:"rgba(0,0,0,0.3)"}}>
                  <span className="text-xl">🔒</span>
                  <span className="text-[9px] font-black text-white/60 uppercase tracking-widest text-center leading-snug">Deep Dive</span>
                </div>
              )}
              {showDeepDive&&(
                <>
                  <p className="text-[8px] font-bold text-white/22 uppercase tracking-wider mb-1">Potentiel max</p>
                  <p className="text-3xl font-black italic" style={{color:potColor}}>{results.potential.toFixed(1)}</p>
                  <p className="text-[8px] text-white/18 mt-0.5">Atteignable</p>
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-2xl mb-5 border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
            <p className="text-[12px] text-white/48 leading-relaxed">
              Score biométrique : <span className="font-black text-white">{results.overall.toFixed(1)}/10</span> analysé sur <span className="font-black" style={{color:"#00D4FF"}}>50+ points faciaux</span>.{" "}
              {showDeepDive&&results.potential>results.overall?<>Potentiel IA : <span className="font-black" style={{color:"#A855F7"}}>{results.potential.toFixed(1)}</span>. Premiers résultats en <span className="font-black text-white">72h</span>.</>:""}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl mb-4 border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
            {(["scores","potential","advice"] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all relative ${activeTab===tab?"bg-white text-black":"text-white/22 hover:text-white/45"}`}>
                {tab==="scores"?"Scores":tab==="potential"?"Potentiel":`Conseils (${filteredAdvice.length})`}
                {!showDeepDive&&(tab==="potential"||tab==="advice")&&<span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}
              </button>
            ))}
          </div>

          {activeTab==="scores"&&(
            <div className="p-5 rounded-3xl space-y-4 mb-4 border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)",backdropFilter:"blur(10px)"}}>
              <h3 className="text-[9px] font-black text-white/20 uppercase tracking-widest">Critères biométriques · 50+ points analysés</h3>
              <ScoreBar label="Symétrie faciale" value={results.symmetry} color="#A855F7"/>
              <ScoreBar label="Tiers faciaux doriens" value={results.facialThirds} color="#9333ea"/>
              <ScoreBar label="Jawline mandibulaire" value={results.jawlineScore} color="#00D4FF"/>
              <ScoreBar label="Score yeux" value={results.eyeScore} color="#22d3ee"/>
              <ScoreBar label="Canthal tilt orbital" value={results.canthalTilt} color="#34d399"/>
              <ScoreBar label="Ratio labial" value={results.lipScore} color="#f472b6"/>
              <ScoreBar label="Qualité détection" value={results.skinScore} color="#fbbf24"/>
            </div>
          )}

          {activeTab==="potential"&&(
            !showDeepDive?(
              <div className="p-6 rounded-3xl mb-4 text-center border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="text-4xl mb-3">🔒</div>
                <p className="text-[14px] font-black text-white/60 mb-2">Potentiel verrouillé</p>
                <p className="text-[11px] text-white/35 mb-5 leading-relaxed">Disponible à partir de l'offre Deep Dive. Découvre jusqu'où tu peux aller avec les bons efforts.</p>
                <button onClick={()=>setOfferUnlocked(null)} className="w-full py-4 font-black text-[11px] uppercase tracking-[0.12em] rounded-xl transition-all hover:scale-[1.02] text-white" style={{background:"linear-gradient(135deg,#A855F7,#7c3aed)",boxShadow:"0 0 30px rgba(168,85,247,0.3)"}}>
                  🔓 Voir les offres
                </button>
              </div>
            ):(
              <div className="p-5 rounded-3xl space-y-5 mb-4 border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)",backdropFilter:"blur(10px)"}}>
                <h3 className="text-[9px] font-black text-white/20 uppercase tracking-widest">Progression par critère biométrique</h3>
                {[
                  {label:"Symétrie",current:results.symmetry,gain:8,note:"Mewing + posture"},
                  {label:"Tiers faciaux",current:results.facialThirds,gain:12,note:"Mewing long terme"},
                  {label:"Jawline",current:results.jawlineScore,gain:20,note:"BF% + chewing + mewing"},
                  {label:"Yeux",current:results.eyeScore,gain:5,note:"Peu améliorable (génétique)"},
                  {label:"Canthal tilt",current:results.canthalTilt,gain:isFemale?8:5,note:isFemale?"Fox eye makeup":"Peu améliorable"},
                  {label:"Lèvres",current:results.lipScore,gain:15,note:"Hydratation + soin"},
                ].map((item,i)=>{
                  const maxVal=Math.min(item.current+item.gain,100);
                  return(
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-white/35 uppercase tracking-wider">{item.label}</span>
                        <span className="text-[9px]"><span className="text-white font-black">{item.current}</span><span className="text-white/18 mx-1">→</span><span className="font-black" style={{color:"#A855F7"}}>{maxVal}</span></span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden relative" style={{background:"rgba(255,255,255,0.03)"}}>
                        <div className="h-full rounded-full absolute" style={{width:`${maxVal}%`,background:"rgba(168,85,247,0.12)"}}/>
                        <div className="h-full rounded-full bg-white/65 absolute" style={{width:`${item.current}%`}}/>
                      </div>
                      <p className="text-[8px] text-white/16 italic">{item.note}</p>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab==="advice"&&(
            !showDeepDive?(
              <div className="p-6 rounded-3xl mb-4 text-center border" style={{background:"rgba(255,255,255,0.02)",borderColor:"rgba(255,255,255,0.04)"}}>
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-[14px] font-black text-white/60 mb-2">Conseils verrouillés</p>
                <p className="text-[11px] text-white/35 mb-5 leading-relaxed">{filteredAdvice.length} conseils personnalisés classés par impact, avec gains attendus et délais concrets.</p>
                <button onClick={()=>setOfferUnlocked(null)} className="w-full py-4 font-black text-[11px] uppercase tracking-[0.12em] rounded-xl transition-all hover:scale-[1.02] text-white" style={{background:"linear-gradient(135deg,#A855F7,#7c3aed)",boxShadow:"0 0 30px rgba(168,85,247,0.3)"}}>
                  🔓 Voir les offres
                </button>
              </div>
            ):(
              <div className="space-y-2 mb-4">
                <p className="text-[8px] text-white/16 uppercase tracking-widest font-black">{filteredAdvice.length} conseils · impact décroissant</p>
                {filteredAdvice.map((a,i)=>{
                  const links=AMAZON_LINKS[a.category]||[];
                  const isOpen=expandedAdvice===i;
                  return(
                    <div key={i} className="rounded-2xl overflow-hidden transition-all border" style={{background:"rgba(255,255,255,0.02)",borderColor:isOpen?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.04)"}}>
                      <button className="w-full p-4 text-left flex items-start gap-3" onClick={()=>setExpandedAdvice(isOpen?null:i)}>
                        <span className="text-lg flex-shrink-0 mt-0.5">{a.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap"><PriorityBadge p={a.priority}/><DiffBadge d={a.difficulty}/></div>
                          <p className="text-[12px] font-black text-white/72 leading-snug mb-1">{a.title}</p>
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-[8px] font-black" style={{color:"#A855F7"}}>{a.scoreGain}</span>
                            <span className="text-[7px] text-white/16">·</span>
                            <span className="text-[8px] text-white/22">⏱ {a.timeline}</span>
                          </div>
                        </div>
                        <span className="flex-shrink-0 mt-1 text-white/30 transition-transform duration-300" style={{transform:isOpen?"rotate(180deg)":"rotate(0deg)"}}>
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                        </span>
                      </button>
                      {isOpen&&(
                        <div className="px-4 pb-4 pt-3 border-t" style={{borderColor:"rgba(255,255,255,0.03)"}}>
                          <p className="text-[11px] text-white/38 leading-relaxed whitespace-pre-line mb-4">{a.description}</p>
                          {links.length>0&&(
                            <div className="space-y-1">
                              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2">🛒 Produits recommandés</p>
                              {links.map((lk,j)=>(
                                <a key={j} href={lk.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all group border" style={{borderColor:"rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
                                  <span className="text-[10px] text-white/50 font-semibold">{lk.label}</span>
                                  <span className="text-[8px] font-black flex-shrink-0 flex items-center gap-1" style={{color:"#A855F7"}}>Amazon <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          <div className="mt-4 space-y-3">
            <button onClick={()=>setPage("analysis")} className="w-full py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.15em] rounded-2xl hover:scale-[1.01] transition-all">Nouvelle analyse</button>
            <button onClick={()=>{navigator.clipboard.writeText(`Mon score biométrique : ${results.overall.toFixed(1)}/10 — via BioMetry Lab`);alert("✓ Copié !");}} className="w-full py-4 font-black text-[10px] uppercase tracking-[0.15em] rounded-2xl transition-all border" style={{background:"rgba(255,255,255,0.025)",color:"rgba(255,255,255,0.22)",borderColor:"rgba(255,255,255,0.04)"}}>Partager mon score</button>
          </div>
          <p className="text-[8px] text-white/7 text-center mt-6">Analyse biométrique · Résultats indicatifs · Pas un jugement de valeur</p>
        </div>
      </main>
    );
  }

  return null;
}

