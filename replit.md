# Replit.md - Attendance Management System

## Overview

This is a full-stack attendance management system built with React, Express.js, and PostgreSQL. The application provides face recognition-based attendance tracking with role-based access control for employees, managers, and administrators. The system includes location-based check-in restrictions and comprehensive attendance reporting.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for the user interface
- **Vite** as the build tool and development server
- **Tailwind CSS** with shadcn/ui component library for styling
- **TanStack Query** for server state management and API calls
- **Wouter** for client-side routing
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Express.js** with TypeScript for the REST API server
- **Session-based authentication** using express-session with PostgreSQL store
- **Role-based access control** (employee, manager, admin roles)
- **Python integration** for face recognition processing using OpenCV
- **RESTful API design** with comprehensive error handling

### Database Layer
- **PostgreSQL** as the primary database
- **Drizzle ORM** for database schema management and queries
- **Neon Database** integration for serverless PostgreSQL hosting

## Key Components

### Authentication System
- Session-based authentication with secure cookie management
- Password hashing using bcrypt
- Role-based middleware for protecting routes
- Face recognition integration for biometric authentication

### Face Recognition System
- **Dual implementation approach**: 
  - Client-side face detection using face-api.js for real-time feedback
  - Server-side face recognition using Python OpenCV for secure processing
- Face encoding storage and comparison
- Multiple pose training for improved accuracy
- Confidence scoring and verification thresholds

### Attendance Management
- Clock in/out functionality with face verification
- Location-based restrictions using GPS coordinates and postcode validation
- Attendance record tracking with automatic time calculations
- Real-time status updates and historical reporting

### User Management
- Employee invitation system with unique tokens
- Location assignment for employees
- Profile management with face registration
- Comprehensive user administration

## Data Flow

1. **User Authentication**: Users log in with email/password, then register face biometrics
2. **Attendance Check-in**: 
   - User initiates check-in from dashboard
   - System captures face image and verifies location
   - Python service processes face recognition
   - Attendance record created upon successful verification
3. **Management Operations**:
   - Managers can invite employees and assign locations
   - Admins can manage system-wide settings and locations
   - Real-time attendance monitoring and reporting

## External Dependencies

### Core Framework Dependencies
- **React ecosystem**: react, react-dom, @tanstack/react-query
- **UI Components**: @radix-ui components, tailwindcss, lucide-react
- **Form handling**: react-hook-form, @hookform/resolvers, zod
- **Authentication**: bcrypt, express-session, connect-pg-simple

### Face Recognition Dependencies
- **Client-side**: face-api.js for browser-based face detection
- **Server-side**: Python opencv-python, face-recognition, pillow, numpy
- **Database**: @neondatabase/serverless, drizzle-orm

### Development Tools
- **Build tools**: vite, esbuild, tsx
- **TypeScript**: Full type safety across frontend and backend
- **Database**: drizzle-kit for migrations and schema management

## Deployment Strategy

### Development Environment
- Replit-based development with hot reloading
- PostgreSQL database provisioning through Replit
- Environment variable management for database connections
- Integrated Python environment for face recognition services

### Production Considerations
- **Build process**: Vite builds client, esbuild bundles server
- **Database**: Neon PostgreSQL with connection pooling
- **Session storage**: PostgreSQL-backed session store
- **Static files**: Express serves built client assets
- **Python services**: Subprocess execution for face recognition

### Security Measures
- Secure session management with httpOnly cookies
- Password hashing with bcrypt
- Environment variable protection for sensitive data
- CORS configuration for API security
- SQL injection prevention through parameterized queries

## Changelog

```
Changelog:
- June 24, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```