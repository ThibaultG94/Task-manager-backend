import request from 'supertest';
import { app } from '../server';
import * as chai5 from 'chai';
import { setupDataBase, userHeight, userNine } from './testUtils';

const expect = chai5.expect;

let userHeightId: number = 0,
	userNineId: number = 0;

let userHeightToken: number = 0,
	userNineToken: number = 0;

let workspaceUserHeightId: number = 0;

let invitationId: number = 0;

before(async function () {
	await setupDataBase();
	this.timeout(2000);
});

before(async function () {
	const responseUserHeight = await request(app)
		.post('/users/register')
		.send(userHeight);
	userHeightId = await responseUserHeight.body.user._id;

	const responseUserNine = await request(app)
		.post('/users/register')
		.send(userNine);
	userNineId = await responseUserNine.body.user._id;

	const responseLoginHeight = await request(app).post('/users/login').send({
		email: userHeight.email,
		password: userHeight.password,
	});
	userHeightToken = await responseLoginHeight.body.token;
	userHeightId = await responseLoginHeight.body.user.id;

	const responseLoginNine = await request(app).post('/users/login').send({
		email: userNine.email,
		password: userNine.password,
	});
	userNineToken = await responseLoginNine.body.token;
	userNineId = await responseLoginNine.body.user.id;
});

describe('User send invitation', async function () {
	before(async function () {
		const responseCreateWorkspaceUserHeight = await request(app)
			.post(`/workspaces/user/${userHeightId}/create-workspace`)
			.set('Cookie', `token=${userHeightToken}`)
			.send({
				title: 'First Workspace',
				userId: userHeightId,
				description: 'This is the first workspace',
				isDefault: false,
			});
		workspaceUserHeightId = await responseCreateWorkspaceUserHeight.body
			.workspace._id;
	});

	it("Shouldn't send an invitation without token", async function () {
		const response = await request(app)
			.post(`/invitations/send-invitation`)
			.send({
				inviteeId: userNineId,
				workspaceId: workspaceUserHeightId,
			})
			.expect(401);
	});

	it('Should send an invitation', async function () {
		const response = await request(app)
			.post(`/invitations/send-invitation`)
			.set('Cookie', `token=${userHeightToken}`)
			.send({
				inviteeId: userNineId,
				workspaceId: workspaceUserHeightId,
			})
			.expect(200);
		invitationId = await response.body.invitation._id;
	});
});

after(async function () {
	await setupDataBase();
});
