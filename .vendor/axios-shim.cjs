"use strict";

function create() {
  return {
    interceptors: {
      request: {
        use() {}
      },
      response: {
        use() {}
      }
    },
    async request() {
      throw new Error("axios shim request() is not implemented");
    }
  };
}

module.exports = {
  create,
  default: {
    create
  }
};
