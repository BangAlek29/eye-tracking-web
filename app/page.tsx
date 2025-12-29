"use client";

import React, { useState } from "react";
import VideoLearningTracker from "@/app/components/VideoLearningTracker";

type TrackingMode = "mediapipe" | "webgazer" | "combined";

const VIDEOS = [
  { name: "Biologi - Redominasi", file: "Video Biologi Redominasi FIX.mp4" },
  { name: "FAPERTA - Dasar Genetika", file: "Video FAPERTA Dasar Genetika FIX.mp4" },
  { name: "FIKOM - Analisis", file: "Video FIKOM Analisis FIX.mp4" },
  { name: "FIKOM - Gravity", file: "Video FIKOM Gravity FIX.mp4" },
  { name: "FIKOM - Model Komunikasi", file: "Video FIKOM Model Komunikasi FIX.mp4" },
];

export default function Home() {
  const [mode, setMode] = useState<TrackingMode>("combined");
  const [selectedVideo, setSelectedVideo] = useState(0);
  const [dataCount, setDataCount] = useState(0);

  const currentVideo = VIDEOS[selectedVideo];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mt-10 mb-15">
          <h1 className="text-3xl font-bold text-white mb-2">
            Video Learning Eye Tracking System
          </h1>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
          {/* Video Selection */}
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Video:</label>
            <select
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none"
            >
              {VIDEOS.map((video, index) => (
                <option key={index} value={index}>
                  {video.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selection */}
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as TrackingMode)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none"
            >
              <option value="mediapipe">MediaPipe</option>
              <option value="webgazer">WebGazer</option>
              <option value="combined">MediaPipe + WebGazer</option>
            </select>
          </div>
        </div>

        {/* Video Player with Tracking */}
        <VideoLearningTracker
          key={`${selectedVideo}-${mode}`}
          videoSrc={`/Video/${currentVideo.file}`}
          videoTitle={currentVideo.name}
          mode={mode}
          onDataRecorded={setDataCount}
        />
      </div>
    </main>
  );
}