const express = require('express');
const uuid = require('uuid/v4');
const { isWebUri } = require('valid-url');
const logger = require('../logger');
const { bookmarks } = require('../store');
const BookmarksService = require('./bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();


bookmarksRouter
  .route('/')
  .get((req, res, next) => {
    BookmarksService.getAllBookmarks(req.app.get('db'))
      .then(bookmarks => {
        res.json(bookmarks);
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;
    // the advantage of this approach is the code is cleaner
    // the disadvantage is the error message is less specific
    if(!title || !url || !description || !rating) {
      logger.error('All fields are required');
      return res
        .status(400)
        .send('Invalid data');
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`);
      // eslint-disable-next-line quotes
      return res.status(400).send(`'url' must be a valid URL`);
    }

    const newBookmark = {
      title,
      url,
      description,
      rating
    };

    BookmarksService.insertBookmark(req.app.get('db'), newBookmark)
      .then(bookmark => {
        logger.info(`Bookmark with the id ${bookmark.id} created.`);
        res
          .status(201)
          .location(`http://localhost:8000/bookmarks/${bookmark.id}`)
          .json(bookmark);
      })
      .catch(next);
  });

bookmarksRouter
  .route('/:id')
  .get((req, res, next) => {
   
    BookmarksService.getById(req.app.get('db'), req.params.id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${req.params.id} was not found`);
          return res
            .status(404)
            .json({ 
              error: { message: 'Bookmark not found' }
            });
        }
        res.json(bookmark);
      })
      .catch(next);
  })
  .delete((req, res) => {
    const { id } = req.params;

    const bookmarkIndex = bookmarks.findIndex( b => b.id === id);

    if (bookmarkIndex === -1) {
      logger.error(`Bookmark with the id ${id} is not found`);
      return res
        .status(404)
        .send('Not found');
    }

    bookmarks.splice(bookmarkIndex, 1);

    logger.info(`Bookmark with the id ${id} deleted.`);

    res
      .status(204)
      .end();
  });

module.exports = bookmarksRouter;