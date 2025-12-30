# Tigerdo - Security Guard App

## Overview

A mobile app for security guards to manage shifts, log activities, receive petrol reminders, and handle emergencies.

## Features

### 🏠 Home (Shift Management)

- **Start/End Shift** with geolocation check
- **Activity Logging** (visitor entries, incidents, patrols)
- **Petrol Reminders** every 30 minutes (works in background)
- **Timeline View** of shift activities

### 📜 History

- View past shift logs
- Filter by date

### ✅ Authorize

- **Manage authorized people** (name, description, phone)
- **Manage authorized cars** (name, description, plate number)
- Add/Delete functionality

### 🚨 Emergency

- **Emergency Contacts** (name, email, phone, position)
- **📱 SOS SMS** - Send SMS to all contacts via smsnotifygh.com API
- **📞 Call All** - Sequentially call each emergency contact

### 👤 Profile

- User information display

---

## Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** expo-router
- **Database:** Firebase Firestore
- **Notifications:** expo-notifications
- **SMS API:** smsnotifygh.com

---

## Configuration

### Location (index.tsx)

```javascript
const TARGET_LOCATION = {
  latitude: 5.6203491,
  longitude: -0.1534685,
};
const ALLOWED_RADIUS_METERS = 100;
```

### Petrol Reminder Interval

```javascript
const PETROL_REMINDER_INTERVAL_SECONDS = 1800; // 30 minutes
```

### SMS API (emergency.tsx)

```javascript
const SMS_API_KEY = "your-api-key";
const SMS_SENDER_ID = "izone";
```

---

## Build Commands

```bash
# Development
npx expo start --dev-client

# Production Build
npx eas-cli build --profile production --platform android
```

---

## Firebase Collections

- `logs` - Shift activity logs
- `authorizedPeople` - Authorized visitors
- `authorizedCars` - Authorized vehicles
- `emergencyContacts` - Emergency contact list
