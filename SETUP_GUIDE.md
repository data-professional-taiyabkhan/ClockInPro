# Complete Setup Guide - Attendance Management System

This guide provides detailed step-by-step instructions to set up and run the Attendance Management System on your local machine or server.

## 📋 Prerequisites Checklist

Before starting, ensure you have the following installed:

- [ ] **Node.js 18 or higher** - [Download from nodejs.org](https://nodejs.org/)
- [ ] **npm** (comes with Node.js) or **yarn** package manager
- [ ] **Python 3.8 or higher** - [Download from python.org](https://python.org/)
- [ ] **PostgreSQL 12 or higher** - [Download from postgresql.org](https://www.postgresql.org/)
- [ ] **Git** - [Download from git-scm.com](https://git-scm.com/)
- [ ] **Camera/Webcam** - For facial recognition functionality

### System Requirements
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: At least 2GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux Ubuntu 18.04+

## 🚀 Step-by-Step Installation

### Step 1: Clone the Repository

```bash
# Clone the project
git clone <repository-url>
cd attendance-management-system

# Verify you're in the correct directory
ls -la
# You should see: package.json, server/, client/, shared/, etc.
```

### Step 2: Install Node.js Dependencies

```bash
# Install all Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

**Expected output**: You should see all packages listed without errors.

### Step 3: Set Up Python Environment

```bash
# Create a virtual environment (recommended)
python -m venv face_recognition_env

# Activate virtual environment
# On Windows:
face_recognition_env\Scripts\activate
# On macOS/Linux:
source face_recognition_env/bin/activate

# Install Python dependencies
pip install -r python-requirements.txt

# Verify Python packages
pip list
```

**Note**: If you encounter errors with `dlib` or `cmake`, install them separately:
```bash
# Install cmake first
pip install cmake

# Then install dlib
pip install dlib

# Finally install face_recognition
pip install face-recognition
```

### Step 4: Database Setup

#### Option A: Local PostgreSQL Installation

1. **Install PostgreSQL**:
   - Windows: Download installer from postgresql.org
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql postgresql-contrib`

2. **Create Database**:
```bash
# Start PostgreSQL service
# Windows: Start from Services or pgAdmin
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Create database
createdb attendance_management

# Create user (optional but recommended)
psql -c "CREATE USER attendance_user WITH PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE attendance_management TO attendance_user;"
```

#### Option B: Using Docker (Alternative)

```bash
# Run PostgreSQL in Docker
docker run --name postgres-attendance \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=attendance_management \
  -p 5432:5432 \
  -d postgres:13
```

### Step 5: Environment Configuration

1. **Create environment file**:
```bash
# Copy example environment file
cp .env.example .env

# Edit the .env file
nano .env  # or use your preferred editor
```

2. **Configure environment variables**:
```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/attendance_management

# Session Security
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Application Settings
NODE_ENV=development
PORT=5000

# Python Path (adjust based on your system)
PYTHON_PATH=python3
```

**Important**: Replace `username`, `password`, and `your-super-secret-session-key` with your actual values.

### Step 6: Database Schema Setup

```bash
# Push database schema to PostgreSQL
npm run db:push

# Verify tables were created
psql -d attendance_management -c "\dt"
```

**Expected output**: You should see tables like `users`, `attendance_records`, `locations`, etc.

### Step 7: Start the Application

```bash
# Start the development server
npm run dev
```

**Expected output**:
```
[express] serving on port 5000
The application is running on http://localhost:5000
```

### Step 8: Verify Installation

1. **Open your browser** and navigate to `http://localhost:5000`
2. **Check the console** for any error messages
3. **Test basic functionality**:
   - Try to access the login page
   - Check if the camera works (allow camera permissions)

## 👤 Initial System Setup

### Create Administrator Account

1. **Navigate to**: `http://localhost:5000`
2. **Click**: "Register" or "Create Account"
3. **Fill in admin details**:
   - First Name: Admin
   - Last Name: User
   - Email: admin@company.com
   - Password: password123
   - Role: Administrator

### Create Manager Account

1. **Login as admin**
2. **Go to**: User Management
3. **Create manager account**:
   - Email: manager@company.com
   - Password: password123
   - Role: Manager

### Set Up Office Locations

1. **Login as admin**
2. **Navigate to**: Locations tab
3. **Add office location**:
   - Name: Main Office
   - Address: Your office address
   - Postcode: Your postcode
   - Radius: 100 meters (adjust as needed)

### Create Employee Accounts

1. **Login as manager** (manager@company.com / password123)
2. **Navigate to**: Employee Management tab
3. **Click**: "Add Employee"
4. **Fill employee details**:
   - First Name: Employee name
   - Last Name: Employee surname
   - Email: employee@company.com
   - Role: Employee
5. **Upload face image** for recognition

## 🔧 Configuration & Customization

### Face Recognition Settings

Edit `server/actual_deepface.py` to adjust recognition parameters:

```python
# Adjust these values for your environment
VERIFICATION_THRESHOLD = 0.4  # Lower = more strict
MODEL_NAME = 'Facenet'        # Face recognition model
DETECTOR_BACKEND = 'opencv'   # Face detection method
```

### Location Settings

Modify radius and GPS accuracy in the admin panel:
- **Default radius**: 100 meters
- **GPS accuracy**: 50 meters
- **Location timeout**: 30 seconds

### Security Settings

Update session and security configurations:

```javascript
// In server/auth.ts
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_MIN_LENGTH = 8;
const MAX_LOGIN_ATTEMPTS = 5;
```

## 🧪 Testing the System

### Test Face Recognition

1. **Login as employee**
2. **Click**: "Face Check-In"
3. **Allow camera access**
4. **Position face** in the camera frame
5. **Wait for recognition** (should take 2-3 seconds)

### Test Location Verification

1. **Ensure you're within office radius**
2. **Check browser location permissions**
3. **Verify GPS coordinates** in developer console

### Test Manager Features

1. **Login as manager**
2. **Upload employee face images**
3. **View attendance reports**
4. **Manage employee assignments**

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**:
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Verify database credentials

#### 2. Python Face Recognition Error
```
ModuleNotFoundError: No module named 'deepface'
```
**Solution**:
```bash
# Activate virtual environment
source face_recognition_env/bin/activate

# Reinstall dependencies
pip install -r python-requirements.txt
```

#### 3. Camera Not Working
```
NotAllowedError: Permission denied
```
**Solution**:
- Allow camera permissions in browser
- Check if camera is being used by another app
- Try different browser (Chrome recommended)

#### 4. Face Recognition Not Accurate
**Solution**:
- Ensure good lighting
- Upload high-quality face images
- Adjust verification threshold
- Re-upload face images if needed

#### 5. Location Not Detected
```
GeolocationPositionError: User denied geolocation
```
**Solution**:
- Allow location permissions in browser
- Check if location services are enabled
- Try refreshing the page

### Development Tools

#### View Database Contents
```bash
# Connect to database
psql -d attendance_management

# View users
SELECT id, email, "firstName", "lastName", role FROM users;

# View attendance records
SELECT * FROM attendance_records ORDER BY "clockInTime" DESC LIMIT 10;

# Exit database
\q
```

#### Check Application Logs
```bash
# View server logs
npm run dev

# View Python logs (if debugging face recognition)
python3 server/actual_deepface.py test
```

#### Reset Database (if needed)
```bash
# WARNING: This will delete all data
npm run db:push --force
```

## 🚀 Production Deployment

### Environment Preparation

1. **Set production environment**:
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
SESSION_SECRET=your_production_session_secret
```

2. **Build application**:
```bash
npm run build
```

3. **Use process manager**:
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "attendance-system" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### Security Considerations

- [ ] Use HTTPS in production
- [ ] Set strong session secrets
- [ ] Configure firewall rules
- [ ] Regular database backups
- [ ] Monitor application logs
- [ ] Update dependencies regularly

## 📞 Support

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review application logs** for error messages
3. **Verify all prerequisites** are properly installed
4. **Test with different browsers** or devices
5. **Contact support** with detailed error messages

## 📝 Default Accounts Summary

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Admin | admin@company.com | password123 | Full system access |
| Manager | manager@company.com | password123 | Employee management |
| Employee | (created by manager) | password123 | Attendance tracking |

**Important**: Change default passwords after first login!

---

**Setup Complete!** Your Attendance Management System should now be running successfully. Access it at `http://localhost:5000` and start managing your workforce efficiently.