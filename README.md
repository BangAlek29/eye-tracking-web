# Eye Tracking Learning Analytics

A real-time eye-tracking system for educational videos that detects focus and gaze direction during video lessons, records tracking data to a webhook, and visualizes attention with focus metrics, gaze heatmaps, attention timelines, and region distribution charts.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Three tracking modes** — MediaPipe FaceMesh, WebGazer.js, or combined MediaPipe + WebGazer in one session
- **Calibration** — 5-second MediaPipe pupil calibration and a 9-point WebGazer calibration grid (5 clicks per point)
- **Real-time insight** — focus detection (focused/unfocused), gaze direction (left / center / right), and screen-region mapping across a 3×3 grid
- **Stable predictions** — smoothing buffers for gaze coordinates and pupil data, plus landmark stability checks
- **Data recording** — tracking samples recorded at a configurable interval and forwarded to a webhook (defaults to the local `/api/webhook` proxy, which relays to a Google Sheets Apps Script endpoint)
- **Session analytics** — `Focus Rate`, Total Focus Time, Distraction Count, Longest Focus Streak, Avg Focus Duration, and Watch Duration
- **Visualizations** — gaze heatmap, 5-second attention timeline, and region distribution chart (with a demo-data mode for preview)
- **Built-in video library** — 5 educational videos with fullscreen playback; sessions persist in sessionStorage
- **Fully configurable** — every threshold, interval, and feature flag tunable via `NEXT_PUBLIC_*` environment variables

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Eye tracking | MediaPipe FaceMesh, WebGazer.js |
| Analytics | Custom TypeScript utils (heatmap, timeline, region stats) |
| Styling | Tailwind CSS 4 |

## Project Structure

```
app/
├── analytics/                  # Analytics dashboard page
├── api/webhook/                # Local webhook proxy to the data spreadsheet
├── components/
│   ├── VideoLearningTracker.tsx  # Video player + tracking pipeline
│   └── analytics/               # FocusMetrics, GazeHeatmap, AttentionTimeline, RegionDistributionChart
├── config/                     # config.ts (env-backed), constants.ts
├── types/                      # webgazer.d.ts
├── utils/                      # eyeTrackingUtils, webgazerUtils, analyticsUtils
├── layout.tsx
└── page.tsx                    # Video picker + mode selector
public/Video/                   # Educational videos
screenshots/                    # Usage documentation screenshots
```

## Installation

```bash
git clone https://github.com/dzikribassyril/eye-tracking-web.git
cd eye-tracking-web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (camera permission is required).

## Usage

1. Pick a video and a tracking mode (MediaPipe, WebGazer, or combined).
2. Allow camera access and complete the calibration steps for the selected mode.
3. Press play — the tracker records focus and gaze data while the video plays.
4. Finish the video and open the analytics page to review focus metrics, heatmaps, and attention distribution for the session.

To route data elsewhere, set `NEXT_PUBLIC_WEBHOOK_URL` to your own endpoint (it defaults to the built-in `/api/webhook` proxy).

## License

MIT License — see the [LICENSE](LICENSE) file.
