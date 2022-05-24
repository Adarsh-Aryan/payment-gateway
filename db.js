const mongodb = require("mongodb");
const { MongoClient } = mongodb;
const mongoURI =
  "mongodb+srv://admin-adarsh:adarsh123@cluster0.jshdb.mongodb.net/TripConnect?retryWrites=true&w=majority";

async function connectedDatabase() {
  const client = await MongoClient.connect(mongoURI);
  return client;
}

module.exports = connectedDatabase;
