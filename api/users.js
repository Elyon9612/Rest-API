const router = require('express').Router();

exports.router = router;

const { getDbReference } = require('../lib/mongo');
const { extractValidFields, validateAgainstSchema } = require('../lib/validation');
const ObjectID = require('mongodb').ObjectID;
const { BSONType } = require('mongodb');

const bcrypt = require('bcrypt');
const { generateAuthToken, requireAuthentication, postAuthentication } = require('../lib/auth');

const UserSchema = {
  name: {required: true},
  email: {required: true},
  password: {required: true},
  admin: {required: false}
};

// Get business by Id---------------------------------------
async function getBusinessForUser(id){
  const db = getDbReference();
  const collection = db.collection('businesses');

  const results = await collection.find(
    { ownerid: id }
  ).toArray();
  for(var i =0;i<results.length;i++){
    bus_id = results[i]._id;
    //console.log("== business id is",bus_id);
    const reviews = await db.collection('reviews').find(
      { userid: id}, 
      {businessid: bus_id }
    ).toArray();
    // console.log("-- reviews is",reviews);
    const photos = await db.collection('photos').find(
      { userid: id },
      { businessid: bus_id }
    ).toArray();
    const viewPhoto = reviews.concat(photos);
    results[i].viewPhoto = viewPhoto;
  }
  return results;
}

async function getReviewsForUser(id) {
  const db = getDbReference();
  const collection = db.collection('reviews');
  const results = await collection.find(
    { _id: new ObjectID(id) }
  ).toArray();
  return results;
}

async function getPhotosForUser(id) {
  const db = getDbReference();
  const collection = db.collection('photos');
  const results = await collection.find(
    { _id: new ObjectID(id) }
  ).toArray();
  return results;
}
// Get all users---------------------------------------
async function getUserPage(){
  const db = getDbReference();
  const collection = db.collection('users');
  const result = await collection.find({}).toArray();
  //console.log("-- admin is", result[0].admin);
  return result;
}

// Delete user by Id
async function deleteUserById(id) {
  const db = getDbReference();
  const collection = db.collection('users');
  const result = await collection.deleteOne({
    _id: new ObjectID(id)
  });
  return result.deletedCount > 0;
}

async function insertNewUser(user,check){
  const userToInsert = extractValidFields(user,UserSchema);

  userToInsert.password = await bcrypt.hash(userToInsert.password,8);       // hash the password and store it into the previous place
  if(check === true){
    userToInsert.admin = true;
  }else{
    userToInsert.admin = false;           // Default admin is false
  }
  const db = getDbReference();
  const collection = db.collection('users');
  const result = await collection.insertOne(userToInsert);
  return result.insertedId;
}

async function getUserById(id, includePassword){
  const db = getDbReference();
  const collection = db.collection('users');
  if( !ObjectID.isValid(id)){
    return null;
  }else{
    const projection = includePassword ? {} : { password:0 }
    const results = await collection.find({ _id: new ObjectID(id) }).project(projection).toArray();
    //console.log("-- admin~ is", results[0].admin);
    return results[0];
  }
};

async function getUserByEmail(email, includePassword) {
  const db = getDbReference();
  const collection = db.collection('users');
  const projection = includePassword ? {} : { password: 0 }
  const results = await collection.find({ email: email }).project(projection).toArray();
  return results[0];
};

async function updateUserById(id,user){
  // const previous = await getUserById(id,true);
  // console.log("previous is ", previous.admin); 
  const userToUpdate = {
    "name":user.name,
    "email":user.email,
    "password":user.password,
    "admin": user.admin
  };
  const db = getDbReference();
  const collection = db.collection('users');

  const result = await collection.replaceOne(
    {_id: new ObjectID(id)},
    userToUpdate
  );
  return result.matchedCount > 0;
}

async function validateUser(email, password) {
  const user = await getUserByEmail(email, true);
  console.log("return password is", user.password);
  return user && await bcrypt.compare(password, user.password);
}

// User API endpoints below:-----------------------------
router.get('/all', async (req, res) => {
  try {
    const alluser = await getUserPage();
    res.status(200).send(alluser);
  } catch (err) {
    console.error(" --error:", err);
    res.status(500).send({
      err: "Error fetching users from DB."
    });
  }
});

