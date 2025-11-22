# 📢 Announcements System - Comprehensive Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for an announcements system that allows admins to send announcements to carriers, with both in-app notifications and email notifications.

---

## 🎯 System Requirements

### Core Features
1. **Admin Announcement Creation**
   - Create announcements with title, message, priority level
   - Rich text support (optional)
   - Target audience selection (all carriers, specific groups)
   - Schedule announcements (optional future enhancement)
   - Preview before sending

2. **Carrier Announcement Viewing**
   - Beautiful, modern announcements page
   - Filter by priority/date
   - Mark as read/unread
   - Search functionality
   - Pagination for large lists

3. **Notification Integration**
   - In-app notifications via existing notification system
   - Email notifications via Resend
   - Unread count badge
   - Real-time updates

4. **Navigation Integration**
   - Add to header navigation with matching icon
   - Visible to both admins and carriers
   - Badge showing unread announcements count

---

## 🗄️ Database Schema

### New Table: `announcements`

```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  created_by UUID NOT NULL, -- Admin user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration date
  is_active BOOLEAN NOT NULL DEFAULT true,
  target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'active_carriers', 'specific_groups' (future)
  metadata JSONB -- For future extensibility
);

-- Indexes for performance
CREATE INDEX idx_announcements_active ON announcements(is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX idx_announcements_priority ON announcements(priority, created_at DESC);
```

### New Table: `announcement_reads`

```sql
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  carrier_user_id VARCHAR(255) NOT NULL, -- Supabase carrier user ID
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(announcement_id, carrier_user_id)
);

-- Indexes
CREATE INDEX idx_announcement_reads_carrier ON announcement_reads(carrier_user_id, read_at DESC);
CREATE INDEX idx_announcement_reads_announcement ON announcement_reads(announcement_id);
```

### Update `notifications` Table

Add new notification type:
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- Existing types...
  'announcement'  -- NEW: System announcements
));
```

---

## 📁 File Structure

```
app/
  admin/
    announcements/
      page.tsx                    # Admin announcements management page
      create/
        page.tsx                  # Create new announcement
      [id]/
        page.tsx                  # View/edit announcement
  announcements/
    page.tsx                      # Carrier announcements viewing page
    [id]/
      page.tsx                    # Individual announcement detail page

app/api/
  announcements/
    route.ts                      # GET (list), POST (create)
    [id]/
      route.ts                    # GET (single), PUT (update), DELETE
    [id]/read/
      route.ts                    # POST (mark as read)
    unread-count/
      route.ts                    # GET (unread count for current user)

components/
  announcements/
    AnnouncementCard.tsx          # Reusable announcement card component
    AnnouncementList.tsx          # List view with filters
    AnnouncementDetail.tsx        # Full announcement detail view
    CreateAnnouncementForm.tsx    # Admin form for creating announcements
    PriorityBadge.tsx             # Priority indicator component

lib/
  email-templates/
    announcement-template.tsx     # Email template for announcements
```

---

## 🎨 UI/UX Design

### Admin Announcements Page
- **Layout**: Modern dashboard-style layout
- **Features**:
  - Create announcement button (prominent, top-right)
  - List of all announcements (past and present)
  - Status indicators (active, expired, draft)
  - Statistics: Total sent, read rate, active announcements
  - Search and filter by priority/date
  - Edit/delete actions

### Carrier Announcements Page
- **Layout**: Clean, card-based design matching bid-board aesthetic
- **Features**:
  - Hero section with "Latest Announcements" heading
  - Priority-based color coding:
    - Urgent: Red accent
    - High: Orange accent
    - Normal: Blue accent
    - Low: Gray accent
  - Unread indicator badges
  - Filter tabs: All, Unread, Urgent
  - Search bar
  - Infinite scroll or pagination
  - Individual announcement cards with:
    - Priority badge
    - Title
    - Preview text (truncated)
    - Date/time
    - Read/unread status
    - "Read More" button

### Announcement Detail Page
- **Layout**: Centered, readable content layout
- **Features**:
  - Full announcement content
  - Priority indicator
  - Date/time stamp
  - Back button
  - Mark as read button
  - Related announcements (optional)

---

## 🔔 Notification Integration

### In-App Notifications

When an admin creates an announcement:
1. Create notification record for each active carrier
2. Type: `'announcement'`
3. Title: Announcement title
4. Message: Truncated preview (first 100 chars)
5. Data: `{ announcementId, priority, createdAt }`
6. Link: `/announcements/{announcementId}`

### Email Notifications

1. **Check carrier preferences**: Respect `email_notifications` setting
2. **Send via Resend**: Use React Email template
3. **Template Design**: 
   - Match NOVA branding
   - Priority-based styling
   - Clear CTA button to view announcement
   - Mobile-responsive
4. **Batch Processing**: Use notification worker queue for large sends

---

## 🚀 Implementation Phases

### Phase 1: Database & API (Foundation)
- [ ] Create database migrations
- [ ] Create API endpoints
- [ ] Add announcement type to notifications
- [ ] Test API with Postman/curl

### Phase 2: Admin Interface
- [ ] Create admin announcements page
- [ ] Build create announcement form
- [ ] Add edit/delete functionality
- [ ] Add statistics dashboard
- [ ] Test admin workflow

### Phase 3: Carrier Interface
- [ ] Create carrier announcements page
- [ ] Build announcement cards
- [ ] Add filters and search
- [ ] Add detail view
- [ ] Add mark as read functionality
- [ ] Test carrier workflow

### Phase 4: Notifications
- [ ] Integrate with notification system
- [ ] Create email template
- [ ] Wire up email sending
- [ ] Add to notification worker
- [ ] Test notification flow

### Phase 5: Navigation & Polish
- [ ] Add to header navigation
- [ ] Add unread count badge
- [ ] Add icon (Megaphone/Bullhorn)
- [ ] Responsive design
- [ ] Dark mode support
- [ ] Final testing

---

## 🎯 Technical Decisions

### 1. Notification Strategy
**Decision**: Use existing `notifications` table + new `announcements` table
**Rationale**: 
- Leverages existing notification infrastructure
- Keeps announcements separate for better management
- Allows announcement-specific features (expiration, targeting)

### 2. Email Sending
**Decision**: Use Resend with React Email templates (existing system)
**Rationale**:
- Already configured and working
- Consistent with other notification emails
- Professional templates

### 3. Real-time Updates
**Decision**: SWR polling (30s interval) + manual refresh
**Rationale**:
- Simple, reliable
- Matches existing notification system pattern
- Can upgrade to WebSockets later if needed

### 4. Priority Levels
**Decision**: 4 levels (low, normal, high, urgent)
**Rationale**:
- Clear visual hierarchy
- Allows filtering and sorting
- Matches common notification patterns

### 5. Target Audience
**Decision**: Start with "all carriers", add targeting later
**Rationale**:
- Simpler initial implementation
- Can extend with groups/segments later
- Covers 90% of use cases

---

## 📊 Data Flow

### Creating an Announcement (Admin)
```
1. Admin fills form → POST /api/announcements
2. Create announcement record
3. Get all active carrier user IDs
4. For each carrier:
   a. Create notification record (type: 'announcement')
   b. Queue email job (if email enabled)
