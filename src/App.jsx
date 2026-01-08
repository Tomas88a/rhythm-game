import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Volume2, Power, Heart, Zap, Play, Pause, Square, RotateCcw, Eye, EyeOff, Menu } from 'lucide-react';

/**
 * RHYTHM BOY: ARCADE EDITION - v11.0 (Alignment Fixes)
 * * Changes:
 * - UI: Moved Power LED inside the screen bezel area (top-left).
 * - LAYOUT: Aligned Config/System panels to the TOP of the TAP button (items-start).
 * - LOGIC: Kept all v10 logic (Tap to start, difficulty, etc).
 */

// --- Audio Engine ---
class GrooveEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.6;

    this.nextNoteTime = 0.0;
    this.beatCount = 0; 
    this.isPlaying = false;
    this.tempo = 90;
    this.timerID = null;
    this.scheduleAheadTime = 0.1;
    this.lookahead = 25.0;
    
    this.onMeasureStart = null; 
  }

  resume() {
      if (this.ctx.state === 'suspended') {
          this.ctx.resume();
      }
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time) {
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
  }

  playMetronomeClick(time, isStrong) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(isStrong ? 1200 : 800, time);
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.05);
  }

  playFeedback(time, type) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time); 
        osc.frequency.exponentialRampToValueAtTime(1760, time + 0.1);
        gain.gain.setValueAtTime(0.2, time);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, time); 
        osc.frequency.linearRampToValueAtTime(50, time + 0.15);
        gain.gain.setValueAtTime(0.2, time);
    }

    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      if (this.beatCount === 0) {
          if (this.onMeasureStart) this.onMeasureStart(this.nextNoteTime);
      }
      if (this.beatCount === 0 || this.beatCount === 2) {
          this.playKick(this.nextNoteTime);
      } else {
          this.playSnare(this.nextNoteTime);
      }
      this.playMetronomeClick(this.nextNoteTime, this.beatCount === 0);
      
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += secondsPerBeat;
      this.beatCount = (this.beatCount + 1) % 4;
    }
    this.timerID = window.setTimeout(this.scheduler.bind(this), this.lookahead);
  }

  async start() {
    if (this.isPlaying) return;
    this.resume();
    this.isPlaying = true;
    this.beatCount = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerID);
  }
}

