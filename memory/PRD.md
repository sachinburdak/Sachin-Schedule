# Sachin Schedule - Detailed Product Requirements Document (PRD)

---

## 1. Product Overview

**App Name:** Sachin Schedule
**Type:** Cross-platform mobile app (iOS, Android, Web)
**Purpose:** A disciplined daily schedule tracker that helps the user follow a structured routine, track task completion, log actual timings, and gain analytics-driven insights on consistency and delays.
**Tech Stack:** Expo SDK 54 (React Native) + FastAPI (Python) + MongoDB

---

## 2. Target User

- Single primary user (Sachin) with cross-device sync capability
- Anyone who wants to follow a fixed, disciplined daily routine
- Focused on health, fitness, work/study, nutrition, and self-improvement

---

## 3. Core Screens & Navigation

| Tab | Screen | Purpose |
|-----|--------|---------|
| Today | Dashboard | View today's schedule timeline, check off tasks, log actual start times |
| History | Calendar Heatmap | View past days' completion rates, tap to see missed/completed task details |
| Analytics | Insights Dashboard | Streak, avg completion, most missed tasks, best tasks, delay insights |
| Settings | Profile & Preferences | User profile, notification toggle, schedule info, logout |

**Auth Screens:** Login, Register (email/password for cross-device sync)

---

## 4. Daily Schedule - 11 Time Blocks

The schedule is **fixed** (not editable by user) and sourced from an Excel timetable. Each block has a **start time**, **end time**, and a list of **tasks**.

| # | Block | Time | End | Tasks |
|---|-------|------|-----|-------|
| 1 | **Wake Up** | 5:30 AM | 6:00 AM | Wash Face (Cleanser + Moisturizer), Drink 2 Glasses of Water, Black Coffee, 1-2 Bananas* |
| 2 | **Gym & Fitness** | 6:00 AM | 8:10 AM | Stretching 5 min, Treadmill 5 min (Running), Exercise, Meditation** |
| 3 | **Morning Routine** | 8:10 AM | 9:30 AM | Boil Eggs*, Fresh, Brush, Bath, Shampoo***, Conditioner***, Cleanser, Body Wash, Soap, Sea Salt****, Hair Dryer, Clay Wax, Moisturizer, Sunscreen, Eat Eggs + Potato*, Creatine*, Vitamin D3*, Whey Protein*, Chia Seeds*, Perfume/Deodorant, Clean Clothes, Watch, Chain |
| 4 | **Work Session 1** (Mon-Thu) / **Study Session 1** (Fri-Sun) | 9:30 AM | 3:00 PM | Work Session 1 or Study Session 1 |
| 5 | **Lunch** | 3:00 PM | 3:30 PM | Roti + Sabji + Ghee, Curd, Green Tea |
| 6 | **Work Session 2** (Mon-Thu) / **Study Session 2** (Fri-Sun) | 3:30 PM | 6:00 PM | Work Session 2 or Study Session 2 |
| 7 | **Diet & Snack** | 6:00 PM | 7:00 PM | Soaked Chana 20gm, 4 Egg Whites, Soya Chunks 50gm, Soaked Soya Beans 40gm, Jeera |
| 8 | **Reading / Study / Test** | 7:00 PM | 8:55 PM | Reading / Study Session |
| 9 | **Dinner** | 9:00 PM | 9:15 PM | Roti + Sabji + Ghee, Milk |
| 10 | **Bedtime Routine** | 9:15 PM | 10:00 PM | Remember Goals / AEON, No Screens Allowed, Cleanser, Moisturizer, Mustard Oil |
| 11 | **Sleep** | 10:00 PM | 5:30 AM | Sleep (or Sleep - Rest & Recover on Sundays) |

### Frequency Rules (Task Visibility by Day)

| Symbol | Rule | Affected Tasks |
|--------|------|----------------|
| * | Except Sunday | Bananas, Boil Eggs, Eat Eggs, Creatine, Vitamin D3, Whey Protein, Chia Seeds |
| ** | Extended on Fri/Sat | Meditation (Extended) |
| *** | Alternate days, not Sunday | Shampoo, Conditioner |
| **** | Except Sunday & Thursday | Sea Salt |

**Important:** If a task is not applicable on a given day (e.g., Sea Salt on Thursday), it must NOT appear in the schedule for that day. The app is fully **frequency-aware**.

### Work vs Study Logic

| Day | Session Type |
|-----|-------------|
| Monday - Thursday | **Work** Session 1 & 2 |
| Friday - Sunday | **Study** Session 1 & 2 |

---

## 5. Feature Specifications

### 5.1 Today Tab (Dashboard)

**Header:**
- Greeting: "Good Morning/Afternoon/Evening, {name}"
- Date: e.g., "5 Apr 2026"
- Day badge: e.g., "Sunday"

