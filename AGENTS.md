# WP TODO - Project Overview for AI Agents

## Project Purpose

WP TODO is a React Native mobile application that transforms WordPress into a backend for a personal todo management system. The core philosophy centers on **data ownership, portability, and longevity**.

### Why This Project Exists

The creator built this app to address fundamental frustrations with modern productivity tools:

1. **Provider Dependency**: Todo apps frequently shut down, get acquired, or remove API access
2. **Data Lock-in**: User data becomes trapped in proprietary systems
3. **Lack of Control**: Limited ability to extend or automate functionality

### The WordPress Philosophy

**"Cloud is just somebody else's computer. You can run your own cloud with WordPress."**

By using WordPress as a backend, this project ensures:

- **Longevity**: WordPress powers a significant portion of the web and isn't going away
- **Portability**: WordPress runs anywhere - shared hosting, VPS, WordPress.com
- **Extensibility**: Users can add custom automation, AI features, or integrations on the WordPress side
- **Data Ownership**: Complete control over your data
- **Mobile-First Development**: Demonstrates WordPress as a viable backend for modern mobile apps

## Technical Architecture

### Stack Overview

- **Frontend**: React Native with Expo
- **UI Framework**: Native Base
- **Animation**: Reanimated 2 & Moti
- **State Management**: React Context API
- **Data Persistence**: AsyncStorage (local) + WordPress REST API (remote)
- **Backend**: Any WordPress installation with REST API and Application Passwords

### Core Components

#### 1. Data Manager (`src/utils/data-manager.tsx`)

The heart of the application - manages all data synchronization between local state and WordPress.

**Key Responsibilities:**
- Maintains local todo state with dirty flags for change tracking
- Orchestrates bi-directional sync between app and WordPress
- Handles connection state and configuration
- Manages taxonomy terms for todo organization
- Integrates with iOS Reminders (Platform-specific)

**Data Flow:**
```
Local Todos (AsyncStorage) 
    ↕️ (dirty flag tracking)
Data Manager Sync
    ↕️ (REST API calls)
WordPress Post Type (remote storage)
```

#### 2. WordPress API Integration (`src/utils/wpapi.ts`)

Handles all WordPress REST API communication.

**Authentication Methods:**
- **Application Passwords**: For self-hosted WordPress (Basic Auth with base64 encoding)
- **OAuth Bearer Tokens**: For WordPress.com sites

**Key Functions:**
- `authenticadedFetch()`: Unified authenticated request handler
- `getURLForCPT()`: Resolves REST endpoints for custom post types
- `getPagePromise()`: Recursive pagination handler (fetches 100 items per page)
- `normalizeUrl()`: Handles URL protocol normalization

#### 3. Setup Screen (`src/screens/setup-screen.tsx`)

Multi-stage connection wizard:

1. **Site Detection**: Probes URL for WordPress REST API or WordPress.com site
2. **Authentication**: 
   - Self-hosted: Application Password flow
   - WordPress.com: OAuth 2.0 flow via expo-auth-session
3. **Plugin Detection**: Checks for "Personal OS" plugin (recommended but optional)
4. **Post Type Selection**: User selects which Custom Post Type holds todos
5. **Taxonomy Selection**: Optional - for organizing todos into lists/notebooks

### Data Synchronization Strategy

#### Sync Process

The sync is a two-phase operation:

**Phase 1: Push Local Changes**
```typescript
// Filter todos with dirty flag
const dataToSync = cachedData
    .filter(todo => todo.dirty)
    .filter(todo => todo.subject.length > 0);

// Push each to WordPress
updatePromises = dataToSync.map(pushTodoToWP);
```

**Phase 2: Pull Remote State**
```typescript
Promise.all([
    getPagePromise(url, 1, 'publish', [], login, pass, wpcomToken),
    getPagePromise(url, 1, 'private', [], login, pass, wpcomToken),
    getPagePromise(url, 1, 'trash', [], login, pass, wpcomToken),
])
```

#### Post Status Mapping

WordPress post statuses map to todo states:

- **publish/private**: Active todos (not done)
- **trash**: Completed/deleted todos
- Completed todos are moved to trash (soft delete)
- True deletion uses WordPress DELETE endpoint

#### Dirty Flag Pattern

Local changes are tracked with a `dirty: boolean` flag:
- Set to `true` when user modifies a todo
- Triggers sync on next sync operation
- Cleared after successful WordPress update

### WordPress Integration

#### Flexible Post Type System

The app works with **any WordPress post type**, not just posts:

- Custom Post Types (CPTs) via plugins
- Built-in types (posts, pages - though not recommended for privacy)
- Recommended: "Personal OS" plugin with dedicated `todo` post type

#### Taxonomy Support

Optional but powerful - organize todos into lists/projects:

- Maps to WordPress taxonomies (categories, tags, custom taxonomies)
- Recommended: "Personal OS" plugin's `notebook` taxonomy
- Automatic "inbox" term assignment for new todos without a list

#### Data Storage Format

Each todo is stored as a WordPress post:

```typescript
{
    title: { raw: "Todo subject text" },
    excerpt: { raw: "Todo notes/description" },
    status: "publish" | "private" | "trash",
    id: 123,
    meta: {
        // Custom metadata
        reminders_id: "...",  // For iOS sync
        // Any other custom fields
    },
    [taxonomy_slug]: [term_ids]  // List assignments
}
```

### Platform-Specific Features

#### iOS Reminders Integration (`src/utils/ios-reminders.tsx`)

On iOS devices, the app can bi-directionally sync with Apple Reminders:

