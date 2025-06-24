import {
  pgTable,
  text,
  varchar,
  timestamp,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User storage table - redesigned for attendance system
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  password: varchar("password").notNull(),
  role: varchar("role").notNull().default("employee"), // employee, manager, admin
  faceImageUrl: varchar("face_image_url"), // Simple face image for recognition
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Location settings for check-in restrictions
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  postcode: varchar("postcode").notNull(),
  address: text("address"),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  radiusMeters: integer("radius_meters").default(100), // Check-in radius
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  date: varchar("date").notNull(),
  locationId: integer("location_id").references(() => locations.id),
  checkInMethod: varchar("check_in_method").default("face"), // face, manual
  manuallyApprovedBy: integer("manually_approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employeeInvitations = pgTable("employee_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token").unique().notNull(),
  role: varchar("role").default("employee"),
  invitedBy: integer("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for employee location assignments
export const employeeLocations = pgTable("employee_locations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  locationId: integer("location_id").notNull().references(() => locations.id),
  assignedById: integer("assigned_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
  approvedRecords: many(attendanceRecords, {
    relationName: "approvedBy"
  }),
  employeeLocations: many(employeeLocations),
  assignedLocations: many(employeeLocations, { relationName: "assignedBy" }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
  employeeAssignments: many(employeeLocations),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  user: one(users, {
    fields: [attendanceRecords.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [attendanceRecords.locationId],
    references: [locations.id],
  }),
  approvedBy: one(users, {
    fields: [attendanceRecords.manuallyApprovedBy],
    references: [users.id],
    relationName: "approvedBy"
  }),
}));

export const employeeInvitationsRelations = relations(employeeInvitations, ({ one }) => ({
  invitedBy: one(users, {
    fields: [employeeInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const employeeLocationsRelations = relations(employeeLocations, ({ one }) => ({
  user: one(users, {
    fields: [employeeLocations.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [employeeLocations.locationId],
    references: [locations.id],
  }),
  assignedBy: one(users, {
    fields: [employeeLocations.assignedById],
    references: [users.id],
    relationName: "assignedBy",
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(employeeInvitations).omit({
  id: true,
  createdAt: true,
  token: true,
});

export const insertEmployeeLocationSchema = createInsertSchema(employeeLocations).omit({
  id: true,
  createdAt: true,
});

// Login schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type EmployeeInvitation = typeof employeeInvitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type EmployeeLocation = typeof employeeLocations.$inferSelect;
export type InsertEmployeeLocation = z.infer<typeof insertEmployeeLocationSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;