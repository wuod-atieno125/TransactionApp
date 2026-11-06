const { query } = require("../../config/database");

async function requireAuth(req, res, next) {
  try {
    const sessionUser = req.session?.user;

    if (!sessionUser?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await query(
      `SELECT id, full_name, role, account_status
       FROM users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionUser.id]
    );

    const user = result.rows[0];

    if (!user || user.account_status !== "approved") {
      if (req.session) {
        req.session.destroy(() => {});
      }

      res.clearCookie("transaction.sid");

      return res.status(401).json({
        success: false,
        message: "Session invalid or account not approved.",
      });
    }

    // Refresh session identity and role from the current database record.
    req.session.user = {
      ...sessionUser,
      id: user.id,
      fullName: user.full_name,
      role: user.role,
    };

    req.user = {
      id: user.id,
      fullName: user.full_name,
      role: user.role,
      accountStatus: user.account_status,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...roles) {
  const allowedRoles = roles
    .flat()
    .filter((role) => typeof role === "string" && role.trim())
    .map((role) => role.trim().toLowerCase());

  return function authorizeRole(req, res, next) {
    const user = req.user || req.session?.user;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!user.role || !allowedRoles.includes(user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };
