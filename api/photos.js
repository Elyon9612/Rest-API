const router = require('express').Router();
const validation = require('../lib/validation');

const photos = require('../data/photos');

const { getDbReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

exports.router = router;
exports.photos = photos;
const ObjectID = require('mongodb').ObjectID;
const { BSONType } = require('mongodb');

const bcrypt = require('bcrypt');
const { generateAuthToken, requireAuthentication, postAuthentication } = require('../lib/auth');

/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};

async function getPhotosById(id) {
  const db = getDbReference();
  const collection = db.collection('photos');
  const result = await collection.find({
    userid: id
  }).toArray();
  return result;
}

async function insertNewPhotos(photos) {                   //business here is directly came from req body
  const db = getDbReference();
  const collection = db.collection('photos');
  const result = await collection.insertOne(photos);
  return result.insertedId;
}

async function deletePhotosById(id) {
  const db = getDbReference();
  const collection = db.collection('photos');
  const result = await collection.deleteOne({
    userid: id
  });
  return result.deletedCount > 0;
}

async function updatePhotosById(id, photos) {
  const db = getDbReference();
  const photosValue = {
    // "_id":photos._id,
    "userid": id,
    "businessid": photos.businessid,
    "caption": photos.caption
  };
  const collection = db.collection('photos');
  const result = await collection.replaceOne(
    {userid:id},
    photosValue
  );
  console.log("result is",result);
  return result.matchedCount > 0;
}


/*
 * Route to create a new photo.
 */
router.post('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.userid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, photoSchema)) {
      try {
        const photos = validation.extractValidFields(req.body, photoSchema);
        const id = await insertNewPhotos(req.body);
        res.status(201).json({
          id: id
        });
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Error inserting photos page from DB."
        });
      }
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const check = await getPhotosById(req.params.id);
      if (check) {
        res.status(200).send(check);
      } else {
        next();
      }
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Unable to fetch Photos."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to update a photo.
 */
router.put('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.userid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, photoSchema)) {
      try {
        const db = getDbReference();
        const collection = db.collection('photos');
        const results = await collection.find({
          userid: req.body.userid
        }).toArray();
        const updatedPhoto = validation.extractValidFields(req.body, photoSchema);
        //console.log("-- showing:",updatedPhoto);
        if (results[0] != undefined && results[0].businessid === updatedPhoto.businessid && updatedPhoto.userid === results[0].userid) {
          // console.log("let see~");
          const check = await updatePhotosById(req.body.userid, req.body);
          if (check) {
            res.status(200).send({ check });
          } else {
            next();
          }
        } else {
          res.status(403).json({
            error: "User has not posted a photo of this reviews"
          });
        }
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Unable to update photos"
        });
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid photo object"
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to delete a photo.
 */
router.delete('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const deleteSuccess = await deletePhotosById(req.params.id);
      if (deleteSuccess) {
        res.status(204).end();
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to delete Photos."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});
