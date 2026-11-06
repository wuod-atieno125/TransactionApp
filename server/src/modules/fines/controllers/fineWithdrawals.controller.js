const service = require("../services/fineWithdrawals.service");

function actorFromRequest(req) {
  return {
    id: req.user?.id || req.session?.user?.id,
    role: String(
      req.user?.role || req.session?.user?.role || ""
    ).toLowerCase(),
  };
}

async function listWithdrawals(req, res, next) {
  try {
    const data = await service.listWithdrawals(req.query);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function getWithdrawal(req, res, next) {
  try {
    const data = await service.getWithdrawal(req.params.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function initiateWithdrawal(req, res, next) {
  try {
    const actor = actorFromRequest(req);

    const data = await service.initiateWithdrawal(
      req.body,
      actor.id
    );

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function decideWithdrawal(req, res, next) {
  try {
    const actor = actorFromRequest(req);

    const data = await service.decideWithdrawal(
      req.params.id,
      req.body,
      actor.id
    );

    const decision = String(req.body.decision || "").toLowerCase();

    return res.json({
      success: true,
      message:
        decision === "approve"
          ? "Withdrawal approved successfully."
          : "Withdrawal rejected successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function executeWithdrawal(req, res, next) {
  try {
    const actor = actorFromRequest(req);

    const data = await service.executeWithdrawal(
      req.params.id,
      req.body,
      actor.id
    );

    return res.json({
      success: true,
      message: "Withdrawal executed successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listWithdrawals,
  getWithdrawal,
  initiateWithdrawal,
  decideWithdrawal,
  executeWithdrawal,
};