import {
  users,
  attendanceRecords,
  locations,
  employeeInvitations,
  type User,
  type InsertUser,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type Location,
  type InsertLocation,
  type EmployeeInvitation,
  type InsertInvitation,
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
  updateUserFaceEncoding(userId: number, faceImageUrl: string, faceEncoding: any, confidence: number): Promise<User>;
  updateUserAssignedLocations(userId: number, locationIds: number[]): Promise<User>;
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
  
  // Invitation operations
  createInvitation(invitation: InsertInvitation & { token: string }): Promise<EmployeeInvitation>;
  getInvitationByToken(token: string): Promise<EmployeeInvitation | undefined>;
  markInvitationUsed(id: number): Promise<EmployeeInvitation>;
  getActiveInvitations(): Promise<EmployeeInvitation[]>;
  
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

  async updateUserFaceEncoding(userId: number, faceImageUrl: string, faceEncoding: any, confidence: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        faceImageUrl,
        faceEncoding: JSON.stringify(faceEncoding),
        faceConfidence: confidence.toString(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateUserAssignedLocations(userId: number, locationIds: number[]): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        assignedLocations: JSON.stringify(locationIds),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
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
    const [newLocation] = await db
      .insert(locations)
      .values(location)
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
}

export const storage = new DatabaseStorage();