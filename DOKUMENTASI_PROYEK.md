# Dokumentasi Proyek Eye-Tracking Web

## 📋 Ringkasan Proyek

**Nama Proyek:** Eye-Tracking Web - Student Focus Detection  
**Deskripsi:** Aplikasi web untuk mendeteksi fokus mahasiswa/siswa saat menonton video pembelajaran menggunakan teknologi pelacakan mata (eye tracking). Sistem ini menggunakan kombinasi **MediaPipe FaceMesh** untuk deteksi pupil dan fokus, serta **WebGazer.js** untuk pelacakan posisi pandangan di layar.

**Tujuan Utama:**
- Mendeteksi apakah siswa fokus atau tidak saat menonton video pembelajaran
- Merekam data eye tracking secara real-time
- Mengirim data ke Google Spreadsheet melalui webhook
- Menyediakan dashboard analytics untuk menganalisis pola perhatian siswa

---

## 🛠 Tech Stack

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Next.js | 16.0.3 | Framework React SSR |
| React | 19.2.0 | Library UI |
| TypeScript | ^5 | Type safety |
| TailwindCSS | ^4 | Styling |
| MediaPipe FaceMesh | latest | Deteksi landmark wajah & pupil |
| WebGazer.js | ^3.4.0 | Gaze tracking di layar |

---

## 📁 Struktur Proyek

```
eye-tracking-web/
├── app/
│   ├── page.tsx                          # Halaman utama (Home)
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Global styles
│   │
│   ├── analytics/
│   │   └── page.tsx                      # Halaman dashboard analytics
│   │
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts                  # API Route untuk proxy webhook ke Google Sheets
│   │
│   ├── components/
│   │   ├── VideoLearningTracker.tsx      # Komponen utama eye tracking + video player
│   │   └── analytics/
│   │       ├── FocusMetrics.tsx          # Komponen metrik fokus
│   │       ├── GazeHeatmap.tsx           # Komponen heatmap perhatian
│   │       ├── AttentionTimeline.tsx     # Komponen timeline atensi
│   │       └── RegionDistributionChart.tsx # Komponen grafik distribusi region
│   │
│   ├── config/
│   │   ├── config.ts                     # Konfigurasi dari environment variables
│   │   └── constants.ts                  # Konstanta statis (indeks landmark, dll)
│   │
│   ├── types/
│   │   └── webgazer.d.ts                 # Type definitions untuk WebGazer.js
│   │
│   └── utils/
│       ├── eyeTrackingUtils.ts           # Utility MediaPipe (pupil, gaze, focus)
│       ├── webgazerUtils.ts              # Utility WebGazer (screen region, calibration)
│       └── analyticsUtils.ts             # Utility analytics (metrik, heatmap, timeline)
│
├── public/
│   └── Video/                            # Folder video pembelajaran
│       ├── Video Biologi Redominasi FIX.mp4
│       ├── Video FAPERTA Dasar Genetika FIX.mp4
│       ├── Video FIKOM Analisis FIX.mp4
│       ├── Video FIKOM Gravity FIX.mp4
│       └── Video FIKOM Model Komunikasi FIX.mp4
│
├── package.json
├── tsconfig.json
├── next.config.ts
└── eslint.config.mjs
```

---

## 🔧 Cara Menjalankan

### Prerequisites
- Node.js 18+ terinstall
- NPM atau Yarn

### Instalasi
```bash
# Clone repository
git clone <repo-url>
cd eye-tracking-web

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

> **PENTING:** Izinkan akses kamera saat diminta karena eye tracking membutuhkan webcam.

---

## 📖 Penjelasan Komponen Utama

### 1. `app/page.tsx` - Halaman Home

Halaman utama yang memungkinkan user untuk:
- Memilih video pembelajaran dari daftar 5 video
- Memilih mode tracking: MediaPipe, WebGazer, atau Combined
- Melihat jumlah data yang sudah direkam
- Navigasi ke halaman Analytics

```typescript
type TrackingMode = "mediapipe" | "webgazer" | "combined";

