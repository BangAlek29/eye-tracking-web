/**
 * WebGazer.js Type Definitions
 * Type declarations untuk library WebGazer.js
 */

declare module 'webgazer' {
    export interface GazePrediction {
        x: number;
        y: number;
    }

    export interface WebGazerInstance {
        setGazeListener(callback: (data: GazePrediction | null, elapsedTime: number) => void): WebGazerInstance;
        begin(): Promise<WebGazerInstance>;
        pause(): void;
        resume(): void;
        end(): void;
        showPredictionPoints(show: boolean): WebGazerInstance;
        showVideo(show: boolean): WebGazerInstance;
        showFaceOverlay(show: boolean): WebGazerInstance;
        showFaceFeedbackBox(show: boolean): WebGazerInstance;
        setTracker(tracker: string): WebGazerInstance;
        setRegression(regression: string): WebGazerInstance;
        clearData(): void;
        recordScreenPosition(x: number, y: number, eventType?: string): void;
        params: {
            camConstraints: MediaStreamConstraints;
            showVideoPreview: boolean;
            showFaceOverlay: boolean;
            showFaceFeedbackBox: boolean;
            showGazeDot: boolean;
        };
    }

    const webgazer: WebGazerInstance;
    export default webgazer;
}
