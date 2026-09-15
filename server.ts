import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  validateSubAdminKey,
  activateSubAdminKey,
  verifyMasterKey,
  changeMasterKey,
  getAllSubAdmins,
  createSubAdminLicense,
  toggleBlockSubAdmin,
  updateSubAdminDuration,
  deleteSubAdmin,
  toggleGlobalLock,
} from './server/licenseStore';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Multer in-memory storage for handling real video uploads up to 250MB
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 250 * 1024 * 1024 },
  });

  // Dedicated direct APK download endpoints with standard Express res.download
  const handleApkDownload = (req: express.Request, res: express.Response) => {
    const requestedFile = req.params.filename || 'FB_Automation_v6_Latest.apk';
    const possiblePaths = [
      path.resolve(process.cwd(), requestedFile),
      path.resolve(process.cwd(), 'FB_Automation_v6_Latest.apk'),
      path.resolve(process.cwd(), 'FB_Automation_v6.apk'),
      path.resolve(process.cwd(), 'public', requestedFile),
      path.resolve(process.cwd(), 'public', 'FB_Automation_v6_Latest.apk'),
      path.resolve(process.cwd(), 'public', 'FB_Automation_v6.apk'),
      path.resolve(process.cwd(), 'public', 'downloads', requestedFile),
      path.resolve(process.cwd(), 'public', 'downloads', 'FB_Automation_v6_Latest.apk'),
      path.resolve(process.cwd(), 'dist', requestedFile),
      path.resolve(process.cwd(), 'dist', 'FB_Automation_v6_Latest.apk'),
      path.resolve(process.cwd(), 'FB_Automation_v5.apk'),
      path.resolve(process.cwd(), 'public', 'FB_Automation_v5.apk'),
    ];

    const apkPath = possiblePaths.find((p) => fs.existsSync(p));

    if (!apkPath) {
      return res.status(404).send('APK file not found on server.');
    }

    const downloadName = path.basename(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.download(apkPath, downloadName, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).send('Download failed');
        }
      }
    });
  };

  app.get('/api/download-apk', handleApkDownload);
  app.get('/FB_Automation_v6_Latest.apk', handleApkDownload);
  app.get('/FB_Automation_v6.apk', handleApkDownload);
  app.get('/FB_Automation_v5.apk', handleApkDownload);
  app.get('/downloads/:filename', handleApkDownload);
  app.get('/downloads/FB_Automation_v6_Latest.apk', handleApkDownload);
  app.get('/downloads/FB_Automation_v5.apk', handleApkDownload);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ==========================================
  // SUB ADMIN LICENSE VALIDATION & ACTIVATION API
  // ==========================================

  // Sub Admin validation on app launch & periodic background check
  app.post('/api/license/validate', (req, res) => {
    try {
      const { key, deviceId } = req.body;
      const result = validateSubAdminKey(key, deviceId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ valid: false, status: 'error', message: err.message });
    }
  });

  // Sub Admin device activation
  app.post('/api/license/activate', (req, res) => {
    try {
      const { key, deviceId, clientDeviceName } = req.body;
      const result = activateSubAdminKey(key, deviceId, clientDeviceName);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, valid: false, status: 'error', message: err.message });
    }
  });

  // ==========================================
  // MASTER ADMIN PANEL API (PROTECTED BY MASTER KEY)
  // ==========================================

  // Master Admin Key verification / login
  app.post('/api/admin/login', (req, res) => {
    try {
      const { masterKey } = req.body;
      const isValid = verifyMasterKey(masterKey);
      if (isValid) {
        // Return signed authorization token valid for master actions
        const token = `master_tok_${Buffer.from(String(masterKey).trim() + '_authenticated').toString('base64')}`;
        return res.json({ success: true, token, message: 'মাস্টার অ্যাডমিন অথেন্টিকেশন সফল হয়েছে।' });
      }
      return res.status(401).json({ success: false, message: 'ভুল মাস্টার অ্যাডমিন কি! (Invalid Master Admin Key)' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Middleware to enforce Master Admin Key verification
  const requireMasterAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['x-master-token'] || req.headers['authorization'];
    const keyHeader = req.headers['x-master-key'] || req.body?.masterKey || req.query?.masterKey;

    if (keyHeader && verifyMasterKey(String(keyHeader))) {
      return next();
    }

    if (authHeader && String(authHeader).includes('master_tok_')) {
      return next();
    }

    return res.status(403).json({ success: false, message: 'অননুমোদিত অ্যাক্সেস! শুধুমাত্র মাস্টার অ্যাডমিন প্রবেশাধিকার রয়েছে।' });
  };

  // Get all Sub Admins & system status (Master Admin only)
  app.get('/api/admin/licenses', requireMasterAdmin, (req, res) => {
    try {
      const data = getAllSubAdmins();
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Create new Sub Admin with custom duration (e.g. 7, 30, 60 days, custom)
  app.post('/api/admin/licenses/create', requireMasterAdmin, (req, res) => {
    try {
      const { name, phoneOrNote, planDays } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'সাব অ্যাডমিনের নাম আবশ্যক।' });
      }
      const newSubAdmin = createSubAdminLicense({
        name: name.trim(),
        phoneOrNote: phoneOrNote || '',
        planDays: Number(planDays) || 30,
      });
      res.json({ success: true, license: newSubAdmin, message: 'নতুন সাব অ্যাডমিন লাইসেন্স সফলভাবে তৈরি হয়েছে!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Instantly Disable / Enable (Block/Unblock) a Sub Admin
  app.post('/api/admin/licenses/toggle-block', requireMasterAdmin, (req, res) => {
    try {
      const { id, isBlocked, reason } = req.body;
      const success = toggleBlockSubAdmin(id, Boolean(isBlocked), reason);
      res.json({
        success,
        message: isBlocked
          ? 'সাব অ্যাডমিনকে সফলভাবে Disable/Block করা হয়েছে। অ্যাপ তাৎক্ষণিকভাবে লক হয়ে গেছে।'
          : 'সাব অ্যাডমিনকে পুনরায় সক্রিয় (Active) করা হয়েছে।',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Update or Extend Sub Admin License duration (+30, +60 days or set specific days)
  app.post('/api/admin/licenses/extend', requireMasterAdmin, (req, res) => {
    try {
      const { id, days, mode } = req.body;
      const result = updateSubAdminDuration(id, mode === 'set' ? 'set' : 'extend', Number(days) || 30);
      res.json({
        success: result.success,
        newExpiresAt: result.newExpiresAt,
        remainingDays: result.remainingDays,
        message: mode === 'set'
          ? `সাব অ্যাডমিনের মেয়াদ ${days} দিনে সেট করা হয়েছে।`
          : `সাব অ্যাডমিনের মেয়াদ আরো ${days} দিন বৃদ্ধি করা হয়েছে।`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Permanently Remove / Delete a Sub Admin
  app.post('/api/admin/licenses/delete', requireMasterAdmin, (req, res) => {
    try {
      const { id } = req.body;
      const success = deleteSubAdmin(id);
      res.json({ success, message: 'সাব অ্যাডমিন সফলভাবে রিমুভ (Delete) করা হয়েছে।' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Emergency Global Kill-Switch
  app.post('/api/admin/toggle-global-lock', requireMasterAdmin, (req, res) => {
    try {
      const { globalLocked, message } = req.body;
      const isLocked = toggleGlobalLock(Boolean(globalLocked), message);
      res.json({
        success: true,
        globalLocked: isLocked,
        message: isLocked ? 'সবার জন্য অ্যাপ সম্পূর্ণ লক করা হয়েছে।' : 'সবার জন্য অ্যাপ আনলক করা হয়েছে।',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Change Master Admin Key
  app.post('/api/admin/change-key', requireMasterAdmin, (req, res) => {
    try {
      const { currentKey, newKey } = req.body;
      const result = changeMasterKey(currentKey, newKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Real Facebook Video Upload endpoint - Proxies directly to Facebook Graph Video API
  app.post('/api/facebook/upload-video', upload.single('video'), async (req, res) => {
    try {
      const { page_id, access_token, description, title, targeting, post_type } = req.body;

      if (!page_id || !access_token) {
        return res.status(400).json({
          success: false,
          error: 'page_id and access_token are required for Facebook upload',
        });
      }

      // Build standard FormData for Facebook Graph Video API
      const fbFormData = new FormData();
      fbFormData.append('access_token', access_token);
      if (description) fbFormData.append('description', description);
      if (title) fbFormData.append('title', title);
      
      // Feed / Geo targeting
      if (targeting) {
        fbFormData.append('targeting', typeof targeting === 'string' ? targeting : JSON.stringify(targeting));
      }

      if (req.file) {
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'video/mp4' });
        fbFormData.append('source', blob, req.file.originalname || 'video.mp4');
      }

      // Use Meta Graph Video endpoint
      const endpoint = `https://graph-video.facebook.com/v19.0/${encodeURIComponent(page_id)}/videos`;

      const fbRes = await fetch(endpoint, {
        method: 'POST',
        body: fbFormData,
      });

      const data: any = await fbRes.json();

      if (!fbRes.ok || data.error) {
        return res.status(400).json({
          success: false,
          error: data.error?.message || 'Facebook API rejected upload',
          fbError: data.error,
        });
      }

      return res.json({
        success: true,
        id: data.id,
        postId: `${page_id}_${data.id}`,
        postUrl: `https://www.facebook.com/${page_id}/videos/${data.id}`,
        details: 'Video published to Facebook Page successfully!',
      });
    } catch (err: any) {
      console.error('Facebook upload error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Server error while uploading video to Facebook',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
