import request from 'supertest';
import { app } from '../server';
import * as chai3 from 'chai';
import {
	setupDataBase,
	userFour,
	userFive,
	adminFour,
	adminFive,
	superAdminTwo,
} from './testUtils';

const expect = chai3.expect;

let userFourId: number = 0,
	userFiveId: number = 0,
	adminFourId: number = 0,
	adminFiveId: number = 0,
	superAdminTwoId: number = 0;

let userFourToken: number = 0,
	userFiveToken: number = 0,
	adminFourToken: number = 0,
	adminFiveToken: number = 0,
	superAdminTwoToken: number = 0;

let workspaceUserFourId: number = 0,
	workspaceUserFiveId: number = 0,
	workspaceAdminFourId: number = 0,
	workspaceAdminFiveId: number = 0,
	workspaceSuperAdminTwoId: number = 0;

let firstTaskId: number = 0,
	secondTaskId: number = 0,
	thirdTaskId: number = 0,
	firstAdminTaskId: number = 0,
	secondAdminTaskId: number = 0,
	firstSuperAdminTaskId: number = 0;

// setup initial users
before(async function () {
	const responseFour = await request(app)
		.post('/users/register')
		.send(userFour);
	userFourId = await responseFour.body.user._id;

	const responseFive = await request(app)
		.post('/users/register')
		.send(userFive);
	userFiveId = await responseFive.body.user._id;

	const responseAdminFour = await request(app)
		.post('/users/register')
		.send(adminFour);
	adminFourId = await responseAdminFour.body.user._id;

	const responseAdminFive = await request(app)
		.post('/users/register')
		.send(adminFive);
	adminFiveId = await responseAdminFive.body.user._id;

	const responseSuperAdminTwo = await request(app)
		.post('/users/register')
		.send(superAdminTwo);
	superAdminTwoId = await responseSuperAdminTwo.body.user._id;

	const responseLoginFour = await request(app).post('/users/login').send({
		email: userFour.email,
		password: userFour.password,
	});
	userFourToken = await responseLoginFour.body.token;
	userFourId = await responseLoginFour.body.user.id;

	const response = await request(app)
		.post(`/workspaces/user/${userFourId}/create-workspace`)
		.set('Cookie', `token=${userFourToken}`)
		.send({
			title: 'MyWorkspaceUser',
			userId: userFourId,
			isDefault: true,
		});

	workspaceUserFourId = await response.body.workspace._id;

	const responseLoginFive = await request(app).post('/users/login').send({
		email: userFive.email,
		password: userFive.password,
	});
	userFiveToken = await responseLoginFive.body.token;
	userFiveId = await responseLoginFive.body.user.id;

	const responseWorkspaceFive = await request(app)
		.post(`/workspaces/user/${userFiveId}/create-workspace`)
		.set('Cookie', `token=${userFiveToken}`)
		.send({
			title: 'MyWorkspaceUserFive',
			userId: userFiveId,
			isDefault: true,
		});
	workspaceUserFiveId = await responseWorkspaceFive.body.workspace._id;

	const responseTaskUserFive = await request(app)
		.post('/task/')
		.set('Cookie', `token=${userFiveToken}`)
		.send({
			title: 'Third Task',
			userId: userFiveId,
			date: Date.now(),
			description: 'This is the third task',
			workspaceId: workspaceUserFiveId,
		})
		.expect(200);
	thirdTaskId = responseTaskUserFive.body._id;
});

// ********************* TASK CREATION ***************************

// USER TASK CREATION

describe('User Task creation', () => {
	before(async function () {
		const responseLoginFour = await request(app).post('/users/login').send({
			email: userFour.email,
			password: userFour.password,
		});
		userFourToken = await responseLoginFour.body.token;
		userFourId = await responseLoginFour.body.user.id;
	});

	it("Shouldn't register a first task by userFour without token", async function () {
		const response = await request(app)
			.post('/task/')
			.send({
				title: 'First Task',
				userId: userFourId,
				date: Date.now(),
				description: 'This is the first task',
				workspaceId: workspaceUserFourId,
			})
			.expect(401);
	});

	it('Should create a task from userFour', async function () {
		const response = await request(app)
			.post('/task/')
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'First Task',
				userId: userFourId,
				date: Date.now(),
				description: 'This is the first task',
				workspaceId: workspaceUserFourId,
			})
			.expect(200);
		firstTaskId = response.body._id;
	});

	it('Should create a second task from userFour', async function () {
		const response = await request(app)
			.post('/task/')
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'Second Task',
				userId: userFourId,
				date: Date.now(),
				description: 'This is the second task',
				workspaceId: workspaceUserFourId,
			})
			.expect(200);
		secondTaskId = response.body._id;
	});
});

// ADMIN TASK CREATION

