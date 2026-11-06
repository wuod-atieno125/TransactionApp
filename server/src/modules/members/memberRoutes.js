
const express = require("express");
const multer = require("multer");
const { query, getClient } = require("../../config/database");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const memberRepository = require("./memberRepository");
const {
  MAX_PROFILE_PICTURE_BYTES,
  processProfilePicture,
} = require("./profilePicture");
const {
  isKenyanMobilePhone,
  normalizePhoneInput,
} = require("../../shared/utilities/phoneNumber");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PICTURE_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter(_req, file, callback) {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      const error = new Error("Only JPEG and PNG images are supported.");
      error.code = "UNSUPPORTED_PROFILE_IMAGE";
      return callback(error);
    }
    return callback(null, true);
  },
}).single("profilePicture");

function handleProfilePictureUpload(req, res, next) {
  profilePictureUpload(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Profile pictures must be 2 MB or smaller.",
      });
    }

    if (error.code === "UNSUPPORTED_PROFILE_IMAGE") {
      return res.status(415).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Upload one profile picture using the profilePicture field.",
      });
    }

    if (error.code === "LIMIT_FIELD_COUNT" || error.code === "LIMIT_PART_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Upload one profile picture without extra form fields.",
      });
    }

    return next(error);
  });
}

// GET /api/members
router.get(
  "/",
  requireAuth,
  requireRole("member", "treasurer", "chairperson", "secretary"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, full_name, LOWER(TRIM(role)) AS role,
                LOWER(TRIM(account_status)) AS account_status, created_at
         FROM users
         WHERE LOWER(TRIM(role)) <> 'technical_admin'
           AND LOWER(TRIM(account_status)) = 'approved'
           AND deleted_at IS NULL
         ORDER BY
           CASE LOWER(TRIM(role))
             WHEN 'chairperson' THEN 1
             WHEN 'treasurer' THEN 2
             WHEN 'secretary' THEN 3
             ELSE 4
           END,
           full_name ASC`
      );

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        members: result.rows.map((user) => ({
          id: user.id,
          fullName: user.full_name,
          role: user.role,
          accountStatus: user.account_status,
          registeredAt: user.created_at,
        })),
      });
    } catch (error) {
      return next(error);
    }
  }
);

// GET /api/members/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         id,
         full_name,
         username,
         phone,
         recovery_email,
         role,
         account_status,
         created_at,
         updated_at,
         profile_picture_updated_at
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL`,
      [req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      member: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        phone: user.phone,
        recoveryEmail: user.recovery_email,
        role: user.role,
        accountStatus: user.account_status,
        registeredAt: user.created_at,
        updatedAt: user.updated_at,
        profilePictureUpdatedAt: user.profile_picture_updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me/profile-picture", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT profile_picture
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL`,
      [req.session.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (!result.rows[0].profile_picture) {
      return res.status(204).end();
    }

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    });
    return res.status(200).send(result.rows[0].profile_picture);
  } catch (error) {
    return next(error);
  }
});

router.put(
  "/me/profile-picture",
  requireAuth,
  handleProfilePictureUpload,
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Choose a JPEG or PNG profile picture.",
      });
    }

    let profilePicture;
    try {
      profilePicture = await processProfilePicture(req.file.buffer);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: "The selected image is corrupt or cannot be decoded.",
      });
    }

    try {
      const result = await query(
        `UPDATE users
         SET profile_picture = $1,
             profile_picture_updated_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
           AND deleted_at IS NULL
         RETURNING profile_picture_updated_at`,
        [profilePicture, req.session.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile picture updated successfully.",
        profilePictureUpdatedAt: result.rows[0].profile_picture_updated_at,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// PATCH /api/members/me
router.patch("/me", requireAuth, async (req, res, next) => {
  const body = req.body || {};
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const usernameInput = typeof body.username === "string"
    ? body.username.trim().toLowerCase()
    : "";
  const phoneInput = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = normalizePhoneInput(phoneInput);
  const recoveryEmail = typeof body.recoveryEmail === "string"
    ? body.recoveryEmail.trim().toLowerCase()
    : "";

  if (fullName.length < 2 || fullName.length > 150) {
    return res.status(400).json({
      success: false,
      message: "Full name must be between 2 and 150 characters.",
    });
  }

  if (
    typeof body.username !== "string" ||
    !/^[a-z0-9_]{3,30}$/.test(usernameInput)
  ) {
    return res.status(400).json({
      success: false,
      message: "Username must be 3 to 30 characters using letters, numbers, or underscores.",
    });
  }

  if (!isKenyanMobilePhone(phoneInput)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid Kenyan mobile number (e.g. 0712 345 678 or +254 712 345 678).",
    });
  }

  if (recoveryEmail.length > 254 || !EMAIL_PATTERN.test(recoveryEmail)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid recovery email address.",
    });
  }

  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const oldResult = await client.query(
      `SELECT full_name, username, phone, recovery_email
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [req.session.user.id]
    );

    if (oldResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const oldAccount = oldResult.rows[0];
    const updatedResult = await client.query(
      `UPDATE users
       SET full_name = $1,
           username = $2,
           phone = $3,
           normalized_phone = $4,
           recovery_email = $5,
           normalized_email = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, full_name, username, phone, recovery_email, role,
                 account_status, created_at, updated_at,
                 profile_picture_updated_at`,
      [
        fullName,
        usernameInput,
        phone,
        phone,
        recoveryEmail,
        recoveryEmail,
        req.session.user.id,
      ]
    );

    const account = updatedResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
         actor_user_id, action, target_type, target_id, old_values, new_values
       )
       VALUES ($1, 'account_profile_updated', 'user', $2, $3::jsonb, $4::jsonb)`,
      [
        account.id,
        account.id,
        JSON.stringify(oldAccount),
        JSON.stringify({
          full_name: account.full_name,
          username: account.username,
          phone: account.phone,
          recovery_email: account.recovery_email,
        }),
      ]
    );

    await client.query("COMMIT");
    req.session.user.fullName = account.full_name;

    return res.status(200).json({
      success: true,
      message: "Account settings updated successfully.",
      member: {
        id: account.id,
        fullName: account.full_name,
        username: account.username,
        phone: account.phone,
        recoveryEmail: account.recovery_email,
        role: account.role,
        accountStatus: account.account_status,
        registeredAt: account.created_at,
        updatedAt: account.updated_at,
        profilePictureUpdatedAt: account.profile_picture_updated_at,
      },
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      if (error.constraint === "users_username_lower_unique") {
        return res.status(409).json({
          success: false,
          message: "That username is already in use.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "That phone number or email address is already in use.",
      });
    }

    return next(error);
  } finally {
    if (client) client.release();
  }
});

router.get(
  "/me/deletion-request",
  requireAuth,
  requireRole("member"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, request_reason AS reason, status,
                requested_at AS "requestedAt"
         FROM member_deletion_requests
         WHERE member_user_id = $1
           AND status = 'pending'
         LIMIT 1`,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        deletionRequest: result.rows[0] || null,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/me/role-removal-request",
  requireAuth,
  requireRole("chairperson", "secretary", "treasurer"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, office_role AS "officeRole", reason, status,
                requested_at AS "requestedAt"
         FROM official_role_removal_requests
         WHERE requester_user_id = $1
           AND status = 'pending'
         LIMIT 1`,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        roleRemovalRequest: result.rows[0] || null,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/me/role-removal-request",
  requireAuth,
  requireRole("chairperson", "secretary", "treasurer"),
  async (req, res, next) => {
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (reason.length < 5 || reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Provide a role-removal reason between 5 and 1000 characters.",
      });
    }

    let client;
    try {
      client = await getClient();
      await client.query("BEGIN");

      const currentUserResult = await client.query(
        `SELECT id, full_name, role
         FROM users
         WHERE id = $1
           AND role IN ('chairperson', 'secretary', 'treasurer')
           AND account_status = 'approved'
           AND deleted_at IS NULL
         FOR UPDATE`,
        [req.user.id]
      );
      const currentUser = currentUserResult.rows[0];

      if (!currentUser) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Only active officials can request removal from their role.",
        });
      }

      const existingRequest = await client.query(
        `SELECT id, office_role AS "officeRole", reason, status,
                requested_at AS "requestedAt"
         FROM official_role_removal_requests
         WHERE requester_user_id = $1
           AND status = 'pending'
         LIMIT 1
         FOR UPDATE`,
        [currentUser.id]
      );

      if (existingRequest.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "You already have a role-removal request awaiting review.",
          roleRemovalRequest: existingRequest.rows[0],
        });
      }

      const requestResult = await client.query(
        `INSERT INTO official_role_removal_requests (
           requester_user_id, office_role, reason
         )
         VALUES ($1, $2, $3)
         RETURNING id, office_role AS "officeRole", reason, status,
                   requested_at AS "requestedAt"`,
        [currentUser.id, currentUser.role, reason]
      );
      const roleRemovalRequest = requestResult.rows[0];

      await client.query(
        `INSERT INTO notifications (
           recipient_user_id, event_type, title, message
         )
         SELECT id, 'official_role_removal_request',
                'Official role-removal request',
                $1
         FROM users
         WHERE role = 'technical_admin'
           AND account_status = 'approved'
           AND deleted_at IS NULL`,
        [
          `${currentUser.full_name} (${currentUser.role}) requested removal from office. Reason: ${reason}`,
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (
           actor_user_id, action, target_type, target_id, new_values
         )
         VALUES ($1, 'official_role_removal_requested', 'user', $2, $3::jsonb)`,
        [
          currentUser.id,
          currentUser.id,
          JSON.stringify({
            request_id: roleRemovalRequest.id,
            office_role: currentUser.role,
            reason,
            status: "pending",
          }),
        ]
      );

      await client.query("COMMIT");
      return res.status(202).json({
        success: true,
        message: "Role-removal request sent to the Technical Admin.",
        roleRemovalRequest,
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch((rollbackError) => {
          console.error("Role-removal request rollback failed:", rollbackError);
        });
      }
      return next(error);
    } finally {
      if (client) client.release();
    }
  }
);

router.post(
  "/me/deletion-request",
  requireAuth,
  requireRole("member"),
  async (req, res, next) => {
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (reason.length < 5 || reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Provide a deletion reason between 5 and 1000 characters.",
      });
    }

    try {
      const deletionRequest = await memberRepository.requestAccountDeletion(
        req.user.id,
        reason
      );

      if (!deletionRequest) {
        return res.status(409).json({
          success: false,
          message: "Only an active member can request account deletion.",
        });
      }

      return res.status(202).json({
        success: true,
        message: "Your deletion request has been sent to the chairperson for approval.",
        deletionRequest,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
