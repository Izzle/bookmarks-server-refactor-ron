'use strict';
const app = require('./app');
const { PORT, NODE_ENV } = require('./config');

app.listen(PORT, () => {
  console.log(`Server is running in ${NODE_ENV} mode on ${PORT}`);
});