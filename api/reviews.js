const router = require('express').Router();
const validation = require('../lib/validation');

const reviews = require('../data/reviews');

const { getDbReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');
const ObjectID = require('mongodb').ObjectID;
const { BSONType } = require('mongodb');

const bcrypt = require('bcrypt');
const { generateAuthToken, requireAuthentication, postAuthentication } = require('../lib/auth');

exports.router = router;
exports.reviews = reviews;

/*
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};

async function getReviewsById(id) {
  const db = getDbReference();
  const collection = db.collection('reviews');
  const result = await collection.find({
    userid: id
  }).toArray();
  return result;
}

async function insertNewReviews(reviews) {                   //business here is directly came from req body
  const db = getDbReference();
  const collection = db.collection('reviews');
  const result = await collection.insertOne(reviews);
  return result.insertedId;
}

async function deleteReviewsById(id) {
  const db = getDbReference();
  const collection = db.collection('reviews');
  const result = await collection.deleteOne({
    userid: id
  });
  return result.deletedCount > 0;
}

async function updateReviewsById(id, reviews) {
  const db = getDbReference();
  const reviewsValue = {
    "_id":reviews.id,
    "userid":id,
    "businessid": reviews.businessid,
    "dollars": reviews.dollars,
    "stars": reviews.stars,
    "review": reviews.review
  };
  const collection = db.collection('reviews');
  const result = await collection.replaceOne(
    {userid: id},
    reviewsValue
  );
  return result.matchedCount > 0;
}

/*
 * Route to create a new review.
 */
router.post('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.userid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, reviewSchema)) {
      try {
        const db = getDbReference();
        const collection = db.collection('reviews');
        const results = await collection.find({
          userid: req.body.userid,
          businessid: req.body.businessid
        }).toArray();
        if (results[0] != undefined) {
          console.log(" result has: ", results[0]);
          res.status(403).json({
            error: "User has already posted a review of this business"
          });
        } else {
          // console.log("Hello!");
          const reviews = validation.extractValidFields(req.body, reviewSchema);
          const id = await insertNewReviews(req.body);
          res.status(201).json({
            id: id
          });
        }
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Error inserting reviews page from DB."
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
 * Route to fetch info about a specific review.
 */
router.get('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    // console.log(" --id ", req.params.id );
    try {
      const check = await getReviewsById(req.params.id);
      if (check) {
        res.status(200).send(check);
      } else {
        next();
      }
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Unable to fetch reviews."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to update a review.
 */
router.put('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.userid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, reviewSchema)) {
      try {
        const db = getDbReference();
        const collection = db.collection('reviews');
        const results = await collection.find({
          userid: req.body.userid
        }).toArray();
        console.log(" result has: ", results[0]);
        if (results[0] == undefined) {
          res.status(403).json({
            error: "User has not posted a review of this business"
          });
        } else {
          //console.log(" result is",results[0]);
          const check = await updateReviewsById(req.body.userid, req.body);
          if (check) {
            res.status(200).send({ check });
          } else {
            next();
          }
        }
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Unable to update reviews"
        });
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid review object"
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to delete a review.
 */
router.delete('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const deleteSuccess = await deleteReviewsById(req.params.id);
      if (deleteSuccess) {
        res.status(204).end();
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to delete reviews."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});
