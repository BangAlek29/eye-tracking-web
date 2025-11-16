/**
 * Eye Tracking Utilities
 * Fungsi-fungsi helper untuk deteksi pupil, smoothing, kalibrasi, dan gaze direction
 */

import config from "../config/config";
import { CONSTANTS } from "../config/constants";

export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark extends Point2D {
  z?: number;
  visibility?: number;
}

export interface PupilCoordinates {
  left: Point2D;
  right: Point2D;
}

export interface EyeTrackingData {
  timestamp: number; // dalam detik
  left_pupil: Point2D;
  right_pupil: Point2D;
  is_focused: 0 | 1;
  gaze_direction: "Kanan" | "Kiri" | "Atas" | "Bawah" | "Tengah";
}

// Import indices dari constants
const LEFT_EYE_INDICES = CONSTANTS.MEDIAPIPE.LEFT_EYE_INDICES;
const RIGHT_EYE_INDICES = CONSTANTS.MEDIAPIPE.RIGHT_EYE_INDICES;
const LEFT_PUPIL_INDEX = CONSTANTS.MEDIAPIPE.LEFT_PUPIL_INDEX;
const RIGHT_PUPIL_INDEX = CONSTANTS.MEDIAPIPE.RIGHT_PUPIL_INDEX;

/**
 * Ekstrak pupil dari landmarks
 */
export function extractPupilCoordinates(landmarks: Landmark[]): PupilCoordinates | null {
  if (
    !landmarks ||
    landmarks.length < CONSTANTS.MEDIAPIPE.TOTAL_LANDMARKS ||
    !landmarks[LEFT_PUPIL_INDEX] ||
    !landmarks[RIGHT_PUPIL_INDEX]
  ) {
    return null;
  }

  const leftPupilLandmark = landmarks[LEFT_PUPIL_INDEX];
  const rightPupilLandmark = landmarks[RIGHT_PUPIL_INDEX];

  return {
    left: {
      x: leftPupilLandmark.x,
      y: leftPupilLandmark.y,
    },
    right: {
      x: rightPupilLandmark.x,
      y: rightPupilLandmark.y,
    },
  };
}

/**
 * Hitung bounding box untuk mata (left atau right)
 */
