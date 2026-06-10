# Architecture

## High-Level Components

1. Desktop App
   - Chat interface
   - Voice button
   - Permission center
   - Memory viewer
   - Activity log
   - Connector settings

2. Agent Core
   - Interprets user intent
   - Chooses tools
   - Decides if confirmation is required
   - Generates action plans
   - Saves useful memories only after policy checks

3. Permission Engine
   - Stores allowed capabilities
   - Blocks unsafe actions
   - Requires confirmation for sensitive actions
   - Supports per-app and per-tool permissions

4. Local Memory
   - User preferences
   - Task history
   - Repeated workflow patterns
   - Contact/context notes
   - Missed-response tracking

5. Background Worker
   - Runs after app startup if user allows
   - Watches connected sources
   - Summarizes changes
   - Detects pending replies/actions
   - Never sends replies without approval

6. Connectors
   - Email connector
   - WhatsApp connector
   - Browser connector
   - File connector
   - Calendar connector later

## Data Flow

```text
User command -> Agent Core -> Permission Check -> Tool Plan -> User Confirmation -> Tool Execution -> Audit Log -> Memory Update
```

For background learning:

```text
Approved source -> Background Worker -> Local Classifier -> Memory Candidate -> Privacy Filter -> User-reviewable Memory
```

## Risk Levels

Low risk:

- Summarize local notes.
- Search connected inbox.
- Draft a reply.
- Remind user about pending action.

Medium risk:

- Move files.
- Create calendar events.
- Fill forms.

High risk:

- Send message/email.
- Delete files.
- Purchase/pay.
- Change system settings.
- Share private data externally.

High-risk actions require explicit confirmation every time.

