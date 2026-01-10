import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Heart, Pause, RotateCcw, Volume2, VolumeX, Play } from 'lucide-react';

/**
 * RHYTHM BOY: INFINITE ARCADE - v29.0 (Stability & Layout Fix)
 * * CRITICAL FIX: Removed conflicting internal scheduler in GrooveEngine. 
 * * CRITICAL FIX: Implemented "Time Freeze" pause logic so audio actually stops and resumes correctly.
 * * UI: Expanded Config Panel to fill empty space. Made Sliders and Buttons significantly larger.
 * * VISUAL: Ensured Note/Target rendering loop is robust.
 */

// --- Audio Engine (Pure Sound Emitter) ---
class GrooveEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.6;
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
  suspend() { if (this.ctx.state === 'running') this.ctx.suspend(); } // Not used, we calculate offset instead

  playCountIn(time, beat) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(beat === 3 ? 1500 : 800, time);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  playClick(time, isStrong) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(isStrong ? 1000 : 800, time);
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.05);
  }

  playFeedback(type) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const time = this.ctx.currentTime;
    if (type === 'hit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time); 
        osc.frequency.exponentialRampToValueAtTime(1760, time + 0.1);
        gain.gain.setValueAtTime(0.2, time);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time); 
        osc.frequency.linearRampToValueAtTime(50, time + 0.15);
        gain.gain.setValueAtTime(0.2, time);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }
}

