export async function POST(request: Request) {
  try {
    const data = await request.json();

    const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycby-sRnKFIq5hzdGUgrSh4tL8ZC4jPiQlZSvvpUBTCvidt4kT0ZDfSlSGNbIf1VM2u28/exec";

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(`Webhook error: ${response.status} ${response.statusText}`);
      return Response.json(
        { error: `Webhook returned ${response.status}` },
        { status: response.status }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Webhook proxy error:", error);
    return Response.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
