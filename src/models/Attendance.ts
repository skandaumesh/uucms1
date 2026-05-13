import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  studentId: mongoose.Types.ObjectId;
  semester: string;
  subjects: {
    subjectCode: string;
    subjectName: string;
    totalClasses: number;
    attendedClasses: number;
    percentage: number;
  }[];
  lastSync: Date;
}

const AttendanceSchema: Schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semester: { type: String, required: true },
  subjects: [{
    subjectCode: { type: String },
    subjectName: { type: String },
    totalClasses: { type: Number },
    attendedClasses: { type: Number },
    percentage: { type: Number },
  }],
  lastSync: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
