
const express = require("express");

const fineRulesRoutes = require("./fineRules.routes");
const fineRecordsRoutes = require("./fineRecords.routes");
const finePaymentsRoutes = require("./finePayments.routes");
const fineWithdrawalsRoutes = require("./fineWithdrawals.routes");

const router = express.Router();
const { requireAuth } = require("../../../shared/middleware/auth");
router.use(requireAuth);

router.use("/rules", fineRulesRoutes);
router.use("/records", fineRecordsRoutes);
router.use("/payments", finePaymentsRoutes);
router.use("/withdrawals", fineWithdrawalsRoutes);

module.exports = router;