const bookshelf = require('../bookshelf');
const User = require('./user');

module.exports = bookshelf.Model.extend({
    tableName: 'profile',
    // user: () => this.hasOne(User)
});