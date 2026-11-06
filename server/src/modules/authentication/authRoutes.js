
const express = require("express");
const rateLimit = require("express-rate-limit");
const validateRequest = require("../../shared/middleware/validateRequest");
const authController = require("./authController");
const { requireAuth } = require("../../shared/middleware/auth");
const {
  validateRegistration,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword
} = require("./authValidator");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const SESSION_COOKIE = "transaction.sid";

const ALLOWED_STATUSES = new Set(["approved"]);

function normalizeIdentifier(value) {
  const identifier = String(value || "").trim();

  if (identifier.includes("@")) {
    return { email: identifier.toLowerCase(), phone: null };
  }

  // Preserve a leading + for international phone numbers.
  const phone = identifier.replace(/[^\d+]/g, "");

  return {
    email: null,
    phone: phone || null,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
  };
}

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

const emailCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification-code requests. Please try again later."
  }
});

const emailVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later."
  }
});

function validateEmailOnly(body) {
  if (
    !body ||
    typeof body.email !== "string" ||
    body.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return "Enter a valid email address.";
  }

  return null;
}

function validateEmailCode(body) {
  const emailError = validateEmailOnly(body);

  if (emailError) return emailError;

  if (
    typeof body.code !== "string" ||
    !/^\d{6}$/.test(body.code.trim())
  ) {
    return "Enter the six-digit verification code.";
  }

  return null;
}
function validatePasswordResetCode(body) {
  return validateEmailCode(body);
}

router.post(
  "/email-verification/send",
  emailCodeLimiter,
  validateRequest(validateEmailOnly),
  authController.sendEmailVerificationCode
);

router.post(
  "/email-verification/verify",
  emailVerifyLimiter,
  validateRequest(validateEmailCode),
  authController.verifyEmailCode
);

const passwordResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many code verification attempts. Please try again later."
  }
});

router.post(
  "/reset-password/verify-code",
  passwordResetCodeLimiter,
  validateRequest(validatePasswordResetCode),
  authController.verifyPasswordResetCode
);


const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password change attempts. Please try again later.",
  },
});

router.post(
  "/register",
  registerLimiter,
  validateRequest(validateRegistration),
  authController.register
);
// POST /api/auth/login
router.post(
  "/login",
  loginLimiter,
  validateRequest(validateLogin),
  authController.login
);

router.patch(
  "/password",
  requireAuth,
  passwordChangeLimiter,
  validateRequest(validateChangePassword),
  authController.changePassword
);

// GET /api/auth/me
router.get("/me",requireAuth, (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  return res.status(200).json({
    success: true,
    user: req.session.user,
  });
});


const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many recovery requests. Please try again later.",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later.",
  },
});

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateRequest(validateForgotPassword),
  authController.forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validateRequest(validateResetPassword),
  authController.resetPassword
);

// POST /api/auth/logout
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  }

  req.session.destroy((error) => {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    if (error) {
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });
});

module.exports = router;
