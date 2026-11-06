"use strict";

const express = require("express");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();
router.use(requireAuth);

const canView = requireRole(["member", "treasurer", "chairperson"]);
const canUpdate = requireRole("treasurer");

// GET /api/payment-destination
router.get("/", canView, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT payment_number AS "paymentNumber", updated_at AS "updatedAt"
       FROM group_payment_destination
       WHERE id = TRUE`
    );

    return res.status(200).json({
      success: true,
      paymentDestination: result.rows[0] || null,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/payment-destination — the treasurer maintains the group's payment number.
router.put("/", canUpdate, async (req, res, next) => {
  const paymentNumber = typeof req.body?.paymentNumber === "string"
    ? req.body.paymentNumber.replace(/[\s-]/g, "")
    : "";

  if (!/^\d{5,20}$/.test(paymentNumber)) {
    return res.status(400).json({
      success: false,
      message: "Enter a payment number containing 5 to 20 digits.",
    });
  }

  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const previousResult = await client.query(
      `SELECT payment_number AS "paymentNumber", updated_at AS "updatedAt"
       FROM group_payment_destination
       WHERE id = TRUE
       FOR UPDATE`
    );
    const previous = previousResult.rows[0] || null;

    const result = await client.query(
      `INSERT INTO group_payment_destination (id, payment_number, updated_by, updated_at)
       VALUES (TRUE, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payment_number = EXCLUDED.payment_number,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING payment_number AS "paymentNumber", updated_at AS "updatedAt"`,
      [paymentNumber, actorId]
    );
    const paymentDestination = result.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, old_values, new_values
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        actorId,
        previous ? "group_payment_destination_updated" : "group_payment_destination_created",
        "group_payment_destination",
        JSON.stringify(previous),
        JSON.stringify({ paymentNumber }),
      ]
    );

    await client.query("COMMIT");
    return res.status(previous ? 200 : 201).json({
      success: true,
      message: "Group payment number saved.",
      paymentDestination,
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return next(error);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