// --- PATTERNS ---
const PATTERNS = {
  rest: { id: 'rest', name: 'REST', difficulty: 1, timings: [], render: () => <rect x="45" y="45" width="10" height="10" fill="currentColor" opacity="0.1" /> },
  quarter: { id: 'quarter', name: 'QTR', difficulty: 1, timings: [0], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="50" cy="70" r="10" /><line x1="60" y1="70" x2="60" y2="20" strokeWidth="4" /></g> },
  eighths: { id: 'eighths', name: '8TH', difficulty: 1, timings: [0, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="4"><circle cx="30" cy="70" r="10" /><line x1="40" y1="70" x2="40" y2="20" /><circle cx="70" cy="70" r="10" /><line x1="80" y1="70" x2="80" y2="20" /><line x1="40" y1="20" x2="80" y2="20" strokeWidth="8" /></g> },
  sixteenths: { id: 'sixteenths', name: '16TH', difficulty: 1, timings: [0, 0.25, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3">{[20, 40, 60, 80].map(x => <React.Fragment key={x}><circle cx={x} cy="70" r="6" /><line x1={x + 6} y1="70" x2={x + 6} y2="20" /></React.Fragment>)}<line x1="26" y1="20" x2="86" y2="20" strokeWidth="6" /><line x1="26" y1="32" x2="86" y2="32" strokeWidth="5" /></g> },
  triplet: { id: 'triplet', name: 'TRIP', difficulty: 2, timings: [0, 0.333, 0.666], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="25" cy="70" r="8" /><line x1="33" y1="70" x2="33" y2="20" strokeWidth="3"/><circle cx="50" cy="70" r="8" /><line x1="58" y1="70" x2="58" y2="20" strokeWidth="3"/><circle cx="75" cy="70" r="8" /><line x1="83" y1="70" x2="83" y2="20" strokeWidth="3"/><line x1="33" y1="20" x2="83" y2="20" strokeWidth="6" /><text x="58" y="15" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">3</text></g> },
  galop: { id: 'galop', name: 'GALP', difficulty: 2, timings: [0, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="8" /><line x1="38" y1="70" x2="38" y2="20" strokeWidth="3"/><circle cx="60" cy="70" r="8" /><line x1="68" y1="70" x2="68" y2="20" strokeWidth="3"/><circle cx="80" cy="70" r="8" /><line x1="88" y1="70" x2="88" y2="20" strokeWidth="3"/><line x1="38" y1="20" x2="88" y2="20" strokeWidth="7" /><line x1="68" y1="32" x2="88" y2="32" strokeWidth="5" /></g> },
  revGalop: { id: 'revGalop', name: 'RGAL', difficulty: 2, timings: [0, 0.25, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="20" cy="70" r="8" /><line x1="28" y1="70" x2="28" y2="20" strokeWidth="3"/><circle cx="40" cy="70" r="8" /><line x1="48" y1="70" x2="48" y2="20" strokeWidth="3"/><circle cx="70" cy="70" r="8" /><line x1="78" y1="70" x2="78" y2="20" strokeWidth="3"/><line x1="28" y1="20" x2="78" y2="20" strokeWidth="7" /><line x1="28" y1="32" x2="48" y2="32" strokeWidth="5" /></g> },
  sync: { id: 'sync', name: 'SYNC', difficulty: 3, timings: [0, 0.25, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="20" cy="70" r="8" /><line x1="28" y1="70" x2="28" y2="20" strokeWidth="3"/><circle cx="50" cy="70" r="8" /><line x1="58" y1="70" x2="58" y2="20" strokeWidth="3"/><circle cx="80" cy="70" r="8" /><line x1="88" y1="70" x2="88" y2="20" strokeWidth="3"/><line x1="28" y1="20" x2="88" y2="20" strokeWidth="7" /><line x1="28" y1="32" x2="38" y2="32" strokeWidth="5" /><line x1="78" y1="32" x2="88" y2="32" strokeWidth="5" /></g> },
  dotted8Sixteenth: { id: 'dotted8Sixteenth', name: 'D.8', difficulty: 3, timings: [0, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="9" /><line x1="40" y1="70" x2="40" y2="20" strokeWidth="3"/><circle cx="50" cy="65" r="3" /> <circle cx="70" cy="70" r="9" /><line x1="80" y1="70" x2="80" y2="20" strokeWidth="3"/><line x1="40" y1="20" x2="80" y2="20" strokeWidth="7" /><line x1="70" y1="32" x2="80" y2="32" strokeWidth="5" /></g> },
  sixteenthDotted8: { id: 'sixteenthDotted8', name: '16.D', difficulty: 3, timings: [0, 0.25], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="9" /><line x1="40" y1="70" x2="40" y2="20" strokeWidth="3"/><circle cx="70" cy="70" r="9" /><line x1="80" y1="70" x2="80" y2="20" strokeWidth="3"/><circle cx="90" cy="65" r="3" /> <line x1="40" y1="20" x2="80" y2="20" strokeWidth="7" /><line x1="40" y1="32" x2="55" y2="32" strokeWidth="5" /></g> },
};

export default function RhythmConsoleV9() {
  const [bpm, setBpm] = useState(85);
  const [difficulty, setDifficulty] = useState(1);
  const [showGuides, setShowGuides] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hp, setHp] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScores, setHighScores] = useState({ 1: [], 2: [], 3: [] });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1); 

  // --- REFS ---
  const difficultyRef = useRef(1); 
  const measureCountRef = useRef(0);
  const engineRef = useRef(null);
  const animRef = useRef(null);
  const playheadRef = useRef(null);
  const timelineRef = useRef(null); 

  // --- STATE SYNC ---
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  const [measurePatterns, setMeasurePatterns] = useState([]);
  const [measureStartTime, setMeasureStartTime] = useState(0);
  const [targets, setTargets] = useState([]); 
  const [feedback, setFeedback] = useState({ text: "READY", type: "neutral" });

  // --- INIT ---
  useEffect(() => {
    engineRef.current = new GrooveEngine();
    engineRef.current.onMeasureStart = (time) => {
        setMeasureStartTime(time);
        measureCountRef.current += 1; 
        generateFullMeasure(measureCountRef.current);
    };

    const savedScores = localStorage.getItem('rhythmBoyHighScores');
    if (savedScores) setHighScores(JSON.parse(savedScores));

    return () => {
        engineRef.current.stop();
        if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => { engineRef.current.tempo = bpm; }, [bpm]);

  // --- LOGIC ---
  const saveHighScore = (finalScore, level) => {
    if (finalScore === 0) return;
    setHighScores(prev => {
        const newScores = [...(prev[level] || []), finalScore].sort((a, b) => b - a).slice(0, 10);
        const updated = { ...prev, [level]: newScores };
        localStorage.setItem('rhythmBoyHighScores', JSON.stringify(updated));
        return updated;
    });
  };

  const generateFullMeasure = (currentMeasureIndex) => {
      const currentDiff = difficultyRef.current;

      const getWeightedPattern = (diff) => {
          const allKeys = Object.keys(PATTERNS).filter(k => k !== 'rest');
          let pool = [];
          
          if (diff === 1) {
              pool = allKeys.filter(k => PATTERNS[k].difficulty === 1);
          } else if (diff === 2) {
              const basic = allKeys.filter(k => PATTERNS[k].difficulty === 1);
              const medium = allKeys.filter(k => PATTERNS[k].difficulty === 2);
              pool = [...basic, ...medium, ...medium, ...medium]; 
          } else {
              const basic = allKeys.filter(k => PATTERNS[k].difficulty === 1);
              const medium = allKeys.filter(k => PATTERNS[k].difficulty === 2);
              const expert = allKeys.filter(k => PATTERNS[k].difficulty === 3);
              pool = [...basic, ...medium, ...expert, ...expert, ...expert, ...expert];
          }
          const randKey = pool[Math.floor(Math.random() * pool.length)];
          return PATTERNS[randKey];
      };

      const newPatterns = [];
      const newTargets = [];
      const isFirstMeasure = currentMeasureIndex === 1;

      for (let i = 0; i < 4; i++) {
          let pattern;
          if (isFirstMeasure) {
              if (i < 2) pattern = PATTERNS['rest'];
              else pattern = getWeightedPattern(currentDiff);
          } else {
              if (i === 0) pattern = PATTERNS['eighths'];
              else pattern = getWeightedPattern(currentDiff);
          }

          newPatterns.push(pattern);
          if (pattern.id !== 'rest') {
              pattern.timings.forEach(t => {
                  newTargets.push({ beatAbsolute: i + t, hit: false, missed: false });
              });
          }
      }
      setMeasurePatterns(newPatterns);
      setTargets(newTargets);
  };

  const resetGame = () => {
    engineRef.current.stop();
    setIsPlaying(false);
    setHp(100);
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setFeedback({ text: "READY", type: "neutral" });
    setMeasurePatterns([]);
    setTargets([]);
    setMeasureStartTime(0);
    measureCountRef.current = 0;
    setActiveBeat(-1);
  };

  const togglePause = () => {
      if (!isPlaying) return;
      engineRef.current.stop();
      setIsPlaying(false);
      setFeedback({ text: "PAUSED", type: "neutral" });
  };

  // --- LOOP ---
  useEffect(() => {
      const loop = () => {
          if (isPlaying && measureStartTime > 0 && !gameOver) {
              const ctx = engineRef.current.ctx;
              const currentTime = ctx.currentTime;
              const secondsPerBeat = 60 / bpm;
              const rawProgress = (currentTime - measureStartTime) / (secondsPerBeat * 4);
              const progress = Math.max(0, Math.min(1, rawProgress));

              const currentBeatPos = rawProgress * 4;
              const currentBeatIndex = Math.floor(currentBeatPos);
              
              if (currentBeatIndex >= 0 && currentBeatIndex < 4) {
                  setActiveBeat(currentBeatIndex);
              }

              if (playheadRef.current) playheadRef.current.style.left = `${progress * 100}%`;
              
              setTargets(prev => prev.map(t => {
                  if (!t.hit && !t.missed && currentBeatPos > t.beatAbsolute + 0.35) {
                      triggerFeedback("MISS", "bad");
                      return { ...t, missed: true };
                  }
                  return t;
              }));
          }
          animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, measureStartTime, bpm, gameOver]);

  // --- INPUT ---
  const triggerFeedback = (text, type) => {
      setFeedback({ text, type, id: Math.random() });
      if (type === 'bad') {
          setCombo(0);
          setHp(h => {
              const newHp = Math.max(0, h - 15);
              if (newHp === 0 && !gameOver) {
                  setGameOver(true);
                  engineRef.current.stop();
              }
              return newHp;
          });
          engineRef.current.playFeedback(engineRef.current.ctx.currentTime, 'miss');
      } else {
          setCombo(c => c + 1);
          setHp(h => Math.min(100, h + 3)); 
          engineRef.current.playFeedback(engineRef.current.ctx.currentTime, 'hit');
      }
  };

  useEffect(() => { if (gameOver) saveHighScore(score, difficulty); }, [gameOver]);

  const handleTap = useCallback(() => {
      if (gameOver) {
          resetGame();
          return;
      }

      if (!isPlaying) {
          const resumeAndStart = async () => {
              if (engineRef.current.ctx.state === 'suspended') await engineRef.current.ctx.resume();
              
              if (measureCountRef.current > 0) {
                  await engineRef.current.start();
                  setIsPlaying(true);
                  setFeedback({ text: "RESUME", type: "good" });
              } else {
                  await engineRef.current.start();
                  setIsPlaying(true);
                  setFeedback({ text: "GO!", type: "good" });
              }
          };
          resumeAndStart();
          return;
      }

      const ctx = engineRef.current.ctx;
      const currentBeatPos = ((ctx.currentTime - measureStartTime) / (60 / bpm));
      
      let bestDiff = Infinity;
      let bestIndex = -1;

      setTargets(prev => {
          prev.forEach((t, i) => {
              if (t.hit || t.missed) return;
              const diff = Math.abs(currentBeatPos - t.beatAbsolute);
              if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
          });

          if (bestIndex !== -1 && bestDiff <= 0.25) {
              const isPerfect = bestDiff <= 0.15;
              const points = isPerfect ? 100 : 50;
              setScore(s => s + (points * (1 + Math.floor(combo / 10))));
              triggerFeedback(isPerfect ? "PERF" : "GOOD", "good"); 
              const next = [...prev];
              next[bestIndex] = { ...next[bestIndex], hit: true };
              return next;
          } else {
              triggerFeedback("BAD", "bad");
              return prev;
          }
      });
  }, [isPlaying, measureStartTime, bpm, gameOver, combo]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.code === 'Space') { 
              e.preventDefault(); 
              setIsSpacePressed(true);
              handleTap(); 
          }
      };
      const handleKeyUp = (e) => {
          if (e.code === 'Space') {
              setIsSpacePressed(false);
          }
      }
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [handleTap]);

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 font-sans select-none overflow-y-auto">
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            .font-pixel { font-family: 'Press Start 2P', monospace; }
            .lcd-bg { background-color: #8bac0f; color: #0f380f; }
            .lcd-grid {
                background-image: linear-gradient(#0f380f11 1px, transparent 1px),
                linear-gradient(90deg, #0f380f11 1px, transparent 1px);
                background-size: 3px 3px;
            }
            .console-shadow { 
                box-shadow: 
                    0 25px 50px -12px rgba(0, 0, 0, 0.9),
                    inset 0 2px 4px 0 rgba(255, 255, 255, 0.1);
            }
            .panel-box {
                background-color: #262626;
                border: 2px solid #404040;
                border-radius: 12px;
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
                position: relative;
            }
            .panel-label {
                position: absolute;
                top: -8px; left: 10px;
                background: #333;
                padding: 0 4px;
                font-family: 'Press Start 2P', monospace;
                font-size: 8px;
                color: #666;
            }
            
            /* Level Buttons */
            .btn-level {
                background: #333;
                border: 1px solid #111;
                transition: all 0.1s;
                position: relative;
                color: #666;
            }
            .btn-level:active { transform: translateY(1px); }
            .btn-level.active {
                background: #eab308;
                color: #000;
                border-color: #854d0e;
                box-shadow: 0 0 10px rgba(234, 179, 8, 0.4);
            }

            /* Tap Button (Square Arcade) */
            .btn-arcade {
                background: #ef4444;
                box-shadow: 
                    0 8px 0 #991b1b,
                    0 15px 20px rgba(0,0,0,0.4);
                transition: transform 0.05s, box-shadow 0.05s;
                border-radius: 8px;
            }
            .btn-arcade:active, .btn-arcade.pressed {
                transform: translateY(8px);
                box-shadow: 0 0 0 #991b1b;
                background: #dc2626;
            }

            /* System Buttons */
            .btn-system {
                background: #333;
                border: 1px solid #555;
                color: #888;
                transition: all 0.1s;
            }
            .btn-system:hover { background: #444; color: #fff; }
            .btn-system:active { background: #222; transform: translateY(1px); }

            /* Guide Switch */
            .switch-track {
                background: #111;
                border-radius: 20px;
                border: 1px solid #444;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
            }
            .switch-thumb {
                transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
            }

            /* Slider */
            input[type=range] {
                -webkit-appearance: none;
                width: 100%;
                background: transparent;
            }
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                height: 20px;
                width: 30px;
                border-radius: 4px;
                background: #666;
                border: 2px solid #222;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                margin-top: -8px;
                cursor: grab;
            }
            input[type=range]::-webkit-slider-runnable-track {
                width: 100%;
                height: 4px;
                background: #111;
                border-radius: 2px;
                border: 1px solid #444;
            }
        `}</style>

        {/* --- CONSOLE CHASSIS --- */}
        <div className="relative w-full max-w-[900px] bg-[#333] rounded-[40px] p-8 console-shadow border-t border-white/10 flex flex-col items-center">
            
            {/* --- SCREEN BEZEL --- */}
            <div className="w-full bg-[#171717] rounded-t-lg rounded-b-[30px] p-8 pt-4 shadow-[0_4px_0_#000] mb-8 relative border border-white/5">
                
                {/* PWR LED (Moved inside bezel) */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full border border-black/50 ${isPlaying ? 'bg-green-500 shadow-[0_0_8px_#4ade80]' : 'bg-red-900'}`}></div>
                    <span className="text-[8px] text-white/30 font-pixel tracking-widest">POWER</span>
                </div>

                <div className="flex justify-end text-white/30 text-[10px] font-pixel mb-2 px-1 w-full uppercase tracking-widest">
                     <span>design by Tomaxxx</span>
                </div>
                
                {/* LCD DISPLAY */}
                <div className="aspect-[2.2/1] w-full lcd-bg lcd-grid rounded-sm border-4 border-[#0f380f]/40 relative overflow-hidden flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
                    
                    {/* HUD */}
                    <div className="flex justify-between items-center p-3 bg-[#0f380f]/10 border-b border-[#0f380f]/20 h-12">
                         <div className="font-pixel text-[#0f380f] text-sm w-1/3 flex flex-col">
                             <span className="text-[8px] opacity-60">SCORE</span>
                             <span>{score.toString().padStart(6, '0')}</span>
                         </div>
                         <div className="font-pixel text-center w-1/3 font-bold text-xl tracking-widest text-[#0f380f] animate-pulse">
                             {feedback.text}
                         </div>
                         <div className="flex justify-end items-center gap-1 w-1/3 text-[#0f380f]">
                             <Heart size={16} fill="currentColor" />
                             <div className="flex gap-0.5">
                                 {[...Array(5)].map((_, i) => (
                                     <div key={i} className={`w-2 h-5 border-2 border-[#0f380f] ${hp > i * 20 ? 'bg-[#0f380f]' : 'bg-transparent'}`}></div>
                                 ))}
                             </div>
                         </div>
                    </div>

                    {/* GAMEPLAY AREA */}
                    <div className="flex-1 px-6 flex flex-col relative z-0 py-4">
                        <div className="flex-1 flex gap-3 items-center">
                             {[0,1,2,3].map(i => {
                                 const p = measurePatterns[i];
                                 const active = activeBeat === i; 
                                 const isLocked = measureCountRef.current > 1 && i === 0;

                                 return (
                                     <div key={i} className={`h-full flex-1 border-4 border-[#0f380f] flex flex-col items-center justify-center relative 
                                        ${active && isPlaying ? 'bg-[#0f380f]/20' : ''}
                                        ${isLocked ? 'border-8' : ''} 
                                     `}>
                                         <div className="absolute top-2 left-2 font-pixel text-[10px] text-[#0f380f] opacity-60">{i+1}</div>
                                         {isLocked && <div className="absolute top-2 right-2 text-[#0f380f] opacity-60"><Lock size={12} fill="currentColor" /></div>}
                                         
                                         {p ? (
                                             <div className={`w-full h-full p-4 text-[#0f380f] flex items-center justify-center ${p.id === 'rest' ? 'opacity-30' : ''}`}>
                                                 <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">{p.render()}</svg>
                                             </div>
                                         ) : <div className="font-pixel text-xs text-[#0f380f] opacity-50">...</div>}
                                     </div>
                                 );
                             })}
                        </div>

                        {/* TIMELINE */}
                        <div className="h-12 border-2 border-[#0f380f] mt-4 relative bg-[#0f380f]/5" ref={timelineRef}>
                            <div className="absolute inset-0 flex">
                                {[0,1,2,3].map(i => <div key={i} className="flex-1 border-r border-[#0f380f]/20"></div>)}
                            </div>
                            <div className="absolute top-1/2 w-full h-[2px] bg-[#0f380f]/40"></div>
                            {targets.map((t, idx) => (
                                <div key={idx} 
                                     className={`absolute top-1/2 w-4 h-6 -ml-2 -mt-3 border-2 border-[#0f380f] flex items-center justify-center transition-opacity
                                     ${!showGuides && !t.missed && !t.hit ? 'opacity-0' : ''}
                                     ${t.hit ? 'opacity-0' : t.missed ? 'bg-[#0f380f] opacity-50' : ''}
                                     `}
                                     style={{ left: `${(t.beatAbsolute/4)*100}%` }}>
                                </div>
                            ))}
                            <div ref={playheadRef} className={`absolute top-0 bottom-0 w-[3px] bg-[#0f380f] z-20 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0'}`} style={{ left: '0%' }}></div>
                        </div>
                    </div>

                    {/* GAME OVER */}
                    {gameOver && (
                        <div className="absolute inset-0 bg-[#8bac0f] z-40 flex flex-col items-center justify-center p-8 font-pixel text-[#0f380f]">
                            <div className="text-4xl mb-6 font-bold">GAME OVER</div>
                            <div className="text-2xl mb-6">SCORE: {score}</div>
                            <div className="text-xs uppercase mb-4">Top 10 (Lvl {difficulty})</div>
                            <div className="flex-1 overflow-y-auto w-full max-w-sm border-t-4 border-b-4 border-[#0f380f] py-4 mb-4">
                                {highScores[difficulty]?.map((s, i) => (
                                    <div key={i} className="flex justify-between text-xs py-1"><span>#{i+1}</span><span>{s}</span></div>
                                ))}
                            </div>
                            <div className="text-sm animate-pulse">PRESS TAP TO RESTART</div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CONTROL DECK (TOP ALIGNED) --- */}
            <div className="w-full flex items-start justify-between gap-6 px-4">
                
                {/* LEFT BOX: SETTINGS */}
                <div className="flex-1 h-32 panel-box p-4 flex flex-col justify-between">
                    <span className="panel-label">CONFIG</span>
                    
                    {/* Level */}
                    <div>
                        <div className="font-pixel text-[10px] text-white/40 mb-2">LEVEL</div>
                        <div className="flex gap-2">
                            {[1, 2, 3].map(lvl => (
                                <button key={lvl} onClick={() => !isPlaying && setDifficulty(lvl)} className={`flex-1 h-8 rounded text-xs font-pixel font-bold btn-level ${difficulty === lvl ? 'active' : ''}`}>
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* BPM */}
                    <div>
                        <div className="flex justify-between font-pixel text-[10px] text-white/40 mb-1">
                            <span>SPEED</span>
                            <span className="text-yellow-500">{bpm}</span>
                        </div>
                        <input type="range" min="60" max="180" step="5" value={bpm} onChange={(e) => !isPlaying && setBpm(parseInt(e.target.value))} className="w-full" />
                    </div>
                </div>

                {/* CENTER: TAP BUTTON */}
                <div className="w-48 flex flex-col items-center justify-start shrink-0">
                    <button 
                        onMouseDown={handleTap}
                        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
                        className={`w-32 h-32 btn-arcade group flex items-center justify-center ${isSpacePressed ? 'pressed' : ''}`}
                    >
                        <span className="font-pixel text-white/90 text-3xl tracking-widest opacity-80 group-active:translate-y-1">TAP</span>
                    </button>
                    <div className="mt-3 font-pixel text-[10px] text-white/20 uppercase tracking-[0.2em]">{isPlaying ? (measureCountRef.current > 0 ? "PLAYING" : "READY") : (gameOver ? "RETRY" : "START")}</div>
                </div>

                {/* RIGHT BOX: SYSTEM */}
                <div className="flex-1 h-32 panel-box p-4 flex flex-col justify-between">
                    <span className="panel-label">SYSTEM</span>
                    
                    {/* Pause / Guide Row */}
                    <div className="flex justify-between items-center gap-4">
                        <button onClick={togglePause} className="flex-1 h-10 bg-[#333] border border-[#555] rounded flex items-center justify-center gap-2 hover:bg-[#444] active:bg-[#222]" disabled={!isPlaying}>
                            <Pause size={16} className="text-white/60" />
                            <span className="font-pixel text-[10px] text-white/60">PAUSE</span>
                        </button>

                        <div className="flex flex-col items-end">
                            <span className="font-pixel text-[8px] text-white/30 mb-1">GUIDE</span>
                            <button onClick={() => setShowGuides(!showGuides)} className="w-12 h-6 switch-track flex items-center px-1">
                                <div className={`w-4 h-4 rounded-full shadow-md switch-thumb ${showGuides ? 'bg-green-500 translate-x-6' : 'bg-gray-500 translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>

                    {/* Reset Button */}
                    <button onClick={resetGame} className="w-full h-8 mt-auto flex items-center justify-center gap-2 text-red-400 hover:text-red-300 transition-colors">
                        <RotateCcw size={14} />
                        <span className="font-pixel text-[10px]">RESET GAME</span>
                    </button>
                </div>

            </div>

        </div>
        
        <div className="fixed bottom-2 right-2 text-white/10 text-[10px] font-pixel">v11.0 Aligned</div>
    </div>
  );
}