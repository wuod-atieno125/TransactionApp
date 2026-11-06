
const express = require("express");
const { requireRole } = require("../../../shared/middleware/auth");
const controller = require("../controllers/fineWithdrawals.controller");

const router = express.Router();

router.get(
  "/",
  requireRole("treasurer", "chairperson"),
  controller.listWithdrawals
);

router.get(
  "/:id",
  requireRole("treasurer", "chairperson"),
  controller.getWithdrawal
);

router.post(
  "/",
  requireRole("treasurer"),
  controller.initiateWithdrawal
);

router.patch(
  "/:id/decision",
  requireRole("chairperson"),
  controller.decideWithdrawal
);

router.post(
  "/:id/execute",
  requireRole("treasurer"),
  controller.executeWithdrawal
);

module.exports = router;