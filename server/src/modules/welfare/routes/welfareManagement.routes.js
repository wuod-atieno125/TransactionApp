const express = require("express");
const { requireAuth, requireRole } = require("../../../shared/middleware/auth");
const controller = require("../controllers/welfareManagement.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/requirements", requireRole("member", "treasurer", "chairperson", "secretary"), controller.requirements);
router.put("/requirements", requireRole("chairperson"), controller.setRequirement);
router.get("/contributions", requireRole("member", "treasurer", "chairperson", "secretary"), controller.contributions);
router.post("/contributions", requireRole("treasurer"), controller.recordContribution);
router.get("/members/:memberId/statement", requireRole("member", "treasurer", "chairperson", "secretary"), controller.statement);
router.get("/balance", requireRole("treasurer", "chairperson", "secretary"), controller.balance);
router.post("/withdrawals", requireRole("treasurer"), controller.requestWithdrawal);
router.get("/withdrawals/export", requireRole("treasurer"), controller.withdrawalExport);
router.get("/withdrawals", requireRole("treasurer", "chairperson", "secretary"), controller.withdrawals);
router.patch("/withdrawals/:id/decision", requireRole("chairperson"), controller.decideWithdrawal);
router.post("/withdrawals/:id/execute", requireRole("treasurer"), controller.executeWithdrawal);

module.exports = router;
