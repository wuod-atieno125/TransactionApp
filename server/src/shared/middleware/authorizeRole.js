const { requireRole } = require("./auth");

module.exports = requireRole;
module.exports.requireRole = requireRole;
module.exports.authorizeRole = requireRole;
