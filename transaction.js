const mongoose = require('mongoose');
module.exports = work => mongoose.connection.transaction(work, {
  readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary'
});
