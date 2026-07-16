require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const express = require('express');
const multer = require('multer');
const ffmpegPath = require('ffmpeg-static');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const VIDEOS_DATA_FILE = path.join(__dirname, 'data', 'videos.json');
const ABOUT_DATA_FILE = path.join(__dirname, 'data', 'about.json');
const MOMENTS_DATA_FILE = path.join(__dirname, 'data', 'moments.json');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'images', 'uploads');
const VIDEO_UPLOAD_DIR = path.join(ROOT, 'assets', 'videos', 'uploads');
const MOMENTS_UPLOAD_DIR = path.join(ROOT, 'assets', 'moments', 'uploads');
const PORT = process.env.PORT || 5173;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TerraBonum2026!';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(VIDEO_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(MOMENTS_UPLOAD_DIR, { recursive: true });

// ---- tiny JSON datastore ----
function readProducts() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeProducts(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}
function readVideos() {
  try { return JSON.parse(fs.readFileSync(VIDEOS_DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeVideos(list) {
  fs.writeFileSync(VIDEOS_DATA_FILE, JSON.stringify(list, null, 2));
}
function readAbout() {
  try { return JSON.parse(fs.readFileSync(ABOUT_DATA_FILE, 'utf8')); }
  catch (e) { return { name: '', role: '', bio: '', photo: '' }; }
}
function writeAbout(data) {
  fs.writeFileSync(ABOUT_DATA_FILE, JSON.stringify(data, null, 2));
}
function readMoments() {
  try { return JSON.parse(fs.readFileSync(MOMENTS_DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeMoments(list) {
  fs.writeFileSync(MOMENTS_DATA_FILE, JSON.stringify(list, null, 2));
}
function slugify(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}
function uniqueId(base, list) {
  let id = base, n = 1;
  while (list.some(p => p.id === id)) { id = base + '-' + (++n); }
  return id;
}

// Re-encodes any uploaded video (HEVC from iPhones/Instagram, etc.) to
// H.264 + AAC, the one combination every major browser plays natively.
function transcodeToH264(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ], { maxBuffer: 1024 * 1024 * 20 }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// ---- upload handling ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  }
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.mp4', '.mov', '.webm'].includes(ext) ? ext : '.mp4';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype);
    cb(ok ? null : new Error('Only video files are allowed'), ok);
  }
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];
const momentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MOMENTS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const isVideo = VIDEO_MIMES.includes(file.mimetype);
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = isVideo ? ['.mp4', '.mov', '.webm'] : ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const safeExt = allowed.includes(ext) ? ext : (isVideo ? '.mp4' : '.jpg');
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + safeExt);
  }
});
const uploadMoment = multer({
  storage: momentStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = IMAGE_MIMES.includes(file.mimetype) || VIDEO_MIMES.includes(file.mimetype);
    cb(ok ? null : new Error('Only image or video files are allowed'), ok);
  }
});

const app = express();
// no-store on every response (API and static alike) while this is under
// active development, so nothing — including admin fetch results — ever
// shows a stale cached copy after a change.
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

// ---- public API ----
app.get('/api/products', (req, res) => {
  res.json(readProducts());
});
app.get('/api/videos', (req, res) => {
  res.json(readVideos());
});
app.get('/api/about', (req, res) => {
  res.json(readAbout());
});
app.get('/api/moments', (req, res) => {
  res.json(readMoments());
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
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(readProducts());
});

app.post('/api/admin/products', requireAdmin, upload.single('image'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const list = readProducts();
  const id = uniqueId(slugify(b.name), list);
  const product = {
    id,
    name: b.name.trim(),
    category: (b.category || '').trim(),
    collection: (b.collection || b.category || '').trim(),
    meaning: (b.meaning || '').trim(),
    tag: (b.tag || '').trim(),
    price: Number(b.price) || 0,
    img: req.file ? 'assets/images/uploads/' + req.file.filename : (b.img || 'assets/images/kente-hero.jpg'),
    size: (b.size || '').trim(),
    desc: (b.desc || '').trim()
  };
  list.push(product);
  writeProducts(list);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  const list = readProducts();
  const idx = list.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  const b = req.body || {};
  const existing = list[idx];
  const updated = {
    ...existing,
    name: b.name !== undefined ? b.name.trim() : existing.name,
    category: b.category !== undefined ? b.category.trim() : existing.category,
    collection: b.collection !== undefined ? b.collection.trim() : existing.collection,
    meaning: b.meaning !== undefined ? b.meaning.trim() : existing.meaning,
    tag: b.tag !== undefined ? b.tag.trim() : existing.tag,
    price: b.price !== undefined ? (Number(b.price) || 0) : existing.price,
    size: b.size !== undefined ? b.size.trim() : existing.size,
    desc: b.desc !== undefined ? b.desc.trim() : existing.desc,
    img: req.file ? 'assets/images/uploads/' + req.file.filename : existing.img
  };
  list[idx] = updated;
  writeProducts(list);
  res.json(updated);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const list = readProducts();
  const next = list.filter(p => p.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Product not found' });
  writeProducts(next);
  res.json({ ok: true });
});

// ---- admin "watch the craft" video management ----
app.get('/api/admin/videos', requireAdmin, (req, res) => {
  res.json(readVideos());
});

app.post('/api/admin/videos', requireAdmin, uploadVideo.single('video'), async (req, res) => {
  const b = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'A video file is required' });
  if (!b.title) return res.status(400).json({ error: 'Title is required' });

  const rawPath = req.file.path;
  const finalFilename = path.basename(req.file.filename, path.extname(req.file.filename)) + '-web.mp4';
  const finalPath = path.join(VIDEO_UPLOAD_DIR, finalFilename);

  try {
    // Always re-encode to H.264/AAC: phone and Instagram exports are often
    // HEVC, which uploads fine but silently fails to play in most browsers.
    await transcodeToH264(rawPath, finalPath);
  } catch (err) {
    fs.unlink(rawPath, () => {});
    fs.unlink(finalPath, () => {});
    return res.status(500).json({ error: 'Could not process that video file. Try a different file or format.' });
  }
  fs.unlink(rawPath, () => {});

  const list = readVideos();
  const video = {
    id: uniqueId(slugify(b.title), list),
    title: b.title.trim(),
    caption: (b.caption || '').trim(),
    video: 'assets/videos/uploads/' + finalFilename,
    createdAt: Date.now()
  };
  list.push(video);
  writeVideos(list);
  res.status(201).json(video);
});

