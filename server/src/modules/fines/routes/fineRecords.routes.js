const express = require("express");
const { requireRole } = require("../../../shared/middleware/auth");

const controller = require("../controllers/fineRecords.controller");
const paymentController = require("../controllers/finePayments.controller");

const router = express.Router();

router.get(
  "/members",
  requireRole("treasurer"),
  controller.listActiveMembers
);

router.get(
  "/",
  requireRole("member", "treasurer", "chairperson"),
  controller.listFines
);

router.post(
  "/",
  requireRole("treasurer"),
  controller.issueFine
);

router.post(
  "/:fineId/payments",
  requireRole("treasurer"),
  paymentController.recordPayment
);

router.get(
  "/:id",
  requireRole("member", "treasurer", "chairperson"),
  controller.getFine
);

module.exports = router;