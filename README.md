# Attendance Management System

A modern, secure employee attendance management system with facial recognition technology for contactless clock-in/out functionality.

## Features

### 🔐 Advanced Security
- **Facial Recognition Authentication**: Uses DeepFace library with Facenet model for secure employee verification
- **Multi-Role Access Control**: Employee, Manager, and Administrator roles with specific permissions
- **Location-Based Verification**: GPS geofencing to restrict check-ins to authorized locations
- **Session-Based Authentication**: Secure login system with bcrypt password hashing

### 📱 Employee Features
- **Contactless Clock-In/Out**: Face recognition-based attendance tracking
- **Real-Time Location Verification**: Automatic location validation during check-in
- **Attendance History**: View personal attendance records and working hours
- **Dashboard Analytics**: Personal attendance statistics and insights

### 👔 Manager Features
- **Employee Management**: Add, edit, and manage employee profiles
- **Face Image Management**: Upload and manage employee face templates
- **Attendance Oversight**: Monitor team attendance and approve manual entries
- **Location Administration**: Create and manage office locations with geofencing
- **Team Analytics**: Comprehensive attendance reports and insights

### 🛡️ Administrator Features
- **System-Wide Management**: Complete control over all system components
- **User Role Management**: Assign and modify user permissions
- **Location Configuration**: Set up office locations and access controls
- **Invitation System**: Send secure invitations to new employees

## Technology Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** + **shadcn/ui** for modern, responsive design
- **TanStack Query** for efficient server state management
- **Wouter** for lightweight client-side routing
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with **Express.js** framework
- **TypeScript** for full-stack type safety
- **PostgreSQL** database with **Drizzle ORM**
- **Python** integration for face recognition processing
- **Session-based authentication** with secure password hashing

### Face Recognition
- **DeepFace** library with Facenet model
- **OpenCV** for face detection and processing
- **Python** service integration with Node.js backend
- **Real-time face verification** with configurable thresholds

## Installation

### Prerequisites
- Node.js 18+ 
- Python 3.11+
- PostgreSQL database

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd attendance-management-system
   ```

2. **Install dependencies**
   ```bash
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   pip install deepface numpy opencv-python pillow tensorflow
   ```

3. **Database setup**
   ```bash
   # Set your PostgreSQL connection string
   export DATABASE_URL="postgresql://username:password@host:port/database"
   
   # Push database schema
   npm run db:push
   ```

4. **Environment configuration**
   Create a `.env` file with:
   ```
   DATABASE_URL=your_postgresql_connection_string
   SESSION_SECRET=your_secure_session_secret
   NODE_ENV=development
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## Usage

### Initial Setup
1. **Admin Account**: Create the first administrator account through the registration page
2. **Office Locations**: Set up office locations with GPS coordinates and allowed radius
3. **Employee Invitations**: Send invitation links to employees for account creation

### Employee Onboarding
1. **Direct Account Creation**: Managers create employee accounts directly with default password "password123"
2. **Face Registration**: Managers upload employee face images for recognition
3. **Location Assignment**: Assign employees to specific office locations

### Daily Operations
1. **Clock-In**: Employees use face recognition to clock in at authorized locations
2. **Clock-Out**: Face verification for secure clock-out process
3. **Monitoring**: Managers monitor real-time attendance and approve exceptions
4. **Reporting**: Generate attendance reports and analytics

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/register` - User registration (invitation-based)

### Attendance
- `POST /api/verify-face` - Face recognition verification
- `GET /api/attendance` - Get attendance records
- `POST /api/clock-in` - Clock in with face verification
- `POST /api/clock-out` - Clock out with face verification

### Management
- `GET /api/employees` - List employees (Manager+)
- `POST /api/employees` - Create employee accounts directly (Manager+)
- `POST /api/employees/{id}/face` - Upload employee face image (Manager+)
- `GET /api/locations` - List office locations
- `POST /api/locations` - Create office location (Admin)

### Administration
- `POST /api/invitations` - Send employee invitations (Admin)
- `GET /api/system/stats` - System statistics (Admin)

## Security Features

### Face Recognition Security
- **DeepFace Verification**: Industry-standard face recognition with configurable thresholds
- **Anti-Spoofing**: Live face detection to prevent photo-based attacks
- **Template Protection**: Secure storage of face templates with encryption
- **Distance Thresholding**: Configurable similarity thresholds for verification accuracy

### Data Protection
- **Encrypted Storage**: Face templates and sensitive data encrypted at rest
- **Session Security**: Secure session management with automatic expiration
- **Role-Based Access**: Granular permissions based on user roles
- **Audit Logging**: Comprehensive logging of all system activities

### Location Security
- **GPS Verification**: Real-time location validation during check-in
- **Geofencing**: Configurable radius limits for each office location
- **IP Tracking**: Monitor access patterns and detect anomalies

## Configuration

### Face Recognition Settings
```javascript
// Adjust in server/actual_deepface.py
const FACE_THRESHOLD = 0.4;  // Lower = more strict
const MODEL = 'Facenet';     // Face recognition model
const DETECTOR = 'opencv';   // Face detection backend
```

### Location Settings
```javascript
// Default radius for office locations
const DEFAULT_RADIUS_METERS = 100;

// GPS accuracy requirements
const GPS_ACCURACY_THRESHOLD = 50; // meters
```

## Deployment

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database Migration**: Run database migrations in production
3. **Asset Building**: Build optimized frontend assets
4. **Process Management**: Use PM2 or similar for process management
5. **SSL/TLS**: Configure HTTPS with proper certificates

### Replit Deployment
The application is optimized for Replit deployment with:
- Automatic dependency management
- Integrated PostgreSQL database
- One-click deployment configuration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in the `/docs` folder
- Review the troubleshooting guide

## Changelog

### Latest Updates
- **Face Recognition**: Integrated DeepFace library for accurate face verification
- **Security Enhancement**: Implemented multi-layer security with location-based access
- **Performance**: Optimized face recognition pipeline for faster processing
- **UI/UX**: Modern, responsive interface with real-time feedback

---

**Built with ❤️ using modern web technologies for secure, efficient workforce management.**