const VIDEOS = [
  { name: "Biologi - Redominasi", file: "Video Biologi Redominasi FIX.mp4" },
  { name: "FAPERTA - Dasar Genetika", file: "Video FAPERTA Dasar Genetika FIX.mp4" },
  // ... dst
];
```

### 2. `VideoLearningTracker.tsx` - Komponen Inti Eye Tracking

Komponen utama yang menangani seluruh proses eye tracking dengan 705 baris kode. 

#### Props:
```typescript
interface VideoLearningTrackerProps {
  videoSrc: string;           // Path ke file video
  videoTitle: string;         // Judul video
  mode: "mediapipe" | "webgazer" | "combined";  // Mode tracking
  onDataRecorded?: (count: number) => void;     // Callback jumlah data
}
```

#### Phase/Tahapan:
```typescript
type Phase = "idle" | "mediapipe-calibrating" | "webgazer-calibrating" | "playing";
```

1. **idle** - Menunggu user klik tombol play
2. **mediapipe-calibrating** - Kalibrasi MediaPipe (5 detik lihat tengah layar)
3. **webgazer-calibrating** - Kalibrasi WebGazer (klik 9 titik, masing-masing 5x)
4. **playing** - Video diputar + tracking aktif + data dikirim ke webhook

#### Fitur Utama:
- **Auto-fullscreen** saat mulai tracking
- **Reminder banner** jika keluar dari fullscreen
- **Video controls** (play/pause, slider durasi)
- **Gaze dot** visual yang menunjukkan arah pandangan
- **Data recording** setiap 1 detik (configurabel)
- **Session storage** untuk analytics

#### Flow Tracking:
1. User klik play → Request akses kamera
2. Initialize MediaPipe FaceMesh (atau WebGazer sesuai mode)
3. Kalibrasi selesai → Video diputar
4. Setiap 1 detik, data dikirim ke `/api/webhook`
5. Gaze points dikumpulkan untuk analytics
6. User klik "Selesai" → Data session disimpan ke sessionStorage

### 3. `utils/eyeTrackingUtils.ts` - Utility MediaPipe

Berisi fungsi-fungsi untuk memproses data MediaPipe FaceMesh:

| Fungsi | Deskripsi |
|--------|-----------|
| `extractPupilCoordinates()` | Ekstrak koordinat pupil kiri & kanan dari 474 landmarks |
| `detectGazeDirection()` | Deteksi arah pandangan: Kanan, Kiri, Atas, Bawah, Tengah |
| `detectFocus()` | Deteksi apakah user fokus (pupil di area tengah mata) |
| `createSmoothingBuffer()` | Smoothing data pupil dengan moving average |
| `isLandmarkStable()` | Deteksi stabilitas landmark untuk hindari false detection |
| `calibrate()` | Kalibrasi posisi baseline (center) |
| `drawPupils()` | Render pupil di canvas |
| `exportToCSV()` | Export data ke format CSV |

#### Data Types:
```typescript
interface PupilCoordinates {
  left: { x: number; y: number };
  right: { x: number; y: number };
}

interface EyeTrackingData {
  timestamp: number;  // dalam detik
  left_pupil: { x: number; y: number };
  right_pupil: { x: number; y: number };
  is_focused: 0 | 1;
  gaze_direction: "Kanan" | "Kiri" | "Atas" | "Bawah" | "Tengah";
}
```

### 4. `utils/webgazerUtils.ts` - Utility WebGazer

Fungsi untuk WebGazer.js integration:

| Fungsi | Deskripsi |
|--------|-----------|
| `generateCalibrationPoints()` | Generate 9 titik kalibrasi (3x3 grid) |
| `getScreenRegion()` | Konversi koordinat x,y ke region layar |
| `createGazeSmoothingBuffer()` | Smoothing data gaze prediction |
| `formatCombinedPayload()` | Format data gabungan MediaPipe + WebGazer |

#### Screen Regions:
```typescript
type ScreenRegion =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";
```

### 5. `utils/analyticsUtils.ts` - Utility Analytics

Fungsi untuk menghitung metrik analytics:

| Fungsi | Deskripsi |
|--------|-----------|
| `calculateFocusPercentage()` | Persentase waktu fokus |
| `calculateRegionDistribution()` | Distribusi pandangan per region |
| `generateAttentionTimeline()` | Data timeline attention per interval |
| `generateHeatmapData()` | Data heatmap untuk visualisasi |
| `calculateDistractionCount()` | Jumlah transisi fokus → tidak fokus |
| `calculateLongestFocusStreak()` | Durasi fokus terlama (streak) |
| `calculateSessionAnalytics()` | Kalkulasi lengkap semua metrik session |

### 6. `api/webhook/route.ts` - API Webhook

Next.js API Route yang bertindak sebagai proxy untuk mengirim data ke Google Apps Script webhook. Mendukung 3 tipe payload:

```typescript
// MediaPipe only
interface MediaPipePayload {
  left_x, left_y, right_x, right_y: number;
  is_focused: number;
  gaze: string;
}

