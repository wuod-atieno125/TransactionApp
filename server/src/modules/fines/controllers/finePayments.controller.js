const service = require("../services/finePayments.service");

function actorFromRequest(req) {
  return {
    id: req.user?.id || req.session?.user?.id,
    role: String(req.user?.role || req.session?.user?.role || "").toLowerCase(),
  };
}

async function listPayments(req, res, next) {
  try {
    const data = await service.listPayments(req.query, actorFromRequest(req));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function recordPayment(req, res, next) {
  try {
    const actor = actorFromRequest(req);

    const data = await service.recordPayment(
      req.params.fineId,
      req.body,
      actor.id
    );

    return res.status(201).json({
      success: true,
      message: "Fine payment recorded successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPayments,
  recordPayment,
};