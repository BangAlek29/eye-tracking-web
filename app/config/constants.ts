/**
 * Application Constants
 * Static values yang tidak berubah
 */

export const CONSTANTS = {
  // MediaPipe indices untuk wajah
  MEDIAPIPE: {
    LEFT_EYE_INDICES: [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173],
    RIGHT_EYE_INDICES: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    LEFT_PUPIL_INDEX: 468,
    RIGHT_PUPIL_INDEX: 473,
    TOTAL_LANDMARKS: 474,
  },

  // Gaze directions
  GAZE_DIRECTIONS: {
    RIGHT: "Kanan" as const,
    LEFT: "Kiri" as const,
    DOWN: "Bawah" as const,
    UP: "Atas" as const,
    CENTER: "Tengah" as const,
  },

  // FPS for calculations
  TARGET_FPS: 30,

  // Canvas drawing defaults
  CANVAS: {
    ASPECT_RATIO: "4/3",
  },
};

export default CONSTANTS;
