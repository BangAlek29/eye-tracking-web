"use client";

import React from "react";
import { HeatmapCell } from "@/app/utils/analyticsUtils";

interface GazeHeatmapProps {
    data: HeatmapCell[];
    rows?: number;
    cols?: number;
}

// Color interpolation from blue to red
function getHeatColor(intensity: number): string {
    // Blue (cold) -> Yellow -> Red (hot)
    if (intensity < 0.5) {
        const t = intensity * 2;
        const r = Math.round(255 * t);
        const g = Math.round(255 * t);
        const b = Math.round(255 * (1 - t));
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    } else {
        const t = (intensity - 0.5) * 2;
        const r = 255;
        const g = Math.round(255 * (1 - t));
        const b = 0;
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    }
}

export default function GazeHeatmap({ data, rows = 6, cols = 9 }: GazeHeatmapProps) {
    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Heatmap Area Perhatian</h3>

            <div
                className="grid gap-1 aspect-video rounded-lg overflow-hidden"
                style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`
                }}
            >
                {data.map((cell, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-center text-xs font-medium transition-all hover:scale-105"
                        style={{
                            backgroundColor: getHeatColor(cell.intensity),
                            minHeight: '30px'
                        }}
                        title={`${cell.count} data points`}
                    >
                        {cell.count > 0 && (
                            <span className="text-white/80 text-[10px]">{cell.count}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-slate-400 text-xs">Low</span>
                <div className="flex h-3 w-32 rounded overflow-hidden">
                    <div className="flex-1 bg-blue-500" />
                    <div className="flex-1 bg-yellow-500" />
                    <div className="flex-1 bg-red-500" />
                </div>
                <span className="text-slate-400 text-xs">High</span>
            </div>
        </div>
    );
}
