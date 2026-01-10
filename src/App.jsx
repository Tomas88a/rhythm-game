import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Heart, Pause, RotateCcw, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';

/**
 * RHYTHM BOY: INFINITE ARCADE - v26.7 (Fix & Features)
 * * FIXED: Visual rendering bug where 'left' was undefined (calculated in JSX now).
 * * FIXED: Missing 'playCountIn' method in GrooveEngine.
 * * FEATURE: Added Chinese instruction text on start.
 * * FEATURE: Clear "TARGETS" toggle button.
 * * FEATURE: 4-beat Count-in sequence.
 */

// --- Audio Engine ---
class GrooveEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.6;
    this.nextNoteTime = 0.0;
    this.isPlaying = false;
    this.tempo = 90;
    this.timerID = null;
    this.scheduleAheadTime = 0.1;
    this.lookahead = 25.0;
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  // Added missing Count-in method
  playCountIn(time, beat) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    // 4th beat (GO!) is higher pitch
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

  start() {
    if (this.isPlaying) return;
    this.resume();
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) clearTimeout(this.timerID);
  }
}

// --- PATTERNS ---
const PATTERNS = {
  rest: { id: 'rest', name: 'REST', difficulty: 1, timings: [], render: () => <rect x="45" y="45" width="10" height="10" fill="currentColor" opacity="0.1" /> },
  quarter: { id: 'quarter', name: 'QTR', difficulty: 1, timings: [0], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="50" cy="70" r="10" /><line x1="60" y1="70" x2="60" y2="20" strokeWidth="4" /></g> },
  eighths: { id: 'eighths', name: '8TH', difficulty: 1, timings: [0, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="4"><circle cx="30" cy="70" r="10" /><line x1="40" y1="70" x2="40" y2="20" /><circle cx="70" cy="70" r="10" /><line x1="80" y1="70" x2="80" y2="20" /><line x1="40" y1="20" x2="80" y2="20" strokeWidth="8" /></g> },
  sixteenths: { id: 'sixteenths', name: '16TH', difficulty: 1, timings: [0, 0.25, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3">{[20, 40, 60, 80].map(x => <React.Fragment key={x}><circle cx={x} cy="70" r="6" /><line x1={x + 6} y1="70" x2={x + 6} y2="20" /></React.Fragment>)}<line x1="26" y1="20" x2="86" y2="20" strokeWidth="6" /><line x1="26" y1="32" x2="86" y2="32" strokeWidth="5" /></g> },
  triplet: { id: 'triplet', name: 'TRIP', difficulty: 2, timings: [0, 0.333, 0.666], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="25" cy="70" r="8" /><line x1="33" y1="70" x2="33" y2="20" strokeWidth="3"/><circle cx="50" cy="70" r="8" /><line x1="59" y1="70" x2="59" y2="20" strokeWidth="3"/><circle cx="75" cy="70" r="8" /><line x1="84" y1="70" x2="84" y2="20" strokeWidth="3"/><line x1="34" y1="20" x2="84" y2="20" strokeWidth="7" /><text x="59" y="15" textAnchor="middle" fontSize="18" fontWeight="bold" fill="currentColor">3</text></g> },
  galop: { id: 'galop', name: 'GALP', difficulty: 2, timings: [0, 0.5, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="8" /><line x1="39" y1="70" x2="39" y2="20" strokeWidth="3"/><circle cx="60" cy="70" r="8" /><line x1="69" y1="70" x2="69" y2="20" strokeWidth="3"/><circle cx="80" cy="70" r="8" /><line x1="89" y1="70" x2="89" y2="20" strokeWidth="3"/><line x1="39" y1="20" x2="89" y2="20" strokeWidth="7" /><line x1="69" y1="32" x2="89" y2="32" strokeWidth="5" /></g> },
  revGalop: { id: 'revGalop', name: 'RGAL', difficulty: 2, timings: [0, 0.25, 0.5], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="20" cy="70" r="8" /><line x1="29" y1="70" x2="29" y2="20" strokeWidth="3"/><circle cx="40" cy="70" r="8" /><line x1="49" y1="70" x2="49" y2="20" strokeWidth="3"/><circle cx="70" cy="70" r="8" /><line x1="79" y1="70" x2="79" y2="20" strokeWidth="3"/><line x1="29" y1="20" x2="79" y2="20" strokeWidth="7" /><line x1="29" y1="32" x2="49" y2="32" strokeWidth="6" /></g> },
  sync: { id: 'sync', name: 'SYNC', difficulty: 3, timings: [0, 0.25, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="20" cy="70" r="8" /><line x1="28" y1="70" x2="28" y2="20" strokeWidth="3"/><circle cx="50" cy="70" r="8" /><line x1="58" y1="70" x2="58" y2="20" strokeWidth="3"/><circle cx="80" cy="70" r="8" /><line x1="88" y1="70" x2="88" y2="20" strokeWidth="3"/><line x1="28" y1="20" x2="88" y2="20" strokeWidth="7" /><line x1="28" y1="32" x2="38" y2="32" strokeWidth="6" /><line x1="78" y1="32" x2="88" y2="32" strokeWidth="6" /></g> },
  dotted8Sixteenth: { id: 'dotted8Sixteenth', name: 'D.8', difficulty: 3, timings: [0, 0.75], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="9" /><line x1="40" y1="70" x2="40" y2="20" strokeWidth="3"/><circle cx="50" cy="65" r="3" /> <circle cx="70" cy="70" r="9" /><line x1="80" y1="70" x2="80" y2="20" strokeWidth="3"/><line x1="40" y1="20" x2="80" y2="20" strokeWidth="7" /><line x1="70" y1="32" x2="80" y2="32" strokeWidth="5" /></g> },
  sixteenthDotted8: { id: 'sixteenthDotted8', name: '16.D', difficulty: 3, timings: [0, 0.25], render: () => <g stroke="currentColor" fill="currentColor" strokeWidth="3"><circle cx="30" cy="70" r="9" /><line x1="40" y1="70" x2="40" y2="20" strokeWidth="3"/><circle cx="70" cy="70" r="9" /><line x1="80" y1="70" x2="80" y2="20" strokeWidth="3"/><circle cx="90" cy="65" r="3" /> <line x1="40" y1="20" x2="80" y2="20" strokeWidth="7" /><line x1="40" y1="32" x2="55" y2="32" strokeWidth="5" /></g> },
};

function App() {
  const [bpm, setBpm] = useState(85);
  const [difficulty, setDifficulty] = useState(1);
  const [guideAudio, setGuideAudio] = useState(true);
  const [showTargets, setShowTargets] = useState(true); // Toggle targets
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
  
  const [visiblePatterns, setVisiblePatterns] = useState([]);
  const [visibleTargets, setVisibleTargets] = useState([]);

  const engineRef = useRef(null);
  const noteQueueRef = useRef([]); 
  const patternQueueRef = useRef([]); 
  const lastGenBeatRef = useRef(-1); 
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const timerIDRef = useRef(null);
  const animRef = useRef(null);
  const lastTapRef = useRef(0);
  const difficultyRef = useRef(1); 
  const guideAudioRef = useRef(true); 

  const playheadRef = useRef(null);
  const timelineRef = useRef(null); 

  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { guideAudioRef.current = guideAudio; }, [guideAudio]);

  // Scale Logic
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

  // Sync Bpm 
  const bpmRef = useRef(bpm);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // --- LOGIC ---
  const generateChunk = () => {
      const currentDiff = difficultyRef.current;
      const startBeat = lastGenBeatRef.current + 1;

      const getWeightedPattern = (diff) => {
          const allKeys = Object.keys(PATTERNS).filter(k => k !== 'rest');
          let pool = [];
          if (diff === 1) pool = allKeys.filter(k => PATTERNS[k].difficulty === 1);
          else if (diff === 2) {
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
              if (absBeat % 4 === 0) pattern = PATTERNS['eighths']; 
              else pattern = getWeightedPattern(currentDiff);
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
      const secondsPerBeat = 60.0 / bpmRef.current;
      const lookahead = 25.0; 
      const scheduleAheadTime = 0.1; 
      const currentAbsBeat = (ctx.currentTime - startTimeRef.current) / secondsPerBeat;

      if (lastGenBeatRef.current < currentAbsBeat + 8) generateChunk();

      noteQueueRef.current.forEach(note => {
          if (note.played) return;
          const noteTime = startTimeRef.current + (note.absBeat * secondsPerBeat);
          if (noteTime < ctx.currentTime + scheduleAheadTime) {
              if (note.absBeat % 1 === 0) dev.playClick(noteTime, note.absBeat % 4 === 0);
              if (guideAudioRef.current) {
                  if (note.type === 'kick') dev.playKick(noteTime);
                  else dev.playSnare(noteTime);
              }
              note.played = true;
          }
      });
      timerIDRef.current = setTimeout(scheduleAudio, lookahead);
  }, []);

  const visualLoop = useCallback(() => {
      if (!engineRef.current) return; 
      const ctx = engineRef.current.ctx;
      const secondsPerBeat = 60.0 / bpmRef.current;
      const currentAbsBeat = (ctx.currentTime - startTimeRef.current) / secondsPerBeat;

      // Count-In Visual Feedback
      if (currentAbsBeat < 0) {
          const count = Math.ceil(Math.abs(currentAbsBeat));
          if (count <= 4 && count > 0) {
             if (feedback.text !== String(count)) setFeedback({ text: String(count), type: "neutral" });
          }
      } else if (currentAbsBeat >= 0 && currentAbsBeat < 0.5 && feedback.text !== "GO!") {
           setFeedback({ text: "GO!", type: "good" });
      }

      // Miss Check
      if (!gameOver) {
          noteQueueRef.current.forEach(note => {
              if (!note.missed && !note.hit && currentAbsBeat > note.absBeat + 0.3) { 
                  note.missed = true;
                  triggerFeedback("MISS", "bad");
              }
          });
      }

      // Prune
      if (noteQueueRef.current.length > 50) {
          const idx = noteQueueRef.current.findIndex(n => n.absBeat > currentAbsBeat - 2);
          if (idx > 0) noteQueueRef.current = noteQueueRef.current.slice(idx);
      }
      if (patternQueueRef.current.length > 20) {
          const idx = patternQueueRef.current.findIndex(p => p.startBeat > currentAbsBeat - 2);
          if (idx > 0) patternQueueRef.current = patternQueueRef.current.slice(idx);
      }

      // Render - Fix the Left Position Calculation
      const HIT_LINE_PERCENT = 20;
      const BEAT_WIDTH_PERCENT = 18;

      const visiblePats = patternQueueRef.current.filter(p => 
          p.startBeat > currentAbsBeat - 2 && p.startBeat < currentAbsBeat + 6
      ).map(p => ({
          ...p,
          left: HIT_LINE_PERCENT + (p.startBeat - currentAbsBeat) * BEAT_WIDTH_PERCENT
      }));
      setVisiblePatterns(visiblePats);

      const visibleNotes = noteQueueRef.current.filter(n => 
          n.absBeat > currentAbsBeat - 2 && n.absBeat < currentAbsBeat + 6
      ).map(n => ({
          ...n,
          left: HIT_LINE_PERCENT + (n.absBeat - currentAbsBeat) * BEAT_WIDTH_PERCENT
      }));
      setVisibleTargets(visibleNotes);

      if (!gameOver) animRef.current = requestAnimationFrame(visualLoop);
  }, [gameOver, feedback.text]); 

  useEffect(() => {
      if (isPlaying) {
          scheduleAudio();
          animRef.current = requestAnimationFrame(visualLoop);
      } else {
          if (timerIDRef.current) clearTimeout(timerIDRef.current);
          if (animRef.current) cancelAnimationFrame(animRef.current);
      }
      return () => {
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
      const secondsPerBeat = 60.0 / bpmRef.current;
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
      await engineRef.current.resume();
      resetGame();
      
      const spb = 60.0 / bpmRef.current;
      const countInDuration = 4 * spb;
      startTimeRef.current = engineRef.current.ctx.currentTime + countInDuration + 0.1;
      
      const now = engineRef.current.ctx.currentTime + 0.1;
      for(let i=0; i<4; i++) {
          engineRef.current.playCountIn(now + (i * spb), i);
      }
      
      lastGenBeatRef.current = -5; 
      generateChunk(); 
      generateChunk(); 
      setIsPlaying(true);
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
  
  const resumeGame = async () => {
      if (engineRef.current) {
          await engineRef.current.ctx.resume();
          const now = engineRef.current.ctx.currentTime;
          const timePaused = now - pausedAtRef.current;
          startTimeRef.current += timePaused;
          setIsPlaying(true);
      }
  };

  const handleMainAction = (e) => {
      if(e) e.preventDefault();
      if (isPlaying) {
          handleTap(e);
      } else {
          if (patternQueueRef.current.length > 0 && !gameOver) {
              resumeGame();
          } else {
              startGame();
          }
      }
  };

  useEffect(() => {
      const handleKeyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); setIsSpacePressed(true); handleMainAction(); } };
      const handleKeyUp = (e) => { if (e.code === 'Space') { setIsSpacePressed(false); } };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [handleMainAction]);

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
          height: '380px', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute'
      }} id="game-container">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Zpix&display=swap');
            
            .font-pixel { font-family: 'Press Start 2P', monospace; }
            .font-chinese { font-family: 'Zpix', 'Press Start 2P', monospace; }
            
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

                      {/* MAIN GAME VIEW */}
                      <div className="flex-1 flex flex-col relative z-0 overflow-hidden">
                          
                          {/* Chinese Text Overlay (Only in READY state) */}
                          {!isPlaying && !gameOver && feedback.text === "READY" && (
                              <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                                  <div className="text-[#0f380f] font-chinese text-xl md:text-2xl animate-pulse opacity-80 text-center leading-loose tracking-widest">
                                      跟着节拍器<br/>打击卡片上的节奏型
                                  </div>
                              </div>
                          )}

                          {/* TRACK 1: PATTERNS (Top - 65% Height) */}
                          <div className="h-[65%] relative border-b-2 border-[#0f380f]/30 w-full overflow-hidden">
                              <div className="absolute top-0 bottom-0 w-[2px] bg-[#0f380f] z-30 opacity-70" style={{ left: `${HIT_LINE_PERCENT}%` }}>
                                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f380f]"></div>
                              </div>

                              {/* Scrolling Patterns (Cards with gap) */}
                              {visiblePatterns.map((p, i) => (
                                  <div 
                                      key={`p-${i}`}
                                      className="absolute top-[20%] -translate-y-1/2 h-full flex items-center justify-center"
                                      style={{
                                          left: `${p.left}%`,
                                          width: `16%`, // Fixed visual width 16% (gap 2%)
                                          opacity: p.pattern.id === 'rest' ? 0.4 : 1,
                                          transform: 'scale(1.0)'
                                      }}
                                  >
                                      {/* Card Box (Thicker Border) */}
                                      <div className="w-[90%] h-[80%] border-4 border-[#0f380f] rounded-sm bg-[#8bac0f] shadow-sm flex items-center justify-center p-2 relative">
                                          <div className="text-[#0f380f] w-full h-full overflow-visible">
                                              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                                  {p.pattern.render()}
                                              </svg>
                                          </div>
                                          {p.startBeat % 4 === 0 && (
                                              <div className="absolute top-1 left-1 text-[8px] text-[#0f380f] font-pixel opacity-50">1</div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {/* TRACK 2: TARGETS (Bottom - 35% Height) */}
                          <div className="h-[35%] relative w-full overflow-hidden bg-[#0f380f]/5">
                              
                              <div className="absolute top-0 bottom-0 w-[2px] bg-[#0f380f] z-30 opacity-70" style={{ left: `${HIT_LINE_PERCENT}%` }}>
                                   <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f380f]"></div>
                              </div>
                              
                              {/* Hit Box */}
                              <div className="absolute top-[45%] -translate-y-1/2 w-8 h-8 border-4 border-[#0f380f] z-20" 
                                   style={{ left: `${HIT_LINE_PERCENT}%`, marginLeft: '-16px' }}>
                              </div>

                              {/* Scrolling Notes */}
                              {visibleTargets.map((t, i) => (
                                  <div 
                                      key={`t-${i}`}
                                      className={`absolute top-[45%] -translate-y-1/2 w-6 h-6 border-4 border-[#0f380f] bg-transparent
                                          ${t.hit ? 'opacity-0 scale-150' : t.missed ? 'opacity-30' : ''}
                                          ${!showTargets && !t.missed && !t.hit ? 'opacity-0' : ''}
                                      `}
                                      style={{
                                          left: `${t.left}%`,
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

              {/* --- CONTROL DECK (FULL FILL) --- */}
              <div className="w-full flex items-center justify-between gap-6 px-2">
                  
                  {/* Left: Settings */}
                  <div className="flex-1 h-20 bg-[#262626] border-2 border-[#404040] rounded-xl p-3 grid grid-cols-2 gap-4 relative shadow-inner">
                      <span className="panel-label">SETTINGS</span>
                      <div className="flex flex-col justify-center gap-1">
                          <span className="font-pixel text-[8px] text-white/40 mb-1">LEVEL</span>
                          <div className="flex gap-1 h-full">
                              {[1, 2, 3].map(lvl => (
                                  <button key={lvl} onClick={() => !isPlaying && setDifficulty(lvl)} className={`flex-1 h-8 rounded text-sm font-pixel font-bold btn-level ${difficulty === lvl ? 'active' : ''}`}>
                                      {lvl}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                           <div className="flex justify-between font-pixel text-[8px] text-white/40">
                              <span>SPEED</span>
                              <span className="text-yellow-500">{bpm}</span>
                          </div>
                          <input type="range" min="60" max="180" step="5" value={bpm} onChange={(e) => !isPlaying && setBpm(parseInt(e.target.value))} className="w-full h-8" />
                      </div>
                  </div>

                  {/* Center: Tap (Centered) */}
                  <div className="w-32 flex flex-col items-center justify-center shrink-0">
                      <button 
                          onPointerDown={handleMainAction}
                          className={`w-28 h-20 btn-arcade group flex items-center justify-center ${isSpacePressed ? 'pressed' : ''}`}
                          style={{ touchAction: 'none' }}
                      >
                          <span className="font-pixel text-white/90 text-2xl tracking-widest opacity-80 group-active:translate-y-1">TAP</span>
                      </button>
                  </div>

                  {/* Right: System */}
                  <div className="flex-1 h-20 bg-[#262626] border-2 border-[#404040] rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 relative shadow-inner">
                      <span className="panel-label">SYSTEM</span>
                      
                      <button onClick={() => setGuideAudio(!guideAudio)} className={`rounded border flex items-center justify-center gap-2 transition-all ${guideAudio ? 'bg-[#333] border-green-500' : 'bg-[#111] border-[#444]'}`}>
                           <Volume2 size={14} className={guideAudio ? "text-green-400" : "text-gray-500"} />
                           <span className="font-pixel text-[8px] text-white/50">AUD</span>
                      </button>

                      <button onClick={() => setShowTargets(!showTargets)} className={`rounded border flex items-center justify-center gap-2 transition-all ${showTargets ? 'bg-[#333] border-green-500' : 'bg-[#111] border-[#444]'}`}>
                           {showTargets ? <Eye size={14} className="text-green-400"/> : <EyeOff size={14} className="text-gray-500"/>}
                           <span className="font-pixel text-[8px] text-white/50">TARGETS</span>
                      </button>

                      <button onClick={togglePause} className="bg-[#333] border border-[#555] rounded flex items-center justify-center gap-2 hover:bg-[#444] active:bg-[#222]" disabled={!isPlaying}>
                          <Pause size={14} className="text-white/60" />
                          <span className="font-pixel text-[8px] text-white/60">PAUSE</span>
                      </button>

                      <button onClick={resetGame} className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 border border-transparent hover:border-red-900/30 rounded">
                          <RotateCcw size={14} />
                          <span className="font-pixel text-[8px]">RESET</span>
                      </button>
                  </div>

              </div>
          </div>
      </div>
    </>
  );
}

export default App;