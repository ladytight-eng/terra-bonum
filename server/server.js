const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 5173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TerraBonum2026!';
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'terrabonum';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

let db;
async function connectDb() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB');
}

function slugify(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}
async function uniqueId(base, collection) {
  let id = base, n = 1;
  while (await collection.findOne({ id })) { id = base + '-' + (++n); }
  return id;
}

// Uploads a buffer straight to Cloudinary (no local disk writes — this app
// runs on hosts with ephemeral/no persistent local storage). Cloudinary
// transcodes video to a broadly-compatible H.264 MP4 automatically, which
// fixes the common case of HEVC clips from iPhones/Instagram not playing
// back in most browsers.
function uploadToCloudinary(buffer, resourceType) {
  return new Promise((resolve, reject) => {
    const options = { resource_type: resourceType, folder: 'terra-bonum' };
    if (resourceType === 'video') {
      options.video_codec = 'h264';
      options.audio_codec = 'aac';
    }
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = IMAGE_MIMES.includes(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = VIDEO_MIMES.includes(file.mimetype);
    cb(ok ? null : new Error('Only video files are allowed'), ok);
  }
});
const uploadMoment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = IMAGE_MIMES.includes(file.mimetype) || VIDEO_MIMES.includes(file.mimetype);
    cb(ok ? null : new Error('Only image or video files are allowed'), ok);
  }
});

const app = express();
// no-store on every response so nothing — including admin fetch results —
// ever shows a stale cached copy after a change.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json());

function requireAdmin(req, res, next) {
  const supplied = req.get('x-admin-password');
  if (supplied && supplied === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}
function stripMongoId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

// ---- public API ----
app.get('/api/products', async (req, res) => {
  const list = await db.collection('products').find().toArray();
  res.json(list.map(stripMongoId));
});
app.get('/api/videos', async (req, res) => {
  const list = await db.collection('videos').find().toArray();
  res.json(list.map(stripMongoId));
});
app.get('/api/about', async (req, res) => {
  const doc = await db.collection('about').findOne({ _id: 'singleton' });
  res.json(stripMongoId(doc) || { name: '', role: '', bio: '', photo: '' });
});
app.get('/api/moments', async (req, res) => {
  const list = await db.collection('moments').find().toArray();
  res.json(list.map(stripMongoId));
});

// ---- admin auth ----
// Stateless: the client stores the password locally and sends it as a header
// on every admin request. No server-side session, so a server restart never
// forces a re-login as long as the password hasn't changed.
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Incorrect password' });
});

// ---- admin product management ----
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const list = await db.collection('products').find().toArray();
  res.json(list.map(stripMongoId));
});

app.post('/api/admin/products', requireAdmin, uploadImage.single('image'), async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const collection = db.collection('products');
  let img = b.img || 'assets/images/kente-hero.jpg';
  if (req.file) {
    try {
      const result = await uploadToCloudinary(req.file.buffer, 'image');
      img = result.secure_url;
    } catch (err) {
      return res.status(500).json({ error: 'Could not upload that image. Try again.' });
    }
  }
  const product = {
    id: await uniqueId(slugify(b.name), collection),
    name: b.name.trim(),
    category: (b.category || '').trim(),
    collection: (b.collection || b.category || '').trim(),
    meaning: (b.meaning || '').trim(),
    tag: (b.tag || '').trim(),
    price: Number(b.price) || 0,
    img,
    size: (b.size || '').trim(),
    desc: (b.desc || '').trim()
  };
  await collection.insertOne(product);
  res.status(201).json(stripMongoId(product));
});

app.put('/api/admin/products/:id', requireAdmin, uploadImage.single('image'), async (req, res) => {
  const collection = db.collection('products');
  const existing = await collection.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const b = req.body || {};
  let img = existing.img;
  if (req.file) {
    try {
      const result = await uploadToCloudinary(req.file.buffer, 'image');
      img = result.secure_url;
    } catch (err) {
      return res.status(500).json({ error: 'Could not upload that image. Try again.' });
    }
  }
  const updates = {
    name: b.name !== undefined ? b.name.trim() : existing.name,
    category: b.category !== undefined ? b.category.trim() : existing.category,
    collection: b.collection !== undefined ? b.collection.trim() : existing.collection,
    meaning: b.meaning !== undefined ? b.meaning.trim() : existing.meaning,
    tag: b.tag !== undefined ? b.tag.trim() : existing.tag,
    price: b.price !== undefined ? (Number(b.price) || 0) : existing.price,
    size: b.size !== undefined ? b.size.trim() : existing.size,
    desc: b.desc !== undefined ? b.desc.trim() : existing.desc,
    img
  };
  await collection.updateOne({ id: req.params.id }, { $set: updates });
  res.json(stripMongoId({ ...existing, ...updates }));
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const result = await db.collection('products').deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});

// ---- admin "watch the craft" video management ----
app.get('/api/admin/videos', requireAdmin, async (req, res) => {
  const list = await db.collection('videos').find().toArray();
  res.json(list.map(stripMongoId));
});

