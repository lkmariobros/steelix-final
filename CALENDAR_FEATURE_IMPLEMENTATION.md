# Office Calendar & Announcements Feature - Implementation Summary

## 🎯 Feature Overview

Implemented a comprehensive **Office Calendar & Announcements** system that combines calendar events and announcement board functionality into a unified interface. This addresses the client's requirement for agents to see "what's going on in the office" with upcoming meetings, announcements, and admin-managed content.

## ✅ What Was Implemented

### 1. Database Schema (`apps/server/src/db/schema/calendar.ts`)

#### Calendar Events Table
- **Fields:**
  - Event details (title, description, type, dates, location)
  - Event types: meeting, training, announcement, holiday, deadline, other
  - Priority levels: low, normal, high, urgent
  - All-day event support
  - Agent assignment (optional - null = all agents see it)
  - Active/inactive status

#### Announcements Table
- **Fields:**
  - Title and content
  - Priority levels
  - Expiration date (optional)
  - Pin to top functionality
  - Active/inactive status

### 2. Backend API (`apps/server/src/routers/calendar.ts`)

#### Calendar Events Endpoints
- `listEvents` - Get all events with date/type filters
- `upcomingEvents` - Get events in next N days (default 7, shows "meeting in 2 days")
- `getEvent` - Get single event details
- `createEvent` - Admin-only: Create new event
- `updateEvent` - Admin-only: Update event
- `deleteEvent` - Admin-only: Delete event

#### Announcements Endpoints
- `listAnnouncements` - Get all active announcements (sorted by pinned first)
- `getAnnouncement` - Get single announcement
- `createAnnouncement` - Admin-only: Create new announcement
- `updateAnnouncement` - Admin-only: Update announcement
- `deleteAnnouncement` - Admin-only: Delete announcement

### 3. Frontend Page (`apps/web/src/app/dashboard/calendar/page.tsx`)

#### Features
- **Dual View Mode:** Toggle between Calendar Events and Announcements
- **Event Cards:** Display upcoming events with:
  - Event type badges (meeting, training, holiday, etc.)
  - Priority indicators (color-coded)
  - Date/time information
  - Location details
  - "Meeting in X days" countdown for events within 7 days
  - Days until calculation (shows "Today", "Tomorrow", or "In X days")

- **Announcement Board:**
  - Pinned announcements at top
  - Priority badges
  - Expiration dates
  - Full content display

- **Admin Management:**
  - Create/Edit/Delete events (admin only)
  - Create/Edit/Delete announcements (admin only)
  - Rich form dialogs with validation

### 4. Navigation Integration
- Added "Office Calendar" to sidebar navigation
- Icon: Calendar icon (RiCalendarLine)
- Accessible from both admin and agent portals

## 📋 Key Features

### For Agents
- ✅ View upcoming meetings and events
- ✅ See "meeting in 2 days" countdown notifications
- ✅ Read office announcements
- ✅ See pinned announcements at top
- ✅ Filter by view mode (Calendar vs Announcements)

### For Admins
- ✅ Create calendar events (meetings, training, deadlines, etc.)
- ✅ Set event priorities and assign to specific agents
- ✅ Create announcements for office updates
- ✅ Pin important announcements to top
- ✅ Set expiration dates for announcements
- ✅ Edit/delete events and announcements

## 🎨 UI/UX Features

- **Color-coded Priority Badges:**
  - Urgent: Red
  - High: Orange
  - Normal: Blue
  - Low: Gray

- **Event Type Badges:**
  - Meeting: Purple
  - Training: Green
  - Holiday: Yellow
  - Deadline: Red
  - Announcement: Blue
  - Other: Gray

- **Smart Notifications:**
  - Events within 7 days show countdown ("Today", "Tomorrow", "In X days")
  - Upcoming events highlighted with blue border

- **Responsive Design:**
  - Grid layout adapts to screen size
  - Mobile-friendly cards
  - Scrollable dialogs

## 🚀 Next Steps

### Database Migration Required
Run Drizzle Kit to generate and apply the migration:

```bash
cd apps/server
bun run db:generate
bun run db:push
```

Or manually create migration from the schema.

### Testing Checklist
- [ ] Create calendar event as admin
- [ ] View events as agent
- [ ] See countdown for upcoming events
- [ ] Create announcement as admin
- [ ] View announcements as agent
- [ ] Pin announcement and verify it appears at top
- [ ] Test expiration date for announcements
- [ ] Verify non-admin users cannot create/edit/delete

## 📝 Notes

- **Permission Model:** All create/update/delete operations require admin role
- **Agent Assignment:** Events can be assigned to specific agents or left null (visible to all)
- **Date Handling:** Supports both all-day and timed events
- **Expiration:** Announcements automatically hide after expiration date
- **Auto-cleanup:** Expired announcements are filtered out by default

## 🔧 Technical Details

- **Backend:** tRPC procedures with type-safe validation
- **Frontend:** React Hook Form + Zod validation
- **State Management:** TanStack Query for caching and invalidation
- **UI Components:** Shadcn/UI components with TailwindCSS
- **Icons:** Remix Icons

This implementation provides a hybrid solution that combines calendar functionality with an announcement board, exactly as requested by the client. The system is flexible enough to handle both scheduled events (with dates) and general announcements (without dates), all managed by admins and visible to all agents.
