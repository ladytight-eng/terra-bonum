// One-time migration: reads the old local JSON files + local uploaded
// images/videos, pushes the media to Cloudinary, and inserts the resulting
// records into MongoDB. Safe to re-run — it clears each collection first.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');
const DB_NAME = process.env.MONGODB_DB || 'terrabonum';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8')); }
  catch (e) { return fallback; }
}

function uploadLocalFile(relativePath, resourceType) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(ROOT, relativePath);
    if (!fs.existsSync(fullPath)) return resolve(null);
    const options = { resource_type: resourceType, folder: 'terra-bonum' };
    if (resourceType === 'video') {
      options.video_codec = 'h264';
      options.audio_codec = 'aac';
    }
    cloudinary.uploader.upload(fullPath, options, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
  });
}

// A path counts as "local" (needs uploading) if it points into our own
// assets/ folder rather than already being a full Cloudinary/http(s) URL —
// e.g. the seed products still reference the site's original stock photos.
function isLocalPath(p) {
  return !!p && !/^https?:\/\//i.test(p);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in .env');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log('Connected to MongoDB. Starting migration...');

  const products = readJson('products.json', []);
  const videos = readJson('videos.json', []);
  const moments = readJson('moments.json', []);
  const about = readJson('about.json', { name: '', role: '', bio: '', photo: '' });

  console.log(`Found ${products.length} products, ${videos.length} videos, ${moments.length} moments.`);

  for (const p of products) {
    if (isLocalPath(p.img)) {
      console.log(`Uploading product image for "${p.name}"...`);
      const url = await uploadLocalFile(p.img, 'image');
      if (url) p.img = url;
    }
  }

  for (const v of videos) {
    if (isLocalPath(v.video)) {
      console.log(`Uploading video "${v.title}"...`);
      const url = await uploadLocalFile(v.video, 'video');
      if (url) v.video = url;
    }
  }

  for (const m of moments) {
    if (isLocalPath(m.media)) {
      console.log(`Uploading moment media (${m.customerName || m.occasion || m.id})...`);
      const url = await uploadLocalFile(m.media, m.mediaType === 'video' ? 'video' : 'image');
      if (url) m.media = url;
    }
  }

  if (isLocalPath(about.photo)) {
    console.log('Uploading founder photo...');
    const url = await uploadLocalFile(about.photo, 'image');
    if (url) about.photo = url;
  }

  if (products.length) {
    await db.collection('products').deleteMany({});
    await db.collection('products').insertMany(products);
  }
  if (videos.length) {
    await db.collection('videos').deleteMany({});
    await db.collection('videos').insertMany(videos);
  }
  if (moments.length) {
    await db.collection('moments').deleteMany({});
    await db.collection('moments').insertMany(moments);
  }
  if (about && about.name) {
    await db.collection('about').updateOne({ _id: 'singleton' }, { $set: about }, { upsert: true });
  }

  console.log('Migration complete.');
  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
