const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const { Validator } = require('jsonschema');
const crypto = require('crypto');
const { verifyToken } = require('./verifyToken'); 
// const verifyToken = require('./verifyToken');

console.log("verifyToken:", verifyToken);

const app = express();
app.use(bodyParser.json());


const client = redis.createClient();
client.connect();


const dataSchema = {
  type: "object",
  properties: {
    planCostShares: {
      type: "object",
      properties: {
        deductible: { type: "integer" },
        _org: { type: "string" },
        copay: { type: "integer" },
        objectId: { type: "string" },
        objectType: { type: "string" }
      },
      required: ["deductible", "_org", "copay", "objectId", "objectType"]
    },
    linkedPlanServices: { type: "array" },
    _org: { type: "string" },
    objectId: { type: "string" },
    objectType: { type: "string" },
    planType: { type: "string" },
    creationDate: { type: "string" }
  },
  required: ["planCostShares", "linkedPlanServices", "_org", "objectId", "objectType", "planType", "creationDate"]
};

const validator = new Validator();


const generateETag = (data) => crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');


app.post('/v1/data', verifyToken, async (req, res) => {
  const validation = validator.validate(req.body, dataSchema);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.map(e => e.stack) });
  }

  const etag = generateETag(req.body);
  await client.set(req.body.objectId, JSON.stringify({ ...req.body, etag }));

  res.status(201).set('ETag', etag).json({ message: 'Data created', objectId: req.body.objectId });
});


app.get('/v1/data/:id', verifyToken, async (req, res) => {
  try {
    const data = await client.get(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const parsedData = JSON.parse(data);
    const clientETag = req.headers['if-none-match'];

    // If client ETag matches, return 304 Not Modified
    if (clientETag && clientETag === parsedData.etag) {
      return res.status(304).end();
    }

    res.status(200).set('ETag', parsedData.etag).json(parsedData);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.delete('/v1/data/:id', verifyToken, async (req, res) => {
  const result = await client.del(req.params.id);
  if (result === 0) {
    return res.status(404).json({ error: 'Data not found' });
  }

  res.status(200).json({ 
    message: 'Data deleted successfully', 
    objectId: req.params.id 
  });
});



app.get('/v1/data', verifyToken, async (req, res) => {
  try {
    const keys = await client.keys('*');
    if (keys.length === 0) {
      return res.status(404).json({ message: 'No data found' });
    }

    const data = await Promise.all(keys.map(async (key) => {
      const value = await client.get(key);
      return JSON.parse(value);
    }));

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//merge PATCH
app.patch('/v1/data/:id', verifyToken, async (req, res) => {
  try {
    const existingData = await client.get(req.params.id);
    if (!existingData) {
      return res.status(404).json({ error: 'Data not found' });
    }

    let parsedData = JSON.parse(existingData);
    const updatedData = { ...parsedData, ...req.body };
    const etag = generateETag(updatedData);
    updatedData.etag = etag;

    await client.set(req.params.id, JSON.stringify(updatedData));

    res.status(200).set('ETag', etag).json({
      message: 'Data updated successfully',
      objectId: req.params.id,
      updatedFields: req.body
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



//If-Match header
app.put('/v1/data/:id', verifyToken, async (req, res) => {
  const existingData = await client.get(req.params.id);
  if (!existingData) {
    return res.status(404).json({ error: 'Data not found' });
  }

  let parsedData = JSON.parse(existingData);
  const clientETag = req.headers['if-match'];

  if (clientETag && clientETag !== parsedData.etag) {
    return res.status(412).json({ error: 'Precondition Failed: Data has changed' });
  }

  const etag = generateETag(req.body);
  await client.set(req.params.id, JSON.stringify({ ...req.body, etag }));

  res.status(200).set('ETag', etag).json({ message: 'Data updated', objectId: req.params.id });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
