import request from 'supertest';
import { app } from '../server';
import {
	userOne,
	userTwo,
	userThree,
	adminOne,
	adminTwo,
	adminThree,
	superAdmin,
	setupDataBase,
} from './testUtils';
import * as chai2 from 'chai';

const expect = chai2.expect;

let userOneId: number = 0,
	userTwoId: number = 0,
	userThreeId: number = 0,
	adminOneId: number = 0,
	adminTwoId: number = 0,
	adminThreeId: number = 0,
	superAdminId: number = 0;

let userOneToken: number = 0,
	userTwoToken: number = 0,
	adminOneToken: number = 0,
	adminTwoToken: number = 0,
	superAdminToken: number = 0;

// setup initial users
before(async () => {
	const responseTwo = await request(app)
		.post('/users/register')
		.send(userTwo);
	userTwoId = await responseTwo.body.user._id;

	const responseThree = await request(app)
		.post('/users/register')
		.send(userThree);
	userThreeId = await responseThree.body.user._id;

	const responseAdminOne = await request(app)
		.post('/users/register')
		.send(adminOne);
	adminOneId = await responseAdminOne.body.user._id;

	const responseAdminThree = await request(app)
		.post('/users/register')
		.send(adminThree);
	adminThreeId = await responseAdminThree.body.user._id;

	const responseSuperAdmin = await request(app)
		.post('/users/register')
		.send(superAdmin);
	superAdminId = await responseSuperAdmin.body.user._id;
});

// ********************* USER TESTS ***************************

// USER REGISTRATION

describe('User Registration', () => {
	it('Should not register a user without email', async () => {
		const userWithoutEmail: any = {
			...userOne,
			email: undefined,
		};
		const response = await request(app)
			.post('/users/register')
			.send(userWithoutEmail)
			.expect(422);
	});

	it('Should not register a user with invalid email format', async () => {
		const userWithInvalidEmail = {
			...userOne,
			email: 'invalid email format',
		};
		const response = await request(app)
			.post('/users/register')
			.send(userWithInvalidEmail)
			.expect(422);
	});

	it('Should register a new user', async () => {
		const response = await request(app)
			.post('/users/register')
			.send(userOne)
			.expect(201);
	});

	it('Should not register a user with an email that is already in use', async () => {
		const response = await request(app)
			.post('/users/register')
			.send(userOne)
			.expect(400);
	});
});

// USER LOGIN

describe('User Login', () => {
	it('Should not login a user without request body', async () => {
		await request(app).post('/users/login').expect(422);
	});

	it('Should not login a user without password', async () => {
		await request(app)
			.post('/users/login')
			.send({
				email: userOne.email,
			})
			.expect(422);
	});

	it('Should not login a user without email', async () => {
		await request(app)
			.post('/users/login')
			.send({
				password: userOne.password,
			})
			.expect(422);
	});

	it('Should not login a user with incorrect password', async () => {
		await request(app)
			.post('/users/login')
			.send({
				email: userOne.email,
				password: 'incorrectPassword',
			})
			.expect(401);
	});

	it('Should not login non-existing user', async () => {
		await request(app)
			.post('/users/login')
			.send({
				email: 'nonexistinguser@example.com',
				password: 'nonexistingpass',
			})
			.expect(404);
	});
});

// USER GET ITS DATA

describe('User get data', () => {
	before(async function () {
		// Login the user and get the token.
		const response = await request(app).post('/users/login').send({
			email: userOne.email,
			password: userOne.password,
		});
		userOneToken = await response.body.token;
		userOneId = await response.body.user.id;
	});
	it("Should not get user's data without token", async () => {
		const response = await request(app)
			.get(`/users/${userOneId}/account`)
			.expect(401);
	});
	it("Should get user's data", async function () {
		const response = await request(app)
			.get(`/users/${userOneId}/account`)
			.set('Cookie', `token=${userOneToken}`)
			.expect(200);
	});
	it("Should not get user's data from an other user", async function () {
		const response = await request(app)
			.get(`/users/${userTwoId}/account`)
			.set('Cookie', `token=${userOneToken}`)
			.expect(403);
	});
	it("Should not get admin's data from a user", async function () {
		const response = await request(app)
			.get(`/users/${adminOneId}/account`)
			.set('Cookie', `token=${userOneToken}`)
			.expect(403);
	});
	it("Should not get superadmin's data from a user", async function () {
		const response = await request(app)
			.get(`/users/${superAdminId}/account`)
			.set('Cookie', `token=${userOneToken}`)
			.expect(403);
	});
});

