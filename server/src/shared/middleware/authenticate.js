const { requireAuth } = require("./auth");

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.authenticate = requireAuth;