app.post('/api/admin/videos', requireAdmin, uploadVideo.single('video'), async (req, res) => {
  const b = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'A video file is required' });
  if (!b.title) return res.status(400).json({ error: 'Title is required' });

  let uploaded;
  try {
    uploaded = await uploadToCloudinary(req.file.buffer, 'video');
  } catch (err) {
    return res.status(500).json({ error: 'Could not process that video file. Try a different file or format.' });
  }

  const collection = db.collection('videos');
  const video = {
    id: await uniqueId(slugify(b.title), collection),
    title: b.title.trim(),
    caption: (b.caption || '').trim(),
    video: uploaded.secure_url,
    createdAt: Date.now()
  };
  await collection.insertOne(video);
  res.status(201).json(stripMongoId(video));
});

app.put('/api/admin/videos/:id', requireAdmin, uploadVideo.single('video'), async (req, res) => {
  const collection = db.collection('videos');
  const existing = await collection.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  const b = req.body || {};
  let videoUrl = existing.video;

  if (req.file) {
    try {
      const uploaded = await uploadToCloudinary(req.file.buffer, 'video');
      videoUrl = uploaded.secure_url;
    } catch (err) {
      return res.status(500).json({ error: 'Could not process that video file. Try a different file or format.' });
    }
  }

  const updates = {
    title: b.title !== undefined ? b.title.trim() : existing.title,
    caption: b.caption !== undefined ? b.caption.trim() : existing.caption,
    video: videoUrl
  };
  await collection.updateOne({ id: req.params.id }, { $set: updates });
  res.json(stripMongoId({ ...existing, ...updates }));
});

app.delete('/api/admin/videos/:id', requireAdmin, async (req, res) => {
  const result = await db.collection('videos').deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Video not found' });
  res.json({ ok: true });
});

// ---- admin "about" (meet the maker) management ----
app.get('/api/admin/about', requireAdmin, async (req, res) => {
  const doc = await db.collection('about').findOne({ _id: 'singleton' });
  res.json(stripMongoId(doc) || { name: '', role: '', bio: '', photo: '' });
});

app.put('/api/admin/about', requireAdmin, uploadImage.single('photo'), async (req, res) => {
  const b = req.body || {};
  const existing = (await db.collection('about').findOne({ _id: 'singleton' })) || {};
  let photo = existing.photo || '';
  if (req.file) {
    try {
      const result = await uploadToCloudinary(req.file.buffer, 'image');
      photo = result.secure_url;
    } catch (err) {
      return res.status(500).json({ error: 'Could not upload that photo. Try again.' });
    }
  }
  const updated = {
    name: b.name !== undefined ? b.name.trim() : (existing.name || ''),
    role: b.role !== undefined ? b.role.trim() : (existing.role || ''),
    bio: b.bio !== undefined ? b.bio.trim() : (existing.bio || ''),
    photo
  };
  await db.collection('about').updateOne({ _id: 'singleton' }, { $set: updated }, { upsert: true });
  res.json(updated);
});

// ---- admin "customer moments" management ----
app.get('/api/admin/moments', requireAdmin, async (req, res) => {
  const list = await db.collection('moments').find().toArray();
  res.json(list.map(stripMongoId));
});

app.post('/api/admin/moments', requireAdmin, uploadMoment.single('media'), async (req, res) => {
  const b = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'A photo or video is required' });
  const isVideo = VIDEO_MIMES.includes(req.file.mimetype);

  let uploaded;
  try {
    uploaded = await uploadToCloudinary(req.file.buffer, isVideo ? 'video' : 'image');
  } catch (err) {
    return res.status(500).json({ error: 'Could not process that file. Try again.' });
  }

  const collection = db.collection('moments');
  const moment = {
    id: await uniqueId(slugify(b.customerName || b.occasion || 'moment'), collection),
    customerName: (b.customerName || '').trim(),
    occasion: (b.occasion || '').trim(),
    mediaType: isVideo ? 'video' : 'image',
    media: uploaded.secure_url,
    createdAt: Date.now()
  };
  await collection.insertOne(moment);
  res.status(201).json(stripMongoId(moment));
});

app.put('/api/admin/moments/:id', requireAdmin, uploadMoment.single('media'), async (req, res) => {
  const collection = db.collection('moments');
  const existing = await collection.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Moment not found' });
  const b = req.body || {};
  let mediaType = existing.mediaType;
  let media = existing.media;

  if (req.file) {
    const isVideo = VIDEO_MIMES.includes(req.file.mimetype);
    try {
      const uploaded = await uploadToCloudinary(req.file.buffer, isVideo ? 'video' : 'image');
      mediaType = isVideo ? 'video' : 'image';
      media = uploaded.secure_url;
    } catch (err) {
      return res.status(500).json({ error: 'Could not process that file. Try again.' });
    }
  }

  const updates = {
    customerName: b.customerName !== undefined ? b.customerName.trim() : existing.customerName,
    occasion: b.occasion !== undefined ? b.occasion.trim() : existing.occasion,
    mediaType,
    media
  };
  await collection.updateOne({ id: req.params.id }, { $set: updates });
  res.json(stripMongoId({ ...existing, ...updates }));
});

app.delete('/api/admin/moments/:id', requireAdmin, async (req, res) => {
  const result = await db.collection('moments').deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Moment not found' });
  res.json({ ok: true });
});

// ---- static site (after API routes so API always wins) ----
app.use(express.static(ROOT));

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Terra Bonum server running at http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
