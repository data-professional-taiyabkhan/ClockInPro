import {
  users,
  attendanceRecords,
  locations,
  employeeInvitations,
  employeeLocations,
  type User,
  type InsertUser,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type Location,
  type InsertLocation,
  type EmployeeInvitation,
  type InsertInvitation,
  type EmployeeLocation,
  type InsertEmployeeLocation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import session from "express-session";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserFaceImage(userId: number, faceImageUrl: string): Promise<User>;
  updateUserFaceEmbedding(userId: number, faceImageUrl: string, faceEmbedding: number[]): Promise<User>;
  getAllEmployees(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  
  // Attendance operations
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: number, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord>;
  getUserAttendanceRecords(userId: number, limit?: number): Promise<AttendanceRecord[]>;
  getTodayAttendanceRecord(userId: number, date: string): Promise<AttendanceRecord | undefined>;
  getAllAttendanceRecords(limit?: number): Promise<AttendanceRecord[]>;
  
  // Location operations
  createLocation(location: InsertLocation): Promise<Location>;
  getActiveLocations(): Promise<Location[]>;
  getLocationByPostcode(postcode: string): Promise<Location | undefined>;
  updateLocation(id: number, updates: Partial<Location>): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  
  // Invitation operations
  createInvitation(invitation: InsertInvitation & { token: string }): Promise<EmployeeInvitation>;
  getInvitationByToken(token: string): Promise<EmployeeInvitation | undefined>;
  markInvitationUsed(id: number): Promise<EmployeeInvitation>;
  getActiveInvitations(): Promise<EmployeeInvitation[]>;
  
  // Employee location operations
  assignEmployeeToLocation(assignment: InsertEmployeeLocation): Promise<EmployeeLocation>;
  removeEmployeeFromLocation(userId: number, locationId: number): Promise<void>;
  getEmployeeLocations(userId: number): Promise<Location[]>;
  getUsersAtLocation(locationId: number): Promise<User[]>;
  getAllEmployeeLocationAssignments(): Promise<(EmployeeLocation & { user: User; location: Location })[]>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserFaceImage(userId: number, faceImageUrl: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ faceImageUrl })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserFaceEmbedding(userId: number, faceImageUrl: string, faceEmbedding: number[]): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        faceImageUrl,
        faceEmbedding: faceEmbedding
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Attendance operations
  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [attendanceRecord] = await db
      .insert(attendanceRecords)
      .values(record)
      .returning();
    return attendanceRecord;
  }

  async updateAttendanceRecord(id: number, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const [attendanceRecord] = await db
      .update(attendanceRecords)
      .set(updates)
      .where(eq(attendanceRecords.id, id))
      .returning();
    return attendanceRecord;
  }

  async getUserAttendanceRecords(userId: number, limit: number = 10): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit);
  }

  async getTodayAttendanceRecord(userId: number, date: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, date)));
    return record || undefined;
  }

  async getAllAttendanceRecords(limit: number = 50): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit);
  }

  // Location operations
  async createLocation(location: InsertLocation): Promise<Location> {
    // Convert coordinates to strings as required by schema
    const locationData = {
      ...location,
      latitude: location.latitude?.toString(),
      longitude: location.longitude?.toString()
    };
    
    const [newLocation] = await db
      .insert(locations)
      .values([locationData])
      .returning();
    return newLocation;
  }

  async getActiveLocations(): Promise<Location[]> {
    return await db
      .select()
      .from(locations)
      .where(eq(locations.isActive, true))
      .orderBy(desc(locations.createdAt));
  }

  async getLocationByPostcode(postcode: string): Promise<Location | undefined> {
    const [location] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.postcode, postcode), eq(locations.isActive, true)));
    return location || undefined;
  }

  async updateLocation(id: number, updates: Partial<Location>): Promise<Location> {
    const [location] = await db
      .update(locations)
      .set(updates)
      .where(eq(locations.id, id))
      .returning();
    return location;
  }

  async deleteLocation(id: number): Promise<void> {
    // First remove all employee assignments for this location
    await db.delete(employeeLocations)
      .where(eq(employeeLocations.locationId, id));
    
    // Update attendance records to remove location reference
    await db.update(attendanceRecords)
      .set({ locationId: null })
      .where(eq(attendanceRecords.locationId, id));
    
    // Then delete the location
    await db.delete(locations)
      .where(eq(locations.id, id));
  }

  // Invitation operations
  async createInvitation(invitation: InsertInvitation & { token: string }): Promise<EmployeeInvitation> {
    const [newInvitation] = await db
      .insert(employeeInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async getInvitationByToken(token: string): Promise<EmployeeInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(employeeInvitations)
      .where(and(eq(employeeInvitations.token, token), eq(employeeInvitations.used, false)));
    return invitation || undefined;
  }

  async markInvitationUsed(id: number): Promise<EmployeeInvitation> {
    const [invitation] = await db
      .update(employeeInvitations)
      .set({ used: true })
      .where(eq(employeeInvitations.id, id))
      .returning();
    return invitation;
  }

  async getActiveInvitations(): Promise<EmployeeInvitation[]> {
    return await db
      .select()
      .from(employeeInvitations)
      .where(and(eq(employeeInvitations.used, false)))
      .orderBy(desc(employeeInvitations.createdAt));
  }

  // Employee location operations
  async assignEmployeeToLocation(assignment: InsertEmployeeLocation): Promise<EmployeeLocation> {
    const [employeeLocation] = await db
      .insert(employeeLocations)
      .values(assignment)
      .onConflictDoNothing()
      .returning();
    return employeeLocation;
  }

  async removeEmployeeFromLocation(userId: number, locationId: number): Promise<void> {
    await db
      .delete(employeeLocations)
      .where(and(
        eq(employeeLocations.userId, userId),
        eq(employeeLocations.locationId, locationId)
      ));
  }

  async getEmployeeLocations(userId: number): Promise<Location[]> {
    const result = await db
      .select({
        id: locations.id,
        name: locations.name,
        postcode: locations.postcode,
        address: locations.address,
        latitude: locations.latitude,
        longitude: locations.longitude,
        radiusMeters: locations.radiusMeters,
        isActive: locations.isActive,
        createdAt: locations.createdAt,
      })
      .from(employeeLocations)
      .innerJoin(locations, eq(employeeLocations.locationId, locations.id))
      .where(and(
        eq(employeeLocations.userId, userId),
        eq(locations.isActive, true)
      ));
    
    return result;
  }

  async getUsersAtLocation(locationId: number): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        password: users.password,
        role: users.role,
        faceImageUrl: users.faceImageUrl,
        faceEmbedding: users.faceEmbedding,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(employeeLocations)
      .innerJoin(users, eq(employeeLocations.userId, users.id))
      .where(and(
        eq(employeeLocations.locationId, locationId),
        eq(users.isActive, true)
      ));
    
    return result;
  }

  async getAllEmployeeLocationAssignments(): Promise<(EmployeeLocation & { user: User; location: Location })[]> {
    try {
      const result = await db
        .select()
        .from(employeeLocations)
        .innerJoin(users, eq(employeeLocations.userId, users.id))
        .innerJoin(locations, eq(employeeLocations.locationId, locations.id))
        .where(and(
          eq(users.isActive, true),
          eq(locations.isActive, true)
        ))
        .orderBy(users.firstName, users.lastName);
      
      return result.map(row => ({
        id: row.employee_locations.id,
        userId: row.employee_locations.userId,
        locationId: row.employee_locations.locationId,
        assignedById: row.employee_locations.assignedById,
        createdAt: row.employee_locations.createdAt,
        user: row.users,
        location: row.locations
      }));
    } catch (error) {
      console.error("Error getting employee location assignments:", error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();