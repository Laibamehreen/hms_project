import { connectDB, Patient, inMemoryPatientsStore } from '@/lib/db';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const isDbConnected = await connectDB();
  if (isDbConnected) {
    try {
      const patients = await Patient.find().sort({ createdAt: -1 });
      return NextResponse.json(patients, {
        headers: { 'X-Data-Source': 'mongodb' }
      });
    } catch (error) {
      console.warn("MongoDB query failed, falling back to in-memory store:", error);
    }
  }

  // Gracefully fallback to in-memory store if MongoDB is offline or unavailable
  return NextResponse.json(inMemoryPatientsStore.getAll(), {
    headers: { 'X-Data-Source': 'in-memory' }
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
    }

    delete data.id;
    if (data.age !== undefined) {
      data.age = Number(data.age) || 0;
    }

    const isDbConnected = await connectDB();
    if (isDbConnected) {
      try {
        const patient = await Patient.create(data);
        return NextResponse.json(patient, {
          status: 201,
          headers: { 'X-Data-Source': 'mongodb' }
        });
      } catch (error) {
        console.warn("MongoDB create failed, falling back to in-memory store:", error);
      }
    }

    const patient = inMemoryPatientsStore.create(data);
    return NextResponse.json(patient, {
      status: 201,
      headers: { 'X-Data-Source': 'in-memory' }
    });
  } catch (error) {
    console.error("POST /api/patients error:", error);
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "A valid patient ID is required" }, { status: 400 });
    }

    if (updateData.age !== undefined) {
      updateData.age = Number(updateData.age) || 0;
    }

    const isDbConnected = await connectDB();
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      try {
        const updated = await Patient.findByIdAndUpdate(id, updateData, { new: true });
        if (updated) {
          return NextResponse.json(updated, {
            headers: { 'X-Data-Source': 'mongodb' }
          });
        }
      } catch (error) {
        console.warn("MongoDB update failed, falling back to in-memory store:", error);
      }
    }

    const updated = inMemoryPatientsStore.update(id, updateData);
    if (!updated) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json(updated, {
      headers: { 'X-Data-Source': 'in-memory' }
    });
  } catch (error) {
    console.error("PATCH /api/patients error:", error);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "A valid patient ID is required" }, { status: 400 });
    }

    const isDbConnected = await connectDB();
    if (isDbConnected && mongoose.isValidObjectId(id)) {
      try {
        const deleted = await Patient.findByIdAndDelete(id);
        if (deleted) {
          return NextResponse.json({ message: "Patient deleted successfully" });
        }
      } catch (error) {
        console.warn("MongoDB delete failed, falling back to in-memory store:", error);
      }
    }

    const deleted = inMemoryPatientsStore.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Patient deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/patients error:", error);
    return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
  }
}