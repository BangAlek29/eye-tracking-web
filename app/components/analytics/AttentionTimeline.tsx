"use client";

import React from "react";
import { TimelinePoint } from "@/app/utils/analyticsUtils";

interface AttentionTimelineProps {
    data: TimelinePoint[];
    videoDuration: number;
}

export default function AttentionTimeline({ data, videoDuration }: AttentionTimelineProps) {
    const maxTime = Math.max(videoDuration, data.length > 0 ? data[data.length - 1].time : 0);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Attention Timeline</h3>

            {/* Chart */}
            <div className="relative h-32 bg-slate-900/50 rounded-lg overflow-hidden">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 px-1">
                    {[100, 75, 50, 25, 0].map((val) => (
                        <div key={val} className="flex items-center">
                            <span className="text-slate-500 text-[10px] w-6">{val}</span>
                            <div className="flex-1 border-t border-slate-700/50" />
                        </div>
                    ))}
                </div>

                {/* Bars */}
                <div className="absolute inset-0 flex items-end gap-[2px] px-8 py-2">
                    {data.map((point, index) => (
                        <div
                            key={index}
                            className="flex-1 rounded-t transition-all hover:opacity-80"
                            style={{
                                height: `${point.focusScore}%`,
                                backgroundColor: point.isFocused
                                    ? point.focusScore >= 75 ? '#22c55e' : '#84cc16'
                                    : point.focusScore >= 25 ? '#eab308' : '#ef4444',
                                minWidth: '4px'
                            }}
                            title={`${formatTime(point.time)}: ${point.focusScore}% fokus`}
                        />
                    ))}
                </div>

                {/* 50% threshold line */}
                <div
                    className="absolute left-8 right-0 border-t-2 border-dashed border-yellow-500/50"
                    style={{ bottom: '50%' }}
                />
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-2 px-8">
                <span className="text-slate-500 text-xs">0:00</span>
                <span className="text-slate-500 text-xs">{formatTime(maxTime / 2)}</span>
                <span className="text-slate-500 text-xs">{formatTime(maxTime)}</span>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    <span className="text-slate-400 text-xs">Fokus Tinggi</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500" />
                    <span className="text-slate-400 text-xs">Sedang</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-slate-400 text-xs">Rendah</span>
                </div>
            </div>
        </div>
    );
}
