function validateRequest(validator) {
  return function requestValidation(req, res, next) {
    try {
      if (!validator) {
        return next(
          new Error("validateRequest requires a validation schema or function.")
        );
      }

      // Supports Joi-style schemas.
      if (typeof validator.validate === "function") {
        const result = validator.validate(req.body);

        if (result.error) {
          return res.status(400).json({
            success: false,
            message: "Request validation failed.",
            errors: result.error.details
              ? result.error.details.map((item) => item.message)
              : [result.error.message],
          });
        }

        if (result.value !== undefined) {
          req.body = result.value;
        }

        return next();
      }

      // Custom body validators return null when valid or an error string.
      if (typeof validator === "function") {
        const result = validator(req.body, req);

        if (result && typeof result.then === "function") {
          return result
            .then((value) => {
              if (typeof value === "string" || value === false || Array.isArray(value)) {
                return res.status(400).json({
                  success: false,
                  message: "Request validation failed.",
                  errors: typeof value === "string"
                    ? [value]
                    : Array.isArray(value)
                      ? value
                      : [],
                });
              }

              return next();
            })
            .catch(next);
        }

        if (typeof result === "string" || result === false || Array.isArray(result)) {
          return res.status(400).json({
            success: false,
            message: "Request validation failed.",
            errors: typeof result === "string"
              ? [result]
              : Array.isArray(result)
                ? result
                : [],
          });
        }

        return next();
      }

      return next(
        new TypeError("Validator must be a function or a schema with validate().")
      );
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validateRequest;
module.exports.validateRequest = validateRequest;
