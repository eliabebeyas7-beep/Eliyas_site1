require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Website files are inside the public folder
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Render URL automatically
const BASE_URL =
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${PORT}`;

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

// Convert Chapa error objects into readable text
function getChapaError(data) {
  if (!data) {
    return "Chapa could not create the payment.";
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data.message && typeof data.message === "object") {
    try {
      return JSON.stringify(data.message);
    } catch {
      return "Chapa returned an error.";
    }
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error === "object") {
    try {
      return JSON.stringify(data.error);
    } catch {
      return "Chapa returned an error.";
    }
  }

  return "Could not create payment.";
}

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Create Chapa payment
app.post("/api/pay", async (req, res) => {
  try {
    if (!CHAPA_SECRET_KEY) {
      return res.status(500).json({
        error: "Chapa secret key is not configured in Render."
      });
    }

    const amount = Number(req.body.amount);
    const firstName = String(
      req.body.first_name || "Supporter"
    ).trim();

    const email = String(
      req.body.email || ""
    ).trim();

    // Check amount
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({
        error: "Please enter a valid amount."
      });
    }

    // Check email
    if (!email || !email.includes("@")) {
      return res.status(400).json({
        error: "Please enter a valid email address."
      });
    }

    const txRef =
      `eliyas-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const payload = {
      amount: amount.toFixed(2),
      currency: "ETB",

      email: email,

      first_name: firstName || "Supporter",
      last_name: "Supporter",

      tx_ref: txRef,

      callback_url:
        `${BASE_URL}/api/callback`,

      return_url:
        `${BASE_URL}/success.html?tx_ref=${encodeURIComponent(txRef)}`,

      customization: {
        title: "Support Eliyas",
        description:
          "Thank you for supporting Eliyas"
      }
    };

    console.log("Sending Chapa payment request:", {
      amount: payload.amount,
      currency: payload.currency,
      email: payload.email,
      tx_ref: payload.tx_ref
    });

    const response = await fetch(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${CHAPA_SECRET_KEY}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    console.log("Chapa response:", data);

    // Check Chapa response
    if (
      !response.ok ||
      !data?.data?.checkout_url
    ) {
      return res.status(502).json({
        error: getChapaError(data)
      });
    }

    // Send checkout URL to website
    return res.json({
      checkout_url:
        data.data.checkout_url
    });

  } catch (error) {
    console.error(
      "Payment error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error. Please try again."
    });
  }
});

// Chapa callback
app.get("/api/callback", async (req, res) => {
  const txRef = req.query.tx_ref;

  if (!txRef || !CHAPA_SECRET_KEY) {
    return res.redirect("/");
  }

  try {
    const response = await fetch(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization:
            `Bearer ${CHAPA_SECRET_KEY}`
        }
      }
    );

    const data = await response.json();

    console.log(
      "Chapa verification:",
      data
    );

    return res.redirect(
      `/success.html?tx_ref=${encodeURIComponent(txRef)}`
    );

  } catch (error) {
    console.error(
      "Verification error:",
      error
    );

    return res.redirect(
      `/success.html?tx_ref=${encodeURIComponent(txRef)}`
    );
  }
});

// IMPORTANT for Render
app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Eliyas Support running on ${BASE_URL}`
    );

    console.log(
      `Listening on port ${PORT}`
    );
  }
);
