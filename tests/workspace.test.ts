import request from 'supertest';
import { app } from '../server';
import * as chai4 from 'chai';
import { setupDataBase, userSix, userSeven } from './testUtils';

const expect = chai4.expect;

let userSixId: number = 0,
	userSevenId: number = 0;

let userSixToken: number = 0,
	userSevenToken: number = 0;

let workspaceUserSixId: number = 0,
	workspaceUserSevenId: number = 0;

before(async function () {
	const responseUserSix = await request(app)
		.post('/users/register')
		.send(userSix);
	userSixId = await responseUserSix.body.user._id;

	const responseUserSeven = await request(app)
		.post('/users/register')
		.send(userSeven);
	userSevenId = await responseUserSeven.body.user._id;
});

// *********************  WORKSPACE CREATION ***************************

describe('User create workspace', async function () {
	before(async function () {
		const responseLoginSix = await request(app).post('/users/login').send({
			email: userSix.email,
			password: userSix.password,
		});
		userSixToken = await responseLoginSix.body.token;
		userSixId = await responseLoginSix.body.user.id;

		const responseLoginSeven = await request(app)
			.post('/users/login')
			.send({
				email: userSeven.email,
				password: userSeven.password,
			});

		userSevenToken = await responseLoginSeven.body.token;
		userSevenId = await responseLoginSeven.body.user.id;
	});

	it("Shouldn't register a workspace by a user without token", async function () {
		const response = await request(app)
			.post(`/workspaces/user/${userSixId}/create-workspace`)
			.send({
				title: 'First Workspace',
				userId: userSixId,
				description: 'This is the first workspace',
				isDefault: true,
			})
			.expect(401);
	});

	it('Should register a workspace with token', async function () {
		const response = await request(app)
			.post(`/workspaces/user/${userSixId}/create-workspace`)
			.set('Cookie', `token=${userSixToken}`)
			.send({
				title: 'First Workspace',
				userId: userSixId,
				description: 'This is the first workspace',
				isDefault: true,
				members: [userSevenId],
			})
			.expect(200);
		workspaceUserSixId = response.body.workspace._id;
	});

	it('Should register an other user workspace with token', async function () {
		const response = await request(app)
			.post(`/workspaces/user/${userSevenId}/create-workspace`)
			.set('Cookie', `token=${userSevenToken}`)
			.send({
				title: 'Second Workspace',
				userId: userSevenId,
				description: 'This is the first workspace of userSeven',
				isDefault: true,
			})
			.expect(200);

		workspaceUserSevenId = response.body.workspace._id;
	});
});

// *********************  USER GET WORKSPACE ***************************

describe('User get workspace', async function () {
	it('Should userSix gets his own workspace', async function () {
		const response = await request(app)
			.get(`/workspaces/${workspaceUserSixId}/`)
			.set('Cookie', `token=${userSixToken}`)
			.expect(200);
	});

	it("Shouldn't userSix gets userSeven's workspace", async function () {
		const response = await request(app)
			.get(`/workspaces/${workspaceUserSevenId}`)
			.set('Cookie', `token=${userSixToken}`)
			.expect(403);
	});

	it("Shouldn't get workspaces without token", async () => {
		const response = await request(app)
			.get(`/workspaces/${workspaceUserSixId}`)
			.expect(401);
	});

	it('Should userSeven gets his workspace as a member of it', async function () {
		const response = await request(app)
			.get(`/workspaces/${workspaceUserSixId}/`)
			.set('Cookie', `token=${userSevenToken}`)
			.expect(200);
	});
});

// *********************  USER UPDATE  WORKSPACE ***************************

describe('User update workspace', async function () {
	it('Should userSix update his own workspace', async function () {
		const response = await request(app)
			.put(`/workspaces/${workspaceUserSixId}/`)
			.set('Cookie', `token=${userSixToken}`)
			.send({
				title: 'New Workspace Title',
				description: 'update the workspace',
			})
			.expect(200);
	});

	it("Shouldn't userSix update userSeven's workspace", async function () {
		const response = await request(app)
			.put(`/workspaces/${workspaceUserSevenId}`)
			.set('Cookie', `token=${userSixToken}`)
			.send({
				title: 'New Workspace Title',
				description: 'update the workspace',
			})
			.expect(403);
	});

	it("Shouldn't update workspaces without token", async () => {
		const response = await request(app)
			.put(`/workspaces/${workspaceUserSixId}`)
			.send({
				title: 'New new Workspace Title',
				description: 'update again the workspace',
			})
			.expect(401);
	});

	it('Should userSeven updates his workspace as a member of it', async function () {
		const response = await request(app)
			.put(`/workspaces/${workspaceUserSixId}/`)
			.send({
				title: 'New new Workspace Title',
				description: 'update again the workspace',
			})
			.set('Cookie', `token=${userSevenToken}`)
			.expect(200);
	});
});

// ********************* USER GET ALL WORKSPACE ***************************

describe('User get all workspace', async function () {
	it('Should userSeven gets his workspace as a creator and a member of it', async function () {
		const response = await request(app)
			.get(`/workspaces/user/${userSevenId}/`)
			.set('Cookie', `token=${userSevenToken}`)
			.expect(200);
	});
});

// ********************* USER DELETE WORKSPACE ***************************

describe('User delete workspace', async function () {
	it("Shouldn't delete workspaces without token", async () => {
		const response = await request(app)
			.delete(`/workspaces/${workspaceUserSixId}`)
			.expect(401);
	});

	it('Should userSix delete his own workspace', async function () {
		const response = await request(app)
			.delete(`/workspaces/${workspaceUserSixId}/`)
			.set('Cookie', `token=${userSixToken}`)
			.expect(200);
	});

	it("Shouldn't userSix delete userSeven's workspace", async function () {
		const response = await request(app)
			.delete(`/workspaces/${workspaceUserSevenId}`)
			.set('Cookie', `token=${userSixToken}`)
			.expect(403);
	});
});

after(async function () {
	await setupDataBase();
});
