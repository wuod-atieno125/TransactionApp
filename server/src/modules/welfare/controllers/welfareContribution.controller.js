const service = require("../services/welfareContribution.service");

async function list(req, res, next) {
  try {
    const { contributions, pagination } = await service.listContributions(
      {
        role: String(req.session.user.role || "").toLowerCase(),
        userId: req.session.user.id,
      },
      req.query
    );

    return res.status(200).json({
      success: true,
      transactions: contributions,
      pagination: {
        ...pagination,
        count: contributions.length,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const transaction = await service.getContribution(req.params.id, {
      role: String(req.session.user.role || "").toLowerCase(),
      userId: req.session.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Welfare contribution not found.",
      });
    }

    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getById,
};
