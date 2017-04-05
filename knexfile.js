// Update with your config settings.

if (process.env.NODE_ENV !== "production")
    loadEnvironmentVariables();
function loadEnvironmentVariables() {
    let dotenv = require('dotenv');
    dotenv.load();
}

module.exports = {

  development: {
      client: 'postgresql',
      connection: {
          database: 'HeyBuddy',
          user:     'timomorawitz',
          password: ''
      },
      pool: {
          min: 2,
          max: 10
      },
      migrations: {
          tableName: 'knex_migrations'
      }
  },

  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  production: {
      client: 'mssql',
      connection: {
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          server: process.env.DB_SERVER,
          database: process.env.DB_DATABASE,
          options: {
              encrypt: true,
          },
      },
      migrations: {
          tableName: 'knex_migrations'
      }
  }
};
