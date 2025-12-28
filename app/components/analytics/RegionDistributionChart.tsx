"use client";

import React from "react";
import { RegionDistribution } from "@/app/utils/analyticsUtils";

interface RegionDistributionChartProps {
    data: RegionDistribution[];
}

const REGION_LABELS: Record<string, string> = {
    "top-left": "Kiri Atas",
    "top-center": "Tengah Atas",
    "top-right": "Kanan Atas",
    "middle-left": "Kiri Tengah",
    "center": "Tengah",
    "middle-right": "Kanan Tengah",
    "bottom-left": "Kiri Bawah",
    "bottom-center": "Tengah Bawah",
    "bottom-right": "Kanan Bawah",
};

export default function RegionDistributionChart({ data }: RegionDistributionChartProps) {
    const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);
    const maxPercentage = Math.max(...data.map(d => d.percentage), 1);

    const formatDwellTime = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.round(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Distribusi Pandangan per Region</h3>

            {/* Grid visualization */}
            <div className="grid grid-cols-3 gap-1 aspect-video mb-4 rounded-lg overflow-hidden">
                {data.map((item) => (
                    <div
                        key={item.region}
                        className="flex flex-col items-center justify-center p-2"
                        style={{
                            backgroundColor: `rgba(147, 51, 234, ${item.percentage / 100})`,
                        }}
                    >
                        <span className="text-white font-bold text-lg">{item.percentage}%</span>
                        <span className="text-white/70 text-xs">{REGION_LABELS[item.region]}</span>
                    </div>
                ))}
            </div>

            {/* Bar chart */}
            <div className="space-y-2">
                {sortedData.slice(0, 5).map((item) => (
                    <div key={item.region} className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-24 truncate">
                            {REGION_LABELS[item.region]}
                        </span>
                        <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all"
                                style={{ width: `${(item.percentage / maxPercentage) * 100}%` }}
                            />
                        </div>
                        <span className="text-white text-xs w-12 text-right">{item.percentage}%</span>
                        <span className="text-slate-500 text-xs w-16 text-right">
                            {formatDwellTime(item.dwellTime)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
