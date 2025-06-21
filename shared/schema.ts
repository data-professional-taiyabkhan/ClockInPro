import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  organization: text("organization").notNull(),
  password: text("password").notNull(),
  faceData: text("face_data"), // Store face encoding/descriptor
  faceRegistered: boolean("face_registered").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  totalHours: text("total_hours"), // Format: "8h 30m"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
  approvedRecords: many(attendanceRecords, {
    relationName: "approvedBy"
  }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