**Progress Card:**
- "Today's Progress" title
- "{X} of {Y} tasks done" subtitle
- Horizontal progress bar (green fill)
- Circular progress percentage badge

**Schedule Timeline:**
- Vertical timeline with dots and connecting lines
- Each block shows: start time - end time, block title, task list
- **Auto-scroll:** On load, the scroll position jumps to the current "NOW" block
- **NOW badge:** The current time block is highlighted with a "NOW" badge and a thicker border
- **Past blocks:** Blocks before the current time are **dimmed** (opacity 0.55) but still scrollable upward
- **Completed blocks:** Timeline dot turns green with checkmark

**Task Checkboxes:**
- Each task has a checkbox (tap to toggle done/undone)
- Completed tasks show: green checkbox, strikethrough text, greyed color
- Optimistic UI: checkbox toggles instantly, syncs in background

**Task Timing (Clock Icon):**
- Each task has a clock icon button on the right side
- Tapping opens a **bottom-sheet time picker** (hours + minutes scrollable columns)
- User selects the actual time they started the task
- If set, the clock icon turns green and shows the actual time (e.g., "6:15 AM")
- This data feeds into the delay analytics

**Pull-to-refresh** supported.

### 5.2 History Tab

**Calendar Heatmap:**
- GitHub-style colored grid for the selected month
- Color intensity based on completion percentage:
  - 0% = light grey
  - 1-24% = lightest green
  - 25-49% = light green
  - 50-74% = medium green
  - 75-99% = dark green
  - 100% = darkest green
- Today highlighted with border
- Legend: "Less" to "More" color scale

**Month Navigation:** Previous/Next month buttons with month/year display

**Stats Row:** Days Tracked, Avg Completion, Perfect Days

**Day Detail Modal (Tap any past day):**
- Opens bottom sheet showing:
  - Day & date
  - Completion summary: "{X}/{Y} tasks - {Z}%"
  - Progress bar
  - **Missed Tasks section** (red icons): Lists every task NOT completed that day, with block name and scheduled time
  - **Completed Tasks section** (green icons): Lists completed tasks, with actual time if logged