// Post new user (finished)
router.post('/', postAuthentication, async (req,res) =>{
  if(validateAgainstSchema(req.body, UserSchema)){
    if (req.admin === true) {
      var x = req.body.admin;
      //console.log("-- body admin is", req.body.admin);
      try {
        const id = await insertNewUser(req.body,x);
        res.status(201).send({
          _id: id
        });
      } catch (err) {
        res.status(500).send({
          error: "Error inserting new user."
        });
      }
    }else{
      try {
        const id = await insertNewUser(req.body,false);
        res.status(201).send({
          _id: id
        });
      } catch (err) {
        res.status(500).send({
          error: "Error inserting new user."
        });
      }
    }
  }else{
    res.status(400).send({
      error: "Request body does not contain a valid user"
    });
  }
});


router.post('/login', async (req, res) => {
  if (req.body && req.body.email && req.body.password) {
    try {
      const authenticated = await validateUser(req.body.email, req.body.password);
      if (authenticated) {
        const user = await getUserByEmail(req.body.email, true);
        // console.log("login is:", user._id);
        res.status(200).send({
          token: generateAuthToken(user._id, user.admin)
        });
      } else {
        res.status(401).send({
          error: "Invalid authentication credentials."
        });
      }
    } catch (err) {
      console.error(" -- error:", err);
      res.status(500).send({
        error: "Error logging in. Try again later."
      });
    }
  } else {
    res.status(400).send({
      error: "Request body needs 'id' and 'password'."
    });
  }
});

// router.post('/login', async (req, res) => {
//   if (req.body && req.body.id && req.body.password) {
//     try {
//       const authenticated = await validateUser(req.body.id, req.body.password);
//       if (authenticated) {
//         const user = await getUserById(req.body.id, true);
//         res.status(200).send({
//           token: generateAuthToken(req.body.id,user.admin)
//         });
//       } else {
//         res.status(401).send({
//           error: "Invalid authentication credentials."
//         });
//       }
//     } catch (err) {
//       console.error(" -- error:", err);
//       res.status(500).send({
//         error: "Error logging in. Try again later."
//       });
//     }
//   } else{
//     res.status(400).send({
//       error: "Request body needs 'id' and 'password'."
//     });
//   }
// });

router.get('/:id', requireAuthentication, async (req,res,next) =>{
  if (req.user === req.params.id || req.admin === true) {
    try {
      const user = await getUserById(req.params.id);
      if (user) {
        res.status(200).send(user);
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Error fetching user."
      })
    }
  } else{
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

// Modify user's data
router.put('/:id', requireAuthentication, async (req, res, next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const user = await updateUserById(req.params.id, req.body);
      if (user) {
        res.status(200).send("Good");
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Error fetching user."
      })
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

// Later add requireAuthentication to there for only admin can delete the users
router.delete('/:id', requireAuthentication, async(req,res,next) => {
  if (req.user === req.params.id || req.admin === true) {
    try {
      const deleteSuccess = await deleteUserById(req.params.id);
      if (deleteSuccess) {
        res.status(204).send({ deleteSuccess });
      } else {
        next();
      }
    } catch (err) {
      res.status(500).send({
        error: "Unable to delete this user."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to list all of a user's businesses.--------------------------
 */
router.get('/:userid/businesses', requireAuthentication, async (req, res) =>{
  // console.log("input is",req.params.userid);
  if (req.user === req.params.userid || req.admin === true) {
    try {
      const check = await getBusinessForUser(req.params.userid);
      if (check) {
        res.status(200).send(check);
      } else {
        next();
      }
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Unable to fetch businesses for this user."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', requireAuthentication, async (req, res) => {
  if (req.user === req.params.userid || req.admin === true) {
    try {
      const check = await getReviewsForUser(req.params.userid);
      if (check) {
        res.status(200).send(check);
      } else {
        next();
      }
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Unable to fetch reviews for this user."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', requireAuthentication, async (req, res) => {
  if (req.user === req.params.userid || req.admin === true) {
    try {
      const check = await getPhotosForUser(req.params.userid);
      if (check) {
        res.status(200).send(check);
      } else {
        next();
      }
    } catch (err) {
      console.error(" --error:", err);
      res.status(500).send({
        err: "Unable to fetch photos for this user."
      });
    }
  } else {
    res.status(403).send({
      error: "Unauthorized to access the resource"
    });
  }
});
