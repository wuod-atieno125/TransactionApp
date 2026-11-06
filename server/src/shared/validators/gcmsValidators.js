"use strict";

module.exports = {
  ...require("../../modules/authentication/authValidator"),
  ...require("../../modules/members/memberValidator"),
  ...require("./roleValidator"),
  ...require("../../modules/welfare/validators/welfare.validator")
};
