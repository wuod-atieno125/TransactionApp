
const express = require("express");
const { requireRole } = require("../../../shared/middleware/auth");
const controller = require("../controllers/finePayments.controller");

const router = express.Router();

router.get("/", requireRole("member", "treasurer", "chairperson"), controller.listPayments);

module.exports = router;