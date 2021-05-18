/*
 * Module for working with a MongoDB connection.
 */

//For talking to our mongodb server
const { MongoClient } = require('mongodb');

const mongoHost = process.env.MONGO_HOST || 'localhost';
const mongoPort = process.env.MONGO_PORT || 27017;
const mongoUser = process.env.MONGO_USER;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoDBName = process.env.MONGO_DB_NAME;

const mongoUrl = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDBName}`;

//Use thoes value above to make connection with mongo

let db = null;

//This function would be called when first launch the server
//Establish the connect before the server listen for requests
exports.connectToDb = function (callback) {
    MongoClient.connect(mongoUrl, { useUnifiedTopology: true }, function (err, client) {
        if (err) {
            throw err;
        }
        // put execute query & specific the database name
        db = client.db(mongoDBName)
        // process of calling our API server
        callback();
    });
};

exports.getDbReference = function () {
    return db;
};