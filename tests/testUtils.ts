import User from '../models/user.model';
import Task from '../models/task.model';
import refreshTokenModel from '../models/refreshToken.model';
import workspaceModel from '../models/workspace.model';
import invitationModel from '../models/invitation.model';
import logger from '../config/logger';

export const userOne = {
	username: 'testuser',
	email: 'test@example.com',
	password: 'Mypassword77',
	role: 'user',
};

export const userTwo = {
	username: 'testusertwo',
	email: 'testtwo@example.com',
	password: 'Mysecondpassword88',
	role: 'user',
};

export const userThree = {
	username: 'testuserthree',
	email: 'testthree@example.com',
	password: 'Mythirdpassword99',
	role: 'user',
};

export const userFour = {
	username: 'testuserfour',
	email: 'testfour@example.com',
	password: 'MyFourthpassword99',
	role: 'user',
};

export const userFive = {
	username: 'testuserfive',
	email: 'testfive@example.com',
	password: 'MyFifthpassword99',
	role: 'user',
};

export const userSix = {
	username: 'testusersix',
	email: 'testsix@example.com',
	password: 'MySixthpassword99',
	role: 'user',
};

export const userSeven = {
	username: 'testuserseven',
	email: 'testseven@example.com',
	password: 'MySeventhpassword99',
	role: 'user',
};

export const userHeight = {
	username: 'testuserheight',
	email: 'testheight@example.com',
	password: 'MyHeigthpassword99',
	role: 'user',
};

export const userNine = {
	username: 'testusernine',
	email: 'testnine@example.com',
	password: 'MyNinenthpassword99',
	role: 'user',
};

export const adminOne = {
	username: 'testadmin',
	email: 'testadmin@example.com',
	password: 'azertyuiop666?',
	role: 'admin',
};

export const adminTwo = {
	username: 'testadmintwo',
	email: 'testadmintwo@example.com',
	password: 'wxcvbn9744µ£',
	role: 'admin',
};

export const adminThree = {
	username: 'testadminthree',
	email: 'testadminthree@example.com',
	password: 'qsdfghjklm644/*ds',
	role: 'admin',
};

export const adminFour = {
	username: 'testadminfour',
	email: 'testadminfour@example.com',
	password: 'qsdfghjklm4588*?oksd',
	role: 'admin',
};

export const adminFive = {
	username: 'testadminfive',
	email: 'testadminfive@example.com',
	password: 'qsdfghjklm123456MLJF???765',
	role: 'admin',
};

export const superAdmin = {
	username: 'superAdmin',
	email: 'superadmin@example.com',
	password: 'therealsuperadminpasswordu93!!!€€€$$$',
	role: 'superadmin',
};

export const superAdminTwo = {
	username: 'superAdminTwo',
	email: 'superadmintwo@example.com',
	password: 'therealsuperadminpasswordu77$$$$',
	role: 'superadmin',
};

// Function for configuring the database in the test environment
export const setupDataBase = async () => {
	try {
		await User.deleteMany(); // Attempt to delete all User documents in the database
		await Task.deleteMany(); // Attempt to delete all Task documents in the database
		await refreshTokenModel.deleteMany();
		await workspaceModel.deleteMany();
		await invitationModel.deleteMany();
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
	}
};
