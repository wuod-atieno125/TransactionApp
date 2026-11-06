const repository = require("../repositories/welfareContribution.repository");

function parsePagination(queryParams = {}) {
  const parse = (value, fallback) => {
    if (value === undefined || value === "") return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      const error = new Error("Invalid pagination parameters.");
      error.statusCode = 400;
      throw error;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      const error = new Error("Invalid pagination parameters.");
      error.statusCode = 400;
      throw error;
    }

    return parsed;
  };

  const limit = parse(queryParams.limit, 50);
  const offset = parse(queryParams.offset, 0);

  if (limit < 1 || offset < 0) {
    const error = new Error("Invalid pagination parameters.");
    error.statusCode = 400;
    throw error;
  }

  return {
    limit: Math.min(limit, 100),
    offset,
  };
}

async function getContribution(id, actor) {
  return repository.findById(id, actor);
}

async function listContributions(actor, queryParams) {
  const pagination = parsePagination(queryParams);
  const contributions = await repository.list({ ...actor, ...pagination });

  return { contributions, pagination };
}

module.exports = {
  getContribution,
  listContributions,
  parsePagination,
};