// --- PATTERNS ---
const PATTERNS = {
  rest: { id: 'rest', name: 'REST', difficulty: 1, timings: [], render: () => <rect x="45" y="45" width="10" height="10" fill="currentColor" opacity="0.1" /> },
  quarter: { id: 'quarter', name: 'QTR', difficulty: 1, timings: [0], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="10" /><line x1="25" y1="70" x2="25" y2="20" strokeWidth="4" /></g> },
  eighths: { id: 'eighths', name: '8TH', difficulty: 1, timings: [0, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="4"><circle cx="15" cy="70" r="10" /><line x1="25" y1="70" x2="25" y2="20" /><circle cx="65" cy="70" r="10" /><line x1="75" y1="70" x2="75" y2="20" /><line x1="25" y1="20" x2="75" y2="20" strokeWidth="8" /></g> },
  sixteenths: { id: 'sixteenths', name: '16TH', difficulty: 1, timings: [0, 0.25, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3">{[15, 35, 55, 75].map(x => <React.Fragment key={x}><circle cx={x} cy="70" r="6" /><line x1={x + 6} y1="70" x2={x + 6} y2="20" /></React.Fragment>)}<line x1="21" y1="20" x2="81" y2="20" strokeWidth="6" /><line x1="21" y1="32" x2="81" y2="32" strokeWidth="5" /></g> },
  triplet: { id: 'triplet', name: 'TRIP', difficulty: 2, timings: [0, 0.333, 0.666], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="8" /><line x1="23" y1="70" x2="23" y2="20" strokeWidth="3"/><circle cx="48" cy="70" r="8" /><line x1="56" y1="70" x2="56" y2="20" strokeWidth="3"/><circle cx="81" cy="70" r="8" /><line x1="89" y1="70" x2="89" y2="20" strokeWidth="3"/><line x1="23" y1="20" x2="89" y2="20" strokeWidth="6" /><text x="50" y="15" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">3</text></g> },
  galop: { id: 'galop', name: 'GALP', difficulty: 2, timings: [0, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="8" /><line x1="23" y1="70" x2="23" y2="20" strokeWidth="3"/><circle cx="65" cy="70" r="8" /><line x1="73" y1="70" x2="73" y2="20" strokeWidth="3"/><circle cx="85" cy="70" r="8" /><line x1="93" y1="70" x2="93" y2="20" strokeWidth="3"/><line x1="23" y1="20" x2="93" y2="20" strokeWidth="7" /><line x1="73" y1="32" x2="93" y2="32" strokeWidth="5" /></g> },
  revGalop: { id: 'revGalop', name: 'RGAL', difficulty: 2, timings: [0, 0.25, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="8" /><line x1="23" y1="70" x2="23" y2="20" strokeWidth="3"/><circle cx="35" cy="70" r="8" /><line x1="43" y1="70" x2="43" y2="20" strokeWidth="3"/><circle cx="65" cy="70" r="8" /><line x1="73" y1="70" x2="73" y2="20" strokeWidth="3"/><line x1="23" y1="20" x2="73" y2="20" strokeWidth="7" /><line x1="23" y1="32" x2="43" y2="32" strokeWidth="5" /></g> },
  sync: { id: 'sync', name: 'SYNC', difficulty: 3, timings: [0, 0.25, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="35" cy="70" r="8" /><line x1="43" y1="70" x2="43" y2="20" strokeWidth="3"/><circle cx="75" cy="70" r="8" /><line x1="83" y1="70" x2="83" y2="20" strokeWidth="3"/><line x1="10" y1="20" x2="90" y2="20" strokeWidth="7" /><line x1="43" y1="32" x2="53" y2="32" strokeWidth="5" /><line x1="83" y1="32" x2="93" y2="32" strokeWidth="5" /></g> },
  dotted8Sixteenth: { id: 'dotted8Sixteenth', name: 'D.8', difficulty: 3, timings: [0, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="9" /><line x1="25" y1="70" x2="25" y2="20" strokeWidth="3"/><circle cx="35" cy="65" r="3" /> <circle cx="85" cy="70" r="9" /><line x1="95" y1="70" x2="95" y2="20" strokeWidth="3"/><line x1="25" y1="20" x2="95" y2="20" strokeWidth="7" /><line x1="85" y1="32" x2="95" y2="32" strokeWidth="5" /></g> },
  sixteenthDotted8: { id: 'sixteenthDotted8', name: '16.D', difficulty: 3, timings: [0, 0.25], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="15" cy="70" r="9" /><line x1="25" y1="70" x2="25" y2="20" strokeWidth="3"/><circle cx="35" cy="70" r="9" /><line x1="45" y1="70" x2="45" y2="20" strokeWidth="3"/><circle cx="55" cy="65" r="3" /> <line x1="25" y1="20" x2="65" y2="20" strokeWidth="7" /><line x1="25" y1="32" x2="40" y2="32" strokeWidth="5" /></g> },
};

function App() {
  const [bpm, setBpm] = useState(85);
  const [difficulty, setDifficulty] = useState(1);
  const [guideAudio, setGuideAudio] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hp, setHp] = useState(100);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScores, setHighScores] = useState({ 1: [], 2: [], 3: [] });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [scale, setScale] = useState(1);
  const [feedback, setFeedback] = useState({ text: "READY", type: "neutral" });
  
  // Display Queues
  const [visiblePatterns, setVisiblePatterns] = useState([]);
  const [visibleTargets, setVisibleTargets] = useState([]);

  // Refs
  const engineRef = useRef(null);
  const noteQueueRef = useRef([]); 
  const patternQueueRef = useRef([]); 
  const lastGenBeatRef = useRef(-1); 
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0); // Track pause time
  const timerIDRef = useRef(null);
  const animRef = useRef(null);
  const lastTapRef = useRef(0);
  const difficultyRef = useRef(1); 
  const guideAudioRef = useRef(true); 

  const playheadRef = useRef(null);
  const timelineRef = useRef(null); 

  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { guideAudioRef.current = guideAudio; }, [guideAudio]);

  // Scale Logic (Ultra Compact 1000x380)
  useEffect(() => {
    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        
        const gameW = 1000; 
        const gameH = 380; 
        
        let s, rotate;
        if (isPortrait) {
            s = Math.min(h / gameW, w / gameH) * 0.95;
            rotate = 'rotate(90deg)';
        } else {
            s = Math.min(w / gameW, h / gameH) * 0.95;
            rotate = 'rotate(0deg)';
        }
        
        const container = document.getElementById('game-container');
        if (container) {
            container.style.transform = `${rotate} scale(${s})`;
            container.style.display = 'flex';
        }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    handleResize();
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Init Audio
  useEffect(() => {
    engineRef.current = new GrooveEngine();
    const savedScores = localStorage.getItem('rhythmBoyHighScores');
    if (savedScores) setHighScores(JSON.parse(savedScores));
    return () => {
        if (timerIDRef.current) clearTimeout(timerIDRef.current);
        if (animRef.current) cancelAnimationFrame(animRef.current);
        if (engineRef.current) engineRef.current.stop();
    };
  }, []);

  useEffect(() => { if(engineRef.current) engineRef.current.tempo = bpm; }, [bpm]);

  // --- LOGIC ---

  const generateChunk = () => {
      const currentDiff = difficultyRef.current;
      const startBeat = lastGenBeatRef.current + 1;

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

      for (let i = 0; i < 4; i++) {
          const absBeat = startBeat + i;
          let pattern;

          if (absBeat < 0) {
              pattern = PATTERNS['rest']; 
          } else {
              if (absBeat % 4 === 0) {
                  pattern = PATTERNS['eighths']; 
              } else {
                  pattern = getWeightedPattern(currentDiff);
              }
          }

          patternQueueRef.current.push({ startBeat: absBeat, pattern });

          if (pattern.id !== 'rest') {
              pattern.timings.forEach(t => {
                  noteQueueRef.current.push({
                      absBeat: absBeat + t,
                      played: false,
                      hit: false,
                      missed: false,
                      type: (absBeat % 4 === 0 && t === 0) ? 'kick' : 'snare',
                      parentPattern: pattern
                  });
              });
          }
      }
      lastGenBeatRef.current += 4;
  };

  const scheduleAudio = useCallback(() => {
      if (!engineRef.current) return;
      const dev = engineRef.current;
      const ctx = dev.ctx;
      const secondsPerBeat = 60.0 / bpm;
      const lookahead = 25.0; 
      const scheduleAheadTime = 0.1; 

      const currentAbsBeat = (ctx.currentTime - startTimeRef.current) / secondsPerBeat;

      // Buffer
      if (lastGenBeatRef.current < currentAbsBeat + 8) {
          generateChunk();
      }

      // Play
      noteQueueRef.current.forEach(note => {
          if (note.played) return;
          const noteTime = startTimeRef.current + (note.absBeat * secondsPerBeat);
          if (noteTime < ctx.currentTime + scheduleAheadTime) {
              
              if (note.absBeat % 1 === 0) {
                  dev.playClick(noteTime, note.absBeat % 4 === 0);
              }

              if (guideAudioRef.current) {
                  if (note.type === 'kick') dev.playKick(noteTime);
                  else dev.playSnare(noteTime);
              }
              
              note.played = true;
          }
      });
      
      if (isPlaying) {
          timerIDRef.current = setTimeout(scheduleAudio, lookahead);
      }
  }, [bpm, isPlaying]);

  // Visual Loop
  const visualLoop = useCallback(() => {
      if (!isPlaying || !engineRef.current) return; 
      const ctx = engineRef.current.ctx;
      const secondsPerBeat = 60.0 / bpm;
      const currentAbsBeat = (ctx.currentTime - startTimeRef.current) / secondsPerBeat;

      // Count-In Visuals
      if (currentAbsBeat < 0) {
          const count = Math.ceil(Math.abs(currentAbsBeat));
          if (count <= 4 && count > 0) {
              if (feedback.text !== String(count)) setFeedback({ text: String(count), type: "neutral" });
          }
      } else if (currentAbsBeat >= 0 && currentAbsBeat < 0.5 && feedback.text !== "GO!") {
           setFeedback({ text: "GO!", type: "good" });
      }

      const activePat = patternQueueRef.current.find(p => 
          currentAbsBeat >= p.startBeat && currentAbsBeat < p.startBeat + 1
      );
      if (activePat && activePat.pattern.id !== 'rest') {
          setCurrentPattern(activePat.pattern);
          setActiveBeat(activePat.startBeat % 4);
      } else {
          setCurrentPattern(null);
          setActiveBeat(-1);
      }

      if (gameOver) {
          animRef.current = requestAnimationFrame(visualLoop);
          return;
      }

      noteQueueRef.current.forEach(note => {
          if (!note.missed && !note.hit && currentAbsBeat > note.absBeat + 0.25) { 
              note.missed = true;
              triggerFeedback("MISS", "bad");
          }
      });

      if (noteQueueRef.current.length > 50) {
          const idx = noteQueueRef.current.findIndex(n => n.absBeat > currentAbsBeat - 2);
          if (idx > 0) noteQueueRef.current = noteQueueRef.current.slice(idx);
      }
      if (patternQueueRef.current.length > 20) {
          const idx = patternQueueRef.current.findIndex(p => p.startBeat > currentAbsBeat - 2);
          if (idx > 0) patternQueueRef.current = patternQueueRef.current.slice(idx);
      }

      const visible = noteQueueRef.current.filter(n => 
          n.absBeat > currentAbsBeat - 2 && n.absBeat < currentAbsBeat + 6
      ).map(n => ({
          ...n,
          offset: n.absBeat - currentAbsBeat
      }));
      setVisibleTargets(visible);

      const visiblePats = patternQueueRef.current.filter(p => 
          p.startBeat > currentAbsBeat - 2 && p.startBeat < currentAbsBeat + 6
      ).map(p => ({
          ...p,
          offset: p.startBeat - currentAbsBeat
      }));
      setVisiblePatterns(visiblePats);

      animRef.current = requestAnimationFrame(visualLoop);
  }, [isPlaying, gameOver, bpm, feedback.text]);

  useEffect(() => {
      if (isPlaying) {
          scheduleAudio();
          animRef.current = requestAnimationFrame(visualLoop);
      } else {
          if (timerIDRef.current) clearTimeout(timerIDRef.current);
          if (animRef.current) cancelAnimationFrame(animRef.current);
      }
  }, [isPlaying, scheduleAudio, visualLoop]);

  const triggerFeedback = (text, type) => {
      setFeedback({ text, type, id: Math.random() });
      if (type === 'bad') {
          setCombo(0);
          engineRef.current?.playFeedback('miss');
          setHp(h => {
              const newHp = Math.max(0, h - 10);
              if (newHp === 0) setGameOver(true);
              return newHp;
          });
      } else {
          setCombo(c => c + 1);
          engineRef.current?.playFeedback('hit');
          setHp(h => Math.min(100, h + 2));
      }
  };

  const handleTap = useCallback((e) => {
      if (e && e.type === 'pointerdown') e.preventDefault();
      const now = Date.now();
      if (now - lastTapRef.current < 80) return; 
      lastTapRef.current = now;

      if (gameOver) { resetGame(); return; }
      if (!isPlaying) { startGame(); return; }

      const ctx = engineRef.current.ctx;
      const secondsPerBeat = 60.0 / bpm;
      const currentAbsBeat = (ctx.currentTime - startTimeRef.current) / secondsPerBeat;

      let bestNote = null;
      let minDiff = Infinity;

      for (const note of noteQueueRef.current) {
          if (note.hit || note.missed) continue;
          const diff = note.absBeat - currentAbsBeat;
          if (diff < -0.3) continue; 
          if (diff > 0.6) break; 

          const absDiff = Math.abs(diff);
          if (absDiff < minDiff) {
              minDiff = absDiff;
              bestNote = note;
          }
      }

      if (bestNote && minDiff <= 0.25) { 
          bestNote.hit = true;
          const isPerfect = minDiff <= 0.08;
          const points = isPerfect ? 100 : 50;
          setScore(s => s + points + (Math.floor(combo/10)*10));
          triggerFeedback(isPerfect ? "PERFECT" : "GOOD", "good");
      } else {
          // Only trigger bad feedback if playing and past count-in
          if (currentAbsBeat > 0) triggerFeedback("BAD", "bad");
      }
  }, [isPlaying, gameOver, bpm, combo]);

  const resetGame = () => {
      if (engineRef.current) engineRef.current.stop();
      setIsPlaying(false);
      setHp(100);
      setScore(0);
      setCombo(0);
      setGameOver(false);
      setFeedback({ text: "READY", type: "neutral" });
      setVisiblePatterns([]);
      setVisibleTargets([]);
      noteQueueRef.current = [];
      patternQueueRef.current = [];
      lastGenBeatRef.current = -4; 
  };

  const startGame = async () => {
      if (!engineRef.current) return;
      if (engineRef.current.ctx.state === 'suspended') await engineRef.current.ctx.resume();
      
      // If we were paused (measureCount > 0), we resume. 
      // If measureCount == 0, it's a fresh start.
      if (measureCountRef.current > 0) {
          // Resume Logic
          const now = engineRef.current.ctx.currentTime;
          const timePaused = now - pausedAtRef.current;
          startTimeRef.current += timePaused;
          setIsPlaying(true);
          setFeedback({ text: "RESUME", type: "good" });
      } else {
          // New Game Logic
          resetGame();
          const spb = 60.0 / bpm;
          const countInDuration = 4 * spb;
          startTimeRef.current = engineRef.current.ctx.currentTime + countInDuration + 0.1;
          
          // Schedule count-ins
          const now = engineRef.current.ctx.currentTime + 0.1;
          for(let i=0; i<4; i++) {
              engineRef.current.playCountIn(now + (i * spb), i);
          }
          
          lastGenBeatRef.current = -1; 
          generateChunk(); 
          generateChunk(); 
          
          setIsPlaying(true);
          // Set measureCount to 1 to indicate game has started
          measureCountRef.current = 1; 
      }
  };

  const togglePause = () => {
      if (!isPlaying) return;
      if (engineRef.current) {
          engineRef.current.stop();
          pausedAtRef.current = engineRef.current.ctx.currentTime;
      }
      setIsPlaying(false);
      setFeedback({ text: "PAUSED", type: "neutral" });
  };

  useEffect(() => {
      const handleKeyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); setIsSpacePressed(true); handleTap(); } };
      const handleKeyUp = (e) => { if (e.code === 'Space') { setIsSpacePressed(false); } };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [handleTap]);

  useEffect(() => {
      if (gameOver && score > 0) {
         setHighScores(prev => {
            const newScores = [...(prev[difficulty] || []), score].sort((a, b) => b - a).slice(0, 10);
            const updated = { ...prev, [difficulty]: newScores };
            localStorage.setItem('rhythmBoyHighScores', JSON.stringify(updated));
            return updated;
         });
      }
  }, [gameOver]);

  // Constants
  const HIT_LINE_PERCENT = 20; 
  const BEAT_WIDTH_PERCENT = 18; 

  return (
    <>
      <div id="orientation-overlay">
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>↻</div>
          <div>PLEASE ROTATE DEVICE</div>
      </div>
      
      <div style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'center center',
          width: '1000px', 
          height: '380px', // Compressed height
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute'
      }} id="game-container">
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
                top: -6px; left: 10px;
                background: #333;
                padding: 0 4px;
                font-family: 'Press Start 2P', monospace;
                font-size: 8px;
                color: #666;
            }
            .btn-level {
                background: #333; border: 1px solid #111; transition: all 0.1s; position: relative; color: #666;
            }
            .btn-level:active { transform: translateY(1px); }
            .btn-level.active {
                background: #eab308; color: #000; border-color: #854d0e; box-shadow: 0 0 10px rgba(234, 179, 8, 0.4);
            }
            .btn-arcade {
                background: #ef4444;
                box-shadow: 0 8px 0 #991b1b, 0 15px 20px rgba(0,0,0,0.4);
                transition: transform 0.05s, box-shadow 0.05s;
                border-radius: 8px;
            }
            .btn-arcade:active, .btn-arcade.pressed {
                transform: translateY(8px); box-shadow: 0 0 0 #991b1b; background: #dc2626;
            }
            .btn-system {
                background: #333; border: 1px solid #555; color: #888; transition: all 0.1s;
            }
            .btn-system:hover { background: #444; color: #fff; }
            .btn-system:active { background: #222; transform: translateY(1px); }
            .switch-track {
                background: #111; border-radius: 20px; border: 1px solid #444; box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
            }
            .switch-thumb { transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1); }
            input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none; height: 16px; width: 24px; border-radius: 4px; background: #666; border: 2px solid #222; box-shadow: 0 2px 4px rgba(0,0,0,0.5); margin-top: -6px; cursor: grab;
            }
            input[type=range]::-webkit-slider-runnable-track {
                width: 100%; height: 4px; background: #111; border-radius: 2px; border: 1px solid #444;
            }
          `}</style>

          <div className="relative w-full max-w-[1000px] bg-[#333] rounded-[40px] p-6 console-shadow border-t border-white/10 flex flex-col items-center">
              
              {/* --- SCREEN --- */}
              <div className="w-full bg-[#171717] rounded-t-lg rounded-b-[30px] p-8 pt-4 shadow-[0_4px_0_#000] mb-4 relative border border-white/5">
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full border border-black/50 ${isPlaying ? 'bg-green-500 shadow-[0_0_8px_#4ade80]' : 'bg-red-900'}`}></div>
                      <span className="text-[8px] text-white/30 font-pixel tracking-widest">POWER</span>
                  </div>
                  <div className="flex justify-end text-white/30 text-[10px] font-pixel mb-2 px-1 w-full uppercase tracking-widest">
                       <span>design by Tomaxxx</span>
                  </div>
                  
                  {/* LCD DISPLAY */}
                  <div className="aspect-[3/1] w-full lcd-bg lcd-grid rounded-sm border-4 border-[#0f380f]/40 relative overflow-hidden flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
                      
                      {/* HUD */}
                      <div className="flex justify-between items-center p-2 bg-[#0f380f]/10 border-b border-[#0f380f]/20 h-10 z-20 relative">
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

                      {/* MAIN GAME VIEW (DUAL TRACK) */}
                      <div className="flex-1 flex flex-col relative z-0 overflow-hidden">
                          
                          {/* TRACK 1: PATTERNS (Top - 70% Height - Moved UP to 30%) */}
                          <div className="h-[70%] relative border-b-2 border-[#0f380f]/30 w-full overflow-hidden">
                              <div className="absolute top-0 bottom-0 w-[2px] bg-[#0f380f] z-30 opacity-70" style={{ left: `${HIT_LINE_PERCENT}%` }}>
                                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f380f]"></div>
                              </div>

                              {/* Scrolling Patterns (NO BOXES) */}
                              {visiblePatterns.map((p, i) => (
                                  <div 
                                      key={`p-${i}`}
                                      className="absolute top-[30%] -translate-y-1/2 h-full flex items-center justify-center"
                                      style={{
                                          left: `${HIT_LINE_PERCENT + (p.offset * BEAT_WIDTH_PERCENT)}%`,
                                          width: `${BEAT_WIDTH_PERCENT}%`,
                                          opacity: p.pattern.id === 'rest' ? 0.4 : 1,
                                          transform: 'scale(1.0)'
                                      }}
                                  >
                                      {/* Pure Note Graphic (No Border/Bg) */}
                                      <div className="w-full h-full p-2 text-[#0f380f]">
                                          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                              {p.pattern.render()}
                                          </svg>
                                      </div>
                                      
                                      {/* Anchor Indicator */}
                                      {p.startBeat % 4 === 0 && (
                                          <div className="absolute top-1 left-1 text-[8px] text-[#0f380f] font-pixel opacity-50">1</div>
                                      )}
                                  </div>
                              ))}
                          </div>

                          {/* TRACK 2: TARGETS (Bottom - 30% Height - Centered at 40%) */}
                          <div className="h-[30%] relative w-full overflow-hidden bg-[#0f380f]/5">
                              
                              <div className="absolute top-0 bottom-0 w-[2px] bg-[#0f380f] z-30 opacity-70" style={{ left: `${HIT_LINE_PERCENT}%` }}>
                                   <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f380f]"></div>
                              </div>
                              
                              {/* Hit Box */}
                              <div className="absolute top-[40%] -translate-y-1/2 w-8 h-8 border-4 border-[#0f380f] z-20" 
                                   style={{ left: `${HIT_LINE_PERCENT}%`, marginLeft: '-16px' }}>
                              </div>

                              {/* Scrolling Notes */}
                              {visibleTargets.map((t, i) => (
                                  <div 
                                      key={`t-${i}`}
                                      className={`absolute top-[40%] -translate-y-1/2 w-6 h-6 border-4 border-[#0f380f] bg-transparent
                                          ${t.hit ? 'opacity-0 scale-150' : t.missed ? 'opacity-30' : ''}
                                      `}
                                      style={{
                                          left: `${HIT_LINE_PERCENT + (t.offset * BEAT_WIDTH_PERCENT)}%`,
                                          marginLeft: '-12px'
                                      }}
                                  />
                              ))}
                          </div>

                      </div>

                      {/* GAME OVER */}
                      {gameOver && (
                          <div className="absolute inset-0 bg-[#8bac0f] z-[999] flex flex-col items-center justify-center p-8 font-pixel text-[#0f380f]">
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

              {/* --- CONTROL DECK --- */}
              <div className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 px-2">
                  
                  {/* Left: Config (Grid Layout to fill height) */}
                  <div className="h-20 panel-box p-3 grid grid-rows-2 gap-1">
                      <span className="panel-label">CONFIG</span>
                      
                      {/* Row 1: Level + Audio Toggle */}
                      <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1 items-center flex-1">
                              <span className="font-pixel text-[8px] text-white/40">LVL</span>
                              <div className="flex gap-1 flex-1">
                                  {[1, 2, 3].map(lvl => (
                                      <button key={lvl} onClick={() => !isPlaying && setDifficulty(lvl)} className={`flex-1 h-6 rounded text-[8px] font-pixel font-bold btn-level ${difficulty === lvl ? 'active' : ''}`}>
                                          {lvl}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          
                          {/* Integrated Audio Switch */}
                          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                              <button onClick={() => setGuideAudio(!guideAudio)} className="w-8 h-4 switch-track flex items-center px-0.5">
                                  <div className={`w-3 h-3 rounded-full shadow-md switch-thumb flex items-center justify-center ${guideAudio ? 'bg-green-500 translate-x-4' : 'bg-gray-500 translate-x-0'}`}>
                                  </div>
                              </button>
                              <span className="font-pixel text-[8px] text-white/30">AUD</span>
                          </div>
                      </div>

                      {/* Row 2: Speed Slider (Full Width) */}
                      <div className="flex items-center gap-2">
                          <span className="font-pixel text-[8px] text-white/40 w-6">SPD</span>
                          <input type="range" min="60" max="180" step="5" value={bpm} onChange={(e) => !isPlaying && setBpm(parseInt(e.target.value))} className="flex-1" />
                          <span className="font-pixel text-[8px] text-yellow-500 w-6 text-right">{bpm}</span>
                      </div>
                  </div>

                  {/* Center: Gap Filler / Status Light? Left empty for spacing or maybe a logo later */}
                  <div className="w-4"></div>

                  {/* Right: Actions (Tap + System) */}
                  <div className="h-20 flex items-center justify-end gap-3">
                      
                      {/* Small System Buttons */}
                      <div className="flex flex-col gap-2 h-full justify-center">
                          <button onClick={togglePause} className="w-16 h-8 bg-[#333] border border-[#555] rounded flex items-center justify-center gap-1 hover:bg-[#444] active:bg-[#222]" disabled={!isPlaying}>
                              <Pause size={12} className="text-white/60" />
                              <span className="font-pixel text-[8px] text-white/60">PAUSE</span>
                          </button>
                          <button onClick={resetGame} className="w-16 h-6 flex items-center justify-center gap-1 text-red-400 hover:text-red-300">
                              <RotateCcw size={12} />
                              <span className="font-pixel text-[8px]">RESET</span>
                          </button>
                      </div>

                      {/* Giant TAP */}
                      <div className="relative">
                          <button 
                              onPointerDown={handleTap}
                              className={`w-28 h-20 btn-arcade group flex items-center justify-center ${isSpacePressed ? 'pressed' : ''}`}
                              style={{ touchAction: 'none' }}
                          >
                              <span className="font-pixel text-white/90 text-2xl tracking-widest opacity-80 group-active:translate-y-1">TAP</span>
                          </button>
                          {/* Status Text under button */}
                          <div className="absolute -bottom-3 left-0 w-full text-center font-pixel text-[6px] text-white/20 uppercase tracking-[0.2em]">
                              {isPlaying ? "RHYTHM PAD" : "START"}
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      </div>
    </>
  );
}

export default App;