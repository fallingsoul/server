var mongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const url = "mongodb://localhost:27017/local";
const connection = {
  write:function() {

  }
};
mongoClient.connect(url,function (err,db) {
  assert.equal(null,err);
  connection.read = db;
});

module.exports = connection;
