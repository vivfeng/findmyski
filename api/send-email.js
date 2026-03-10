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
    const payload = JSON.stringify(req.body);

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: payload,
      redirect: "follow",
    });

    // Google Apps Script may return HTML on error or redirect; read as text first
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        status: "error",
        message: "Invalid response from Google Apps Script.",
        debug: { responseStatus: response.status, responseText: text.slice(0, 500) },
      });
    }

    // Append debug info temporarily
    data._debug = {
      scriptUrlPrefix: scriptUrl.slice(0, 60) + "...",
      payloadKeys: Object.keys(req.body || {}),
      responseStatus: response.status,
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.toString() });
  }
}
