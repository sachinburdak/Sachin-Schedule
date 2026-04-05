# Sachin Schedule - Product Requirements Document

## Overview
A mobile app to track a highly disciplined daily schedule with beautiful UI, cross-device sync, and progress tracking.

## Core Features
1. **Daily Schedule Timeline** - Fixed schedule from Excel sheet (5:30 AM Wake Up to 11:00 PM Sleep) with 13 time blocks and 40+ tasks
2. **Task Completion Tracking** - Checkbox-style completion with optimistic UI updates, synced to MongoDB
3. **Progress Dashboard** - Real-time completion percentage, progress bar, and greeting
4. **History Calendar** - GitHub-style heatmap showing daily completion history with month navigation
5. **Authentication** - Email/password JWT auth for cross-device data sync
6. **Day-Aware Schedule** - Schedule adapts based on day of week (Sunday rest, Thursday no sea salt, alternate day shampoo, weekend extended meditation)
7. **Settings** - Profile info, notification toggle, schedule info, logout

## Tech Stack
- **Frontend**: Expo Router (React Native), TypeScript, Expo SDK 54
- **Backend**: FastAPI, Python
- **Database**: MongoDB (Motor async driver)
- **Auth**: JWT (access + refresh tokens), bcrypt password hashing

## API Endpoints
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token
- `GET /api/schedule` - Get today's schedule with completion status
- `POST /api/schedule/toggle` - Toggle task completion
- `GET /api/history?month=&year=` - Get monthly progress data

## Design
- Organic & Earthy theme (sage green #2C4A3B, warm sand #C97A5E, bone white #F5F5F0)
- Timeline-based layout with left-aligned checkable tasks
- Progress ring and completion bar on dashboard
- Calendar heatmap for history view

## Schedule Blocks (13 daily blocks)
1. Wake Up (5:30 AM)
2. Gym & Fitness (6:00 AM)
3. Morning Routine (7:30 AM)
4. Breakfast & Get Ready (9:00 AM)
5. Work/Study Block 1 (10:00 AM)
6. Lunch (1:00 PM)
7. Work/Study Block 2 (2:00 PM)
8. Diet Snack (5:00 PM)
9. Reading/Study (6:00 PM)
10. Dinner (7:00 PM)
11. Evening Goals (8:00 PM)
12. Bedtime Routine (10:00 PM)
13. Sleep (11:00 PM)
