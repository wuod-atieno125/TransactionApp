
const express = require("express");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");

const router = express.Router();

router.use(requireAuth);

const canManageMemberships = requireRole(["chairperson", "secretary"]);
const canViewMemberships = requireRole([
  "chairperson",
  "treasurer",
  "secretary",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// GET /api/group-memberships/me
// Users can view their own memberships.
router.get("/me", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id, group_name, joined_at
       FROM group_memberships
       WHERE user_id = $1
       ORDER BY group_name ASC`,
      [req.session.user.id]
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      memberships: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/group-memberships
// Authorized officers can list group memberships.
router.get("/", canViewMemberships, async (req, res, next) => {
  const { groupName } = req.query;

  if (groupName !== undefined && typeof groupName !== "string") {
    return res.status(400).json({
      success: false,
      message: "groupName must be supplied once as a string.",
    });
  }

  try {
    const params = [];
    let sql = `
      SELECT
        gm.user_id,
        u.full_name,
        u.phone,
        u.role,
        u.account_status,
        gm.group_name,
        gm.joined_at
      FROM group_memberships gm
      JOIN users u ON u.id = gm.user_id
    `;

    if (groupName !== undefined) {
      if (!groupName.trim() || groupName.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "groupName must be 1–100 characters.",
        });
      }

      params.push(groupName.trim());
      sql += ` WHERE gm.group_name = $1`;
    }

    sql += ` ORDER BY gm.group_name ASC, u.full_name ASC`;

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      memberships: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/group-memberships
// Chairperson or secretary adds a user to a group.
router.post("/", canManageMemberships, async (req, res, next) => {
  const { userId, groupName } = req.body || {};

  if (!validUuid(userId)) {
    return res.status(400).json({
      success: false,
      message: "A valid user ID is required.",
    });
  }

  if (
    typeof groupName !== "string" ||
    !groupName.trim() ||
    groupName.trim().length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Group name is required and must not exceed 100 characters.",
    });
  }

  const normalizedGroupName = groupName.trim();
  const actorId = req.session.user.id;
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, full_name, account_status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = userResult.rows[0];

    if (user.account_status !== "approved") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Only approved users can be added to a group.",
      });
    }

    const existingResult = await client.query(
      `SELECT user_id
       FROM group_memberships
       WHERE user_id = $1 AND group_name = $2
       FOR UPDATE`,
      [userId, normalizedGroupName]
    );

    if (existingResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This user already belongs to that group.",
      });
    }

    const result = await client.query(
      `INSERT INTO group_memberships (user_id, group_name)
       VALUES ($1, $2)
       RETURNING user_id, group_name, joined_at`,
      [userId, normalizedGroupName]
    );

    const membership = result.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, target_id, new_values
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        actorId,
        "group_membership_created",
        "group_membership",
        userId,
        JSON.stringify({
          ...membership,
          member_name: user.full_name,
        }),
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "User added to the group successfully.",
      membership,
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This user already belongs to that group.",
      });
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/group-memberships/:userId/:groupName
// Chairperson or secretary removes a membership.
router.delete(
  "/:userId/:groupName",
  canManageMemberships,
  async (req, res, next) => {
    const { userId, groupName } = req.params;

    if (!validUuid(userId)) {
      return res.status(400).json({
        success: false,
        message: "A valid user ID is required.",
      });
    }

    if (!groupName || groupName.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "A valid group name is required.",
      });
    }

    const actorId = req.session.user.id;
    let client;

    try {
      client = await getClient();
      await client.query("BEGIN");

      const result = await client.query(
        `DELETE FROM group_memberships
         WHERE user_id = $1 AND group_name = $2
         RETURNING user_id, group_name, joined_at`,
        [userId, groupName]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Group membership not found.",
        });
      }

      await client.query(
        `INSERT INTO audit_logs (
           actor_user_id, action, target_type, target_id, old_values
         )
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          actorId,
          "group_membership_removed",
          "group_membership",
          userId,
          JSON.stringify(result.rows[0]),
        ]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "User removed from the group successfully.",
        membership: result.rows[0],
      });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      return next(error);
    } finally {
      if (client) client.release();
    }
  }
);

module.exports = router;
