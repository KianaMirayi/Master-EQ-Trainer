import React, { useState, useEffect } from 'react';
import { CalibrationPreset, CalibrationManager } from '../lib/CalibrationManager';
import { EQNodeData } from '../lib/utils';
import { EQCanvas } from './EQCanvas';
import { AudioEngine } from '../lib/AudioEngine';
import { TrackManager, Track } from '../lib/TrackManager';
import { ArrowLeft, Play, Square, Headphones, Settings, Plus, Save, Trash2, Volume2, Power } from 'lucide-react';
import { cn } from '../lib/utils';

export function CalibrationSettings({ onBack }: { onBack: () => void }) {
  const [presets, setPresets] = useState<CalibrationPreset[]>(CalibrationManager.getPresets());
  const [activeId, setActiveId] = useState<string | null>(CalibrationManager.getActivePresetId());
  const [editingPreset, setEditingPreset] = useState<CalibrationPreset | null>(null);

  const handleSave = (preset: CalibrationPreset) => {
    CalibrationManager.savePreset(preset);
    setPresets(CalibrationManager.getPresets());
  };

  const handleCreate = () => {
    const newPreset: CalibrationPreset = {
      id: Date.now().toString(),
      name: `Preset ${presets.length + 1}`,
      nodes: [
        { id: `c_n1`, type: 'lowshelf', freq: 60, gain: 0, q: 1, stereoMode: 'Stereo' },
        { id: `c_n2`, type: 'peaking', freq: 250, gain: 0, q: 1, stereoMode: 'Stereo' },
        { id: `c_n3`, type: 'peaking', freq: 1000, gain: 0, q: 1, stereoMode: 'Stereo' },
        { id: `c_n4`, type: 'peaking', freq: 4000, gain: 0, q: 1, stereoMode: 'Stereo' },
        { id: `c_n5`, type: 'highshelf', freq: 10000, gain: 0, q: 1, stereoMode: 'Stereo' }
      ]
    };
    handleSave(newPreset);
    setEditingPreset(newPreset);
  };

  const handleDelete = (id: string) => {
    CalibrationManager.deletePreset(id);
    setPresets(CalibrationManager.getPresets());
    setActiveId(CalibrationManager.getActivePresetId());
    if (editingPreset?.id === id) setEditingPreset(null);
  };

  const handleSetActive = (id: string | null) => {
    CalibrationManager.setActivePresetId(id);
    setActiveId(id);
  };

  if (editingPreset) {
    return (
      <CalibrationEditor 
        preset={editingPreset} 
        onSave={(p) => { handleSave(p); setEditingPreset(p); }}
        onBack={() => setEditingPreset(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      <div className="max-w-4xl mx-auto p-6 md:p-12">
        <header className="flex items-center gap-4 mb-10">
          <button 
            onClick={onBack}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Headphones className="w-6 h-6 text-cyan-400" /> Headphones Calibration
            </h1>
            <p className="text-slate-400">Create global EQ presets to counteract headphone coloration.</p>
          </div>
        </header>

        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Saved Presets</h2>
            <button 
              onClick={handleCreate}
              className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-4 py-2 hover:bg-cyan-500/20 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> New Preset
            </button>
          </div>

          <div className="space-y-3">
            {presets.length === 0 ? (
              <p className="text-slate-500 text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                No presets found. Create one to get started.
              </p>
            ) : presets.map(p => (
              <div key={p.id} className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-colors",
                activeId === p.id ? "bg-cyan-500/10 border-cyan-500/50" : "bg-slate-950/50 border-slate-800 hover:border-slate-600"
              )}>
                <div className="flex-1 cursor-pointer" onClick={() => setEditingPreset(p)}>
                  <div className="flex items-center gap-3">
                    <h3 className={cn("font-medium", activeId === p.id ? "text-cyan-400" : "text-slate-200")}>
                      {p.name}
                    </h3>
                    {activeId === p.id && (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                        Active Global
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{p.nodes.length} Active Bands</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSetActive(activeId === p.id ? null : p.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      activeId === p.id 
                        ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
                        : "bg-cyan-500 text-slate-900 border-transparent hover:bg-cyan-400"
                    )}
                  >
                    {activeId === p.id ? "Deactivate" : "Set Active"}
                  </button>
                  <button 
                    onClick={() => setEditingPreset(p)}
                    className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                    title="Edit Preset"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="p-2 border border-slate-700 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 rounded-lg text-slate-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CalibrationEditor({ preset, onSave, onBack }: { preset: CalibrationPreset, onSave: (p: CalibrationPreset) => void, onBack: () => void }) {
  const [nodes, setNodes] = useState<EQNodeData[]>(preset.nodes);
  const [globalGain, setGlobalGain] = useState<number>(preset.globalGain || 0);
  const [gainStr, setGainStr] = useState<string>((preset.globalGain || 0).toString());
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [gainBypassToggle, setGainBypassToggle] = useState(false);

  const isAllNodesBypassed = nodes.length > 0 && nodes.every(n => n.enabled === false);
  const isCurrentlyBypassed = nodes.length > 0 ? isAllNodesBypassed : gainBypassToggle;

  const applyToEngine = (currentNodes: EQNodeData[], currentGain: number, bypass: boolean) => {
    if (!engine) return;
    // We already modified node enabled states if length > 0, so no need to map them again for engine
    engine.setUserNodes(currentNodes); 
    engine.setCalibrationGain(bypass ? 0 : currentGain);
  }

  // Auto-save on node change, and also apply audio changes
  const handleNodesChange = (newNodes: EQNodeData[]) => {
    setNodes(newNodes);
    onSave({ ...preset, nodes: newNodes, globalGain });
    const isNewBypassed = newNodes.length > 0 ? newNodes.every(n => n.enabled === false) : gainBypassToggle;
    applyToEngine(newNodes, globalGain, isNewBypassed);
  };

  const handleGlobalGainChange = (gain: number) => {
    setGlobalGain(gain);
    onSave({ ...preset, nodes, globalGain: gain });
    applyToEngine(nodes, gain, isCurrentlyBypassed);
  };

  const toggleBypass = () => {
    const nextBypass = !isCurrentlyBypassed;
    if (nodes.length > 0) {
      const newNodes = nodes.map(n => ({ ...n, enabled: !nextBypass }));
      setNodes(newNodes);
      onSave({ ...preset, nodes: newNodes, globalGain });
      applyToEngine(newNodes, globalGain, nextBypass);
    } else {
      setGainBypassToggle(nextBypass);
      applyToEngine(nodes, globalGain, nextBypass);
    }
  };

  const handleGainStrChange = (val: string) => {
    setGainStr(val);
    if (val === "" || val === "-" || val === "+") return;
    
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      handleGlobalGainChange(parsed);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (isInputFocused) return;
      
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        toggleBypass();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBypass]);

  const handleGainBlur = () => {
    if (gainStr === "" || gainStr === "-" || gainStr === "+") {
      setGainStr("0");
      handleGlobalGainChange(0);
    } else {
      const parsed = parseFloat(gainStr) || 0;
      setGainStr(parsed.toString());
    }
  };

  useEffect(() => {
    const newEngine = new AudioEngine();
    // Use userNodes for the active editing experience
    newEngine.setUserNodes(nodes);
    newEngine.setCalibrationNodes([]);
    newEngine.setCalibrationGain(globalGain);
    newEngine.setListenMode('user');

    setEngine(newEngine);

    const track = TrackManager.getRandomTrack('builtin');
    setTrackName(track.name.replace(/\.[^/.]+$/, ""));

    const initAudio = async () => {
      let arrayBuffer;
      if (track.file) arrayBuffer = await track.file.arrayBuffer();
      else if (track.url) {
        const res = await fetch(encodeURI(track.url));
        if (res.ok) arrayBuffer = await res.arrayBuffer();
      }
      
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        const decoded = await newEngine.ctx.decodeAudioData(arrayBuffer);
        newEngine.setBuffer(decoded);
      }
    };

    initAudio();

    return () => {
      newEngine.dispose();
    };
  }, []);

  const togglePlayback = async () => {
    if (!engine || !engine.buffer) return;
    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      if (engine.ctx.state === 'suspended') {
        await engine.ctx.resume();
      }
      engine.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-cyan-500/30 relative">
      {/* Top Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-slate-800" />
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" /> 
            <input 
              value={preset.name}
              onChange={(e) => onSave({...preset, name: e.target.value})}
              className="bg-transparent border-none outline-none focus:ring-1 focus:ring-cyan-500/50 rounded px-1 w-32"
            />
          </h2>
          
          <div className="w-px h-6 bg-slate-800 mx-2 hidden md:block" />
          
          <div className="hidden md:flex items-center gap-3">
            <span className="text-xs text-slate-400">Testing Audio: <span className="text-slate-300">{trackName}</span></span>
            <button
              onClick={togglePlayback}
              className={cn(
                "flex items-center justify-center p-2 rounded-xl transition duration-300",
                isPlaying ? "bg-cyan-500/20 text-cyan-400" : "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20"
              )}
            >
              {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-950/50 rounded-xl p-1 md:hidden">
            <button
              onClick={togglePlayback}
              className={cn(
                "flex items-center justify-center p-2 rounded-lg transition duration-300",
                isPlaying ? "bg-cyan-500/20 text-cyan-400" : "bg-cyan-500 text-slate-900"
              )}
            >
              {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
          </div>

          <button
            onClick={toggleBypass}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm",
              isCurrentlyBypassed 
                ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
                : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
            )}
            title="Global Bypass (Z)"
          >
            <Power className="w-4 h-4" />
            <span className="hidden sm:inline">{isCurrentlyBypassed ? "Bypassed" : "Bypass"}</span>
          </button>

          <div className="flex items-center gap-2 px-2 mr-2 bg-slate-950/30 py-1 px-3 rounded-lg border border-slate-800/50">
            <span className="text-xs text-slate-400">Gain / Atten</span>
            <div className="flex items-center gap-1">
              <input 
                type="text"
                value={gainStr}
                onChange={(e) => handleGainStrChange(e.target.value)}
                onBlur={handleGainBlur}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-sm text-slate-200 font-mono text-center outline-none focus:border-cyan-500 transition-colors"
              />
              <span className="text-xs text-slate-500 font-mono">dB</span>
            </div>
          </div>

          <button onClick={onBack} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition text-sm">
            <Save className="w-4 h-4" /> Done Editing
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex">
        <div className="absolute top-4 left-4 z-30 pointer-events-none text-slate-500 text-xs bg-slate-900/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800/50">
          Double-click on empty space to add nodes (up to 10). Select a node and click the Trash icon to remove.
        </div>
        <div className="flex-1 min-w-0 min-h-0 relative">
          {engine && (
            <EQCanvas 
              engine={engine}
              userNodes={nodes}
              onNodesChange={handleNodesChange}
              showTarget={false}
              allowAddRemoveNodes={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
