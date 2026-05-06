import { useEffect, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import { Log } from '../../logging_middleware/logger.js';

const API_BASE = import.meta.env.VITE_NOTIFICATION_API_BASE_URL || '/api';
const API_TOKEN = import.meta.env.VITE_NOTIFICATION_AUTH_TOKEN || '';
const PRIORITY_LIMIT_OPTIONS = [5, 10, 15, 20];
const NOTIFICATION_TYPES = ['All', 'Placement', 'Result', 'Event'];
const STORAGE_KEY = 'notification_viewed_ids_v1';
const TYPE_RANK = {
  placement: 3,
  result: 2,
  event: 1,
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1d4ed8' },
    secondary: { main: '#0f766e' },
    background: { default: '#f4f7fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#475569' },
  },
  shape: { borderRadius: 18 },
  typography: {
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

function log(level, pkg, message) {
  Log('frontend', level, pkg, message, API_TOKEN).catch(() => {});
}

function readViewedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveViewedIds(viewedIds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...viewedIds]));
}

function getType(notification) {
  const value = String(notification.Type ?? notification.type ?? '').trim().toLowerCase();
  if (value.includes('placement')) return 'Placement';
  if (value.includes('result')) return 'Result';
  if (value.includes('event')) return 'Event';
  return 'Event';
}

function getMessage(notification) {
  return notification.Message || notification.message || 'No message provided.';
}

