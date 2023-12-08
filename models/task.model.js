"use strict";
exports.__esModule = true;
var mongoose_1 = require("mongoose");
// Defines the Task schema for MongoDB
var taskSchema = new mongoose_1["default"].Schema({
    title: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    date: {
        type: Number,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    status: {
        type: String,
        "enum": ['Pending', 'In Progress', 'Completed', 'Archived'],
        "default": 'Pending'
    },
    estimatedTime: {
        type: Number,
        required: false
    },
    comments: {
        type: String,
        required: false
    },
    priority: {
        type: String,
        "enum": ['Low', 'Medium', 'High', 'Urgent'],
        "default": 'Medium',
        required: false
    },
    workspaceId: {
        type: String,
        required: true
    },
    deadline: {
        type: String,
        required: false
    },
    assignedTo: {
        type: [String],
        required: false
    },
    archiveDate: {
        type: String,
        required: false,
        "default": null
    }
}, 
// Add creation and update timestamps to each document
{ timestamps: true });
// Indexing userId for  query efficiency
taskSchema.index({ userId: 1 });
exports["default"] = mongoose_1["default"].model('task', taskSchema);
