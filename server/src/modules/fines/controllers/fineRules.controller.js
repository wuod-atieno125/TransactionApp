
const fineRulesService = require("../services/fineRules.service");

function handleError(error, next) {
  return next(error);
}

async function listRules(req, res, next) {
  try {
    const rules = await fineRulesService.listRules({
      status: req.query.status,
      search: req.query.search,
    });

    return res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (error) {
    return handleError(error, next);
  }
}

async function getRule(req, res, next) {
  try {
    const rule = await fineRulesService.getRule(req.params.id);

    return res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    return handleError(error, next);
  }
}

async function createRule(req, res, next) {
  try {
    const rule = await fineRulesService.createRule({
      ...req.body,
      actorId: req.session.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Fine rule created successfully.",
      data: rule,
    });
  } catch (error) {
    return handleError(error, next);
  }
}

async function createRuleVersion(req, res, next) {
  try {
    const rule = await fineRulesService.createRuleVersion({
      ruleId: req.params.id,
      ...req.body,
      actorId: req.session.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Fine rule version created successfully.",
      data: rule,
    });
  } catch (error) {
    return handleError(error, next);
  }
}

async function updateRuleStatus(req, res, next) {
  try {
    const rule = await fineRulesService.updateRuleStatus({
      ruleId: req.params.id,
      status: req.body.status,
      actorId: req.session.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Fine rule status updated successfully.",
      data: rule,
    });
  } catch (error) {
    return handleError(error, next);
  }
}

module.exports = {
  listRules,
  getRule,
  createRule,
  createRuleVersion,
  updateRuleStatus,
};