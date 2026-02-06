# Convert an Upcoming Event to a Gallery Event

You can turn an **upcoming event** into a **gallery event** after it has taken place, without losing data. All orders, reports, statistics, passes, and scans stay linked to the same event.

**Rule:** Conversion to gallery is only allowed **after the event date** has passed. The "Convert to Gallery" button appears only for upcoming events whose date is already in the past. This prevents moving an event to the gallery before it has happened.

## What stays the same (no data loss)

- **Orders** – All orders keep the same `event_id`; nothing is deleted or moved.
- **Reports & statistics** – Dashboard and analytics still show this event’s sales and scans.
- **Passes** – Pass definitions and stock remain unchanged.
- **Event details** – Name, date, venue, city, description, poster, etc. stay as-is.

Only the **event type** and optional **gallery media** change.

## How to convert

### Option 1: One-click “Convert to Gallery” (recommended)

1. Go to **Admin → Events**.
2. Find the upcoming event you want to move to the gallery. The **“Convert to Gallery”** button is shown only when the event date has already passed.
3. Click **“Convert to Gallery”** (or “Convertir en Galerie”) on that event’s card.
4. The edit dialog opens with **Event type** already set to **Gallery Event (Past Event)** and the **Gallery Images** and **Gallery Videos** sections visible.
5. Add images and/or videos:
   - Use **Add File** under Gallery Images for photos.
   - Use **Add File** under Gallery Videos for videos.
6. Click **Save**. The event is now a gallery event with the same orders and stats, plus the new media.

### Option 2: Manual conversion via Edit

1. Go to **Admin → Events**.
2. Click **Edit** on the upcoming event.
3. Change **Event Type** from **Upcoming Event** to **Gallery Event (Past Event)**.
4. In the new **Gallery Images** and **Gallery Videos** sections, add files (they upload when you save).
5. Click **Save**.

## After conversion

- The event appears in the **Event Gallery** on the public site (e.g. `/events` gallery section and `/gallery/:eventSlug`).
- It no longer appears as an “upcoming” event.
- All existing orders, reports, and statistics for this event continue to work; nothing is lost.

## Technical note

Conversion only updates the same row in the `events` table: `event_type` is set to `'gallery'` and `gallery_images` / `gallery_videos` are set or extended. No new event is created and no related rows (orders, passes, scans, etc.) are modified.
