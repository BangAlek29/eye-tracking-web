"use client";

import React, { useEffect, useRef, useState } from "react";
import config from "../config/config";
import {
  PupilCoordinates,
  EyeTrackingData,
  createSmoothingBuffer,
  extractPupilCoordinates,
  detectGazeDirection,
  detectFocus,
  isLandmarkStable,
  calibrate,
  drawPupils,
  Landmark,
} from "../utils/eyeTrackingUtils";

const WEBHOOK_URL = config.api.webhookUrl;
const RECORDING_INTERVAL_MS = config.recording.intervalMs;
const CALIBRATION_DURATION_MS = config.calibration.durationMs;

export default function EyeTrackingDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceMeshRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [eyeTrackingData, setEyeTrackingData] = useState<EyeTrackingData[]>([]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [currentGazeDirection, setCurrentGazeDirection] = useState<string>("Tengah");

  const smoothingBufferRef = useRef(createSmoothingBuffer(10));
  const previousLandmarksRef = useRef<Landmark[] | null>(null);
  const startTimeRef = useRef<number>(0);
  const calibrationDataRef = useRef<PupilCoordinates[]>([]);
  const isTrackingRef = useRef(false);
  const calibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRecordingTimeRef = useRef<number>(0); // Track last recording time

  // Initialize MediaPipe FaceMesh
  const initializeFaceMesh = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const faceMeshModule = await import("@mediapipe/face_mesh");
      const FaceMesh = faceMeshModule.FaceMesh;

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: config.mediapipe.maxNumFaces,
        refineLandmarks: true,
        minDetectionConfidence: config.mediapipe.minDetectionConfidence,
        minTrackingConfidence: config.mediapipe.minTrackingConfidence,
      });

      faceMeshRef.current = faceMesh;
      setIsLoading(false);
      return faceMesh;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize MediaPipe";
      setError(message);
      setIsLoading(false);
      throw err;
    }
  };

  // Callback untuk proses hasil deteksi
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0] as Landmark[];

      // Check stability
      if (previousLandmarksRef.current && !isLandmarkStable(landmarks, previousLandmarksRef.current)) {
        previousLandmarksRef.current = landmarks;
        return;
      }
      previousLandmarksRef.current = landmarks;

      // Extract pupils
      const pupils = extractPupilCoordinates(landmarks);
      if (pupils) {
        // Apply smoothing
        const smoothedPupils = smoothingBufferRef.current.add(pupils);

        // Detect focus
        const focused = detectFocus(smoothedPupils, landmarks);
        setIsFocused(focused);

        // Detect gaze direction
        const gazeDir = detectGazeDirection(landmarks, smoothedPupils);
        setCurrentGazeDirection(gazeDir);

        // Draw pupils
        const pupilColor = focused 
          ? config.visualization.pupilColorFocused 
          : config.visualization.pupilColorUnfocused;
        drawPupils(ctx, smoothedPupils, canvas.width, canvas.height, undefined, pupilColor);

        // Collect calibration data if calibrating
        if (isCalibrating) {
          calibrationDataRef.current.push(smoothedPupils);
        }

        // Store current data for recording
        if (isTrackingRef.current && !isCalibrating) {
          const now = Date.now();
          const elapsedSinceLastRecording = now - lastRecordingTimeRef.current;
          
          // Hanya tambah data sesuai RECORDING_INTERVAL_MS
          if (elapsedSinceLastRecording >= RECORDING_INTERVAL_MS) {
            lastRecordingTimeRef.current = now;
            const newEntry: EyeTrackingData = {
              timestamp: (now - startTimeRef.current) / 1000,
              left_pupil: smoothedPupils.left,
              right_pupil: smoothedPupils.right,
              is_focused: focused ? 1 : 0,
              gaze_direction: gazeDir as "Kanan" | "Kiri" | "Atas" | "Bawah" | "Tengah",
            };
            
            // Send to webhook
            sendToWebhook(newEntry);
            
            // Add to state
            setEyeTrackingData((prev) => [...prev, newEntry]);
          }
        }
      }
    }
  };

  // Start calibration
  const startCalibration = async () => {
    setIsCalibrating(true);
    setCalibrationProgress(0);
    calibrationDataRef.current = [];

    const framesToCapture = Math.ceil((CALIBRATION_DURATION_MS / 1000) * 30); // ~30 FPS
    let framesCollected = 0;

    calibrationIntervalRef.current = setInterval(() => {
      framesCollected++;
      setCalibrationProgress(Math.min((framesCollected / framesToCapture) * 100, 100));

      if (framesCollected >= framesToCapture) {
        if (calibrationIntervalRef.current) {
          clearInterval(calibrationIntervalRef.current);
        }
        setIsCalibrating(false);
        console.log("Calibration complete. Center baseline:", calibrate(calibrationDataRef.current));
      }
    }, 1000 / 30);
  };

  // Start tracking
  const startTracking = async () => {
    try {
      const faceMesh = await initializeFaceMesh();

      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: config.camera.facingMode },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Wait untuk video ready
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve();
        }
      });

      // Set canvas size
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      // Setup face mesh callback
      faceMesh.onResults(onResults);

      // Start face mesh detection
      if (videoRef.current) {
        isTrackingRef.current = true;
        setIsTracking(true);
        startTimeRef.current = Date.now();
        lastRecordingTimeRef.current = startTimeRef.current; // Initialize recording time
        setEyeTrackingData([]);

        // Request animation frame untuk continuous detection
        const detectFrame = async () => {
          if (isTrackingRef.current && faceMesh && videoRef.current) {
            try {
              await faceMesh.send({ image: videoRef.current });
            } catch (err) {
              console.error("Detection error:", err);
            }
            requestAnimationFrame(detectFrame);
          }
        };

        requestAnimationFrame(detectFrame);
      }

      // Start calibration
      await startCalibration();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start tracking";
      setError(message);
      setIsTracking(false);
    }
  };

  // Send data to webhook
  const sendToWebhook = async (data: EyeTrackingData) => {
    try {
      const payload = {
        left_x: data.left_pupil.x,
        left_y: data.left_pupil.y,
        right_x: data.right_pupil.x,
        right_y: data.right_pupil.y,
        is_focused: data.is_focused,
        gaze: data.gaze_direction,
      };

      console.log("Sending to webhook:", payload);

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook error: ${response.status}`);
      } else {
        console.log("Data sent successfully to webhook");
      }
    } catch (err) {
      console.error("Failed to send data to webhook:", err);
    }
  };

  // Stop tracking
  const stopTracking = () => {
    isTrackingRef.current = false;
    setIsTracking(false);

    if (calibrationIntervalRef.current) {
      clearInterval(calibrationIntervalRef.current);
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    if (faceMeshRef.current) {
      faceMeshRef.current.close();
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Camera and Canvas Section */}
      <div className="gap-6">
        <div className="space-y-4">

          {/* Camera Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 z-10">
                <p className="text-white text-center">{error}</p>
              </div>
            )}

            {isCalibrating && (
              <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
                  <p className="text-white mb-3 text-center font-semibold">
                    Kalibrasi: {Math.round(calibrationProgress)}%
                  </p>
                  <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${calibrationProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ display: "none" }}
            />
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ aspectRatio: "4/3" }}
            />
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3">
            <button
              onClick={startTracking}
              disabled={isTracking || isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? "Inisialisasi..." : "Mulai Tracking"}
            </button>
            <button
              onClick={stopTracking}
              disabled={!isTracking}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Stop Tracking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
