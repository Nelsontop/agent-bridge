"use strict";

const querystring = require("node:querystring");

module.exports = {
  parse: querystring.parse.bind(querystring),
  stringify: querystring.stringify.bind(querystring),
  default: {
    parse: querystring.parse.bind(querystring),
    stringify: querystring.stringify.bind(querystring)
  }
};
