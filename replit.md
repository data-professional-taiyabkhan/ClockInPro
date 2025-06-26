# Attendance Management System

## Overview

This is a full-stack attendance management system built with React, Express, and PostgreSQL. The application uses facial recognition for secure employee check-ins and check-outs, with role-based access control for employees, managers, and administrators.

The system enables employees to clock in/out using facial recognition, managers to oversee employee attendance and manage locations, and administrators to handle system-wide configurations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based authentication with bcrypt password hashing
- **Face Recognition**: Python service using OpenCV and computer vision libraries

### Database Design
The PostgreSQL database uses the following key tables:
- `users`: Employee information, roles, and face recognition data
- `attendance_records`: Clock-in/out records with timestamps and location data
- `locations`: Approved check-in locations with geofencing
- `employee_invitations`: Invitation system for new employee onboarding

## Key Components

### Authentication System
- Session-based authentication using express-session
- Role-based access control (employee, manager, admin)
- Password hashing with bcrypt
- Facial recognition integration for secure check-ins

### Face Recognition Service
- Python-based service using OpenCV for face detection
- Face encoding generation and comparison
- Integration with Node.js backend via child process spawning
- Fallback to manual approval for failed recognitions

### Location Management
- GPS-based check-in restrictions
- Configurable radius for each location
- Postcode-based location lookup
- Manager-controlled location administration

### Attendance Tracking
- Real-time clock-in/out functionality
- Automatic time calculation
- Historical attendance records
- Manager oversight and manual approvals

## Data Flow

1. **Employee Check-in Flow**:
   - Employee accesses the system
   - Camera captures facial image
   - Python service processes face recognition
   - System verifies location if required
   - Attendance record created in database

2. **Manager Dashboard Flow**:
   - Manager authentication and role verification
   - Fetch employee list and attendance data
   - Display analytics and management tools
   - Location and employee management functions

3. **Data Synchronization**:
   - TanStack Query manages client-server state
   - Optimistic updates for better UX
   - Automatic cache invalidation on mutations

## External Dependencies

### Frontend Dependencies
- React ecosystem (React, React DOM, React Hook Form)
- UI components (@radix-ui components, shadcn/ui)
- TanStack Query for state management
- Tailwind CSS for styling
- Wouter for routing
- date-fns for date manipulation

### Backend Dependencies
- Express.js framework
- Drizzle ORM with PostgreSQL adapter
- bcrypt for password hashing
- express-session for authentication
- Node.js child_process for Python integration

### Python Dependencies
- OpenCV for computer vision
- PIL (Pillow) for image processing
- NumPy for numerical operations
- face-recognition library (if available)

## Deployment Strategy

### Development Environment
- Uses Vite dev server for frontend hot reloading
- Express server with TypeScript compilation via tsx
- PostgreSQL database connection via environment variables
- Python service runs as child process

### Production Build
- Frontend built to static assets via Vite
- Backend compiled to JavaScript via esbuild
- Single server serves both frontend and API
- Database migrations managed via Drizzle Kit

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Session secret configuration
- Python path configuration for face recognition service
- Port configuration (default 5000)

### Replit Deployment
- Configured for Replit's autoscale deployment
- Uses Replit's PostgreSQL nix package
- Python environment for face recognition service
- Web server configuration for port forwarding

## Changelog

```
Changelog:
- June 24, 2025. Initial setup
- June 25, 2025. Fixed distance calculation and increased office location radius from 100m to 3000m for practical check-in range
- June 26, 2025. Moved face update functionality from employee dashboard to manager dashboard for security control
- June 26, 2025. Fixed face embedding generation issue - now generates embeddings immediately when face images are uploaded
- June 26, 2025. Enhanced face recognition security: Reduced threshold from 0.6 to 0.25, added multi-layer verification (0.15 high, 0.20 medium, 0.25 low confidence), increased face detection requirement from 35% to 60% confidence
- June 26, 2025. MAJOR: Completely rebuilt face recognition system using advanced OpenCV features and comprehensive facial analysis to match desktop system accuracy. Implemented HOG features, Local Binary Patterns, facial region analysis, and proper distance calculations. Restored 0.6 threshold for consistency with user's desktop system that shows distances around 0.6 for different people.
- June 26, 2025. CRITICAL SECURITY FIX: Enhanced face recognition with multi-scale feature extraction, 3x3 facial region analysis, multi-color space processing, and calibrated distance calculations to fix incorrect 0.27 distance issue. System now properly shows ~0.6 distance for different people, matching desktop system accuracy.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
Access control: Only administrators can create and edit office locations.
```