// USER UPDATE HIS ACCOUNT

describe('User update his account', () => {
	it("Should not update user's data without token", async () => {
		const response = await request(app)
			.put(`/users/${userOneId}/update`)
			.send({ username: 'newUserName', email: 'newmail@test.com' })
			.expect(401);
	});
	it("Should update user's data", async function () {
		const response = await request(app)
			.put(`/users/${userOneId}/update`)
			.set('Cookie', `token=${userOneToken}`)
			.send({ username: 'newUserName', email: 'newmail@test.com' })
			.expect(200);
	});
	it("Should not update user's data from an other user", async function () {
		const response = await request(app)
			.put(`/users/${userTwoId}/update`)
			.set('Cookie', `token=${userOneToken}`)
			.send({ password: 'accounthacked' })
			.expect(403);
	});
	it("Should not update admin's data from a user", async function () {
		const response = await request(app)
			.put(`/users/${adminOneId}/update`)
			.set('Cookie', `token=${userOneToken}`)
			.send({ password: 'userhackedanadmin' })
			.expect(403);
	});
	it("Should not update superadmin's account from a user", async function () {
		const response = await request(app)
			.put(`/users/${superAdminId}/update`)
			.set('Cookie', `token=${userOneToken}`)
			.send({ password: 'userhackedsuperadmin' })
			.expect(403);
	});
});

// USER DELETE HIS ACCOUNT

describe('User delete his account', () => {
	before(async function () {
		// Login the user and get the token.
		const response = await request(app).post('/users/login').send({
			email: userTwo.email,
			password: userTwo.password,
		});
		userTwoToken = await response.body.token;
		userTwoId = await response.body.user.id;
	});

	it("Should not delete user's account without token", async () => {
		const response = await request(app)
			.delete(`/users/${userTwoId}/delete`)
			.expect(401);
	});

	it("Should not delete user's account from an other user", async function () {
		const response = await request(app)
			.delete(`/users/${userOneId}/delete`)
			.set('Cookie', `token=${userTwoToken}`)
			.expect(403);
	});

	it("Should not delete admin's account from a user", async function () {
		const response = await request(app)
			.delete(`/users/${adminOneId}/delete`)
			.set('Cookie', `token=${userTwoToken}`)
			.expect(403);
	});

	it('Should not delete superadmin from user', async function () {
		const response = await request(app)
			.delete(`/users/${superAdminId}/delete`)
			.set('Cookie', `token=${userTwoToken}`)
			.expect(403);
	});

	it("Should delete user's account", async function () {
		const response = await request(app)
			.delete(`/users/${userTwoId}/delete`)
			.set('Cookie', `token=${userTwoToken}`)
			.expect(200);
	});
});

// ********************* ADMIN TESTS ***************************

// ADMIN REGISTRATION

describe('Admin Registration', () => {
	it('Should register an admin user', async () => {
		const response = await request(app)
			.post('/users/register')
			.send(adminTwo)
			.expect(201);
		adminTwoId = await response.body.user._id;
	});
});

// ADMIN LOGIN AND LOGOUT

describe('Admin Login and Logout', () => {
	it('Should login admin user', async () => {
		const response = await request(app)
			.post('/users/login')
			.send({
				email: adminTwo.email,
				password: adminTwo.password,
			})
			.expect(200);
		adminTwoToken = await response.body.token;
		adminTwoId = await response.body.user.id;
	});
});

// ADMIN GET ITS DATA

describe('Admin get data', () => {
	before(async function () {
		// Login the admin and get the token.
		const response = await request(app).post('/users/login').send({
			email: adminOne.email,
			password: adminOne.password,
		});
		adminOneToken = await response.body.token;
		adminOneId = await response.body.user.id;
	});

	it("Should get user's data from an admin", async function () {
		const response = await request(app)
			.get(`/users/${userOneId}/account`)
			.set('Cookie', `token=${adminOneToken}`)
			.expect(200);
	});

	it("Should get admin's account from himself", async function () {
		const response = await request(app)
			.get(`/users/${adminOneId}/account`)
			.set('Cookie', `token=${adminOneToken}`)
			.expect(200);
	});

	it("Should not get admin's data from an other admin", async function () {
		const response = await request(app)
			.get(`/users/${adminTwoId}/account`)
			.set('Cookie', `token=${adminOneToken}`)
			.expect(403);
	});

	it("Should not get superadmin's data from an admin", async function () {
		const response = await request(app)
			.get(`/users/${superAdminId}/account`)
			.set('Cookie', `token=${adminOneToken}`)
			.expect(403);
	});
});

