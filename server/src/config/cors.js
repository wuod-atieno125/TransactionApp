function createCorsOptions(allowedClientOrigins) {
  return {
    origin(origin, callback) {
      callback(null, !origin || allowedClientOrigins.includes(origin));
    },
    credentials: true,
  };
}

module.exports = {
  createCorsOptions,
};
