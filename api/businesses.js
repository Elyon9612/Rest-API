const router = require('express').Router();
const validation = require('../lib/validation');

//1. Get the reference from the database
const { getDbReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');
//const { ObjectID } = require('bson');
const ObjectID = require('mongodb').ObjectID;
const { BSONType } = require('mongodb');
exports.router = router;
// exports.businesses = businesses;

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test', { useNewUrlParser: true, useUnifiedTopology: true });

const bcrypt = require('bcrypt');
const { generateAuthToken, requireAuthentication, postAuthentication } = require('../lib/auth');


/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  id: {require: false},
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

// Building mongodb functions here------------------!And need to be exported first!--------


async function getBusinessesPage(page){
  const db = getDbReference();
  const collection = db.collection('businesses');

  const count = await collection.countDocuments();
  const numPerPage = 10;
  const lastPage = Math.ceil(count / numPerPage);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;
  const offset = (page - 1) * numPerPage;
  
  const results = await collection.find({})       //await is promise
    .sort({ _id:1 })
    .skip(offset)
    .limit(numPerPage)
    .toArray();                  //Take the results matched above to the js array

  const links = {};
  if (page < lastPage) {
    links.nextPage = `/businesses?page=${page + 1}`;
    links.lastPage = `/businesses?page=${lastPage}`;
  }
  if (page > 1) {
    links.prevPage = `/businesses?page=${page - 1}`;
    links.firstPage = '/businesses?page=1';
  }
  return{
    businesses: results,
    page: page,
    totalPages: lastPage,
    numPerPage: numPerPage,
    count: count,
    links:links
  };
}

// async function getBusinessById(id){
//   const db = getDbReference();
//   const collection = db.collection('businesses');
//   const results = await collection.findById(id).populate("reviews").populate("photos");
//   console.log(results);
//   return results;
// }

// async function getBusinessById(id){
//   const db = getDbReference();
//   const collection = db.collection('businesses');
//   const result = await collection.findOne({
//     ownerid: id
//   }).populate("reviews").populate("photos").toArray();
//   return result[0];
// }

async function insertNewBusiness(business){                   //business here is directly came from req body
  const db = getDbReference();
  const collection = db.collection('businesses');
  const result = await collection.insertOne(business);
  return result.insertedId;
}

async function deleteBusinessById(id) {
  const db = getDbReference();
  const collection = db.collection('businesses');
  const result = await collection.deleteOne({
    ownerid: id
  });
  return result.deletedCount > 0;
}


async function updateBusinessById(id, business) {
  const db = getDbReference();
  const businessValue = {
    // "id": business.id,
    "ownerid": id,
    "name": business.name,
    "address": business.address,
    "city": business.city,
    "state": business.state,
    "zip": business.zip,
    "phone": business.phone,
    "category": business.category,
    "subcategory": business.subcategory,
    "website": business.website
  };
  const collection = db.collection('businesses');
  const result = await collection.replaceOne(
    { ownerid: id },
    businessValue
  );
  return result.matchedCount > 0;
}

//exports.insertNewBusiness = insertNewBusiness;
//exports.getBusinessesPage = getBusinessesPage;    //Exports function if calling in another files

/*
 * Route to return a list of businesses.
 */ 
router.get('/', requireAuthentication, async (req,res) =>{
  if (req.admin === true) {
    try {
      const businessPage = await getBusinessesPage(parseInt(req.query.page) || 1);
      res.status(200).send(businessPage);
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Error fetching businesses page from DB."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to create a new business.
 */
router.post('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.userid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, businessSchema)) {
      try {
        const business = validation.extractValidFields(req.body, businessSchema);
        const id = await insertNewBusiness(req.body);
        res.status(201).json({
          id: id,
          links: {
            business: `/businesses/${business.id}`
          }
        });
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Error inserting businesses page from DB."
        });
      }
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

// /*
//  * Route to fetch info about a specific business.
//  */
router.get('/:id', async (req, res, next) => {
  try {
    console.log("input id is", req.params.id);
    const check = await getBusinessById(parseInt(req.params.id));
    if (check){
      res.status(200).send(check);
    }else{
      next();
    }
  } catch (err){
    console.error(" --error:", err);
    res.status(500).send({
      err: "Unable to fetch business."
    });
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/', requireAuthentication, async (req, res, next) => {
  if (req.user === req.body.ownerid || req.admin === true) {
    if (validation.validateAgainstSchema(req.body, businessSchema)) {
      try {
        const check = await updateBusinessById(req.body.ownerid, req.body);
        if (check) {
          res.status(200).end();
        } else {
          next();
        }
      } catch (err) {
        console.error(" --error:", err);
        res.status(500).send({
          err: "Unable to update business"
        });
      }
    } else {
      res.status(400).json({
        error: "Request body is not a valid business object"
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to delete a business.      // Has problem that cannot delete ??? What's this id means?
 */
router.delete('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const deleteSuccess = await deleteBusinessById(req.params.id);
      if (deleteSuccess) {
        res.status(204).send({ deleteSuccess });
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to delete business."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});