// ADMIN UPDATE

describe('Admin update his account', () => {
	it("Should update user's data from an admin", async function () {
		const response = await request(app)
			.put(`/users/${userOneId}/update`)
			.set('Cookie', `token=${adminOneToken}`)
			.send({ password: 'adminchangethepassword' })
			.expect(200);
	});

	it("Should update admin's account from himself", async function () {
		const response = await request(app)
			.put(`/users/${adminOneId}/update`)
			.set('Cookie', `token=${adminOneToken}`)
			.send({ password: 'wxcvbn' })
			.expect(200);
	});

	it("Should not update admin's account from an other admin", async function () {
		const response = await request(app)
			.put(`/users/${adminTwoId}/update`)
			.set('Cookie', `token=${adminOneToken}`)
			.send({ password: 'adminhackanotheradmin' })
			.expect(403);
	});

	it("Should not update superadmin's account from an admin", async function () {
		const response = await request(app)
			.put(`/users/${superAdminId}/update`)
			.set('Cookie', `token=${adminOneToken}`)
			.send({ password: 'adminhackedsuperadmin' })
			.expect(403);
	});
});

// ADMIN DELETE HIS ACCOUNT

describe('Admin delete his account', () => {
	before(async function () {
		// Login the admin and get the token.
		const response = await request(app).post('/users/login').send({
			email: adminTwo.email,
			password: adminTwo.password,
		});
		adminTwoToken = await response.body.token;
		adminTwoId = await response.body.user.id;
	});

	it('Should delete user account from an admin', async function () {
		const response = await request(app)
			.delete(`/users/${userOneId}/delete`)
			.set('Cookie', `token=${adminTwoToken}`)
			.expect(200);
	});

	it("Should not delete admin's account from an other admin", async function () {
		const response = await request(app)
			.delete(`/users/${adminOneId}/delete`)
			.set('Cookie', `token=${adminTwoToken}`)
			.expect(403);
	});

	it("Should not delete superadmin's account from an admin", async function () {
		const response = await request(app)
			.delete(`/users/${superAdminId}/delete`)
			.set('Cookie', `token=${adminTwoToken}`)
			.expect(403);
	});

	it("Should delete admin's account from himself", async function () {
		const response = await request(app)
			.delete(`/users/${adminTwoId}/delete`)
			.set('Cookie', `token=${adminTwoToken}`)
			.expect(200);
	});
});

// ********************* SUPERADMIN TESTS ***************************

// SUPERADMIN LOGIN AND LOGOUT

describe('SuperAdmin Login', () => {
	it('Should login superadmin', async () => {
		const response = await request(app)
			.post('/users/login')
			.send({
				email: superAdmin.email,
				password: superAdmin.password,
			})
			.expect(200);
		superAdminToken = await response.body.token;
		superAdminId = await response.body.user.id;
	});
});

// SUPERADMIN GET HIS DATA

describe('SuperAdmin update his account', () => {
	it("Should get superadmin's data from himself", async function () {
		const response = await request(app)
			.get(`/users/${superAdminId}/account`)
			.set('Cookie', `token=${superAdminToken}`)
			.expect(200);
	});
});

// SUPERADMIN UPDATE

describe('SuperAdmin update his account', () => {
	it("Should update superadmin's account from himself", async function () {
		const response = await request(app)
			.put(`/users/${superAdminId}/update`)
			.set('Cookie', `token=${superAdminToken}`)
			.send({ password: 'thenewsuperadminpassword' })
			.expect(200);
	});
});

// SUPERADMIN DELETE HIS ACCOUNT

describe('SuperAdmin delete his account', () => {
	it("Should delete superadmin's account from himself", async function () {
		const response = await request(app)
			.delete(`/users/${superAdminId}/delete`)
			.set('Cookie', `token=${superAdminToken}`)
			.expect(200);
	});
});

after(async function () {
	await setupDataBase();
});