app.put('/api/admin/videos/:id', requireAdmin, uploadVideo.single('video'), async (req, res) => {
  const list = readVideos();
  const idx = list.findIndex(v => v.id === req.params.id);
  if (idx === -1) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Video not found' });
  }
  const b = req.body || {};
  const existing = list[idx];
  let videoPath = existing.video;

  if (req.file) {
    const rawPath = req.file.path;
    const finalFilename = path.basename(req.file.filename, path.extname(req.file.filename)) + '-web.mp4';
    const finalPath = path.join(VIDEO_UPLOAD_DIR, finalFilename);
    try {
      await transcodeToH264(rawPath, finalPath);
    } catch (err) {
      fs.unlink(rawPath, () => {});
      fs.unlink(finalPath, () => {});
      return res.status(500).json({ error: 'Could not process that video file. Try a different file or format.' });
    }
    fs.unlink(rawPath, () => {});
    const oldFilePath = path.join(ROOT, existing.video);
    fs.unlink(oldFilePath, () => {});
    videoPath = 'assets/videos/uploads/' + finalFilename;
  }

  const updated = {
    ...existing,
    title: b.title !== undefined ? b.title.trim() : existing.title,
    caption: b.caption !== undefined ? b.caption.trim() : existing.caption,
    video: videoPath
  };
  list[idx] = updated;
  writeVideos(list);
  res.json(updated);
});

