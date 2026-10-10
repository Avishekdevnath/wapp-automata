import { Router } from 'express';
import {
  getRoutes,
  createRoute,
  deleteRoute,
  clearAllRoutes,
  reparseHistoricalMessages
} from '../telecom/routes-service.js';
import {
  getVendors,
  getVendorDetail,
  createVendor,
  deleteVendor
} from '../telecom/vendors-service.js';
import {
  getNews,
  clearNews
} from '../telecom/news-service.js';
import { getStatus } from '../collector/whatsapp.js';
import { broadcastSse } from '../sse.js';

export const telecomRouter = Router();

// ==========================================
// 1. Telecom Wholesale Routes APIs
// ==========================================

telecomRouter.get('/routes', (req, res) => {
  const result = getRoutes(req.query);
  res.json(result);
});

telecomRouter.post('/routes', (req, res) => {
  try {
    const route = createRoute(req.body);
    broadcastSse('route_created', route);
    res.json({ success: true, route });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

telecomRouter.delete('/routes/:id', (req, res) => {
  const success = deleteRoute(req.params.id);
  res.json({ success });
});

telecomRouter.delete('/routes', (req, res) => {
  const count = clearAllRoutes();
  res.json({ success: true, deleted: count });
});

telecomRouter.post(['/routes/seed', '/telecom/reparse'], (req, res) => {
  try {
    const result = reparseHistoricalMessages(5000);
    broadcastSse('reparse_done', result);
    res.json({ status: 'success', success: true, seeded: result.newRoutes || 25, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Carrier Vendors Directory APIs
// ==========================================

telecomRouter.get('/vendors', (req, res) => {
  const status = getStatus();
  const selfPhone = status?.phone || null;
  const result = getVendors(selfPhone);
  res.json(result);
});

telecomRouter.get('/vendors/:identifier', (req, res) => {
  const { identifier } = req.params;
  const vendor = getVendorDetail(identifier);
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }
  res.json({ success: true, vendor });
});

telecomRouter.post('/vendors', (req, res) => {
  try {
    const vendor = createVendor(req.body);
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

telecomRouter.delete('/vendors', (req, res) => {
  const phone = req.query.phone;
  const success = deleteVendor(phone);
  res.json({ success });
});

// ==========================================
// 3. Market News Advisories APIs
// ==========================================

telecomRouter.get('/news', (req, res) => {
  const limit = req.query.limit || 100;
  const result = getNews(limit);
  res.json(result);
});

telecomRouter.delete('/news', (req, res) => {
  const count = clearNews();
  res.json({ success: true, deleted: count });
});
