"use strict";

const authService = require("../services/authService");
const emailVerificationService = require("../services/emailVerificationService");
const passwordRecoveryService = require("../services/passwordRecoveryService");

function getRegistrationFields(body) {
  return {
    fullName: body.fullName ?? body.full_name ?? body.name,
    username: body.username,
    phone: body.phone,
    recoveryEmail: body.recoveryEmail ?? body.recovery_email ?? body.email,
    password: body.password,
  };
}

function regenerateSession(session) {
  return new Promise((resolve, reject) => {
    session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => error ? reject(error) : resolve());
  });
}

async function sendEmailVerificationCode(req, res, next) {
  try {
    const result = await emailVerificationService.sendCode(
      req.body.email
    );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyEmailCode(req, res, next) {
  try {
    const result = await emailVerificationService.verifyCode(
      req.body.email,
      req.body.code
    );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
}

async function register(req, res, next) {
  try {
    const user = await authService.register(getRegistrationFields(req.body));

    return res.status(201).json({
      success: true,
      message: "Registration submitted. Your account is awaiting approval.",
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        accountStatus: user.account_status,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await authService.login({
      username: req.body.username,
      phone: req.body.phone,
      password: req.body.password,
    });

    if (!req.session) {
      throw new Error("Session middleware is not available.");
    }

    await regenerateSession(req.session);
    req.session.user = user;
    await saveSession(req.session);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.session.user.id, {
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    return next(error);
  }
}


async function forgotPassword(req, res, next) {
  try {
    const email = req.body.email ?? req.body.recoveryEmail;

    await passwordRecoveryService.requestPasswordReset(email);

    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, you will receive password reset instructions shortly.",
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyPasswordResetCode(req, res, next) {
  try {
    await passwordRecoveryService.verifyPasswordResetCode(
      req.body.email,
      req.body.code
    );

    return res.status(200).json({
      success: true,
      message: "Verification successful.",
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    await passwordRecoveryService.resetPassword(
      req.body.email,
      req.body.code,
      req.body.newPassword,
      req.body.username
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  sendEmailVerificationCode,
  verifyPasswordResetCode,
  verifyEmailCode
};