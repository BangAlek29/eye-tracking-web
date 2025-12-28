"use client";

import React, { useEffect, useState } from "react";
import FocusMetrics from "@/app/components/analytics/FocusMetrics";
import GazeHeatmap from "@/app/components/analytics/GazeHeatmap";
import AttentionTimeline from "@/app/components/analytics/AttentionTimeline";
import RegionDistributionChart from "@/app/components/analytics/RegionDistributionChart";
import {
    SessionAnalytics,
    GazePoint,
    calculateSessionAnalytics,
    generateHeatmapData,
    generateAttentionTimeline,
    calculateRegionDistribution,
    HeatmapCell,
    TimelinePoint,
    RegionDistribution,
} from "@/app/utils/analyticsUtils";

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
    const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
    const [regionData, setRegionData] = useState<RegionDistribution[]>([]);

    useEffect(() => {
        // Load session data from sessionStorage
        const storedData = sessionStorage.getItem("eyeTrackingSession");

        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                const gazePoints: GazePoint[] = parsed.gazePoints || [];

                // Calculate analytics
                const sessionAnalytics = calculateSessionAnalytics(
                    gazePoints,
                    parsed.videoName || "Unknown Video",
                    parsed.videoDuration || 0,
                    new Date(parsed.startTime),
                    new Date(parsed.endTime)
                );

                setAnalytics(sessionAnalytics);
                setHeatmapData(generateHeatmapData(gazePoints));
                setTimelineData(generateAttentionTimeline(gazePoints, 5));
                setRegionData(calculateRegionDistribution(gazePoints));
            } catch (e) {
                console.error("Failed to parse session data:", e);
            }
        }
    }, []);

    // Demo data for preview
    const loadDemoData = () => {
        const demoGazePoints: GazePoint[] = [];
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

        // Generate random demo data
        for (let i = 0; i < 500; i++) {
            const t = i * 100; // 100ms intervals
            const videoTime = t / 1000;

            // Simulate more gaze towards center
            const x = screenWidth / 2 + (Math.random() - 0.5) * screenWidth * 0.6;
            const y = screenHeight / 2 + (Math.random() - 0.5) * screenHeight * 0.6;

            // Simulate occasional distractions
            const isFocused = Math.random() > 0.25;

            // Determine region
            const xRegion = x < screenWidth / 3 ? "left" : x < screenWidth * 2 / 3 ? "center" : "right";
            const yRegion = y < screenHeight / 3 ? "top" : y < screenHeight * 2 / 3 ? "middle" : "bottom";
            const region = yRegion === "middle" && xRegion === "center"
                ? "center" as const
                : `${yRegion}-${xRegion}` as const;

            demoGazePoints.push({
                x,
                y,
                timestamp: t,
                videoTime,
                isFocused,
                region: region as GazePoint["region"]
            });
        }

        const sessionAnalytics = calculateSessionAnalytics(
            demoGazePoints,
            "Demo Video - Biologi",
            60,
            new Date(Date.now() - 60000),
            new Date()
        );

        setAnalytics(sessionAnalytics);
        setHeatmapData(generateHeatmapData(demoGazePoints, 6, 9, screenWidth, screenHeight));
        setTimelineData(generateAttentionTimeline(demoGazePoints, 5));
        setRegionData(calculateRegionDistribution(demoGazePoints));
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
                        <p className="text-slate-400 text-sm">
                            {analytics ? analytics.videoName : "No session data"}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadDemoData}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                        >
                            Load Demo Data
                        </button>
                        <a
                            href="/"
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                        >
                            ← Back
                        </a>
                    </div>
                </div>

                {analytics ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Focus Metrics */}
                        <FocusMetrics analytics={analytics} />

                        {/* Heatmap */}
                        <GazeHeatmap data={heatmapData} />

                        {/* Attention Timeline - Full width */}
                        <div className="lg:col-span-2">
                            <AttentionTimeline
                                data={timelineData}
                                videoDuration={analytics.videoDuration}
                            />
                        </div>

                        {/* Region Distribution - Full width */}
                        <div className="lg:col-span-2">
                            <RegionDistributionChart data={regionData} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 bg-slate-800/50 rounded-xl border border-slate-700">
                        <p className="text-slate-400 mb-4">Tidak ada data sesi tersedia</p>
                        <button
                            onClick={loadDemoData}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            Muat Data Demo
                        </button>
                        <p className="text-slate-500 text-sm mt-4">
                            Atau selesaikan sesi tracking terlebih dahulu
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
