const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const DEFAULT_BASE_URL = 'http://20.207.122.201/evaluation-service';
const DEFAULT_LIMIT = 10;
const CATEGORY_RANK = {
  placement: 3,
  result: 2,
  event: 1,
};

// --- Logging middleware integration ---
// Dynamic import to handle both ESM logger and CJS context
let LogFn = null;

async function initLogger() {
  try {
    const loggerPath = path.resolve(__dirname, '..', 'logging_middleware', 'logger.js');
    const mod = await import(`file://${loggerPath.replace(/\\/g, '/')}`);
    LogFn = mod.Log;
  } catch {
    // Fallback: logging unavailable
    LogFn = null;
  }
}

function log(level, pkg, message) {
  const token = getAuthToken();
  if (LogFn && token) {
    LogFn('backend', level, pkg, message, token).catch(() => {});
  }
}

// --- Auth ---
function getAuthToken() {
  return process.env.NOTIFICATION_AUTH_TOKEN || '';
}

// --- Notification field accessors (matched to documented API shape) ---
function getType(notification) {
  const value = String(notification.Type ?? notification.type ?? '').trim().toLowerCase();
  if (value.includes('placement')) return 'Placement';
  if (value.includes('result')) return 'Result';
  if (value.includes('event')) return 'Event';
  return 'Event';
}

function getCategoryRank(notification) {
  return CATEGORY_RANK[getType(notification).toLowerCase()] || 0;
}

function getRecencyValue(notification) {
  const raw = notification.Timestamp || notification.timestamp;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

// --- Priority comparator (placement > result > event, then recency) ---
function compareNotifications(left, right) {
  const rankDelta = getCategoryRank(right) - getCategoryRank(left);
  if (rankDelta !== 0) return rankDelta;

  const recencyDelta = getRecencyValue(right) - getRecencyValue(left);
  if (recencyDelta !== 0) return recencyDelta;

  return String(left.ID ?? '').localeCompare(String(right.ID ?? ''));
}

function extractNotificationArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.notifications)) return payload.notifications;
  return [];
}

async function fetchNotifications() {
  const baseUrl = process.env.NOTIFICATION_API_BASE_URL || DEFAULT_BASE_URL;
  const token = getAuthToken();

  if (!token) {
    log('fatal', 'config', 'Missing NOTIFICATION_AUTH_TOKEN in .env');
    throw new Error('Missing NOTIFICATION_AUTH_TOKEN in .env');
  }

  log('info', 'service', `Fetching notifications from ${baseUrl}/notifications`);

  const response = await axios.get(`${baseUrl}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });

  const notifications = extractNotificationArray(response.data);
  log('info', 'service', `Fetched ${notifications.length} notifications`);
  return notifications;
}

async function getTopNotifications(limit = DEFAULT_LIMIT) {
  const notifications = await fetchNotifications();

  const sorted = notifications
    .slice()
    .sort(compareNotifications)
    .slice(0, limit);

  log('info', 'service', `Top ${limit} priority notifications selected (${sorted.length} returned)`);
  return sorted;
}

async function main() {
  await initLogger();
  log('info', 'service', 'Priority inbox script started');

  const topNotifications = await getTopNotifications(DEFAULT_LIMIT);
  process.stdout.write(`${JSON.stringify(topNotifications, null, 2)}\n`);

  log('info', 'service', 'Priority inbox script completed');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  compareNotifications,
  extractNotificationArray,
  getTopNotifications,
};