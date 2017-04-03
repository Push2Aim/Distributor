const
 knex = require('knex');
 bookshelf = require('bookshelf');
 knexfile = require('../knexfile');

let env = process.env.NODE_ENV?process.env.NODE_ENV:"development";
console.log("load knexfile environment:",env)
module.exports = bookshelf(knex(knexfile[env]));