/**
 * Webhook API Route
 * Handles eye tracking data from MediaPipe, WebGazer, and Combined modes
 */

// MediaPipe only payload
interface MediaPipePayload {
  left_x: number;
  left_y: number;
  right_x: number;
  right_y: number;
  is_focused: number;
  gaze: string;
  tracking_mode?: "mediapipe";
}

// WebGazer only payload
interface WebGazerPayload {
  screen_x: number;
  screen_y: number;
  screen_region: string;
  timestamp: number;
  tracking_mode: "webgazer";
}

// Combined payload
interface CombinedPayload {
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
  screen_region: string | null;
  // Metadata
  tracking_mode: "combined";
  timestamp: number;
}

type WebhookPayload = MediaPipePayload | WebGazerPayload | CombinedPayload;

export async function POST(request: Request) {
  try {
    const data: WebhookPayload = await request.json();

    // Determine tracking mode and normalize data
    const trackingMode = data.tracking_mode || "mediapipe";

    // Build normalized payload for spreadsheet
    const normalizedPayload = {
      timestamp: new Date().toISOString(),
      tracking_mode: trackingMode,
      // MediaPipe fields (default to null if not present)
      left_x: "left_x" in data ? data.left_x : null,
      left_y: "left_y" in data ? data.left_y : null,
      right_x: "right_x" in data ? data.right_x : null,
      right_y: "right_y" in data ? data.right_y : null,
      is_focused: "is_focused" in data ? data.is_focused : null,
      gaze: "gaze" in data ? data.gaze : null,
      // WebGazer fields (default to null if not present)
      screen_x: "screen_x" in data ? data.screen_x : null,
      screen_y: "screen_y" in data ? data.screen_y : null,
      screen_region: "screen_region" in data ? data.screen_region : null,
    };

    const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycby-sRnKFIq5hzdGUgrSh4tL8ZC4jPiQlZSvvpUBTCvidt4kT0ZDfSlSGNbIf1VM2u28/exec";

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
      console.error(`Webhook error: ${response.status} ${response.statusText}`);
      return Response.json(
        { error: `Webhook returned ${response.status}` },
        { status: response.status }
      );
    }

    return Response.json({
      success: true,
      tracking_mode: trackingMode,
    });
  } catch (error) {
    console.error("Webhook proxy error:", error);
    return Response.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
