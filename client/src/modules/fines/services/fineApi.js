
import { apiRequest } from "../../../shared/services/apiClient.js";

// --------------------------------------------------
// FINE RULES
// --------------------------------------------------

export const getFineRules = (params = {}) => {
  const query = new URLSearchParams(params).toString();

  return apiRequest(
    `/fines/rules${query ? `?${query}` : ""}`
  );
};

export const getFineRule = (id) =>
  apiRequest(`/fines/rules/${id}`);

export const createFineRule = (data) =>
  apiRequest("/fines/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createFineRuleVersion = (id, data) =>
  apiRequest(`/fines/rules/${id}/versions`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateFineRuleStatus = (id, status) =>
  apiRequest(`/fines/rules/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// --------------------------------------------------
// FINE RECORDS
// --------------------------------------------------

export const getFineRecords = (params = {}) => {
  const query = new URLSearchParams(params).toString();

  return apiRequest(
    `/fines/records${query ? `?${query}` : ""}`
  );
};

export const getActiveFineMembers = () =>
  apiRequest("/fines/records/members");

export const getFineRecord = (id) =>
  apiRequest(`/fines/records/${id}`);

export const issueFine = (data) =>
  apiRequest("/fines/records", {
    method: "POST",
    body: JSON.stringify(data),
  });

// --------------------------------------------------
// FINE PAYMENTS
// --------------------------------------------------

export const getFinePayments = (params = {}) => {
  const query = new URLSearchParams(params).toString();

  return apiRequest(
    `/fines/payments${query ? `?${query}` : ""}`
  );
};

export const recordFinePayment = (fineId, data) =>
  apiRequest(`/fines/records/${fineId}/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// --------------------------------------------------
// FINE WITHDRAWALS
// --------------------------------------------------

export const getFineWithdrawals = (params = {}) => {
  const query = new URLSearchParams(params).toString();

  return apiRequest(
    `/fines/withdrawals${query ? `?${query}` : ""}`
  );
};

export const getFineWithdrawal = (id) =>
  apiRequest(`/fines/withdrawals/${id}`);

export const initiateFineWithdrawal = (data) =>
  apiRequest("/fines/withdrawals", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const decideFineWithdrawal = (id, data) =>
  apiRequest(`/fines/withdrawals/${id}/decision`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const executeFineWithdrawal = (id, data) =>
  apiRequest(`/fines/withdrawals/${id}/execute`, {
    method: "POST",
    body: JSON.stringify(data),
  });