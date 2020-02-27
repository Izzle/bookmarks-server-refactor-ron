const knex = require('knex');
const app = require('../src/app');
const { makeBookmarksArray } = require('./bookmarks.fixture');

describe.only('Bookmarks Endpoints', function() {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db); // Tests skip server.js, but our app instance expects there to be a 'db' instance
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks_table').truncate());

  afterEach('cleanup', () => db('bookmarks_table').truncate());

  describe('GET /bookmarks', () => {
    context('Given no bookmarks', () => {});

    context('Given there are are bookmarks in the database', () => {});
  });

  describe('GET /bookmarks/:id', () => {
    context('Given no bookmarks', () => {});

    context('Given there are are bookmarks in the database', () => {});
  });

});