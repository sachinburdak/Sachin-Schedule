# Sachin Schedule - Product Requirements Document

## Overview
Daily schedule tracker mobile app with beautiful UI, cross-device sync, and analytics.

## Corrected Schedule (11 Blocks)
1. **Wake Up** 5:30-6:00 AM - Face wash, water, coffee, bananas (except Sunday)
2. **Gym & Fitness** 6:00-8:10 AM - Stretching, treadmill, exercise, meditation
3. **Morning Routine** 8:10-9:30 AM - ONE unified block: hygiene, bath, supplements, diet, get ready (frequency-aware)
4. **Work/Study Session 1** 9:30 AM-3:00 PM - Mon-Thu=Work, Fri-Sun=Study
5. **Lunch** 3:00-3:30 PM - Roti, sabji, ghee, curd, green tea
6. **Work/Study Session 2** 3:30-6:00 PM - Same logic as Session 1
7. **Diet & Snack** 6:00-7:00 PM - Chana, egg whites, soya, jeera
8. **Reading/Study/Test** 7:00-8:55 PM
9. **Dinner** 9:00-9:15 PM - Roti, sabji, ghee, milk
10. **Bedtime Routine** 9:15-10:00 PM - Goals, no screens, skincare
11. **Sleep** 10:00 PM

## Key Features
- **Auto-scroll to NOW** block, past blocks dimmed
- **Date + Day** in header
- **Task timing** - Clock icon per task to log actual start time
- **Analytics tab** - Streak, avg completion, delay insights, missed/best tasks
- **History detail** - Tap any past day to see missed vs completed tasks
- **Frequency-aware** - Items excluded on specific days (Sunday, Thursday, shampoo days)
- **Cross-device sync** via JWT auth

## API Endpoints
- Auth: register, login, logout, me, refresh
- Schedule: GET /api/schedule, POST /api/schedule/toggle, POST /api/schedule/set-time
- History: GET /api/history, GET /api/history/day/{date}
- Analytics: GET /api/analytics?days=30

## Tech: Expo SDK 54 + FastAPI + MongoDB
