require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

app.post("/api/pay", async (req, res) => {
  try {
    if (!CHAPA_SECRET_KEY) {
      return res.status(500).json({ error: "Chapa secret key is not configured." });
    }

    const amount = Number(req.body.amount);
    const firstName = String(req.body.first_name || "Supporter").trim();
    const email = String(req.body.email || "").trim();

    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ error: "Please enter a valid amount." });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email." });
    }

    const txRef = `eliyas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      amount: amount.toFixed(2),
      currency: "ETB",
      email,
      first_name: firstName,
      last_name: "Supporter",
      tx_ref: txRef,
      callback_url: `${BASE_URL}/api/callback`,
      return_url: `${BASE_URL}/success.html?tx_ref=${encodeURIComponent(txRef)}`,
      customization: {
        title: "Support Eliyas",
        description: "Thank you for supporting Eliyas ❤️"
      }
    };

    const response = await fetch("https://api.chapa.co/v1/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CHAPA_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data?.data?.checkout_url) {
      console.error("Chapa error:", data);
      return res.status(502).json({ error: data?.message || "Could not create payment." });
    }

    res.json({ checkout_url: data.data.checkout_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.get("/api/callback", async (req, res) => {
  const txRef = req.query.tx_ref;
  if (!txRef || !CHAPA_SECRET_KEY) return res.redirect("/");

  try {
    const response = await fetch(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
      { headers: { "Authorization": `Bearer ${CHAPA_SECRET_KEY}` } }
    );
    const data = await response.json();
    console.log("Chapa verification:", data);
    res.redirect(`/success.html?tx_ref=${encodeURIComponent(txRef)}`);
  } catch (err) {
    console.error("Verification error:", err);
    res.redirect(`/success.html?tx_ref=${encodeURIComponent(txRef)}`);
  }
});

app.listen(PORT, () => console.log(`Eliyas Support running at ${BASE_URL}`));