**Capabilities:**
- Map taxonomy terms (lists) to Reminders lists
- Import incomplete reminders as todos
- Sync todo changes back to Reminders
- Track sync state with `reminders_id` in post meta

**Permission Flow:**
Uses expo-calendar for Reminders access (Reminders API shares implementation with Calendar API).

### Authentication Details

#### Self-Hosted WordPress

Uses Application Passwords (WordPress 5.6+):

1. User enters WordPress URL
2. App detects REST API at `/?rest_route=/`
3. User creates Application Password at `/wp-admin/authorize-application.php`
4. Credentials stored locally (AsyncStorage)
5. All requests use Basic Authentication: `Authorization: Basic base64(username:password)`

#### WordPress.com Sites

Uses OAuth 2.0:

1. App detects site via WordPress.com public API
2. OAuth flow initiated via `expo-auth-session`
3. User authorizes via WordPress.com
4. Access token stored locally
5. All requests use Bearer token: `Authorization: Bearer {token}`

**OAuth Configuration:**
- Client ID: `106439`
- Redirect URI: `https://artpi.github.io/wp-todo/wpcom-redirect.html`
- Scopes: Implicit (global scope for authenticated user)

### Configuration Storage

All app configuration persists in AsyncStorage:

```typescript
{
    wpurl: string,           // WordPress site URL
    wplogin: string,         // Username (self-hosted)
    wppass: string,          // Application password (self-hosted)
    wpcomtoken: string,      // OAuth token (WordPress.com)
    config: {                // Connection metadata
        connected: boolean,
        site_title: string,
        site_home: string,
        post_type: string,   // Selected CPT slug
        taxonomy: string,    // Selected taxonomy slug
        taxonomy_terms: [],  // Available terms/lists
        username: string,
        gravatar: string,
        // ... more metadata
    },
    todos: [],              // Cached todo data
    ios_reminders_lists: {} // iOS sync mappings
}
```

### Error Handling & Resilience

- **Offline Support**: Todos cached locally, sync resumes when online
- **Conflict Resolution**: Last-write-wins (server state pulled after push)
- **Pagination**: Automatically handles large todo lists (100 items per page)
- **Graceful Degradation**: Works without taxonomy, without plugins, without iOS sync

## Development Workflow

### Running the App

```bash
yarn install
yarn start
```

This launches Expo development server. The app can run:
- In Expo Go client app (iOS/Android)
- In iOS Simulator
- In Android Emulator
- As a web app (limited functionality)

### Code Style

- Uses WordPress prettier configuration: `@wordpress/prettier-config`
- Format code: `yarn format`

### Key Files for Agents to Understand

1. **`src/utils/data-manager.tsx`** - Core sync logic, state management
2. **`src/utils/wpapi.ts`** - WordPress REST API integration
3. **`src/screens/setup-screen.tsx`** - Connection and configuration flow
4. **`src/screens/main-screen.tsx`** - Primary UI for todo management
5. **`App.tsx`** - Entry point and provider setup

## Common Modification Scenarios

### Adding New Todo Properties

1. Update `Todo` interface in `data-manager.tsx`
2. Update `StoredTodo` interface for WordPress format
3. Modify `getPayload()` to include in sync
4. Update UI components to display/edit property

### Supporting New Authentication Methods

1. Add new token storage in `loadStoredData()`
2. Extend `authenticadedFetch()` to handle new auth header format
3. Add UI flow in `setup-screen.tsx`

### Custom WordPress Plugin Integration

1. Detect plugin presence in `connectWP()` (check for custom post types/taxonomies)
2. Auto-configure `post_type` and `taxonomy` if detected
3. Optionally use plugin-specific REST endpoints or meta fields

### Adding Metadata to Todos

Use the `meta` field - WordPress Custom Fields are automatically supported:

```typescript
const newTodo = {
    subject: "Example",
    meta: {
        custom_field: "value"
    }
}
```

## Important Constraints

1. **No Force Push**: Git history cannot be rewritten
2. **Minimal Changes**: Maintain backward compatibility
3. **WordPress Compatibility**: Must work with WordPress 5.6+ (Application Password requirement)
4. **Privacy**: Never expose credentials in logs or code
5. **Expo Compatibility**: All dependencies must be Expo-compatible

## Architecture Decisions & Rationale

### Why Context API Instead of Redux?

Simpler state management for a single-user app with straightforward data flow.

### Why AsyncStorage Instead of SQLite?

Sufficient for todo-sized data, simpler setup, better Expo compatibility.

### Why Both Publish and Private Status?

Flexibility - some users may want active todos to be public (published) or private.

### Why Dirty Flags Instead of State Diffing?

Simpler, more predictable, works well with user-initiated changes.

## Testing Considerations

- No automated test suite currently exists
- Manual testing required for WordPress integration
- Test with both WordPress.com and self-hosted WordPress
- Test with and without taxonomies
- Test with various Custom Post Types
- On iOS: Test Reminders integration

## Future Enhancement Areas

- Real-time sync via WordPress REST API Webhooks
- Conflict resolution for simultaneous edits
- Offline conflict queue
- Android reminder integration
- Desktop/web version
- Collaborative todos (multi-user support)
- Rich text editing for notes
- Attachment support via WordPress Media Library

---

**For AI Agents**: This project prioritizes data ownership and WordPress integration above all else. When making changes, ensure WordPress compatibility is maintained and the core philosophy of user data control is preserved. The app should work with minimal WordPress setup (just REST API + Application Passwords) while gracefully supporting advanced features when available.
