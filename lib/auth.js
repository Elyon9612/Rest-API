//Generate JWT
const jwt = require('jsonwebtoken');
const secretKey = "SuperSecret";

// Store user id as part of payload of jwt
function generateAuthToken(userId,Admin) {
    const payload = { sub: userId, admin:Admin};        //standard
    return jwt.sign(payload, secretKey, { expiresIn: '24h'});
}

exports.generateAuthToken = generateAuthToken;

// Require only some endpoints can only be accessed by authenticated user
function requireAuthentication(req, res, next) {
    console.log(" -- verifying authentication");
    const authHeader = req.get('Authorization') || '';
    const authHeaderParts = authHeader.split(' ');
    console.log(" -- authHeaderParts: ", authHeaderParts);
    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;

    try{
        const payload = jwt.verify(token, secretKey);        // Verify the signuature
        req.user = payload.sub;
        req.admin = payload.admin;
        next();
    } catch (err) {
        res.status(401).send({
            error: "Invalid authentiaction token."
        })
    }
}
exports.requireAuthentication = requireAuthentication

function postAuthentication(req, res, next) {
    console.log(" -- verifying authentication");
    const authHeader = req.get('Authorization') || '';
    const authHeaderParts = authHeader.split(' ');
    console.log(" -- authHeaderParts: ", authHeaderParts);
    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;

    try {
        const payload = jwt.verify(token, secretKey);        // Verify the signuature
        req.user = payload.sub;
        req.admin = payload.admin;
        next();
    } catch (err) {
        next();
    }
}
exports.postAuthentication = postAuthentication