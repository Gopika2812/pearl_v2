import mongoose from "mongoose";

const crmTaskSchema = new mongoose.Schema({
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    title: { type: String, required: true },
    description: { type: String },
    assignedTo: { type: String }, // Username or User ID
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    status: { 
        type: String, 
        enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], 
        default: 'TODO' 
    },
    priority: { 
        type: String, 
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
        default: 'MEDIUM' 
    },
    dueDate: { type: Date },
    createdBy: { type: String, required: true },
}, { timestamps: true });

const CRMTask = mongoose.model("CRMTask", crmTaskSchema);
export default CRMTask;
