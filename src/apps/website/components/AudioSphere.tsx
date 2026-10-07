"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, Mic, Sparkles } from "lucide-react";

interface AudioSphereProps {
  interactive?: boolean;
}

export function AudioSphere({ interactive = true }: AudioSphereProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const scriptSteps = [
    {
      state: "Sleeping",
      speaker: "Jarvis",
      text: "[ Offline Vosk Wake-Word Daemon Standing By ]",
      tool: null,
      status: "idle",
    },
    {
      state: "Awake",
      speaker: "You (making coffee)",
      text: '"Wake up, Jarvis."',
      tool: "vosk_wake_detected",
      status: "detected",
    },
    {
      state: "Instruction",
      speaker: "You",
      text: '"Run the test suite on OpenAgent. If it\'s green, post a Threads update about what I shipped today."',
      tool: "continuous_turn_taking",
      status: "streaming",
    },
    {
      state: "Executing Test Suite",
      speaker: "OpenAgent Dispatcher",
      text: "bash ./test.py → 195 passed in 4.2s",
      tool: "bash: ./test.py",
      status: "success",
    },
    {
      state: "Social Automation",
      speaker: "LocoAgent CDP",
      text: "social_post threads.net (authenticated profile) → Published",
      tool: "social_post: threads.net",
      status: "success",
    },
    {
      state: "Voice Output",
      speaker: "Jarvis (Speakers)",
      text: '"All 195 tests passed. The update is live on Threads."',
      tool: "auto_voice_playback",
      status: "speaking",
    },
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % scriptSteps.length);
      }, 3200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, scriptSteps.length]);

  const current = scriptSteps[activeStep];

  return (
    <div className="flex flex-col items-center">
      {/* The Signature Radial Sphere Visual from DESIGN.md */}
      <div className={`relative group ${interactive ? "cursor-pointer" : ""}`} onClick={() => interactive && setIsPlaying(!isPlaying)}>
        {/* Glow ambient background layer */}
        <div
          className={`absolute -inset-4 rounded-full blur-2xl transition-all duration-1000 ${
            isPlaying ? "opacity-75 scale-110" : "opacity-35 scale-95"
          }`}
          style={{
            background:
              "radial-gradient(circle, rgba(4,71,255,0.35) 0%, rgba(255,71,4,0.3) 50%, rgba(253,252,252,0) 80%)",
          }}
        />

        {/* 220px Audio Sphere with Violet #0447ff and Ember Orange #ff4704 */}
        <div
          className={`w-[220px] h-[220px] md:w-[250px] md:h-[250px] rounded-full relative flex items-center justify-center transition-transform duration-700 shadow-2xl ${
            isPlaying ? "animate-sphere scale-105" : "hover:scale-102"
          }`}
          style={{
            background:
              "radial-gradient(circle at 35% 35%, #0447ff 0%, #7928ca 35%, #ff4704 70%, #ff8b3d 100%)",
            boxShadow:
              "0 20px 50px -15px rgba(4,71,255,0.3), 0 15px 35px -10px rgba(255,71,4,0.3)",
          }}
        >
          {/* Subtle noise/specular texture overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 via-transparent to-white/30 pointer-events-none" />

          {/* Centered Play/Pause Controller */}
          <div className="w-[58px] h-[58px] rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/60 transition-transform duration-300 group-hover:scale-110 z-10">
            {isPlaying ? (
              <Pause className="w-5 h-5 text-black" />
            ) : (
              <Play className="w-5 h-5 text-black ml-0.5" />
            )}
          </div>

          {/* Audio Wave Visualizer Ring when Playing */}
          {isPlaying && (
            <div className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping opacity-25 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Voice Status Indicator Pill */}
      <div className="mt-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[13px] text-[#44403b]">
        <span
          className={`w-2 h-2 rounded-full ${
            isPlaying ? "bg-[#ff4704] animate-ping" : "bg-[#777169]"
          }`}
        />
        <span className="font-medium text-black">
          {isPlaying ? current.state : 'Click sphere to simulate: "Wake up, Jarvis"'}
        </span>
      </div>

      {/* Live Conversation Sequence Feed */}
      <div className="mt-5 w-full max-w-[480px] bg-[#fdfcfc] rounded-[20px] border border-[#ebe8e4] p-5 shadow-whisper transition-all">
        <div className="flex items-center justify-between pb-3 border-b border-[#ebe8e4] text-[12px] text-[#777169]">
          <div className="flex items-center gap-1.5 font-mono">
            <Mic className="w-3.5 h-3.5 text-black" />
            <span>SESSION: CONTINUOUS_VOICE</span>
          </div>
          <span className="text-[11px] font-mono uppercase bg-[#f5f3f1] px-2 py-0.5 rounded text-[#44403b]">
            Step {activeStep + 1}/6
          </span>
        </div>

        <div className="pt-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#44403b]">
              {current.speaker}
            </span>
            {current.tool && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0447ff] bg-[#f5f3f1] px-2 py-0.5 rounded border border-[#ebe8e4]">
                <Sparkles className="w-3 h-3" />
                {current.tool}
              </span>
            )}
          </div>
          <p className="text-[14px] text-black font-normal leading-relaxed">
            {current.text}
          </p>
        </div>

        {/* Step Controls */}
        <div className="mt-4 pt-3 border-t border-[#ebe8e4] flex items-center justify-between text-[12px]">
          <span className="text-[#777169]">
            {isPlaying ? "Simulating live voice turn..." : "Paused"}
          </span>
          <div className="flex items-center gap-1.5">
            {scriptSteps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveStep(idx);
                  setIsPlaying(false);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeStep === idx
                    ? "bg-black w-5"
                    : "bg-[#ebe8e4] hover:bg-[#777169]"
                }`}
                aria-label={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