// WebGazer only
interface WebGazerPayload {
  screen_x, screen_y: number;
  screen_region: string;
  timestamp: number;
  tracking_mode: "webgazer";
}

// Combined (MediaPipe + WebGazer)
interface CombinedPayload {
  // MediaPipe fields
  left_x, left_y, right_x, right_y: number;
  is_focused: number;
  gaze: string;
  // WebGazer fields
  screen_x: number | null;
  screen_y: number | null;
  screen_region: string | null;
  tracking_mode: "combined";
  timestamp: number;
}
```

**Webhook URL:** `https://script.google.com/macros/s/AKfycby-sRnKFIq5hzdGUgrSh4tL8ZC4jPiQlZSvvpUBTCvidt4kT0ZDfSlSGNbIf1VM2u28/exec`

### 7. `config/config.ts` - Konfigurasi Aplikasi

Konfigurasi yang dapat diatur via environment variables:

```typescript
const config = {
  api: {
    webhookUrl: "/api/webhook"  // NEXT_PUBLIC_WEBHOOK_URL
  },
  mediapipe: {
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    maxNumFaces: 1
  },
  smoothing: { bufferSize: 10 },
  stability: { threshold: 0.05 },
  gazeDirection: { threshold: 0.3 },
  focus: { threshold: 0.25 },
  recording: { intervalMs: 1000 },  // Rekam setiap 1 detik
  calibration: { durationMs: 5000 },  // Kalibrasi 5 detik
  visualization: {
    pupilRadius: 8,
    pupilColorFocused: "#00FF00",
    pupilColorUnfocused: "#FF0000"
  },
  webgazer: {
    calibrationPoints: 9,
    calibrationClicksPerPoint: 5
  },
  features: {
    enableLogging: true,
    enableWebhook: true,
    enableCsvExport: true
  }
};
```

### 8. Analytics Dashboard (`/analytics`)

Dashboard untuk menganalisis hasil session eye tracking dengan 4 komponen visualisasi:

#### a. `FocusMetrics.tsx`
Menampilkan metrik fokus dalam bentuk:
- Progress ring persentase fokus utama
- Grid 6 metrik: Total Focus Time, Distraction Count, Longest Focus Streak, Avg Focus Duration, Watch Duration

#### b. `GazeHeatmap.tsx`
Heatmap 6x9 grid yang menunjukkan distribusi area perhatian dengan:
- Color gradient: Blue (low) → Yellow → Red (high)
- Setiap cell menunjukkan jumlah data point

#### c. `AttentionTimeline.tsx`
Bar chart timeline yang menunjukkan:
- Focus score (0-100%) per interval waktu
- Color coding: Green (tinggi), Yellow (sedang), Red (rendah)
- Video time labels

#### d. `RegionDistributionChart.tsx`
Visualisasi distribusi pandangan per region:
- Grid 3x3 dengan persentase per region
- Bar chart top 5 region dengan dwell time

---

## 🔄 Alur Data (Data Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│   ┌─────────┐     ┌──────────────────┐     ┌────────────────┐  │
│   │  Home   │────▶│VideoLearningTracker│────▶│   Analytics   │  │
│   │ (page)  │     │   (component)      │     │   Dashboard   │  │
│   └─────────┘     └──────────────────┘     └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRACKING LAYER                             │
│   ┌─────────────────┐         ┌──────────────────┐             │
│   │  MediaPipe      │◄───────▶│    WebGazer.js   │             │
│   │  FaceMesh       │         │   Gaze Tracking  │             │
│   │ (pupil detect)  │         │ (screen position)│             │
│   └─────────────────┘         └──────────────────┘             │
│            │                           │                        │
│            └─────────────┬─────────────┘                        │
│                          ▼                                      │
│   ┌─────────────────────────────────────────────┐              │
│   │              UTILITY LAYER                  │              │
│   │  eyeTrackingUtils.ts  │  webgazerUtils.ts  │              │
│   │    (focus, gaze)      │  (region, calibrate)│              │
│   └─────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│   ┌──────────────────┐         ┌────────────────────┐          │
│   │  sessionStorage  │         │   /api/webhook     │          │
│   │ (gaze history)   │         │   (proxy route)    │          │
│   └──────────────────┘         └────────────────────┘          │
│            │                           │                        │
│            ▼                           ▼                        │
│   ┌──────────────────┐         ┌────────────────────┐          │
│   │  Analytics Page  │         │  Google Sheets     │          │
│   │ (visualisasi)    │         │ (via Apps Script)  │          │
│   └──────────────────┘         └────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Format Data yang Dikirim ke Webhook

