/**
 * Media Downloads, Cache Storage & Auto-Purge Management
 */
const fs = require('fs');
const path = require('path');
const { MEDIA_DIR } = require('./config');

let storageWarning = null;

function getStorageStats() {
  let disk = { totalGb: 25, usedGb: 5, freeGb: 20, usedPercent: 20 };
  try {
    if (fs.statfsSync) {
      const s = fs.statfsSync('/');
      const total = (s.bsize * s.blocks) / (1024 * 1024 * 1024);
      const free = (s.bsize * s.bavail) / (1024 * 1024 * 1024);
      const used = total - free;
      const pct = s.blocks > 0 ? Math.round(((s.blocks - s.bavail) / s.blocks) * 100) : 0;
      disk = {
        totalGb: Number(total.toFixed(2)),
        usedGb: Number(used.toFixed(2)),
        freeGb: Number(free.toFixed(2)),
        usedPercent: pct
      };
    }
  } catch (err) {}

  let totalFiles = 0;
  let totalBytes = 0;
  const files = [];

  try {
    if (fs.existsSync(MEDIA_DIR)) {
      const names = fs.readdirSync(MEDIA_DIR);
      for (const name of names) {
        const filePath = path.join(MEDIA_DIR, name);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            totalBytes += stat.size;
            files.push({ name, path: filePath, size: stat.size, mtime: stat.mtimeMs });
          }
        } catch {}
      }
    }
  } catch {}

  // Sort oldest first
  files.sort((a, b) => a.mtime - b.mtime);
  totalFiles = files.length;

  return {
    disk,
    media: {
      totalFiles,
      totalBytes,
      totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2))
    },
    autoPurgeThresholdPercent: 80,
    autoPurgeEvictPercent: 50,
    warning: storageWarning,
    files
  };
}

function purgeMediaFiles(percentage) {
  const stats = getStorageStats();
  const files = stats.files;
  if (!files || files.length === 0) {
    return { status: 'ok', deletedCount: 0, freedBytes: 0, freedMb: 0, remainingFiles: 0 };
  }

  let toDelete = [];
  if (percentage >= 100) {
    toDelete = files;
  } else {
    const fraction = Math.max(1, Math.min(100, percentage)) / 100;
    const count = Math.ceil(files.length * fraction);
    toDelete = files.slice(0, count);
  }

  let freedBytes = 0;
  let deletedCount = 0;

  for (const f of toDelete) {
    try {
      if (fs.existsSync(f.path)) {
        fs.unlinkSync(f.path);
        freedBytes += f.size;
        deletedCount++;
      }
    } catch (err) {
      console.warn(`Failed to unlink media file ${f.path}:`, err.message);
    }
  }

  const freedMb = Number((freedBytes / (1024 * 1024)).toFixed(2));
  console.log(`🧹 Purged ${deletedCount} media files (${percentage}%), freed ${freedMb} MB. Remaining files: ${files.length - deletedCount}`);

  return {
    status: 'ok',
    deletedCount,
    freedBytes,
    freedMb,
    remainingFiles: files.length - deletedCount
  };
}

function checkStorageAndAutoPurge() {
  const stats = getStorageStats();
  if (stats.disk.usedPercent >= 80) {
    console.warn(`⚠️ STORAGE WARNING: Disk usage at ${stats.disk.usedPercent}% (exceeds 80% threshold). Automatically purging oldest 50% media...`);
    const result = purgeMediaFiles(50);
    storageWarning = {
      triggeredAt: Date.now(),
      message: `Server storage reached ${stats.disk.usedPercent}%. The oldest 50% of cached media files (${result.deletedCount} files, ${result.freedMb} MB) were automatically purged to prevent system disruption.`
    };
  }
}

// Background storage monitor every 5 minutes
setInterval(checkStorageAndAutoPurge, 5 * 60 * 1000).unref();

function downloadMediaInBackground(msgId, rawPayload) {
  setImmediate(async () => {
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const buffer = await downloadMediaMessage(
        rawPayload,
        'buffer',
        {},
        { logger: { debug(){}, info(){}, error(){}, warn(){} } }
      );
      if (buffer && buffer.length > 0) {
        let ext = '.jpg';
        const m = rawPayload.message || {};
        if (m.videoMessage) ext = '.mp4';
        else if (m.audioMessage) ext = '.ogg';
        else if (m.documentMessage) ext = '.pdf';

        const savePath = path.join(MEDIA_DIR, `${msgId}${ext}`);
        fs.writeFileSync(savePath, buffer);
        console.log(`🖼️ Auto-cached media attachment for [${msgId}] (${buffer.length} bytes)`);
      }
    } catch (err) {}
  });
}

function getStorageWarning() {
  return storageWarning;
}

function dismissStorageWarning() {
  storageWarning = null;
}

module.exports = {
  getStorageStats,
  purgeMediaFiles,
  checkStorageAndAutoPurge,
  downloadMediaInBackground,
  getStorageWarning,
  dismissStorageWarning
};
