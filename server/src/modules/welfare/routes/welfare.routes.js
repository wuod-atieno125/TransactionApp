
const express = require("express");
const welfareManagementRoutes = require("./welfareManagement.routes");
const welfareContributionRoutes = require("./welfareContributionRoutes");
const welfareContributionDetailRoutes = require("./welfareContributionDetailRoutes");
const welfareContributionReportRoutes = require("./welfareContributionReportRoutes");
const welfareContributionReversalRoutes = require("./welfareContributionReversalRoutes");

const router = express.Router();

router.use(welfareManagementRoutes);
router.use(welfareContributionReversalRoutes);
router.use(welfareContributionReportRoutes);
router.use(welfareContributionRoutes);
router.use(welfareContributionDetailRoutes);

module.exports = router;