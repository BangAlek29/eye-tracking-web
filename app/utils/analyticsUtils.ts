/**
 * Analytics Types and Utilities
 * Types and functions for eye tracking analytics
 */

import { ScreenRegion } from "./webgazerUtils";

// Single gaze data point for analytics
export interface GazePoint {
    x: number;
    y: number;
    timestamp: number;      // Session elapsed time (ms)
    videoTime: number;      // Video playback time (s)
    isFocused: boolean;
    region: ScreenRegion | null;
}

// Complete session analytics data
export interface SessionAnalytics {
    sessionId: string;
    videoName: string;
    startTime: Date;
    endTime: Date;
    duration: number;       // Total session duration in seconds
    videoDuration: number;  // Video duration in seconds
    gazePoints: GazePoint[];

    // Computed metrics
    focusPercentage: number;
    totalFocusTime: number;
    distractionCount: number;
    longestFocusStreak: number;
    avgFocusDuration: number;
}

// Region distribution for pie/bar chart
export interface RegionDistribution {
    region: ScreenRegion;
    count: number;
    percentage: number;
    dwellTime: number;  // in milliseconds
}

// Timeline data point for attention chart
export interface TimelinePoint {
    time: number;           // Time in seconds
    focusScore: number;     // 0-100
    isFocused: boolean;
}

// Heatmap cell data
export interface HeatmapCell {
    row: number;
    col: number;
    count: number;
    intensity: number;  // 0-1 normalized
}

/**
 * Calculate focus percentage from gaze points
 */
export function calculateFocusPercentage(gazePoints: GazePoint[]): number {
    if (gazePoints.length === 0) return 0;
    const focusedCount = gazePoints.filter(p => p.isFocused).length;
    return Math.round((focusedCount / gazePoints.length) * 100);
}

/**
 * Calculate region distribution
 */
export function calculateRegionDistribution(gazePoints: GazePoint[]): RegionDistribution[] {
    const regions: ScreenRegion[] = [
        "top-left", "top-center", "top-right",
        "middle-left", "center", "middle-right",
        "bottom-left", "bottom-center", "bottom-right"
    ];

    const totalPoints = gazePoints.filter(p => p.region !== null).length;
    if (totalPoints === 0) return [];

    const intervalMs = 100; // Assume 100ms between points

    return regions.map(region => {
        const regionPoints = gazePoints.filter(p => p.region === region);
        const count = regionPoints.length;
        const percentage = Math.round((count / totalPoints) * 100);
        const dwellTime = count * intervalMs;

        return { region, count, percentage, dwellTime };
    });
}

/**
 * Generate attention timeline data
 */
export function generateAttentionTimeline(
    gazePoints: GazePoint[],
    intervalSeconds: number = 5
): TimelinePoint[] {
    if (gazePoints.length === 0) return [];

    const maxTime = Math.max(...gazePoints.map(p => p.videoTime));
    const timeline: TimelinePoint[] = [];

    for (let t = 0; t <= maxTime; t += intervalSeconds) {
        const pointsInInterval = gazePoints.filter(
            p => p.videoTime >= t && p.videoTime < t + intervalSeconds
        );

        if (pointsInInterval.length === 0) {
            timeline.push({ time: t, focusScore: 0, isFocused: false });
        } else {
            const focusedCount = pointsInInterval.filter(p => p.isFocused).length;
            const focusScore = Math.round((focusedCount / pointsInInterval.length) * 100);
            timeline.push({
                time: t,
                focusScore,
                isFocused: focusScore >= 50
            });
        }
    }

    return timeline;
}

/**
 * Generate heatmap data
 */
export function generateHeatmapData(
    gazePoints: GazePoint[],
    rows: number = 6,
    cols: number = 9,
    screenWidth: number = 1920,
    screenHeight: number = 1080
): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    const cellWidth = screenWidth / cols;
    const cellHeight = screenHeight / rows;

    // Initialize grid
    const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));

    // Count points in each cell
    gazePoints.forEach(point => {
        if (point.x >= 0 && point.y >= 0) {
            const col = Math.min(Math.floor(point.x / cellWidth), cols - 1);
            const row = Math.min(Math.floor(point.y / cellHeight), rows - 1);
            grid[row][col]++;
        }
    });

    // Find max for normalization
    const maxCount = Math.max(...grid.flat(), 1);

    // Generate cell data
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            cells.push({
                row,
                col,
                count: grid[row][col],
                intensity: grid[row][col] / maxCount
            });
        }
    }

    return cells;
}

/**
 * Calculate distraction count (transitions from focused to unfocused)
 */
export function calculateDistractionCount(gazePoints: GazePoint[]): number {
    let count = 0;
    for (let i = 1; i < gazePoints.length; i++) {
        if (gazePoints[i - 1].isFocused && !gazePoints[i].isFocused) {
            count++;
        }
    }
    return count;
}

/**
 * Calculate longest focus streak in seconds
 */
export function calculateLongestFocusStreak(gazePoints: GazePoint[]): number {
    if (gazePoints.length === 0) return 0;

    let maxStreak = 0;
    let currentStreak = 0;
    let streakStart = 0;

    gazePoints.forEach((point, i) => {
        if (point.isFocused) {
            if (currentStreak === 0) {
                streakStart = point.timestamp;
            }
            currentStreak++;
        } else {
            if (currentStreak > 0) {
                const streakDuration = gazePoints[i - 1].timestamp - streakStart;
                maxStreak = Math.max(maxStreak, streakDuration);
            }
            currentStreak = 0;
        }
    });

    // Check final streak
    if (currentStreak > 0 && gazePoints.length > 0) {
        const lastPoint = gazePoints[gazePoints.length - 1];
        const streakDuration = lastPoint.timestamp - streakStart;
        maxStreak = Math.max(maxStreak, streakDuration);
    }

    return Math.round(maxStreak / 1000); // Convert to seconds
}

/**
 * Calculate complete session analytics
 */
export function calculateSessionAnalytics(
    gazePoints: GazePoint[],
    videoName: string,
    videoDuration: number,
    startTime: Date,
    endTime: Date
): SessionAnalytics {
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    const focusPercentage = calculateFocusPercentage(gazePoints);
    const focusedPoints = gazePoints.filter(p => p.isFocused);
    const totalFocusTime = focusedPoints.length * 0.1; // Assume 100ms intervals
    const distractionCount = calculateDistractionCount(gazePoints);
    const longestFocusStreak = calculateLongestFocusStreak(gazePoints);
    const avgFocusDuration = distractionCount > 0
        ? Math.round(totalFocusTime / (distractionCount + 1))
        : Math.round(totalFocusTime);

    return {
        sessionId: `session_${Date.now()}`,
        videoName,
        startTime,
        endTime,
        duration,
        videoDuration,
        gazePoints,
        focusPercentage,
        totalFocusTime,
        distractionCount,
        longestFocusStreak,
        avgFocusDuration
    };
}
