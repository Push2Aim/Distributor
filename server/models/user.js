const bookshelf = require('../bookshelf');
const Profile = require('./profile');

module.exports = bookshelf.Model.extend({
    tableName: 'user',
    // profile: () => this.belongsTo(Profile)
});