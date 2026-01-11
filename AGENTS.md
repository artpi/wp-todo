# WP TODO - AI Agent Guide

## Purpose

A React Native mobile app that uses **any WordPress instance** (self-hosted or WordPress.com) as a backend for todo management. Core philosophy: **data ownership, portability, and longevity**.

### Why WordPress?

**"Cloud is just somebody else's computer. You can run your own cloud with WordPress."** WordPress is portable, extensible, and permanent—ensuring your todo data remains under your control forever. Users can run it anywhere and add custom automation, AI features, or integrations on the WordPress side.

## Technical Stack

- **Frontend**: React Native + Expo, Native Base UI, Reanimated 2
- **State**: React Context API
- **Storage**: AsyncStorage (local cache) + WordPress REST API (remote)
- **Backend**: Any WordPress 5.6+ with REST API and Application Passwords

## Core Components

### 1. Data Manager (`src/utils/data-manager.tsx`)

Manages bidirectional sync between local state and WordPress:
- Dirty flag change tracking
- Sync orchestration (push local → pull remote)
- Configuration and taxonomy management
- iOS Reminders integration

### 2. WordPress API (`src/utils/wpapi.ts`)

REST API communication layer:
- `authenticadedFetch()`: Unified auth (Basic or Bearer token)
- `getURLForCPT()`: Resolves Custom Post Type endpoints
- `getPagePromise()`: Recursive pagination (100 items/page)

### 3. Setup Wizard (`src/screens/setup-screen.tsx`)

Multi-step connection flow:
1. Site detection (REST API or WordPress.com)
2. Authentication (Application Passwords or OAuth 2.0)
3. PersonalOS plugin detection
4. Post type selection (any CPT works)
5. Taxonomy selection (optional, for lists/notebooks)

## Data Sync Strategy

**Two-phase sync:**
1. **Push**: Dirty-flagged todos → WordPress (POST/DELETE)
2. **Pull**: Fetch all statuses (publish, private, trash) → merge to local state

**Post status mapping:**
- `publish`/`private` → Active todos
- `trash` → Completed todos (soft delete)

**Dirty flag pattern:** Local changes set `dirty: true`, sync clears flag after successful push.

## WordPress Integration

### Flexible Post Type System

Works with **any WordPress post type**. Recommended setup:

**[PersonalOS Plugin](https://github.com/artpi/PersonalOS)** (optimal):
- Provides dedicated `todo` Custom Post Type
- Includes `notebook` taxonomy for organizing todos into lists/projects
- Auto-detected and configured during setup
- Supports nested notebook structure (INBOX, NOW, LATER, Projects, Areas)
- Plugin is a full productivity system (notes, Readwise sync, transcriptions)

**Fallback**: Any CPT or built-in type (posts, pages—not recommended for privacy)

### Taxonomy Support

Optional but powerful—maps WordPress taxonomies to todo lists:
- Recommended: PersonalOS `notebook` taxonomy
- Supports categories, tags, or any custom taxonomy
- Auto-assigns "inbox" term to new todos without a list

### Data Format

Todos stored as WordPress posts:

```typescript
{
    title: { raw: "Todo subject" },
    excerpt: { raw: "Notes" },
    status: "publish" | "private" | "trash",
    id: 123,
    meta: { reminders_id: "..." },  // iOS sync
    [taxonomy_slug]: [term_ids]     // List assignments
}
```

## Authentication

**Self-hosted WordPress** (Application Passwords, WP 5.6+):
- Basic Auth: `Authorization: Basic base64(username:apppassword)`
- Created at `/wp-admin/authorize-application.php`

**WordPress.com** (OAuth 2.0):
- Bearer token: `Authorization: Bearer {token}`
- Client ID: `106439`
- Redirect: `https://artpi.github.io/wp-todo/wpcom-redirect.html`

## Platform Features

**iOS Reminders Sync** (`src/utils/ios-reminders.tsx`):
- Bidirectional sync with Apple Reminders
- Maps taxonomy terms (notebooks) to Reminders lists
- Tracks sync state via `reminders_id` post meta

**Offline Support**:
- Todos cached in AsyncStorage
- Sync resumes when online
- Last-write-wins conflict resolution

## Development

**Run:**
```bash
yarn install
yarn start  # Launches Expo dev server
```

**Code style:** WordPress prettier config (`yarn format`)

**Key files:**
- `src/utils/data-manager.tsx` - Sync logic, state
- `src/utils/wpapi.ts` - REST API integration
- `src/screens/setup-screen.tsx` - Connection wizard
- `src/screens/main-screen.tsx` - Todo UI

## Extending

**Add todo properties:**
1. Update `Todo` and `StoredTodo` interfaces in `data-manager.tsx`
2. Modify `getPayload()` to include in sync
3. Update UI components

**Custom metadata:** Use WordPress `meta` field—automatically synced:
```typescript
{ subject: "Task", meta: { custom_field: "value" } }
```

**Plugin integration:**
- Detect custom post types/taxonomies in `connectWP()`
- Auto-configure if PersonalOS or similar plugin detected

## Architecture Notes

- **Context API vs Redux**: Simpler for single-user app
- **AsyncStorage vs SQLite**: Sufficient for todo data, better Expo compatibility
- **Dirty flags vs diffing**: Simpler, predictable for user-initiated changes
- **Both publish/private**: Flexibility for public vs private todos

## Constraints

- Requires WordPress 5.6+ (Application Passwords)
- Expo-compatible dependencies only
- Must work with minimal setup (just REST API) while supporting advanced features gracefully

---

**For AI Agents**: This project prioritizes **data ownership and WordPress integration** above all. The app must work with any WordPress instance (self-hosted or WordPress.com) and any post type/taxonomy configuration. The philosophy is unchanging; the technical setup is flexible.
