export default async function handler(req, res) {
  // Allow CORS for the frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ status: "error", message: "Method not allowed" });

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      status: "error",
      message: "APPS_SCRIPT_URL environment variable is not configured.",
    });
  }

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(req.body),
      redirect: "follow",
    });

    // Google Apps Script may return HTML on error or redirect; read as text first
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // If the response is not JSON, it's likely an Apps Script error page
      return res.status(502).json({
        status: "error",
        message: "Invalid response from Google Apps Script.",
      });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.toString() });
  }
}
