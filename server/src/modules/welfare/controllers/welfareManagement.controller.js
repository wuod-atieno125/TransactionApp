const service = require("../services/welfareManagement.service");

const actor = (req) => ({ userId: req.session.user.id });

async function handle(fn, req, res, next) {
  try {
    return res.status(200).json({ success: true, ...(await fn()) });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requirements: (req, res, next) => handle(
    async () => ({ requirements: await service.getRequirementHistory() }), req, res, next
  ),
  contributions: async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
      const offset = Math.max(Number(req.query.offset) || 0, 0)
      const contributions = await service.listContributions({
        role: String(req.session.user.role || "").toLowerCase(),
        userId: req.session.user.id,
        limit,
        offset,
      })
      return res.status(200).json({
        success: true,
        transactions: contributions,
        contributions,
        pagination: { limit, offset, count: contributions.length },
      })
    } catch (error) {
      return next(error)
    }
  },
  setRequirement: (req, res, next) => handle(
    async () => ({ requirement: await service.setRequirement({ ...req.body, ...actor(req) }) }),
    req, res, next
  ),
  recordContribution: async (req, res, next) => {
    try {
      const entry = await service.recordContribution({ ...req.body, ...actor(req) });
      return res.status(201).json({ success: true, entry });
    } catch (error) {
      return next(error);
    }
  },
  statement: async (req, res, next) => {
    try {
      const role = String(req.session.user.role || "").toLowerCase();
      if (role === "member" && req.params.memberId !== req.session.user.id) {
        return res.status(403).json({
          success: false,
          message: "You may only view your own welfare statement.",
        });
      }
      const statement = await service.getStatement(req.params.memberId);
      if (!statement) return res.status(404).json({ success: false, message: "Contributor welfare account not found." });
      return res.status(200).json({ success: true, statement });
    } catch (error) { return next(error); }
  },
  balance: (req, res, next) => handle(
    async () => ({ balance: await service.getGroupBalance() }), req, res, next
  ),
  requestWithdrawal: async (req, res, next) => {
    try {
      const request = await service.requestWithdrawal({ ...req.body, ...actor(req) });
      return res.status(201).json({ success: true, request });
    } catch (error) { return next(error); }
  },
  withdrawals: (req, res, next) => handle(
    async () => ({ withdrawals: await service.listWithdrawals() }), req, res, next
  ),
  withdrawalExport: (req, res, next) => handle(
    async () => service.getWithdrawalExportData(), req, res, next
  ),
  decideWithdrawal: async (req, res, next) => {
    try {
      const request = await service.decideWithdrawal({
        requestId: req.params.id, approved: req.body.approved === true,
        reason: req.body.reason, ...actor(req),
      });
      return res.status(200).json({ success: true, request });
    } catch (error) { return next(error); }
  },
  executeWithdrawal: async (req, res, next) => {
    try {
      const request = await service.executeWithdrawal({ requestId: req.params.id, ...actor(req) });
      return res.status(200).json({ success: true, request });
    } catch (error) { return next(error); }
  },
};