describe('Admin Task creation', () => {
	before(async function () {
		// Login the admin and get the token.
		const response = await request(app).post('/users/login').send({
			email: adminFour.email,
			password: adminFour.password,
		});
		adminFourToken = await response.body.token;
		adminFourId = await response.body.user.id;

		const responseWorkspace = await request(app)
			.post(`/workspaces/user/${adminFourId}/create-workspace`)
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'MyWorkspaceAdmin',
				userId: adminFourId,
				isDefault: true,
			});
		workspaceAdminFourId = await responseWorkspace.body.workspace._id;
	});

	after(async function () {
		// Disconnect the admin after each test.
		await request(app).post('/users/logout');
	});

	it('Should create a task from an admin', async function () {
		const response = await request(app)
			.post('/task/')
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'First task admin',
				userId: adminFourId,
				date: Date.now(),
				description: 'This is the first admin task',
				workspaceId: workspaceAdminFourId,
			})
			.expect(200);
		firstAdminTaskId = response.body._id;
	});
});

// SUPERADMIN TASK CREATION

describe('SuperAdmin Task creation', () => {
	before(async function () {
		// Login the admin and get the token.
		const response = await request(app).post('/users/login').send({
			email: superAdminTwo.email,
			password: superAdminTwo.password,
		});
		superAdminTwoToken = await response.body.token;
		superAdminTwoId = await response.body.user.id;

		const responseWorkspace = await request(app)
			.post(`/workspaces/user/${superAdminTwoId}/create-workspace`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.send({
				title: 'MyWorkspaceAdmin',
				userId: superAdminTwoId,
				isDefault: true,
			});
		workspaceSuperAdminTwoId = await responseWorkspace.body.workspace._id;
	});
	it('Should create a task from the superadmin', async function () {
		const response = await request(app)
			.post('/task/')
			.set('Cookie', `token=${superAdminTwoToken}`)
			.send({
				title: 'First SuperAdmin Task',
				userId: superAdminTwoId,
				date: Date.now(),
				description: 'This is the first superadmin task',
				workspaceId: workspaceSuperAdminTwoId,
			})
			.expect(200);
		firstSuperAdminTaskId = response.body._id;
	});
});

// ********************* GET TASK ***************************

// USER GET TASK

describe('Get task', () => {
	it('Should userFour gets his own tasks', async function () {
		const response = await request(app)
			.get(`/task/${firstTaskId}/`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(200);
	});
	it("Shouldn't userFour gets userFives's task", async function () {
		const response = await request(app)
			.get(`/task/${thirdTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
	it("Shouldn't get task without token", async () => {
		const response = await request(app)
			.get(`/task/${secondTaskId}`)
			.expect(401);
	});
	it("Shouldn't user get admin's task", async function () {
		const response = await request(app)
			.get(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
	it("Shouldn't user get superadmin's task", async function () {
		const response = await request(app)
			.get(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
});

// ADMIN GET TASK

describe('Get task', () => {
	before(async function () {
		const responseAdminFive = await request(app).post('/users/login').send({
			email: adminFive.email,
			password: adminFive.password,
		});
		adminFiveToken = await responseAdminFive.body.token;
		adminFiveId = await responseAdminFive.body.user.id;

		const responseAdminFiveWorkspace = await request(app)
			.post(`/workspaces/user/${adminFiveId}/create-workspace`)
			.set('Cookie', `token=${adminFiveToken}`)
			.send({
				title: 'MyWorkspaceAdminFive',
				userId: adminFiveId,
				isDefault: true,
			});
		workspaceAdminFiveId = await responseAdminFiveWorkspace.body.workspace
			._id;

		const responseAdminFiveTask = await request(app)
			.post('/task/')
			.set('Cookie', `token=${adminFiveToken}`)
			.send({
				title: 'First task admin',
				userId: adminFiveId,
				date: Date.now(),
				description: 'This is the first admin task',
				workspaceId: workspaceAdminFiveId,
			});
		secondAdminTaskId = responseAdminFiveTask.body._id;
	});

	it('Admin should not get user task', async function () {
		const response = await request(app)
			.get(`/task/${firstTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});

	it("Shouldn't admin get an other admin's task", async function () {
		const response = await request(app)
			.get(`/task/${secondAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});

	it('Should admin gets his own task', async function () {
		const response = await request(app)
			.get(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(200);
	});

	it("Shouldn't admin get superadmin's task", async function () {
		const response = await request(app)
			.get(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});
});

// SUPERADMIN GET TASK

describe('Get task', () => {
	it('Superadmin should not get user task', async function () {
		const response = await request(app)
			.get(`/task/${firstTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(403);
	});
	it("Shouldn't superadmin get an admin's task", async function () {
		const response = await request(app)
			.get(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(403);
	});
	it('Should superadmin get his own task', async function () {
		const response = await request(app)
			.get(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(200);
	});
});

// ********************* GET TASK ***************************

// USER GET WORKSPACE TASKS

describe('User Get Workspace tasks', async () => {
	it('Should user get his workspace tasks', async function () {
		const response = await request(app)
			.get(`/task/workspace/${workspaceUserFourId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(200);
	});
	it('Users should not receive tasks from a workspace of which they are neither the creator nor a member', async function () {
		const response = await request(app)
			.get(`/task/workspace/${workspaceUserFiveId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
});

// ADMIN GET WORKSPACE TASKS

describe('Admin Get Workspace tasks', async () => {
	it('Should admin get his workspace tasks', async function () {
		const response = await request(app)
			.get(`/task/workspace/${workspaceAdminFourId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(200);
	});
	it('Admins should not receive tasks from a workspace of which they are neither the creator nor a member', async function () {
		const response = await request(app)
			.get(`/task/workspace/${workspaceUserFourId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});
});

// ********************* UPDATE TASK ***************************

// USER UPDATE TASKS

describe('User Update tasks', async () => {
	it('Should user update his own task', async function () {
		const response = await request(app)
			.put(`/task/${firstTaskId}/`)
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'New First Task Title',
				userId: userFourId,
				date: Date.now(),
				description:
					"This is the new description of the first task's user",
				status: 'In Progress',
			})
			.expect(200);
	});
	it("Shouldn't user update an other user's task", async function () {
		const response = await request(app)
			.put(`/task/${thirdTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'Title hacked by an other user',
				userId: userFourId,
			})
			.expect(403);
	});
	it("Shouldn't user update admin's task", async function () {
		const response = await request(app)
			.put(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'task hacked by a user',
				userId: userFourId,
			})
			.expect(403);
	});
	it("Shouldn't user update superadmin's task", async function () {
		const response = await request(app)
			.put(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.send({
				title: 'task hacked by a random user',
				userId: userFiveId,
			})
			.expect(403);
	});
});

// ADMIN UPDATE TASKS

describe('Admin Update tasks', async () => {
	it("Shouldn't admin update an other user's task", async function () {
		const response = await request(app)
			.put(`/task/${firstTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'Title hacked by an admin',
				userId: adminFourId,
			})
			.expect(403);
	});
	it('Should admin update his own task', async function () {
		const response = await request(app)
			.put(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'The new title of the first Admin task',
				status: 'Completed',
			})
			.expect(200);
	});
	it("Shouldn't admin update other admin's task", async function () {
		const response = await request(app)
			.put(`/task/${secondAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'task hacked by an other admin',
				userId: adminFourId,
			})
			.expect(403);
	});
	it("Shouldn't admin update superadmin's task", async function () {
		const response = await request(app)
			.put(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.send({
				title: 'task hacked by an admin',
				userId: adminFourId,
			})
			.expect(403);
	});
});

// SUPERADMIN UPDATE TASK

describe('Superadmin update task', () => {
	it("Shouldn't superadmin update an other user's task", async function () {
		const response = await request(app)
			.put(`/task/${firstTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.send({
				title: 'Title hacked by the superadmin',
				userId: superAdminTwoId,
			})
			.expect(403);
	});
	it("Shouldn't superadmin update admin's task", async function () {
		const response = await request(app)
			.put(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.send({
				title: 'task hacked by the superadmin',
				userId: superAdminTwoId,
			})
			.expect(403);
	});
	it('Should superadmin update his own task', async function () {
		const response = await request(app)
			.put(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.send({
				title: 'The new title of the first SuperAdmin task',
				userId: superAdminTwoId,
				status: 'Archived',
			})
			.expect(200);
	});
});

// ********************* GET TASK ***************************

// USER DELETE TASK

describe('Get task', () => {
	it('Should userFour delete his own tasks', async function () {
		const response = await request(app)
			.delete(`/task/${firstTaskId}/`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(200);
	});
	it("Shouldn't userFour delete userFives's task", async function () {
		const response = await request(app)
			.delete(`/task/${thirdTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
	it("Shouldn't delete task without token", async () => {
		const response = await request(app)
			.delete(`/task/${secondTaskId}`)
			.expect(401);
	});
	it("Shouldn't user delete admin's task", async function () {
		const response = await request(app)
			.delete(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
	it("Shouldn't user delete superadmin's task", async function () {
		const response = await request(app)
			.delete(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${userFourToken}`)
			.expect(403);
	});
});

// ADMIN GET TASK

describe('Admin delete task', () => {
	it('Admin should not delete user task', async function () {
		const response = await request(app)
			.delete(`/task/${secondTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});
	it("Shouldn't admin delete an other admin's task", async function () {
		const response = await request(app)
			.delete(`/task/${secondAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});
	it('Should admin delete his own task', async function () {
		const response = await request(app)
			.delete(`/task/${firstAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(200);
	});
	it("Shouldn't admin delete superadmin's task", async function () {
		const response = await request(app)
			.delete(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${adminFourToken}`)
			.expect(403);
	});
});

// SUPERADMIN GET TASK

describe('Superadmin delete task', () => {
	it('Superadmin should not delete user task', async function () {
		const response = await request(app)
			.delete(`/task/${thirdTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(403);
	});
	it("Shouldn't superadmin delete an admin's task", async function () {
		const response = await request(app)
			.delete(`/task/${secondAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(403);
	});
	it('Should superadmin delete his own task', async function () {
		const response = await request(app)
			.delete(`/task/${firstSuperAdminTaskId}`)
			.set('Cookie', `token=${superAdminTwoToken}`)
			.expect(200);
	});
});

after(async function () {
	await setupDataBase();
});
