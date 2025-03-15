// const jwt = require('jsonwebtoken');
// const jwksClient = require('jwks-rsa');
// const axios = require('axios');

// const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
// const GOOGLE_CLIENT_ID = '1082083818229-lsqpiopbbujgk2lufjj275kb848204ud.apps.googleusercontent.com';

// const getGooglePublicKeys = async () => {
//     const response = await axios.get(GOOGLE_CERTS_URL);
//     console.log("Google Public Keys Response:", response.data); // Debugging
//     return response.data;
// };

//   const verifyToken = async (req, res, next) => {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ error: 'Unauthorized: No token provided' });
//     }
  
//     const token = authHeader.split(' ')[1];
  
//     try {
//       const keys = await getGooglePublicKeys();
//       const decodedHeader = jwt.decode(token, { complete: true });
  
//       if (!decodedHeader || !decodedHeader.header.kid) {
//         throw new Error('Invalid Token');
//       }
  
//       const key = keys.keys.find(k => k.kid === decodedHeader.header.kid);
//       if (!key) {
//         throw new Error('Key not found');
//       }
  
//       const publicKey = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  
//       const payload = jwt.verify(token, publicKey, {
//         algorithms: ['RS256'],
//         audience: GOOGLE_CLIENT_ID
//       });
  
//       req.user = payload;
//       next();
//     } catch (error) {
//       return res.status(403).json({ error: 'Forbidden: Invalid token' });
//     }
//   };
  
//   module.exports = { verifyToken };

const axios = require('axios');

const GOOGLE_TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // ✅ Verify the token by calling Google's token info API
        const response = await axios.get(`${GOOGLE_TOKEN_INFO_URL}?access_token=${token}`);
        const payload = response.data;

        // ✅ Attach user info to request
        req.user = payload;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
};

module.exports = { verifyToken };
