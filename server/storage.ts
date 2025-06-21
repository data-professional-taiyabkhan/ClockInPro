import { users, attendanceRecords, type User, type InsertUser, type AttendanceRecord, type InsertAttendanceRecord } from "@shared/schema";
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
  getAllEmployees(): Promise<User[]>;
  
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
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

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

  async updateUserFaceData(userId: number, faceData: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        faceData: faceData,
        faceRegistered: true 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [attendanceRecord] = await db
      .insert(attendanceRecords)
      .values(record)
      .returning();
    return attendanceRecord;
  }

  async updateAttendanceRecord(id: number, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const [updatedRecord] = await db
      .update(attendanceRecords)
      .set(updates)
      .where(eq(attendanceRecords.id, id))
      .returning();
    return updatedRecord;
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
      .where(and(
        eq(attendanceRecords.userId, userId),
        eq(attendanceRecords.date, date)
      ))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(1);
    return record || undefined;
  }
}

export const storage = new DatabaseStorage();
