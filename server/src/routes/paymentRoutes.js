const express = require("express");
const auth = require("../middleware/auth");

const router = express.Router();

const requiredVars = ["PAYSTACK_SECRET_KEY", "PAYSTACK_CALLBACK_URL"];

router.get("/paystack/transactions", auth, async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        message: "Missing Paystack secret key configuration.",
      });
    }

    const response = await fetch("https://api.paystack.co/transaction", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(response.status || 500).json({
        message: data.message || "Unable to fetch Paystack transactions.",
      });
    }

    const successfulTransactions = (data.data || [])
      .filter((transaction) => transaction.status === "success")
      .map((transaction) => ({
        id: transaction.id,
        contributorName:
          transaction.customer?.first_name || transaction.customer?.last_name
            ? `${transaction.customer?.first_name || ""} ${transaction.customer?.last_name || ""}`.trim()
            : transaction.customer?.email || "Unknown Contributor",
        contributorEmail: transaction.customer?.email || "N/A",
        amount: (transaction.amount || 0) / 100,
        transferDate: transaction.paid_at || transaction.created_at,
        reference: transaction.reference,
      }));

    return res.json({ transactions: successfulTransactions });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to fetch Paystack transactions.",
      error: error.message,
    });
  }
});

router.post("/paystack/initialize", async (req, res) => {
  try {
    const missingVars = requiredVars.filter((name) => !process.env[name]);
    if (missingVars.length > 0) {
      return res.status(500).json({
        message: `Missing Paystack environment variables: ${missingVars.join(", ")}`,
      });
    }

    const { email, amount } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required for payment." });
    }

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: "A valid amount is required." });
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amountValue * 100),
          callback_url: process.env.PAYSTACK_CALLBACK_URL,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(response.status || 500).json({
        message: data.message || "Unable to initialize Paystack payment.",
      });
    }

    return res.json({
      message: "Payment initialized successfully.",
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to initialize Paystack payment.",
      error: error.message,
    });
  }
});

module.exports = router;
