const
 knex = require('knex');
 bookshelf = require('bookshelf');
 knexfile = require('../knexfile');

module.exports = bookshelf(knex(knexfile.development));