app.delete('/api/admin/videos/:id', requireAdmin, (req, res) => {
  const list = readVideos();
  const target = list.find(v => v.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Video not found' });
  writeVideos(list.filter(v => v.id !== req.params.id));
  const filePath = path.join(ROOT, target.video);
  fs.unlink(filePath, () => {});
  res.json({ ok: true });
});

// ---- admin "about" (meet the maker) management ----
app.get('/api/admin/about', requireAdmin, (req, res) => {
  res.json(readAbout());
});

app.put('/api/admin/about', requireAdmin, upload.single('photo'), (req, res) => {
  const b = req.body || {};
  const existing = readAbout();
  const updated = {
    name: b.name !== undefined ? b.name.trim() : existing.name,
    role: b.role !== undefined ? b.role.trim() : existing.role,
    bio: b.bio !== undefined ? b.bio.trim() : existing.bio,
    photo: req.file ? 'assets/images/uploads/' + req.file.filename : existing.photo
  };
  writeAbout(updated);
  res.json(updated);
});

// ---- admin "customer moments" management ----
// Handles a moment upload's file: images are kept as-is, videos are
// re-encoded to H.264/AAC just like "watch the craft" clips. Returns the
// final relative path, or throws with a message safe to show the admin.
async function processMomentFile(file) {
  const isVideo = VIDEO_MIMES.includes(file.mimetype);
  if (!isVideo) {
    return { type: 'image', path: 'assets/moments/uploads/' + file.filename };
  }
  const rawPath = file.path;
  const finalFilename = path.basename(file.filename, path.extname(file.filename)) + '-web.mp4';
  const finalPath = path.join(MOMENTS_UPLOAD_DIR, finalFilename);
  try {
    await transcodeToH264(rawPath, finalPath);
  } catch (err) {
    fs.unlink(rawPath, () => {});
    fs.unlink(finalPath, () => {});
    throw new Error('Could not process that video file. Try a different file or format.');
  }
  fs.unlink(rawPath, () => {});
  return { type: 'video', path: 'assets/moments/uploads/' + finalFilename };
}

app.get('/api/admin/moments', requireAdmin, (req, res) => {
  res.json(readMoments());
});

app.post('/api/admin/moments', requireAdmin, uploadMoment.single('media'), async (req, res) => {
  const b = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'A photo or video is required' });

  let processed;
  try {
    processed = await processMomentFile(req.file);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const list = readMoments();
  const idBase = slugify(b.customerName || b.occasion || 'moment');
  const moment = {
    id: uniqueId(idBase, list),
    customerName: (b.customerName || '').trim(),
    occasion: (b.occasion || '').trim(),
    mediaType: processed.type,
    media: processed.path,
    createdAt: Date.now()
  };
  list.push(moment);
  writeMoments(list);
  res.status(201).json(moment);
});

app.put('/api/admin/moments/:id', requireAdmin, uploadMoment.single('media'), async (req, res) => {
  const list = readMoments();
  const idx = list.findIndex(m => m.id === req.params.id);
  if (idx === -1) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'Moment not found' });
  }
  const b = req.body || {};
  const existing = list[idx];
  let mediaType = existing.mediaType;
  let mediaPath = existing.media;

  if (req.file) {
    let processed;
    try {
      processed = await processMomentFile(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    const oldFilePath = path.join(ROOT, existing.media);
    fs.unlink(oldFilePath, () => {});
    mediaType = processed.type;
    mediaPath = processed.path;
  }

  const updated = {
    ...existing,
    customerName: b.customerName !== undefined ? b.customerName.trim() : existing.customerName,
    occasion: b.occasion !== undefined ? b.occasion.trim() : existing.occasion,
    mediaType,
    media: mediaPath
  };
  list[idx] = updated;
  writeMoments(list);
  res.json(updated);
});

app.delete('/api/admin/moments/:id', requireAdmin, (req, res) => {
  const list = readMoments();
  const target = list.find(m => m.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Moment not found' });
  writeMoments(list.filter(m => m.id !== req.params.id));
  const filePath = path.join(ROOT, target.media);
  fs.unlink(filePath, () => {});
  res.json({ ok: true });
});

// ---- static site (after API routes so API always wins) ----
app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log('Terra Bonum server running at http://localhost:' + PORT);
});
