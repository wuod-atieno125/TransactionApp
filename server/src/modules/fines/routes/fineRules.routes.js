
const express = require("express");
const { requireRole } = require("../../../shared/middleware/auth");
const controller = require("../controllers/fineRules.controller");

const router = express.Router();

router.get(
  "/",
  requireRole("member", "secretary", "treasurer", "chairperson"),
  controller.listRules
);
router.get(
  "/:id",
  requireRole("member", "secretary", "treasurer", "chairperson"),
  controller.getRule
);

router.post("/", requireRole("chairperson"), controller.createRule);
router.post("/:id/versions", requireRole("chairperson"), controller.createRuleVersion);
router.patch("/:id/status", requireRole("chairperson"), controller.updateRuleStatus);

module.exports = router;