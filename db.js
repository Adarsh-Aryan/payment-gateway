const mongodb = require("mongodb");
const { MongoClient } = mongodb;
const dotenv = require("dotenv");
dotenv.config();
const mongoURI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.jshdb.mongodb.net/${process.env.MONGODB_DATABASENAME}?retryWrites=true&w=majority`;

async function connectedDatabase() {
  const client = await MongoClient.connect(mongoURI);
  return client;
}

module.exports = connectedDatabase;