### Combined Mode Payload (disarankan):
```json
{
  "timestamp": "2024-12-28T10:30:00.000Z",
  "tracking_mode": "combined",
  "left_x": 0.452,
  "left_y": 0.381,
  "right_x": 0.548,
  "right_y": 0.379,
  "is_focused": 1,
  "gaze": "Tengah",
  "screen_x": 960,
  "screen_y": 540,
  "screen_region": "center"
}
```

### Session Data Format (sessionStorage):
```json
{
  "videoName": "Biologi - Redominasi",
  "videoDuration": 180,
  "startTime": "2024-12-28T10:25:00.000Z",
  "endTime": "2024-12-28T10:28:00.000Z",
  "gazePoints": [
    {
      "x": 960,
      "y": 540,
      "timestamp": 1000,
      "videoTime": 1.0,
      "isFocused": true,
      "region": "center"
    },
    // ... lebih banyak data points
  ]
}
```

---

## 🎯 Algoritma Deteksi Fokus

### 1. Ekstraksi Pupil (MediaPipe)
- Menggunakan FaceMesh dengan 474 landmarks
- Left pupil: index 468
- Right pupil: index 473
- Smoothing dengan moving average buffer (default 10 frames)

### 2. Deteksi Arah Pandangan
```javascript
// Threshold default: 0.3
if (avgNormX > 1 - threshold) return "Kanan";
if (avgNormX < threshold) return "Kiri";
if (avgNormY > 1 - threshold) return "Bawah";
if (avgNormY < threshold) return "Atas";
return "Tengah";
```

### 3. Deteksi Fokus
```javascript
// Threshold default focus: 0.25
// Fokus = kedua pupil berada di area tengah bounding box mata
const leftFocused = 
  leftPupilNormX > focusThreshold &&
  leftPupilNormX < 1 - focusThreshold &&
  leftPupilNormY > focusThreshold &&
  leftPupilNormY < 1 - focusThreshold;
// + sama untuk right eye
return leftFocused && rightFocused;
```

---

## 🌐 Environment Variables

```env
# API
NEXT_PUBLIC_WEBHOOK_URL=/api/webhook

# MediaPipe
NEXT_PUBLIC_MIN_DETECTION_CONFIDENCE=0.5
NEXT_PUBLIC_MIN_TRACKING_CONFIDENCE=0.5
NEXT_PUBLIC_MAX_NUM_FACES=1

# Recording
NEXT_PUBLIC_RECORDING_INTERVAL_MS=1000
NEXT_PUBLIC_CALIBRATION_DURATION_MS=5000

# Focus detection
NEXT_PUBLIC_FOCUS_THRESHOLD=0.25
NEXT_PUBLIC_GAZE_DIRECTION_THRESHOLD=0.3

# WebGazer
NEXT_PUBLIC_WEBGAZER_CALIBRATION_POINTS=9
NEXT_PUBLIC_WEBGAZER_CLICKS_PER_POINT=5

# Feature flags
NEXT_PUBLIC_ENABLE_LOGGING=true
NEXT_PUBLIC_ENABLE_WEBHOOK=true
```

---

## 📝 Catatan Pengembangan

### Fitur yang Sudah Diimplementasi:
- ✅ 3 mode tracking (MediaPipe, WebGazer, Combined)
- ✅ Kalibrasi MediaPipe (5 detik)
- ✅ Kalibrasi WebGazer (9 titik x 5 klik)
- ✅ Auto-fullscreen dengan reminder banner
- ✅ Video player dengan controls (play/pause, slider)
- ✅ Real-time data recording ke Google Sheets
- ✅ Analytics dashboard dengan 4 visualisasi
- ✅ Session data storage di sessionStorage
- ✅ Demo data untuk testing analytics

### Limitasi:
- WebGazer membutuhkan kalibrasi ulang jika user mengubah posisi kepala
- Akurasi tergantung pada pencahayaan dan kualitas webcam
- Data hanya tersimpan di sessionStorage (hilang jika tab ditutup)

---

## 📚 Referensi

- [MediaPipe Face Mesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- [WebGazer.js Documentation](https://webgazer.cs.brown.edu/)
- [Next.js App Router](https://nextjs.org/docs/app)

---

*Dokumentasi dibuat: 28 Desember 2024*  
*Proyek Magang - Student Focus Detection System*
