"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import config from "../config/config";
import {
    PupilCoordinates,
    createSmoothingBuffer,
    extractPupilCoordinates,
    detectGazeDirection,
    detectFocus,
    isLandmarkStable,
    calibrate,
    Landmark,
} from "../utils/eyeTrackingUtils";
import {
    generateCalibrationPoints,
    CalibrationPoint,
    createGazeSmoothingBuffer,
    formatCombinedPayload,
    ScreenRegion,
    getScreenRegion,
} from "../utils/webgazerUtils";
import { GazePoint } from "../utils/analyticsUtils";

const WEBHOOK_URL = config.api.webhookUrl;
const RECORDING_INTERVAL_MS = config.recording.intervalMs;
const CALIBRATION_DURATION_MS = config.calibration.durationMs;

interface VideoLearningTrackerProps {
    videoSrc: string;
    videoTitle: string;
    mode: "mediapipe" | "webgazer" | "combined";
    onDataRecorded?: (count: number) => void;
}

interface TrackingData {
    isFocused: boolean;
    gazeDirection: string;
    screenX: number | null;
    screenY: number | null;
    screenRegion: ScreenRegion | null;
}

type Phase = "idle" | "mediapipe-calibrating" | "webgazer-calibrating" | "playing";

export default function VideoLearningTracker({
    videoSrc,
    videoTitle,
    mode,
    onDataRecorded,
}: VideoLearningTrackerProps) {
    // Video refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Tracking refs
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const faceMeshRef = useRef<any>(null);
    const webgazerRef = useRef<typeof import("webgazer").default | null>(null);

    // State
    const [phase, setPhase] = useState<Phase>("idle");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
    const [dataCount, setDataCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Video state
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // MediaPipe calibration
    const [mediapipeProgress, setMediapipeProgress] = useState(0);

    // WebGazer calibration
    const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
    const [currentPointIndex, setCurrentPointIndex] = useState(0);
    const [clickCount, setClickCount] = useState(0);

    // Refs for tracking
    const smoothingBufferRef = useRef(createSmoothingBuffer(10));
    const gazeSmoothingBufferRef = useRef(createGazeSmoothingBuffer());
    const previousLandmarksRef = useRef<Landmark[] | null>(null);
    const startTimeRef = useRef<number>(0);
    const calibrationDataRef = useRef<PupilCoordinates[]>([]);
    const isTrackingRef = useRef(false);
    const phaseRef = useRef<Phase>("idle"); // Track phase in ref for callback
    const calibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastRecordingTimeRef = useRef<number>(0);
    const currentWebGazerDataRef = useRef<{ x: number; y: number } | null>(null);
    const currentMediaPipeDataRef = useRef<{
        left_x: number;
        left_y: number;
        right_x: number;
        right_y: number;
        is_focused: number;
        gaze: string;
    } | null>(null);

    // Analytics data collection
    const gazeHistoryRef = useRef<GazePoint[]>([]);
    const sessionStartTimeRef = useRef<Date | null>(null);

    // Initialize MediaPipe
    const initMediaPipe = async () => {
        const faceMeshModule = await import("@mediapipe/face_mesh");
        const FaceMesh = faceMeshModule.FaceMesh;

        const faceMesh = new FaceMesh({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        faceMeshRef.current = faceMesh;
        return faceMesh;
    };

    // Initialize WebGazer with timeout
    const initWebGazer = async () => {
        const webgazer = (await import("webgazer")).default;
        webgazerRef.current = webgazer;

        webgazer
            .showVideo(false)
            .showFaceOverlay(false)
            .showFaceFeedbackBox(false)
            .showPredictionPoints(false);

        webgazer.setGazeListener((data) => {
            if (data == null) return;
            const smoothed = gazeSmoothingBufferRef.current.add({ x: data.x, y: data.y });
            currentWebGazerDataRef.current = smoothed;
        });

        // Add timeout for webgazer.begin() to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("WebGazer timeout - kamera mungkin sedang digunakan aplikasi lain")), 15000);
        });

        try {
            await Promise.race([webgazer.begin(), timeoutPromise]);
        } catch (err) {
            // Try to cleanup if failed
            try { webgazer.end(); } catch { /* ignore */ }
            throw err;
        }

        return webgazer;
    };

    // MediaPipe results handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onResults = useCallback((results: any) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0] as Landmark[];

            if (previousLandmarksRef.current && !isLandmarkStable(landmarks, previousLandmarksRef.current)) {
                previousLandmarksRef.current = landmarks;
                return;
            }
            previousLandmarksRef.current = landmarks;

            const pupils = extractPupilCoordinates(landmarks);
            if (pupils) {
                const smoothedPupils = smoothingBufferRef.current.add(pupils);
                const focused = detectFocus(smoothedPupils, landmarks);
                const gazeDir = detectGazeDirection(landmarks, smoothedPupils);

                currentMediaPipeDataRef.current = {
                    left_x: smoothedPupils.left.x,
                    left_y: smoothedPupils.left.y,
                    right_x: smoothedPupils.right.x,
                    right_y: smoothedPupils.right.y,
                    is_focused: focused ? 1 : 0,
                    gaze: gazeDir,
                };

                const webGazerData = currentWebGazerDataRef.current;
                setTrackingData({
                    isFocused: focused,
                    gazeDirection: gazeDir,
                    screenX: webGazerData?.x ?? null,
                    screenY: webGazerData?.y ?? null,
                    screenRegion: webGazerData ? getScreenRegion(webGazerData.x, webGazerData.y) : null,
                });

                // Use phaseRef instead of phase state for accurate value in callback
                if (phaseRef.current === "mediapipe-calibrating") {
                    calibrationDataRef.current.push(smoothedPupils);
                }

                if (isTrackingRef.current && phaseRef.current === "playing") {
                    const now = Date.now();
                    if (now - lastRecordingTimeRef.current >= RECORDING_INTERVAL_MS) {
                        lastRecordingTimeRef.current = now;
                        sendToWebhook();

                        // Collect gaze point for analytics
                        const gazePoint: GazePoint = {
                            x: webGazerData?.x ?? 0,
                            y: webGazerData?.y ?? 0,
                            timestamp: now - startTimeRef.current,
                            videoTime: videoRef.current?.currentTime ?? 0,
                            isFocused: focused,
                            region: webGazerData ? getScreenRegion(webGazerData.x, webGazerData.y) : null,
                        };
                        gazeHistoryRef.current.push(gazePoint);

                        setDataCount((prev) => {
                            const newCount = prev + 1;
                            onDataRecorded?.(newCount);
                            return newCount;
                        });
                    }
                }
            }
        }
    }, [onDataRecorded]);

    // Send to webhook
    const sendToWebhook = async () => {
        try {
            const mediaPipeData = currentMediaPipeDataRef.current;
            const webGazerData = currentWebGazerDataRef.current;

            // For webgazer-only mode, we don't have MediaPipe data
            if (!mediaPipeData && mode !== "webgazer") {
                console.log("No MediaPipe data available yet");
                return;
            }

            const payload = formatCombinedPayload(mediaPipeData, webGazerData, startTimeRef.current);
            console.log("Sending to webhook:", payload);

            const response = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error("Webhook response error:", response.status, response.statusText);
            } else {
                console.log("Webhook sent successfully");
            }
        } catch (err) {
            console.error("Webhook error:", err);
        }
    };

    // Start tracking and play video
    const startTracking = async () => {
        try {
            setError(null);

            // Get camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (cameraVideoRef.current) {
                cameraVideoRef.current.srcObject = stream;
                await new Promise<void>((resolve) => {
                    if (cameraVideoRef.current) {
                        cameraVideoRef.current.onloadedmetadata = () => resolve();
                    }
                });
            }

            // Initialize based on mode
            if (mode === "mediapipe" || mode === "combined") {
                const faceMesh = await initMediaPipe();
                faceMesh.onResults(onResults);

                // Start face detection loop
                const detectFrame = async () => {
                    if (faceMeshRef.current && cameraVideoRef.current) {
                        try {
                            await faceMeshRef.current.send({ image: cameraVideoRef.current });
                        } catch (err) {
                            console.error("Detection error:", err);
                        }
                        // Use phaseRef for accurate value in loop
                        if (phaseRef.current !== "idle") {
                            requestAnimationFrame(detectFrame);
                        }
                    }
                };
                requestAnimationFrame(detectFrame);

                // Start MediaPipe calibration
                startMediaPipeCalibration();
            }

            if (mode === "webgazer") {
                await initWebGazer();
                startWebGazerCalibration();
            }

            // Auto-enter fullscreen
            if (containerRef.current) {
                try {
                    await containerRef.current.requestFullscreen();
                    setIsFullscreen(true);
                } catch (e) {
                    console.log("Fullscreen not available");
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start");
        }
    };

    // MediaPipe calibration
    const startMediaPipeCalibration = () => {
        setPhase("mediapipe-calibrating");
        phaseRef.current = "mediapipe-calibrating";
        setMediapipeProgress(0);
        calibrationDataRef.current = [];

        const framesToCapture = Math.ceil((CALIBRATION_DURATION_MS / 1000) * 30);
        let framesCollected = 0;

        calibrationIntervalRef.current = setInterval(() => {
            framesCollected++;
            setMediapipeProgress(Math.min((framesCollected / framesToCapture) * 100, 100));

            if (framesCollected >= framesToCapture) {
                clearInterval(calibrationIntervalRef.current!);
                console.log("MediaPipe calibrated:", calibrate(calibrationDataRef.current));

                if (mode === "combined") {
                    initWebGazer().then(() => startWebGazerCalibration());
                } else {
                    finishCalibrationAndPlay();
                }
            }
        }, 1000 / 30);
    };

    // WebGazer calibration
    const startWebGazerCalibration = () => {
        setPhase("webgazer-calibrating");
        phaseRef.current = "webgazer-calibrating";
        const points = generateCalibrationPoints();
        setCalibrationPoints(points);
        setCurrentPointIndex(0);
        setClickCount(0);
    };

    // Handle calibration click
    const handleCalibrationClick = (pointId: number) => {
        if (!webgazerRef.current) return;

        const point = calibrationPoints[pointId];
        if (!point) return;

        webgazerRef.current.recordScreenPosition(point.x, point.y, "click");

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        if (newClickCount >= config.webgazer.calibrationClicksPerPoint) {
            const updatedPoints = [...calibrationPoints];
            updatedPoints[pointId].completed = true;
            setCalibrationPoints(updatedPoints);

            if (currentPointIndex < calibrationPoints.length - 1) {
                setCurrentPointIndex(currentPointIndex + 1);
                setClickCount(0);
            } else {
                finishCalibrationAndPlay();
            }
        }
    };

    // Finish calibration and start playing
    const finishCalibrationAndPlay = () => {
        setPhase("playing");
        phaseRef.current = "playing";
        isTrackingRef.current = true;
        startTimeRef.current = Date.now();
        lastRecordingTimeRef.current = startTimeRef.current;
        setDataCount(0);

        // Initialize analytics session
        sessionStartTimeRef.current = new Date();
        gazeHistoryRef.current = [];

        console.log("Calibration finished, starting playback and tracking");

        // Play video
        if (videoRef.current) {
            videoRef.current.play();
        }
    };

    // Stop everything
    const stopTracking = () => {
        // Save analytics data before stopping
        if (gazeHistoryRef.current.length > 0 && sessionStartTimeRef.current) {
            const sessionData = {
                videoName: videoTitle,
                videoDuration: videoDuration,
                startTime: sessionStartTimeRef.current.toISOString(),
                endTime: new Date().toISOString(),
                gazePoints: gazeHistoryRef.current,
            };
            sessionStorage.setItem("eyeTrackingSession", JSON.stringify(sessionData));
            console.log(`Session saved with ${gazeHistoryRef.current.length} gaze points`);
        }

        isTrackingRef.current = false;
        setPhase("idle");
        phaseRef.current = "idle";
        setTrackingData(null);

        if (calibrationIntervalRef.current) {
            clearInterval(calibrationIntervalRef.current);
        }

        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }

        if (cameraVideoRef.current?.srcObject) {
            const stream = cameraVideoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
        }

        try {
            if (faceMeshRef.current) {
                faceMeshRef.current.close();
                faceMeshRef.current = null;
            }
        } catch (e) {
            // Already closed
        }

        try {
            if (webgazerRef.current) {
                webgazerRef.current.end();
                webgazerRef.current = null;
            }
        } catch (e) {
            // Already ended
        }

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        setIsFullscreen(false);
    };

    // Handle fullscreen change
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Video time tracking
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setVideoDuration(video.duration);
        };

        const handleTimeUpdate = () => {
            setVideoCurrentTime(video.currentTime);
        };

        const handlePlay = () => setIsVideoPlaying(true);
        const handlePause = () => setIsVideoPlaying(false);
        const handleEnded = () => setIsVideoPlaying(false);

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("play", handlePlay);
        video.addEventListener("pause", handlePause);
        video.addEventListener("ended", handleEnded);

        return () => {
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
            video.removeEventListener("ended", handleEnded);
        };
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            stopTracking();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`relative bg-black ${isFullscreen ? "w-screen h-screen" : "rounded-xl overflow-hidden aspect-video"}`}
        >
            {/* Hidden camera video for tracking */}
            <video ref={cameraVideoRef} autoPlay playsInline className="hidden" />

            {/* Main video */}
            <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-contain"
                onClick={() => phase === "playing" && videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
            />

            {/* Idle state - Start button */}
            {phase === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    {error && <p className="text-red-400 mb-4">{error}</p>}
                    <button
                        onClick={startTracking}
                        className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all transform hover:scale-110"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>
                </div>
            )}

            {/* MediaPipe Calibration */}
            {phase === "mediapipe-calibrating" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                    <div className="text-center">
                        <div className="w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center mb-6 mx-auto animate-pulse">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                        <h3 className="text-white text-2xl font-bold mb-2">Kalibrasi Mata</h3>
                        <p className="text-slate-300 mb-4">Lihat ke tengah layar...</p>
                        <div className="w-64 h-3 bg-slate-700 rounded-full mx-auto overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                style={{ width: `${mediapipeProgress}%` }}
                            />
                        </div>
                        <p className="text-slate-400 mt-2">{Math.round(mediapipeProgress)}%</p>
                    </div>
                </div>
            )}

            {/* WebGazer Calibration */}
            {phase === "webgazer-calibrating" && (
                <div className="absolute inset-0 bg-black/90">
                    {/* Calibration points - higher z-index */}
                    {calibrationPoints.map((point, index) => (
                        <button
                            key={point.id}
                            onClick={() => handleCalibrationClick(index)}
                            disabled={index !== currentPointIndex}
                            className={`absolute w-14 h-14 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex items-center justify-center text-white font-bold z-50 ${index === currentPointIndex
                                ? "bg-red-500 scale-100 animate-pulse cursor-pointer hover:bg-red-400"
                                : point.completed
                                    ? "bg-green-500 scale-75 opacity-50"
                                    : "bg-slate-600 scale-50 opacity-30"
                                }`}
                            style={{ left: point.x, top: point.y }}
                        >
                            {index + 1}
                        </button>
                    ))}

                    {/* Instructions - at bottom */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center z-10 bg-black/70 backdrop-blur-sm px-6 py-4 rounded-xl">
                        <h3 className="text-white text-xl font-bold mb-2">Kalibrasi Posisi Layar</h3>
                        <p className="text-slate-300">
                            Klik titik merah {config.webgazer.calibrationClicksPerPoint}x sambil melihatnya
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                            Titik {currentPointIndex + 1}/{calibrationPoints.length} • Klik {clickCount}/{config.webgazer.calibrationClicksPerPoint}
                        </p>
                    </div>
                </div>
            )}

            {/* Playing state - Tracking overlay */}
            {phase === "playing" && (
                <>
                    {/* Fullscreen reminder banner (when not fullscreen) */}
                    {!isFullscreen && (
                        <div className="absolute top-0 left-0 right-0 bg-yellow-600/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between z-50">
                            <span className="text-white text-sm">Tracking aktif. Kembali ke fullscreen untuk pengalaman terbaik.</span>
                            <button
                                onClick={() => {
                                    if (containerRef.current) {
                                        containerRef.current.requestFullscreen();
                                    }
                                }}
                                className="bg-white text-yellow-700 px-3 py-1 rounded text-sm font-medium hover:bg-yellow-100 transition-colors"
                            >
                                Fullscreen
                            </button>
                        </div>
                    )}

                    {/* Top right controls */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {/* Fullscreen button */}
                        <button
                            onClick={() => {
                                if (containerRef.current) {
                                    if (document.fullscreenElement) {
                                        document.exitFullscreen();
                                    } else {
                                        containerRef.current.requestFullscreen();
                                    }
                                }
                            }}
                            className="bg-slate-600/80 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isFullscreen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                )}
                            </svg>
                        </button>
                        {/* Stop button */}
                        <button
                            onClick={stopTracking}
                            className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Selesai
                        </button>
                    </div>

                    {/* Video progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <div className="flex items-center gap-3">
                            {/* Play/Pause */}
                            <button
                                onClick={() => {
                                    if (videoRef.current) {
                                        if (isVideoPlaying) {
                                            videoRef.current.pause();
                                        } else {
                                            videoRef.current.play();
                                        }
                                        setIsVideoPlaying(!isVideoPlaying);
                                    }
                                }}
                                className="text-white hover:text-purple-400 transition-colors"
                            >
                                {isVideoPlaying ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>

                            {/* Time */}
                            <span className="text-white text-sm font-mono w-20">
                                {Math.floor(videoCurrentTime / 60)}:{String(Math.floor(videoCurrentTime % 60)).padStart(2, '0')}
                            </span>

                            {/* Progress slider */}
                            <input
                                type="range"
                                min="0"
                                max={videoDuration || 100}
                                value={videoCurrentTime}
                                onChange={(e) => {
                                    if (videoRef.current) {
                                        videoRef.current.currentTime = Number(e.target.value);
                                        setVideoCurrentTime(Number(e.target.value));
                                    }
                                }}
                                className="flex-1 h-2 bg-slate-600 rounded-full appearance-none cursor-pointer accent-purple-500"
                            />

                            {/* Duration */}
                            <span className="text-slate-400 text-sm font-mono w-20 text-right">
                                {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    {/* Gaze dot (if WebGazer active) */}
                    {(mode === "webgazer" || mode === "combined") && trackingData && trackingData.screenX !== null && trackingData.screenY !== null && (
                        <div
                            className="fixed w-4 h-4 bg-purple-500/70 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-50"
                            style={{ left: trackingData.screenX, top: trackingData.screenY }}
                        />
                    )}
                </>
            )}
        </div>
    );
}