5. Return success with announcement ID
```

### Viewing Announcements (Carrier)
```
1. Carrier visits /announcements
2. GET /api/announcements (with read status)
3. Display list with unread indicators
4. When carrier clicks announcement:
   a. Navigate to /announcements/[id]
   b. POST /api/announcements/[id]/read
   c. Update notification read status
```

### Notification Worker
```
1. Worker picks up email job
2. Check carrier email preferences
3. Get announcement details
4. Render email template
5. Send via Resend
6. Log result
```

---

## 🎨 Design Specifications

### Color Scheme
- **Urgent**: Red (#ef4444)
- **High**: Orange (#f59e0b)
- **Normal**: Blue (#3b82f6) - Primary
- **Low**: Gray (#6b7280)

### Typography
- **Title**: font-bold, text-xl (cards), text-2xl (detail)
- **Content**: text-base, leading-relaxed
- **Meta**: text-sm, text-muted-foreground

### Spacing
- Card padding: p-6
- Card gap: space-y-4
- Section spacing: mb-8

### Icons
- **Announcements**: Megaphone (lucide-react)
- **Priority**: AlertCircle (urgent), AlertTriangle (high), Info (normal), Bell (low)

---

## 🔐 Security & Permissions

### Admin Access
- Only users with `role = 'admin'` can create/edit/delete
- API endpoints check admin role
- UI shows admin controls only to admins

### Carrier Access
- All authenticated carriers can view announcements
- Can only mark their own reads
- Cannot modify announcements

---

## 📈 Future Enhancements (Post-MVP)

1. **Rich Text Editor**: Markdown or WYSIWYG editor
2. **Scheduled Announcements**: Send at specific date/time
3. **Target Groups**: Segment carriers by criteria
4. **Announcement Templates**: Reusable templates
5. **Analytics**: Read rates, engagement metrics
6. **Attachments**: PDFs, images, documents
7. **Acknowledgment Required**: Force read confirmation
8. **Announcement Categories**: Organize by type

---

## ✅ Success Criteria

1. ✅ Admins can create announcements easily
2. ✅ Carriers receive in-app notifications
3. ✅ Carriers receive email notifications
4. ✅ Announcements page is visually appealing
5. ✅ Navigation shows unread count
6. ✅ All notifications are properly tracked
7. ✅ System handles large numbers of carriers
8. ✅ Mobile-responsive design
9. ✅ Dark mode support
10. ✅ Performance is acceptable (<2s load time)

---

## 🧪 Testing Checklist

- [ ] Admin can create announcement
- [ ] Notification created for each carrier
- [ ] Email sent to each carrier (if enabled)
- [ ] Carrier sees announcement in list
- [ ] Unread count updates correctly
- [ ] Mark as read works
- [ ] Navigation badge shows correct count
- [ ] Filters work correctly
- [ ] Search works correctly
- [ ] Mobile layout is responsive
- [ ] Dark mode works correctly
- [ ] Email template renders correctly
- [ ] Performance with 1000+ carriers

---

## 📝 Next Steps

1. Review and approve this plan
2. Create database migrations
3. Build API endpoints
4. Create admin interface
5. Create carrier interface
6. Integrate notifications
7. Add to navigation
8. Test end-to-end
9. Deploy to production

