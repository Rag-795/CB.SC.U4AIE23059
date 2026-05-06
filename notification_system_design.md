Stage 1

I implemented the priority inbox as a small Node.js script that fetches notifications from the evaluation service, filters unread items, ranks them by category priority and recency.

Ranking rule:
- placement notifications first
- result notifications next
- event notifications last
- within the same category, newer notifications win
---

Stage 2

I built a React + Material-UI frontend that consumes the given evaluation-service API. The interface presents two views:

1. **All Notifications tab**: Displays all fetched notifications with real-time counts (total, new, viewed)
2. **Priority Inbox tab**: Shows ranked notifications with controls to filter by type (All/Placement/Result/Event) and limit top-N results (5, 10, 15, 20)

Architecture:
- **React + MUI**: Ensures compatibility and provides polished UI components (Tabs, Cards, Chips, Buttons)
- **Vite dev proxy**: Routes `/api/*` requests to `http://20.207.122.201/evaluation-service` to avoid CORS in development
- **Bearer token auth**: Token stored in `.env` and passed in Authorization headers to the evaluation-service API
- **Local state tracking**: Viewed/read notifications stored in browser localStorage with a Set for O(1) lookup
- **Field mapping**: Handles capitalized API response fields (Type, Message, Timestamp, ID)
- **Error handling**: Shows user-friendly error messages with retry capability