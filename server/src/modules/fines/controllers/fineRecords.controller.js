const service = require("../services/fineRecords.service");

function actorFromRequest(req) {
  return {
    id: req.user?.id || req.session?.user?.id,
    role: String(req.user?.role || req.session?.user?.role || "").toLowerCase(),
  };
}

async function listFines(req, res, next) {
  try {
    const data = await service.listFines(req.query, actorFromRequest(req));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function listActiveMembers(req, res, next) {
  try {
    const data = await service.listActiveMembers();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function getFine(req, res, next) {
  try {
    const data = await service.getFine(req.params.id, actorFromRequest(req));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

async function issueFine(req, res, next) {
  try {
    const actor = actorFromRequest(req);
    const data = await service.issueFine(req.body, actor.id);

    return res.status(201).json({
      success: true,
      message: "Fine recorded successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listFines,
  listActiveMembers,
  getFine,
  issueFine,
};