function calculateEyeBoundingBox(landmarks: Landmark[], eyeIndices: number[]) {
  const eyePoints = eyeIndices
    .map((idx) => landmarks[idx])
    .filter((p) => p);

  if (eyePoints.length === 0) {
    return null;
  }

  const minX = Math.min(...eyePoints.map((p) => p.x));
  const maxX = Math.max(...eyePoints.map((p) => p.x));
  const minY = Math.min(...eyePoints.map((p) => p.y));
  const maxY = Math.max(...eyePoints.map((p) => p.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Deteksi gaze direction berdasarkan posisi pupil terhadap bounding box mata
 */
export function detectGazeDirection(
  landmarks: Landmark[],
  pupils: PupilCoordinates
): "Kanan" | "Kiri" | "Atas" | "Bawah" | "Tengah" {
  const leftEyeBB = calculateEyeBoundingBox(landmarks, LEFT_EYE_INDICES);
  const rightEyeBB = calculateEyeBoundingBox(landmarks, RIGHT_EYE_INDICES);

  if (!leftEyeBB || !rightEyeBB) {
    return "Tengah";
  }

  // Hitung normalized position (0-1) untuk kedua mata
  const leftPupilNormX = (pupils.left.x - leftEyeBB.minX) / leftEyeBB.width;
  const leftPupilNormY = (pupils.left.y - leftEyeBB.minY) / leftEyeBB.height;

  const rightPupilNormX = (pupils.right.x - rightEyeBB.minX) / rightEyeBB.width;
  const rightPupilNormY = (pupils.right.y - rightEyeBB.minY) / rightEyeBB.height;

  // Rata-rata posisi pupil dari kedua mata
  const avgNormX = (leftPupilNormX + rightPupilNormX) / 2;
  const avgNormY = (leftPupilNormY + rightPupilNormY) / 2;

  // Threshold untuk menentukan arah
  const threshold = config.gazeDirection.threshold;

  // Deteksi X axis (Kanan/Kiri)
  // Deteksi Y axis (Atas/Bawah)
  const moveRight = avgNormX > 1 - threshold;
  const moveLeft = avgNormX < threshold;
  const moveDown = avgNormY > 1 - threshold;
  const moveUp = avgNormY < threshold;

  if (moveRight) return "Kanan";
  if (moveLeft) return "Kiri";
  if (moveDown) return "Bawah";
  if (moveUp) return "Atas";
  return "Tengah";
}

/**
 * Smoothing menggunakan moving average
 */
class SmoothingBuffer {
  private buffer: PupilCoordinates[] = [];
  private maxSize: number;

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
  }

  add(pupils: PupilCoordinates): PupilCoordinates {
    this.buffer.push(pupils);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    return this.getSmoothed();
  }

  private getSmoothed(): PupilCoordinates {
    if (this.buffer.length === 0) {
      return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
    }

    const avgLeft = {
      x:
        this.buffer.reduce((sum, p) => sum + p.left.x, 0) / this.buffer.length,
      y:
        this.buffer.reduce((sum, p) => sum + p.left.y, 0) / this.buffer.length,
    };

    const avgRight = {
      x:
        this.buffer.reduce((sum, p) => sum + p.right.x, 0) / this.buffer.length,
      y:
        this.buffer.reduce((sum, p) => sum + p.right.y, 0) / this.buffer.length,
    };

    return { left: avgLeft, right: avgRight };
  }

  clear() {
    this.buffer = [];
  }
}

export function createSmoothingBuffer(maxSize?: number) {
  return new SmoothingBuffer(maxSize ?? config.smoothing.bufferSize);
}

/**
 * Deteksi fokus berdasarkan:
 * - Pupil berada di area tengah (threshold tolerance)
 * - Kedua mata terdeteksi
 * - Stabilitas posisi
 */
export function detectFocus(
  pupils: PupilCoordinates,
  landmarks: Landmark[]
): boolean {
  // Cek apakah landmarks valid
  if (!landmarks || landmarks.length < CONSTANTS.MEDIAPIPE.TOTAL_LANDMARKS) {
    return false;
  }

  const leftEyeBB = calculateEyeBoundingBox(landmarks, LEFT_EYE_INDICES);
  const rightEyeBB = calculateEyeBoundingBox(landmarks, RIGHT_EYE_INDICES);

  if (!leftEyeBB || !rightEyeBB) {
    return false;
  }

  // Tolerance untuk area "tengah" (dalam normalized 0-1)
  const focusThreshold = config.focus.threshold;

  // Hitung normalized position
  const leftPupilNormX = (pupils.left.x - leftEyeBB.minX) / leftEyeBB.width;
  const leftPupilNormY = (pupils.left.y - leftEyeBB.minY) / leftEyeBB.height;

  const rightPupilNormX = (pupils.right.x - rightEyeBB.minX) / rightEyeBB.width;
  const rightPupilNormY = (pupils.right.y - rightEyeBB.minY) / rightEyeBB.height;

  // Kedua pupil harus dalam range "tengah"
  const leftFocused =
    leftPupilNormX > focusThreshold &&
    leftPupilNormX < 1 - focusThreshold &&
    leftPupilNormY > focusThreshold &&
    leftPupilNormY < 1 - focusThreshold;

  const rightFocused =
    rightPupilNormX > focusThreshold &&
    rightPupilNormX < 1 - focusThreshold &&
    rightPupilNormY > focusThreshold &&
    rightPupilNormY < 1 - focusThreshold;

  // Hanya fokus jika kedua mata terdeteksi dan di area tengah
  return leftFocused && rightFocused;
}

/**
 * Deteksi stabilitas landmark (untuk menghindari deteksi palsu)
 */
export function isLandmarkStable(
  currentLandmarks: Landmark[],
  previousLandmarks: Landmark[] | null,
  threshold?: number
): boolean {
  const stabilityThreshold = threshold ?? config.stability.threshold;
  
  if (!previousLandmarks || currentLandmarks.length !== previousLandmarks.length) {
    return true; // Dianggap stabil di frame pertama
  }

  let totalDiff = 0;
  let validPoints = 0;

  for (let i = 0; i < currentLandmarks.length && i < 100; i++) {
    // Cek hanya beberapa key points untuk performa
    const curr = currentLandmarks[i];
    const prev = previousLandmarks[i];

    if (curr && prev) {
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalDiff += distance;
      validPoints++;
    }
  }

  const avgDiff = validPoints > 0 ? totalDiff / validPoints : 0;
  return avgDiff < stabilityThreshold;
}

/**
 * Kalibrasi: mengambil posisi baseline (center) selama 5 detik
 */
export function calibrate(
  pupilsArray: PupilCoordinates[]
): Point2D {
  if (pupilsArray.length === 0) {
    return { x: 0.5, y: 0.5 }; // Default center
  }

  const avgLeft = {
    x:
      pupilsArray.reduce((sum, p) => sum + p.left.x, 0) / pupilsArray.length,
    y:
      pupilsArray.reduce((sum, p) => sum + p.left.y, 0) / pupilsArray.length,
  };

  const avgRight = {
    x:
      pupilsArray.reduce((sum, p) => sum + p.right.x, 0) / pupilsArray.length,
    y:
      pupilsArray.reduce((sum, p) => sum + p.right.y, 0) / pupilsArray.length,
  };

  return {
    x: (avgLeft.x + avgRight.x) / 2,
    y: (avgLeft.y + avgRight.y) / 2,
  };
}

/**
 * Convert pupil coordinates untuk rendering di canvas
 * MediaPipe returns normalized coordinates (0-1), kita perlu convert ke pixel
 */
export function scaleToCanvasCoordinates(
  point: Point2D,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  return {
    x: point.x * canvasWidth,
    y: point.y * canvasHeight,
  };
}

/**
 * Draw pupil circles di canvas
 */
export function drawPupils(
  ctx: CanvasRenderingContext2D,
  pupils: PupilCoordinates,
  canvasWidth: number,
  canvasHeight: number,
  radius?: number,
  color?: string
) {
  const pupilRadius = radius ?? config.visualization.pupilRadius;
  const pupilColor = color ?? "#FF0000";
  
  const scaledLeft = scaleToCanvasCoordinates(pupils.left, canvasWidth, canvasHeight);
  const scaledRight = scaleToCanvasCoordinates(pupils.right, canvasWidth, canvasHeight);

  ctx.fillStyle = pupilColor;
  ctx.beginPath();
  ctx.arc(scaledLeft.x, scaledLeft.y, pupilRadius, 0, 2 * Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(scaledRight.x, scaledRight.y, pupilRadius, 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Export data ke CSV format
 */
export function exportToCSV(data: EyeTrackingData[]): string {
  const headers = [
    "Timestamp (detik)",
    "Left Pupil X",
    "Left Pupil Y",
    "Right Pupil X",
    "Right Pupil Y",
    "Is Focused",
    "Gaze Direction",
  ];

  const rows = data.map((record) => [
    record.timestamp,
    record.left_pupil.x.toFixed(4),
    record.left_pupil.y.toFixed(4),
    record.right_pupil.x.toFixed(4),
    record.right_pupil.y.toFixed(4),
    record.is_focused,
    record.gaze_direction,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = "eye-tracking-data.csv") {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
