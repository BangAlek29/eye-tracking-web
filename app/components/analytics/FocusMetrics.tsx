"use client";

import React from "react";
import { SessionAnalytics } from "@/app/utils/analyticsUtils";

interface FocusMetricsProps {
    analytics: SessionAnalytics;
}

export default function FocusMetrics({ analytics }: FocusMetricsProps) {
    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    const metrics = [
        {
            label: "Focus Rate",
            value: `${analytics.focusPercentage}%`,
            color: analytics.focusPercentage >= 70 ? "text-green-400" :
                analytics.focusPercentage >= 50 ? "text-yellow-400" : "text-red-400",
            icon: "👁️"
        },
        {
            label: "Total Focus Time",
            value: formatTime(analytics.totalFocusTime),
            color: "text-blue-400",
            icon: "⏱️"
        },
        {
            label: "Distraction Count",
            value: analytics.distractionCount.toString(),
            color: analytics.distractionCount <= 5 ? "text-green-400" :
                analytics.distractionCount <= 10 ? "text-yellow-400" : "text-red-400",
            icon: "⚠️"
        },
        {
            label: "Longest Focus Streak",
            value: formatTime(analytics.longestFocusStreak),
            color: "text-purple-400",
            icon: "🔥"
        },
        {
            label: "Avg Focus Duration",
            value: formatTime(analytics.avgFocusDuration),
            color: "text-cyan-400",
            icon: "📊"
        },
        {
            label: "Watch Duration",
            value: formatTime(analytics.duration),
            color: "text-slate-300",
            icon: "🎬"
        }
    ];

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Focus Metrics</h3>

            {/* Main focus percentage */}
            <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-purple-500">
                    <span className={`text-3xl font-bold ${metrics[0].color}`}>
                        {analytics.focusPercentage}%
                    </span>
                </div>
                <p className="text-slate-400 text-sm mt-2">Overall Focus Rate</p>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
                <div
                    className={`h-full transition-all ${analytics.focusPercentage >= 70 ? 'bg-green-500' :
                            analytics.focusPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                    style={{ width: `${analytics.focusPercentage}%` }}
                />
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
                {metrics.slice(1).map((metric, index) => (
                    <div key={index} className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span>{metric.icon}</span>
                            <span className="text-slate-400 text-xs">{metric.label}</span>
                        </div>
                        <p className={`text-lg font-semibold ${metric.color}`}>{metric.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