function getTimestamp(notification) {
  const raw = notification.Timestamp || notification.timestamp;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getNotificationId(notification, index) {
  return String(notification.ID || notification.id || `notif-${index}`);
}

function getTypeRank(notification) {
  return TYPE_RANK[getType(notification).toLowerCase()] || 0;
}

// --- Priority comparison (placement > result > event, then recency) ---
function comparePriority(left, right) {
  const typeDelta = getTypeRank(right) - getTypeRank(left);
  if (typeDelta !== 0) return typeDelta;

  const timeDelta = getTimestamp(right) - getTimestamp(left);
  if (timeDelta !== 0) return timeDelta;

  return String(left.ID ?? '').localeCompare(String(right.ID ?? ''));
}

function normalizeNotifications(items) {
  return items.map((notification, index) => ({
    ...notification,
    _id: getNotificationId(notification, index),
    _type: getType(notification),
    _message: getMessage(notification),
    _time: getTimestamp(notification),
  }));
}

async function fetchNotifications({ limit, type } = {}) {
  const url = new URL(`${API_BASE}/notifications`, window.location.origin);
  if (limit) url.searchParams.set('limit', limit);
  if (type && type !== 'All') url.searchParams.set('notification_type', type);

  log('info', 'api', `Fetching notifications: ${url.pathname}${url.search}`);

  const response = await fetch(url.toString(), {
    headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = payload?.message || `HTTP ${response.status} ${response.statusText}`;
    log('error', 'api', `Fetch failed: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.notifications)
      ? payload.notifications
      : [];

  log('info', 'api', `Fetched ${items.length} notifications successfully`);
  return normalizeNotifications(items);
}

function NotificationCard({ notification, viewed, onToggleViewed }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: viewed ? 'divider' : 'primary.main',
        background:
          viewed
            ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))'
            : 'linear-gradient(180deg, rgba(239,246,255,1), rgba(255,255,255,1))',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
        },
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="subtitle2" color="secondary.main" sx={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {notification._type}
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {notification._message}
              </Typography>
            </Box>
            <Chip size="small" label={viewed ? 'Viewed' : 'New'} color={viewed ? 'default' : 'primary'} />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={notification._time ? new Date(notification._time).toLocaleString() : 'No timestamp'} variant="outlined" />
            <Chip size="small" label={`ID: ${notification._id}`} variant="outlined" />
          </Stack>

          <Stack direction="row" justifyContent="flex-end">
            <Button variant={viewed ? 'outlined' : 'contained'} onClick={() => onToggleViewed(notification._id)}>
              {viewed ? 'Mark unread' : 'Mark viewed'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, message }) {
  return (
    <Card elevation={0} sx={{ border: '1px dashed', borderColor: 'divider', backgroundColor: 'rgba(255,255,255,0.7)' }}>
      <CardContent>
        <Stack spacing={1} alignItems="center" textAlign="center" py={4}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

// --- Main App ---
export default function App() {
  const [tab, setTab] = useState(0);
  const [allState, setAllState] = useState({ status: 'loading', data: [], error: '' });
  const [priorityState, setPriorityState] = useState({ status: 'loading', data: [], error: '' });
  const [priorityType, setPriorityType] = useState('All');
  const [priorityLimit, setPriorityLimit] = useState(10);
  const [viewedIds, setViewedIds] = useState(() => readViewedIds());

  useEffect(() => {
    saveViewedIds(viewedIds);
  }, [viewedIds]);

  // Load all notifications on mount
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setAllState((current) => ({ ...current, status: 'loading', error: '' }));
      log('info', 'page', 'Loading all notifications');
      try {
        const data = await fetchNotifications();
        if (!cancelled) {
          setAllState({ status: 'success', data, error: '' });
          log('info', 'page', `All notifications loaded: ${data.length} items`);
        }
      } catch (error) {
        if (!cancelled) {
          setAllState({ status: 'error', data: [], error: error.message });
          log('error', 'page', `Failed to load all notifications: ${error.message}`);
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load priority notifications when filter/limit changes
  useEffect(() => {
    let cancelled = false;

    async function loadPriority() {
      setPriorityState((current) => ({ ...current, status: 'loading', error: '' }));
      log('info', 'page', `Loading priority inbox: type=${priorityType}, limit=${priorityLimit}`);
      try {
        const data = await fetchNotifications({
          type: priorityType === 'All' ? undefined : priorityType,
        });
        const sorted = [...data].sort(comparePriority).slice(0, priorityLimit);
        if (!cancelled) {
          setPriorityState({ status: 'success', data: sorted, error: '' });
          log('info', 'page', `Priority inbox loaded: ${sorted.length} items`);
        }
      } catch (error) {
        if (!cancelled) {
          setPriorityState({ status: 'error', data: [], error: error.message });
          log('error', 'page', `Failed to load priority inbox: ${error.message}`);
        }
      }
    }

    loadPriority();
    return () => {
      cancelled = true;
    };
  }, [priorityType, priorityLimit]);

  const allNotifications = allState.data;
  const priorityNotifications = priorityState.data;

  // Viewed state is tracked purely via localStorage
  const isViewed = (notification) => viewedIds.has(notification._id);

  const toggleViewed = (notificationId) => {
    setViewedIds((current) => {
      const next = new Set(current);
      if (next.has(notificationId)) {
        next.delete(notificationId);
        log('info', 'component', `Marked notification ${notificationId} as unread`);
      } else {
        next.add(notificationId);
        log('info', 'component', `Marked notification ${notificationId} as viewed`);
      }
      return next;
    });
  };

  const allCount = allNotifications.length;
  const viewedCount = allNotifications.filter(isViewed).length;
  const stats = {
    allCount,
    newCount: allCount - viewedCount,
    viewedCount,
  };

  const renderList = (items, isLoading, emptyTitle, emptyMessage) => {
    if (isLoading) {
      return (
        <Stack spacing={2}>
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} variant="rounded" height={148} />
          ))}
        </Stack>
      );
    }

    if (!items.length) {
      return <EmptyState title={emptyTitle} message={emptyMessage} />;
    }

    return (
      <Stack spacing={2}>
        {items.map((notification) => {
          const viewed = isViewed(notification);
          return <NotificationCard key={notification._id} notification={notification} viewed={viewed} onToggleViewed={toggleViewed} />;
        })}
      </Stack>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top left, rgba(29, 78, 216, 0.14), transparent 30%), radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
        }}
      >
        <AppBar position="sticky" elevation={0} color="transparent" sx={{ backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
          <Toolbar sx={{ py: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
                  Campus Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Live feed and priority inbox for placements, results, and events.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                <Chip label={`${stats.allCount} total`} color="primary" />
                <Chip label={`${stats.newCount} new`} color="secondary" />
                <Chip label={`${stats.viewedCount} viewed`} variant="outlined" />
              </Stack>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          {!API_TOKEN && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Missing VITE_NOTIFICATION_AUTH_TOKEN in notification_app_fe/.env.
            </Alert>
          )}

          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
            <Tab label="All Notifications" />
            <Tab label="Priority Inbox" />
          </Tabs>

          {tab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Stack spacing={2} sx={{ position: 'sticky', top: 96 }}>
                  <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.25)', background: 'rgba(255,255,255,0.78)' }}>
                    <CardContent>
                      <Typography variant="overline" color="primary">
                        Overview
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 1, mb: 1, fontWeight: 800 }}>
                        {stats.allCount}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        All notifications loaded from the evaluation service.
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.25)', background: 'rgba(255,255,255,0.78)' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Status
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label="New" color="primary" />
                        <Chip label="Viewed" variant="outlined" />
                        <Chip label="Responsive" color="secondary" variant="outlined" />
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Grid>
              <Grid item xs={12} md={8}>
                {allState.error ? (
                  <Alert severity="error" action={<Button color="inherit" onClick={() => window.location.reload()}>Retry</Button>}>
                    {allState.error}
                  </Alert>
                ) : (
                  renderList(allNotifications, allState.status === 'loading', 'No notifications yet', 'Notifications will appear here once the API returns data.')
                )}
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            <Stack spacing={3}>
              <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.25)', background: 'rgba(255,255,255,0.8)' }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Priority Inbox
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The inbox is ranked by category priority and recency. Use the controls to switch type and top-N size.
                    </Typography>
                    <Divider />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <FormControl fullWidth>
                        <InputLabel id="type-filter-label">Notification type</InputLabel>
                        <Select
                          labelId="type-filter-label"
                          value={priorityType}
                          label="Notification type"
                          onChange={(event) => {
                            setPriorityType(event.target.value);
                            log('info', 'component', `Filter changed: type=${event.target.value}`);
                          }}
                        >
                          {NOTIFICATION_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>
                              {type}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel id="limit-label">Top N</InputLabel>
                        <Select
                          labelId="limit-label"
                          value={priorityLimit}
                          label="Top N"
                          onChange={(event) => {
                            setPriorityLimit(Number(event.target.value));
                            log('info', 'component', `Limit changed: top=${event.target.value}`);
                          }}
                        >
                          {PRIORITY_LIMIT_OPTIONS.map((value) => (
                            <MenuItem key={value} value={value}>
                              {value}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {priorityState.error ? (
                <Alert severity="error" action={<Button color="inherit" onClick={() => window.location.reload()}>Retry</Button>}>
                  {priorityState.error}
                </Alert>
              ) : (
                renderList(priorityNotifications, priorityState.status === 'loading', 'No priority notifications', 'Try a different type filter or top-N size.')
              )}
            </Stack>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}