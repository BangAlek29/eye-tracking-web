/**
 * Application Configuration
 * Centralized configuration from environment variables
 */

export const config = {
  // API Configuration
  api: {
    webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL || "/api/webhook",
  },

  // MediaPipe Configuration
  mediapipe: {
    minDetectionConfidence:
      parseFloat(process.env.NEXT_PUBLIC_MIN_DETECTION_CONFIDENCE || "0.5"),
    minTrackingConfidence:
      parseFloat(process.env.NEXT_PUBLIC_MIN_TRACKING_CONFIDENCE || "0.5"),
    maxNumFaces: parseInt(process.env.NEXT_PUBLIC_MAX_NUM_FACES || "1"),
  },

  // Smoothing Configuration
  smoothing: {
    bufferSize: parseInt(process.env.NEXT_PUBLIC_SMOOTHING_BUFFER_SIZE || "10"),
  },

  // Stability Detection
  stability: {
    threshold: parseFloat(process.env.NEXT_PUBLIC_STABILITY_THRESHOLD || "0.05"),
  },

  // Gaze Direction Configuration
  gazeDirection: {
    threshold: parseFloat(process.env.NEXT_PUBLIC_GAZE_DIRECTION_THRESHOLD || "0.3"),
  },

  // Focus Detection
  focus: {
    threshold: parseFloat(process.env.NEXT_PUBLIC_FOCUS_THRESHOLD || "0.25"),
  },

  // Recording Configuration
  recording: {
    intervalMs: parseInt(process.env.NEXT_PUBLIC_RECORDING_INTERVAL_MS || "1000"),
  },

  // Calibration Configuration
  calibration: {
    durationMs: parseInt(process.env.NEXT_PUBLIC_CALIBRATION_DURATION_MS || "5000"),
  },

  // Drawing/Visualization
  visualization: {
    pupilRadius: parseInt(process.env.NEXT_PUBLIC_PUPIL_DRAWING_RADIUS || "8"),
    pupilColorFocused: process.env.NEXT_PUBLIC_PUPIL_COLOR_FOCUSED || "#00FF00",
    pupilColorUnfocused: process.env.NEXT_PUBLIC_PUPIL_COLOR_UNFOCUSED || "#FF0000",
  },

  // Camera Configuration
  camera: {
    facingMode: (process.env.NEXT_PUBLIC_CAMERA_FACING_MODE || "user") as "user" | "environment",
  },

  // Feature Flags
  features: {
    enableLogging: process.env.NEXT_PUBLIC_ENABLE_LOGGING !== "false",
    enableWebhook: process.env.NEXT_PUBLIC_ENABLE_WEBHOOK !== "false",
    enableCsvExport: process.env.NEXT_PUBLIC_ENABLE_CSV_EXPORT !== "false",
  },
};

export default config;
