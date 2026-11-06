
const { query, getClient } = require("../../../config/database");

const VALID_STATUSES = ["draft", "active", "retired"];

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validateRuleInput(data, defaultStatus = "draft") {
  const ruleCode = String(data.ruleCode || "").trim().toUpperCase();
  const title = String(data.title || "").trim();
  const description = String(data.description || "").trim();
  const conditions = String(data.conditions || "").trim();
  const amount = String(data.fineAmount ?? "").trim();

  if (!/^[A-Z0-9_-]{2,50}$/.test(ruleCode)) {
    fail("Rule code must contain 2–50 letters, numbers, hyphens or underscores.");
  }

  if (!title || title.length > 150) {
    fail("A valid rule title is required (maximum 150 characters).");
  }

  if (!description) {
    fail("Rule description is required.");
  }

  if (!conditions) {
    fail("Rule conditions are required.");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    fail("Fine amount must be a positive amount with up to two decimal places.");
  }

  const effectiveFrom = data.effectiveFrom
    ? new Date(data.effectiveFrom)
    : null;

  const effectiveTo = data.effectiveTo
    ? new Date(data.effectiveTo)
    : null;

  if (!effectiveFrom || Number.isNaN(effectiveFrom.getTime())) {
    fail("A valid effective-from date is required.");
  }

  if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
    fail("A valid effective-to date is required.");
  }

  if (effectiveTo && effectiveTo <= effectiveFrom) {
    fail("Effective-to date must be later than effective-from date.");
  }

  const status = data.status || defaultStatus;

  if (!VALID_STATUSES.includes(status)) {
    fail("Invalid fine rule status.");
  }

  return {
    ruleCode,
    title,
    description,
    conditions,
    fineAmount: amount,
    effectiveFrom,
    effectiveTo,
    status,
  };
}

async function writeAudit(client, {
  actorId,
  action,
  targetId,
  oldValues = null,
  newValues = null,
}) {
  await client.query(
    `INSERT INTO audit_logs
      (actor_user_id, action, target_type, target_id, old_values, new_values)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      actorId,
      action,
      "fine_rule",
      targetId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

async function listRules({ status, search } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      fail("Invalid fine rule status.");
    }

    params.push(status);
    conditions.push(`status = $${params.length}`);

    if (status === "active") {
      conditions.push(
        `(effective_from AT TIME ZONE 'UTC')::date <=
           (NOW() AT TIME ZONE 'UTC')::date`
      );
      conditions.push(
        `(effective_to IS NULL OR
          (effective_to AT TIME ZONE 'UTC')::date >=
            (NOW() AT TIME ZONE 'UTC')::date)`
      );
    }
  }

  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(
      `(rule_code ILIKE $${params.length}
        OR title ILIKE $${params.length}
        OR description ILIKE $${params.length})`
    );
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await query(
    `SELECT
       id,
       rule_code,
       version,
       title,
       description,
       conditions,
       fine_amount,
       currency,
       effective_from,
       effective_to,
       status,
       supersedes_rule_id,
       created_at,
       updated_at
     FROM fine_rules
     ${where}
     ORDER BY rule_code ASC, version DESC`,
    params
  );

  return result.rows;
}

async function getRule(ruleId) {
  const result = await query(
    `SELECT *
     FROM fine_rules
     WHERE id = $1`,
    [ruleId]
  );

  if (!result.rows.length) {
    fail("Fine rule not found.", 404);
  }

  return result.rows[0];
}

async function createRule(data) {
  const input = validateRuleInput(data, "active");
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id
       FROM fine_rules
       WHERE rule_code = $1
       LIMIT 1`,
      [input.ruleCode]
    );

    if (existing.rows.length) {
      fail(
        "This rule code already exists. Create a new version instead.",
        409
      );
    }

    const result = await client.query(
      `INSERT INTO fine_rules (
         rule_code,
         version,
         title,
         description,
         conditions,
         fine_amount,
         currency,
         effective_from,
         effective_to,
         status,
         created_by,
         updated_by
       )
       VALUES ($1, 1, $2, $3, $4, $5, 'KES', $6, $7, $8, $9, $9)
       RETURNING *`,
      [
        input.ruleCode,
        input.title,
        input.description,
        input.conditions,
        input.fineAmount,
        input.effectiveFrom,
        input.effectiveTo,
        input.status,
        data.actorId,
      ]
    );

    const rule = result.rows[0];

    await writeAudit(client, {
      actorId: data.actorId,
      action: "FINE_RULE_CREATED",
      targetId: rule.id,
      newValues: rule,
    });

    await client.query("COMMIT");

    return rule;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      fail("A conflicting fine rule already exists.", 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function createRuleVersion(data) {
  const input = validateRuleInput(data);
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const previousResult = await client.query(
      `SELECT *
       FROM fine_rules
       WHERE id = $1
       FOR UPDATE`,
      [data.ruleId]
    );

    if (!previousResult.rows.length) {
      fail("The fine rule to update was not found.", 404);
    }

    const previous = previousResult.rows[0];

    if (input.ruleCode !== previous.rule_code) {
      fail("A rule version must retain its original rule code.");
    }

    const nextVersion = Number(previous.version) + 1;

    const result = await client.query(
      `INSERT INTO fine_rules (
         rule_code,
         version,
         title,
         description,
         conditions,
         fine_amount,
         currency,
         effective_from,
         effective_to,
         status,
         supersedes_rule_id,
         created_by,
         updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING *`,
      [
        previous.rule_code,
        nextVersion,
        input.title,
        input.description,
        input.conditions,
        input.fineAmount,
        previous.currency,
        input.effectiveFrom,
        input.effectiveTo,
        input.status,
        previous.id,
        data.actorId,
      ]
    );

    const rule = result.rows[0];

    await writeAudit(client, {
      actorId: data.actorId,
      action: "FINE_RULE_VERSION_CREATED",
      targetId: rule.id,
      oldValues: previous,
      newValues: rule,
    });

    await client.query("COMMIT");

    return rule;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      fail("A conflicting fine rule version already exists.", 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateRuleStatus({ ruleId, status, actorId }) {
  if (!VALID_STATUSES.includes(status)) {
    fail("Status must be draft, active or retired.");
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT *
       FROM fine_rules
       WHERE id = $1
       FOR UPDATE`,
      [ruleId]
    );

    if (!currentResult.rows.length) {
      fail("Fine rule not found.", 404);
    }

    const current = currentResult.rows[0];

    if (current.status === "retired" && status !== "retired") {
      fail("A retired rule cannot be reactivated. Create a new version.");
    }

    if (status === "active") {
      const activeResult = await client.query(
        `SELECT id
         FROM fine_rules
         WHERE rule_code = $1
           AND status = 'active'
           AND id <> $2
         FOR UPDATE`,
        [current.rule_code, ruleId]
      );

      if (activeResult.rows.length) {
        fail(
          "Another version of this rule is already active. Retire it before activating this version.",
          409
        );
      }
    }

    const result = await client.query(
      `UPDATE fine_rules
       SET status = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, actorId, ruleId]
    );

    const updated = result.rows[0];

    await writeAudit(client, {
      actorId,
      action: "FINE_RULE_STATUS_UPDATED",
      targetId: ruleId,
      oldValues: { status: current.status },
      newValues: { status: updated.status },
    });

    await client.query("COMMIT");

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      fail("Another active version of this rule already exists.", 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listRules,
  getRule,
  createRule,
  createRuleVersion,
  updateRuleStatus,
};