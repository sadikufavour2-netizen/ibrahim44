/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Coins, Zap, Twitter, ExternalLink, Volume2, VolumeX, Send, Menu, User, X, Settings, Home, LogOut, BarChart } from 'lucide-react';

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

const COIN_SIZE = 120; // increased from 100
const INITIAL_SPEED = 4000; // ms
const MIN_SPEED = 1500; // ms
const SPEED_DECREMENT = 10; // ms

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(() => {
    const saved = localStorage.getItem('tap-tap-total-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('tap-tap-username') || '';
  });
  const [leaderboard, setLeaderboard] = useState<{ score: number; date: string; username: string }[]>(() => {
    const saved = localStorage.getItem('tap-tap-leaderboard');
    return saved ? JSON.parse(saved) : [];
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);
  const [coinPos, setCoinPos] = useState({ x: 50, y: 50 });
  const [timeLeft, setTimeLeft] = useState(INITIAL_SPEED);
  const [level, setLevel] = useState(1);
  const [feedback, setFeedback] = useState<{ id: number; x: number; y: number } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const audioCtx = useRef<AudioContext | null>(null);
  const musicOsc = useRef<OscillatorNode | null>(null);
  const musicGain = useRef<GainNode | null>(null);
  const musicInterval = useRef<NodeJS.Timeout | null>(null);

  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playSound = (freq: number, type: OscillatorType = 'sine', duration = 0.1) => {
    if (isMuted || !audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, audioCtx.current.currentTime + duration);
    
    gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    
    osc.start();
    osc.stop(audioCtx.current.currentTime + duration);
  };

  const startMusic = () => {
    if (isMuted || !audioCtx.current) return;
    if (musicOsc.current) return;

    const gain = audioCtx.current.createGain();
    gain.gain.setValueAtTime(0.02, audioCtx.current.currentTime);
    gain.connect(audioCtx.current.destination);
    musicGain.current = gain;

    const notes = [110, 130.81, 146.83, 164.81]; // A2, C3, D3, E3
    let noteIndex = 0;

    const playNextNote = () => {
      if (!audioCtx.current || !musicGain.current || isMuted) return;
      
      const osc = audioCtx.current.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[noteIndex], audioCtx.current.currentTime);
      
      const noteGain = audioCtx.current.createGain();
      noteGain.gain.setValueAtTime(0, audioCtx.current.currentTime);
      noteGain.gain.linearRampToValueAtTime(0.05, audioCtx.current.currentTime + 0.1);
      noteGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.4);
      
      osc.connect(noteGain);
      noteGain.connect(musicGain.current);
      
      osc.start();
      osc.stop(audioCtx.current.currentTime + 0.5);
      
      noteIndex = (noteIndex + 1) % notes.length;
      musicInterval.current = setTimeout(playNextNote, 500);
    };

    playNextNote();
    musicOsc.current = {} as any; // Placeholder to indicate music is playing
  };

  const stopMusic = () => {
    if (musicInterval.current) {
      clearTimeout(musicInterval.current);
      musicInterval.current = null;
    }
    musicOsc.current = null;
    musicGain.current = null;
  };

  const spawnCoin = useCallback(() => {
    if (!gameAreaRef.current) return;
    const { clientWidth, clientHeight } = gameAreaRef.current;
    
    // Keep coin within bounds with a small padding
    const padding = 20;
    const x = padding + Math.random() * (clientWidth - COIN_SIZE - padding * 2);
    const y = padding + Math.random() * (clientHeight - COIN_SIZE - padding * 2);
    
    setCoinPos({ x, y });
    
    const currentSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - (level - 1) * SPEED_DECREMENT);
    setTimeLeft(currentSpeed);

    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      setGameState('GAME_OVER');
      stopMusic();
      playSound(110, 'sawtooth', 0.5); // Low buzz
    }, currentSpeed);
  }, [level, isMuted]);

  const startGame = () => {
    initAudio();
    startMusic();
    setScore(0);
    setLevel(1);
    setGameState('PLAYING');
    spawnCoin();
  };

  const handleCoinTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (gameState !== 'PLAYING') return;

    playSound(880, 'sine', 0.1); // High ping

    setScore((prev) => {
      const newScore = prev + 1;
      if (newScore % 5 === 0) {
        setLevel((l) => l + 1);
      }
      return newScore;
    });

    // Visual feedback
    setFeedback({ id: Date.now(), x: e.clientX, y: e.clientY });

    spawnCoin();
  };

  const handleMiss = () => {
    if (gameState !== 'PLAYING') return;
    setGameState('GAME_OVER');
    stopMusic();
    playSound(110, 'sawtooth', 0.5); // Low buzz
  };

  useEffect(() => {
    if (gameState === 'GAME_OVER') {
      const currentUsername = username || 'Anonymous';
      const existingEntryIndex = leaderboard.findIndex(entry => entry.username === currentUsername);
      
      let updatedLeaderboard;
      let newUserTotal = score;

      if (existingEntryIndex !== -1) {
        // Update existing entry by adding the new score
        updatedLeaderboard = [...leaderboard];
        newUserTotal = updatedLeaderboard[existingEntryIndex].score + score;
        updatedLeaderboard[existingEntryIndex] = {
          ...updatedLeaderboard[existingEntryIndex],
          score: newUserTotal,
          date: new Date().toLocaleDateString()
        };
      } else {
        // Add new entry
        const newEntry = { score, date: new Date().toLocaleDateString(), username: currentUsername };
        updatedLeaderboard = [...leaderboard, newEntry];
      }

      // Sort and slice
      const finalLeaderboard = updatedLeaderboard
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
        
      setLeaderboard(finalLeaderboard);
      localStorage.setItem('tap-tap-leaderboard', JSON.stringify(finalLeaderboard));
    }
  }, [score, gameState, username]);

  useEffect(() => {
    if (username) {
      const userEntry = leaderboard.find(e => e.username === username);
      if (userEntry) {
        setTotalScore(userEntry.score);
        localStorage.setItem('tap-tap-total-score', userEntry.score.toString());
      } else {
        setTotalScore(0);
        localStorage.setItem('tap-tap-total-score', '0');
      }
    }
  }, [username, leaderboard]);

  const saveUsername = () => {
    const trimmed = tempUsername.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem('tap-tap-username', trimmed);
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-primary/20 blur-[120px] rounded-full" />
      </div>

      {/* Header / HUD */}
      <div className="absolute top-8 left-0 right-0 flex justify-between px-8 z-40 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          {gameState !== 'PLAYING' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <a 
                href="https://analytics.vgdh.io/ibrahim123.vercel.app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white flex items-center gap-2"
                title="Analytics"
              >
                <BarChart className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Analytics</span>
              </a>
            </div>
          )}
          {gameState === 'GAME_OVER' && (
            <button 
              onClick={() => setGameState('START')}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white flex items-center gap-2"
            >
              <Home className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Menu</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          {gameState !== 'PLAYING' && (
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={gameAreaRef}
        className="relative w-full h-full cursor-crosshair"
      >
        <AnimatePresence>
          {gameState === 'PLAYING' && (
            <motion.div
              key={`${coinPos.x}-${coinPos.y}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onPointerDown={handleCoinTap}
              style={{
                position: 'absolute',
                left: coinPos.x,
                top: coinPos.y,
                width: COIN_SIZE,
                height: COIN_SIZE,
              }}
              className="flex items-center justify-center cursor-pointer touch-none"
            >
              <div className="relative w-full h-full bg-purple-primary rounded-full shadow-[0_0_30px_rgba(168,85,247,0.6)] flex items-center justify-center border-4 border-purple-light/30">
                <Coins className="w-12 h-12 text-white fill-white/20" />
                {/* Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                  <motion.circle
                    cx={COIN_SIZE / 2}
                    cy={COIN_SIZE / 2}
                    r={(COIN_SIZE / 2) - 4}
                    fill="transparent"
                    stroke="white"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * ((COIN_SIZE / 2) - 4)}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * ((COIN_SIZE / 2) - 4) }}
                    transition={{ duration: timeLeft / 1000, ease: "linear" }}
                  />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap Feedback removed as requested */}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mb-8"
            >
              <div className="w-24 h-24 bg-purple-primary rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.4)] rotate-12">
                <Coins className="w-12 h-12 text-white" />
              </div>
            </motion.div>
            
            <h1 className="text-6xl font-black mb-2 tracking-tighter text-white">
              TAP TAP <span className="text-purple-primary">VERSE</span>
            </h1>
            
            {username ? (
              <p className="text-purple-light font-bold mb-8 flex items-center gap-2">
                <User className="w-4 h-4" />
                Welcome, {username}
              </p>
            ) : (
              <div className="mb-8 w-full max-w-xs">
                <input
                  type="text"
                  placeholder="Enter Username"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-primary transition-colors text-center font-bold"
                />
              </div>
            )}

            <button
              onClick={() => {
                if (!username && tempUsername.trim()) {
                  saveUsername();
                }
                startGame();
              }}
              className="group relative px-12 py-5 bg-purple-primary hover:bg-purple-dark text-white font-black rounded-2xl transition-all flex items-center gap-3 shadow-[0_10px_30px_rgba(168,85,247,0.3)] hover:shadow-[0_15px_40px_rgba(168,85,247,0.5)] hover:-translate-y-1 active:translate-y-0"
            >
              <Play className="w-6 h-6 fill-white" />
              <span className="text-xl uppercase tracking-widest">Start Game</span>
            </button>

            <div className="mt-16 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-white/40 text-sm font-medium">
                <Trophy className="w-4 h-4" />
                <span>Total Score: {totalScore}</span>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center overflow-y-auto"
          >
            <h2 className="text-purple-primary text-xl font-black uppercase tracking-[0.3em] mb-4">Time's Up!</h2>
            <div className="text-8xl font-black text-white mb-8 tracking-tighter">{score}</div>
            
            <div className="w-full max-w-xs flex flex-col gap-6 mb-12">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-bold uppercase text-xs tracking-widest">Level Reached</span>
                  <span className="text-white font-black text-xl">{level}</span>
                </div>
                <div className="h-px bg-white/10 w-full" />
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-bold uppercase text-xs tracking-widest">Total Score</span>
                  <span className="text-purple-light font-black text-xl">{totalScore}</span>
                </div>
              </div>

              {/* Local Leaderboard */}
              <div className="flex flex-col gap-3">
                <h3 className="text-white/40 font-bold uppercase text-[10px] tracking-[0.3em] text-left px-2">Top Scores</h3>
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className={`flex justify-between items-center px-4 py-3 ${i !== leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-purple-primary font-black text-sm">{i + 1}</span>
                        <div className="flex flex-col items-start">
                          <span className="text-white font-bold text-sm leading-none mb-1">{entry.username}</span>
                          <span className="text-white/40 text-[10px] font-medium">{entry.date}</span>
                        </div>
                      </div>
                      <span className="text-white font-black">{entry.score}</span>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="px-4 py-6 text-white/20 text-xs font-medium italic">No scores yet</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button
                onClick={startGame}
                className="w-full py-5 bg-white text-black hover:bg-purple-light font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 active:translate-y-0"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="text-xl uppercase tracking-widest">Try Again</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-6"
          >
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-8 left-8 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-full max-w-xs flex flex-col gap-8">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-purple-primary/20 rounded-full flex items-center justify-center border-2 border-purple-primary">
                  <User className="w-10 h-10 text-purple-primary" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest">Profile</h2>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] px-2">Username</label>
                  <input
                    type="text"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-purple-primary transition-colors font-bold"
                  />
                </div>
                
                <button
                  onClick={saveUsername}
                  className="w-full py-4 bg-purple-primary hover:bg-purple-dark text-white font-black rounded-xl transition-all shadow-lg"
                >
                  Save Changes
                </button>
              </div>

              <div className="flex flex-col gap-4 pt-8 border-t border-white/10">
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-white/40" />
                    <span className="text-white/60 font-bold text-sm">Sound Effects</span>
                  </div>
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${!isMuted ? 'bg-purple-primary' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${!isMuted ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {gameState === 'GAME_OVER' && (
                  <button
                    onClick={() => {
                      setGameState('START');
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-2 py-3 text-red-400 hover:text-red-300 transition-colors font-bold text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Exit to Main Menu
                  </button>
                )}

                <div className="flex flex-col items-center gap-6 pt-8 border-t border-white/10">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">Contact Us</span>
                    <div className="flex items-center gap-6">
                      <a href="https://t.me/GetVerse" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-purple-primary transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <Send className="w-3 h-3" />
                        @GetVerse
                      </a>
                      <a href="https://x.com/VerseEcosystem" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-purple-primary transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <Twitter className="w-3 h-3" />
                        @VerseEcosystem
                      </a>
                      <a href="https://x.com/ibrahimmy" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-purple-primary transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <ExternalLink className="w-3 h-3" />
                        @ibrahimmy
                      </a>
                    </div>
                  </div>
                  <div className="text-white/10 text-[10px] font-black uppercase tracking-[0.4em]">
                    Built with Verse
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
