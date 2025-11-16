"use client";

import EyeTrackingDemo from "@/app/components/EyeTrackingDemo";

export default function Home() {
  return (
    <main className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Eye Tracking Demo</h1>
        <p className="text-center text-slate-400 mb-8">
          Real-time face detection with MediaPipe FaceMesh
        </p>
        <EyeTrackingDemo />
      </div>
    </main>
  );
}