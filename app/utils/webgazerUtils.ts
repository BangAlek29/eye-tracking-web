/**
 * WebGazer Utilities
 * Utility functions untuk WebGazer.js integration
 */

import config from "../config/config";

export interface ScreenGazeData {
    x: number;
    y: number;
    timestamp: number;
    region: ScreenRegion;
}

export type ScreenRegion =
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "center"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";

export interface CalibrationPoint {
    x: number;
    y: number;
    id: number;
    completed: boolean;
}

/**
 * Generate 9-point calibration grid
 */
export function generateCalibrationPoints(): CalibrationPoint[] {
    const padding = 50; // Padding from screen edges
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const positions = [
        { x: padding, y: padding }, // top-left
        { x: screenWidth / 2, y: padding }, // top-center
        { x: screenWidth - padding, y: padding }, // top-right
        { x: padding, y: screenHeight / 2 }, // middle-left
        { x: screenWidth / 2, y: screenHeight / 2 }, // center
        { x: screenWidth - padding, y: screenHeight / 2 }, // middle-right
        { x: padding, y: screenHeight - padding }, // bottom-left
        { x: screenWidth / 2, y: screenHeight - padding }, // bottom-center
        { x: screenWidth - padding, y: screenHeight - padding }, // bottom-right
    ];

    return positions.map((pos, index) => ({
        ...pos,
        id: index,
        completed: false,
    }));
}

/**
 * Determine screen region from coordinates
 */
export function getScreenRegion(x: number, y: number): ScreenRegion {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const xThird = screenWidth / 3;
    const yThird = screenHeight / 3;

    let xRegion: "left" | "center" | "right";
    let yRegion: "top" | "middle" | "bottom";

    if (x < xThird) {
        xRegion = "left";
    } else if (x < xThird * 2) {
        xRegion = "center";
    } else {
        xRegion = "right";
    }

    if (y < yThird) {
        yRegion = "top";
    } else if (y < yThird * 2) {
        yRegion = "middle";
    } else {
        yRegion = "bottom";
    }

    if (yRegion === "top") {
        return `top-${xRegion}` as ScreenRegion;
    } else if (yRegion === "middle") {
        if (xRegion === "center") return "center";
        return `middle-${xRegion}` as ScreenRegion;
    } else {
        return `bottom-${xRegion}` as ScreenRegion;
    }
}

/**
 * Smoothing buffer for gaze predictions
 */
class GazeSmoothingBuffer {
    private buffer: Array<{ x: number; y: number }> = [];
    private maxSize: number;

    constructor(maxSize: number = 5) {
        this.maxSize = maxSize;
    }

    add(point: { x: number; y: number }): { x: number; y: number } {
        this.buffer.push(point);
        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
        return this.getSmoothed();
    }

    private getSmoothed(): { x: number; y: number } {
        if (this.buffer.length === 0) {
            return { x: 0, y: 0 };
        }

        const avgX = this.buffer.reduce((sum, p) => sum + p.x, 0) / this.buffer.length;
        const avgY = this.buffer.reduce((sum, p) => sum + p.y, 0) / this.buffer.length;

        return { x: avgX, y: avgY };
    }

    clear() {
        this.buffer = [];
    }
}

export function createGazeSmoothingBuffer(maxSize?: number) {
    return new GazeSmoothingBuffer(maxSize ?? config.webgazer?.predictionSmoothingSize ?? 5);
}

/**
 * Format gaze data for webhook
 */
export interface WebGazerWebhookPayload {
    screen_x: number;
    screen_y: number;
    screen_region: ScreenRegion;
    timestamp: number;
    tracking_mode: "webgazer";
}

export function formatWebGazerPayload(
    x: number,
    y: number,
    startTime: number
): WebGazerWebhookPayload {
    return {
        screen_x: Math.round(x),
        screen_y: Math.round(y),
        screen_region: getScreenRegion(x, y),
        timestamp: (Date.now() - startTime) / 1000,
        tracking_mode: "webgazer",
    };
}

/**
 * Combined tracking payload
 */
export interface CombinedWebhookPayload {
    // MediaPipe data
    left_x: number;
    left_y: number;
    right_x: number;
    right_y: number;
    is_focused: number;
    gaze: string;
    // WebGazer data
    screen_x: number | null;
    screen_y: number | null;
    screen_region: ScreenRegion | null;
    // Metadata
    tracking_mode: "combined";
    timestamp: number;
}

export function formatCombinedPayload(
    mediaPipeData: {
        left_x: number;
        left_y: number;
        right_x: number;
        right_y: number;
        is_focused: number;
        gaze: string;
    } | null,
    webGazerData: { x: number; y: number } | null,
    startTime: number
): CombinedWebhookPayload {
    return {
        left_x: mediaPipeData?.left_x ?? 0,
        left_y: mediaPipeData?.left_y ?? 0,
        right_x: mediaPipeData?.right_x ?? 0,
        right_y: mediaPipeData?.right_y ?? 0,
        is_focused: mediaPipeData?.is_focused ?? 0,
        gaze: mediaPipeData?.gaze ?? "Tengah",
        screen_x: webGazerData ? Math.round(webGazerData.x) : null,
        screen_y: webGazerData ? Math.round(webGazerData.y) : null,
        screen_region: webGazerData ? getScreenRegion(webGazerData.x, webGazerData.y) : null,
        tracking_mode: "combined",
        timestamp: (Date.now() - startTime) / 1000,
    };
}