- **Important data boundary rules:**
  - **Future dates:** Do NOT show missed/incomplete tasks (the day hasn't happened yet)
  - **Dates before registration:** Do NOT show missed tasks (user wasn't using the app yet)
  - Only dates from user's registration date through today (inclusive) show incomplete task data

### 5.3 Analytics Tab

**Period Selector:** 7 Days / 14 Days / 30 Days toggle buttons

**Summary Stats Grid (2x2):**
- Day Streak (flame icon)
- Avg Completion % (pie chart icon)
- Perfect Days count (star icon)
- Days Tracked (calendar icon)

**Personalized Message Card:**
- Dynamic message based on performance:
  - >= 80%: "Great job Sachin! You're averaging X%..."
  - 50-79%: "Hey Sachin, you're at X%. Focus on missed tasks..."
  - < 50%: "Hey Sachin, you're at X%. Let's work on consistency..."

**Delay Insights Section:**
- Title: "Delay Insights" with alarm icon
- For each delayed task:
  - Task name
  - Scheduled time
  - Number of times tracked
  - **Average delay in minutes** (e.g., "+12m late")
- **Tip card:** "Hey Sachin, you're late by X min on avg on '{task}'. Try setting an alarm 5 min before!"

**Needs Improvement Section (Most Missed Tasks):**
- Title: "Needs Improvement" with alert icon
- Top 5 most-missed tasks
- Shows: task name, missed count out of total days, miss rate %

**Doing Great Section (Best Tasks):**
- Title: "Doing Great" with trophy icon
- Top 5 most-completed tasks
- Shows: task name, completed count out of total days, completion rate %

**Data Boundary Rules (same as History):**
- Analytics only consider dates from user's registration date through today
- Future dates are excluded from all calculations
- Only days where the user was registered count as "trackable"

### 5.4 Settings Tab

- **Profile Card:** Avatar (initial), name, email, role badge
- **Preferences:** Push notifications toggle
- **Schedule Info:** Type (Daily Fixed), Wake Up time, Sleep time, Day variations
- **About:** App version, "Made for Sachin"
- **Logout button** with confirmation alert

---

## 6. Authentication & Data Sync

**Method:** Email/password with JWT tokens (access + refresh)
- Access token: 15 min expiry
- Refresh token: 7 days expiry
- Tokens stored in AsyncStorage (mobile) and cookies (web)

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Sign in |
| POST | /api/auth/logout | Clear tokens |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/refresh | Refresh access token |

**Security:**
- Brute force protection: 5 failed attempts locks for 15 minutes
- Passwords hashed with bcrypt
- Admin user seeded on startup

---

## 7. API Specification

### Schedule APIs
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/schedule | Get today's schedule with completion status & task timings |
| POST | /api/schedule/toggle | Toggle a task's done/undone status for a date |
| POST | /api/schedule/set-time | Log actual start time for a task on a date |

### History APIs
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/history?month=&year= | Get monthly progress data for calendar heatmap |
| GET | /api/history/day/{YYYY-MM-DD} | Get detailed day view: completed, missed, timings |

### Analytics API
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/analytics?days=30 | Aggregated insights: streak, missed tasks, delays, best tasks |

**Response fields for /api/history/day/{date}:**
```json
{
  "date": "2026-04-05",
  "day": "Sunday",
  "completed_tasks": ["wash_face", "water"],
  "incomplete_tasks": ["black_coffee", "stretching"],
  "incomplete_details": [{"id": "black_coffee", "text": "Black Coffee", "block": "Wake Up", "scheduled_time": "05:30"}],
  "completed_details": [{"id": "wash_face", "text": "Wash Face", "block": "Wake Up", "scheduled_time": "05:30", "actual_time": "05:45"}],
  "task_timings": {"wash_face": "05:45"},
  "total_tasks": 40,
  "completed_count": 2,
  "completion_percentage": 5,
  "is_future": false,
  "is_before_registration": false,
  "registration_date": "2026-04-05"
}
```

**Response fields for /api/analytics:**
```json
{
  "total_days_tracked": 10,
  "avg_completion": 65,
  "perfect_days": 2,
  "streak": 3,
  "period_days": 30,
  "most_missed_tasks": [{"id": "stretching", "text": "Stretching", "missed_count": 7, "total_days": 10}],
  "best_tasks": [{"id": "wash_face", "text": "Wash Face", "completed_count": 10, "total_days": 10}],
  "delay_insights": [{"id": "exercise", "text": "Exercise", "avg_delay_minutes": 15, "scheduled_time": "06:00", "times_tracked": 5}]
}
```

---

## 8. Data Model (MongoDB)

### users
```
{
  email: string (unique),
  password_hash: string,
  name: string,
  role: "user" | "admin",
  created_at: datetime  // Used as registration date for data boundary
}
```

### daily_progress
```
{
  user_id: string,
  date: string (YYYY-MM-DD),
  completed_tasks: string[],    // List of task IDs marked done
  total_tasks: number,
  completion_percentage: number,
  task_timings: {               // Actual start times logged by user
    "task_id": "HH:MM",
    ...
  },
  updated_at: datetime
}
```

### login_attempts
```
{
  identifier: string (IP:email),
  count: number,
  locked_until: datetime
}
```

---

## 9. Business Rules

### 9.1 Incomplete Task Tracking Rules
- **Only dates >= user's registration date (created_at) are considered trackable**
- Dates before the user registered show NO incomplete tasks (the user wasn't using the app)
- **Future dates show NO incomplete tasks** (the day hasn't happened yet)
- Only dates from `registration_date` to `today` (inclusive) show incomplete task data
- This applies to both History day detail modal and Analytics calculations

### 9.2 End-of-Day Behavior
- At the end of each day, all unchecked tasks for that day are automatically preserved as "missed" in the database
- Once a day passes, its tasks can no longer be edited (read-only in history)
- This missed data feeds into the Analytics "Needs Improvement" section

### 9.3 Schedule is Read-Only
- The schedule cannot be modified within the app
- It follows the fixed Excel timetable exactly
- Any changes require a code update

### 9.4 Timezone
- All date calculations use IST (UTC+5:30)
- Dates are stored as strings in YYYY-MM-DD format

---

## 10. Design System

**Theme:** Organic & Earthy

| Token | Value | Usage |
|-------|-------|-------|
| Background | #F5F5F0 | Screen backgrounds |
| Surface | #FFFFFF | Cards, modals |
| Surface Secondary | #EFEFE8 | Subtle backgrounds |
| Primary | #2C4A3B | Buttons, active states, headers |
| Accent | #C97A5E | NOW badge, delays, highlights |
| Text Primary | #1A1A1A | Main text |
| Text Secondary | #5C665F | Subtitles, labels |
| Border | #D8DDD9 | Card borders, dividers |
| Success | #3B6950 | Completed checkboxes, progress bars |
| Error | #964545 | Missed tasks, error states |
| Warning | #C49647 | Tips, streak flame |

**Spacing:** 8pt grid (4, 8, 16, 24, 32, 48)
**Border Radius:** 6px (checkboxes), 12px (buttons), 16px (cards), 20px (major cards)
**Typography:** System font, weights 500-800

---

## 11. Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | sachin@example.com | sachin123 |

---

## 12. Future Enhancements (Not Implemented)

- Push notifications (expo-notifications) for upcoming task reminders
- Weekly challenge mode with streak rewards/gamification
- Social accountability (share progress with coach/partner)
- PDF report export (weekly/monthly summary)
- Widget for home screen showing current task
- Dark mode toggle
