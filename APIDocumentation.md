# Task Manager API Documentation

## Authentication

To interact with tasks, users must register and log in. User authentication is done via email and password. Upon successful login, an authentication token is provided and must be included in the `Authorization` header of all subsequent requests.

**Authorization header format:**

## User Endpoints

### User Registration

- **URL** : `/users/register`
- **Method** : `POST`
- **Description** : Register a new user. A default workspace is created for each new user.
- **Request body** :

  | Field      | Type   | Description                      |
  | ---------- | ------ | -------------------------------- |
  | `email`    | string | User's email address.            |
  | `password` | string | User's password.                 |
  | `username` | string | User's username.                 |
  | `role`     | string | User's role (e.g., user, admin). |

- **Success Response** :

  - **Code** : `201 Created`
  - **Content** : `{ "message": "User successfully registered and default workspace created" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Email already in use. Please change email address or login." }`

  - **Code** : `422 Unprocessable Entity`
  - **Content** : `{ "message": "Invalid input" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error registering account" }`

### User Login

- **URL** : `/users/login`
- **Method** : `POST`
- **Description** : Log in a user.
- **Request body** :

  | Field      | Type   | Description           |
  | ---------- | ------ | --------------------- |
  | `email`    | string | User's email address. |
  | `password` | string | User's password.      |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Authentication successful", "user": {"id": "<User ID>", "username": "<User username>", "email": "<User email>"} }`
  - **Cookies** : Two HttpOnly cookies named `token` and `refreshToken` are set, containing the JWT and the refresh token respectively.

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Invalid credentials" }`

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "Invalid password" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `422 Unprocessable Entity`
  - **Content** : `{ "message": "Invalid input" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

### Update User Information

- **URL** : `/users/:id/update`
- **Method** : `PUT`
- **Description** : Update a user's information.
- **URL Parameters** :

  | Parameter | Type       | Description              |
  | --------- | ---------- | ------------------------ |
  | `id`      | `ObjectId` | ID of the user to update |

- **Request body** : At least one of the following fields should be present:

  | Field      | Type   | Description                      |
  | ---------- | ------ | -------------------------------- |
  | `email`    | string | (Optional) User's email address. |
  | `password` | string | (Optional) User's password.      |
  | `username` | string | (Optional) User's username.      |
  | `role`     | string | (Optional) User's role.          |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "User updated", "user": "<User Object>" }`

- **Error Responses** :

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `422 Unprocessable Entity`
  - **Content** : `{ "message": "No fields for update were provided" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

**Notes**:

1. The user themselves, an `admin`, or a `superadmin` can update the user's data.
2. A non-superadmin user cannot update an `admin` or `superadmin` user's data.
3. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### User Logout

- **URL** : `/users/logout`
- **Method** : `POST`
- **Description** : Logs out a user, clearing the refresh token from cookies and the database.
- **Request Cookies** :

  | Field          | Type   | Description           |
  | -------------- | ------ | --------------------- |
  | `refreshToken` | string | User's refresh token. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "User logged out successfully" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

**Notes**:

1. To logout a user, send a `POST` request to `/users/logout` with the `refreshToken` in the cookies. No request body is required.
2. This endpoint will clear the `refreshToken` from cookies and delete the corresponding document in the database.

### Forgot Password

- **URL** : `/users/auth/forgot-password`
- **Method** : `POST`
- **Description** : Reset password via email.
- **Request body** :

  | Field   | Type   | Description           |
  | ------- | ------ | --------------------- |
  | `email` | string | User's email address. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Email sent" }`

- **Error Responses** :

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "No account with that email address exists" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

### Refresh Token

- **URL** : `/users/token`
- **Method** : `POST`
- **Description** : Refresh access token using the refresh token sent in cookies.
- **Request Cookies** :

  | Field          | Type   | Description           |
  | -------------- | ------ | --------------------- |
  | `refreshToken` | string | User's refresh token. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Token refresh successful", "token": "<New Token>" }`
  - **Cookies** : Two HttpOnly cookies named `token` and `refreshToken` are set, containing the new JWT and refresh token respectively.

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "Refresh token not provided" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Refresh token not found" }`

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

### Get User Information

- **URL** : `/users/:id/account`
- **Method** : `GET`
- **Description** : Retrieve information about a user.
- **URL Parameters** :

  | Parameter | Type       | Description                |
  | --------- | ---------- | -------------------------- |
  | `id`      | `ObjectId` | ID of the user to retrieve |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "user": "<User Object without password>" }`

- **Error Responses** :

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "result": "<Error Details>" }`

**Notes**:

1. A user can only request their own data, unless they are `admin` or `superadmin`.
2. An `admin` can request the data of any user, except for other `admin` and `superadmin` users.
3. A `superadmin` can request data from any user.
4. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

## Workspace Endpoints

### Get Workspace

- **URL** : `/workspaces/:id`
- **Method** : `GET`
- **Description** : Get a workspace by ID.
- **URL Parameters** :

  | Parameter | Type       | Description                |
  | --------- | ---------- | -------------------------- |
  | `id`      | `ObjectId` | ID of the workspace to get |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspace": "<Workspace Object>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "This workspace does not exist" }`

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

**Notes**:

1. A workspace can be accessed only by the user who created it or its members.
2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### Get User Workspaces

- **URL** : `/workspaces/user/:id`
- **Method** : `GET`
- **Description** : Get all workspaces of a specific user.
- **URL Parameters** :

  | Parameter | Type       | Description                            |
  | --------- | ---------- | -------------------------------------- |
  | `id`      | `ObjectId` | ID of the user whose workspaces to get |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspaces": "<Array of Workspace Objects>" }`

- **Error Responses** :

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

**Notes**:

1. A user can only retrieve their own workspaces.
2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### Create Workspace

- **URL** : `/workspaces`
- **Method** : `POST`
- **Description** : Create a new workspace.
- **Request body** :

  | Field         | Type   | Description                                         |
  | ------------- | ------ | --------------------------------------------------- |
  | `title`       | string | Title of the workspace.                             |
  | `userId`      | string | User's ID who created the workspace.                |
  | `description` | string | Description of the workspace.                       |
  | `members`     | Array  | Array of user IDs who are members of the workspace. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspace": "<Workspace Object>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Please add a title" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "The specified user does not exist" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

**Notes**:

1. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### Edit Workspace

- **URL** : `/workspaces/:id`
- **Method** : `PUT`
- **Description** : Edit a workspace.
- **URL Parameters** :

  | Parameter | Type       | Description                 |
  | --------- | ---------- | --------------------------- |
  | `id`      | `ObjectId` | ID of the workspace to edit |

- **Request body** :

  | Field         | Type   | Description                                         |
  | ------------- | ------ | --------------------------------------------------- |
  | `title`       | string | Title of the workspace.                             |
  | `userId`      | string | User's ID who created the workspace.                |
  | `description` | string | Description of the workspace.                       |
  | `members`     | Array  | Array of user IDs who are members of the workspace. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Workspace updated", "workspace": "<Workspace Object>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "This workspace does not exist" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

**Notes**:

1. A workspace can only be edited by the user who created it or a member of it.
2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### Delete Workspace

- **URL** : `/workspaces/:id`
- **Method** : `DELETE`
- **Description** : Delete a workspace.
- **URL Parameters** :

  | Parameter | Type       | Description                   |
  | --------- | ---------- | ----------------------------- |
  | `id`      | `ObjectId` | ID of the workspace to delete |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Workspace deleted <id>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "This workspace does not exist" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "You do not have sufficient rights to perform this action" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

**Notes**:

1. A workspace can only be deleted by a member of the workspace. If the user is not the creator of the workspace, they will only be removed from the workspace, not deleting it.
2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
3. When a workspace is deleted, the tasks created by the user within that workspace will be transferred to their default workspace. If the default workspace is the one being deleted, a new default workspace will be created.

## Task Endpoints

### Create Task

- **URL** : `/tasks`
- **Method** : `POST`
- **Description** : Create a new task.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field         | Type   | Description                                   |
  | ------------- | ------ | --------------------------------------------- |
  | `title`       | string | Title of the task.                            |
  | `description` | string | Description of the task.                      |
  | `dueDate`     | string | Due date of the task in ISO format.           |
  | `priority`    | string | Priority level (low, medium, high).           |
  | `status`      | string | Status of the task (todo, in-progress, done). |
  | `workspaceId` | string | ID of the workspace this task belongs to.     |

- **Success Response** :

  - **Code** : `201 Created`
  - **Content** : `{ "message": "Task created successfully", "task": "<Task Object>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Invalid input data" }`

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "User does not have permission to create a task in this workspace" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error creating task" }`

### Get All Tasks

- **URL** : `/tasks`
- **Method** : `GET`
- **Description** : Retrieve all tasks for the authenticated user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving tasks" }`

### Get Task

- **URL** : `/tasks/:id`
- **Method** : `GET`
- **Description** : Retrieve a task by its ID.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                |
  | --------- | ---------- | -------------------------- |
  | `id`      | `ObjectId` | ID of the task to retrieve |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "task": "<Task Object>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "User does not have permission to view this task" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Task not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving task" }`

### Update Task

- **URL** : `/tasks/:id`
- **Method** : `PUT`
- **Description** : Update a task by its ID.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description              |
  | --------- | ---------- | ------------------------ |
  | `id`      | `ObjectId` | ID of the task to update |

- **Request Body** : At least one of the following fields should be present:

  | Field         | Type   | Description                         |
  | ------------- | ------ | ----------------------------------- |
  | `title`       | string | (Optional) Title of the task.       |
  | `description` | string | (Optional) Description of the task. |
  | `dueDate`     | string | (Optional) Due date in ISO format.  |
  | `priority`    | string | (Optional) Priority level.          |
  | `status`      | string | (Optional) Status of the task.      |
  | `workspaceId` | string | (Optional) ID of the workspace.     |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Task updated successfully", "task": "<Task Object>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Invalid input data" }`

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "User does not have permission to update this task" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Task not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error updating task" }`

### Delete Task

- **URL** : `/tasks/:id`
- **Method** : `DELETE`
- **Description** : Delete a task by its ID.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description              |
  | --------- | ---------- | ------------------------ |
  | `id`      | `ObjectId` | ID of the task to delete |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "message": "Task deleted successfully" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `403 Forbidden`
  - **Content** : `{ "message": "User does not have permission to delete this task" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Task not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error deleting task" }`

### Get Urgent Tasks

- **URL** : `/tasks/:userId/urgent`
- **Method** : `GET`
- **Description** : Get the three most urgent tasks for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                            |
  | --------- | ---------- | -------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get urgent tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Urgent Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving urgent tasks" }`

### Get All Tasks for a User

- **URL** : `/tasks/:userId/all-tasks`
- **Method** : `GET`
- **Description** : Get all tasks for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                         |
  | --------- | ---------- | ----------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get all tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving all tasks" }`

### Get Overdue Tasks

- **URL** : `/tasks/:userId/overdue`
- **Method** : `GET`
- **Description** : Get all overdue tasks for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                             |
  | --------- | ---------- | --------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get overdue tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Overdue Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving overdue tasks" }`

### Get Today's Tasks

- **URL** : `/tasks/:userId/today`
- **Method** : `GET`
- **Description** : Get all tasks due today for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                             |
  | --------- | ---------- | --------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get today's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Today's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving today's tasks" }`

### Get Tomorrow's Tasks

- **URL** : `/tasks/:userId/tomorrow`
- **Method** : `GET`
- **Description** : Get all tasks due tomorrow for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                |
  | --------- | ---------- | ------------------------------------------ |
  | `userId`  | `ObjectId` | ID of the user to get tomorrow's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Tomorrow's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving tomorrow's tasks" }`

### Get This Week's Tasks

- **URL** : `/tasks/:userId/this-week`
- **Method** : `GET`
- **Description** : Get all tasks due this week for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                 |
  | --------- | ---------- | ------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get this week's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of This Week's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving this week's tasks" }`

### Get Next Week's Tasks

- **URL** : `/tasks/:userId/next-week`
- **Method** : `GET`
- **Description** : Get all tasks due next week for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                 |
  | --------- | ---------- | ------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get next week's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Next Week's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving next week's tasks" }`

### Get This Month's Tasks

- **URL** : `/tasks/:userId/this-month`
- **Method** : `GET`
- **Description** : Get all tasks due this month for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                  |
  | --------- | ---------- | -------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get this month's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of This Month's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving this month's tasks" }`

### Get Next Month's Tasks

- **URL** : `/tasks/:userId/next-month`
- **Method** : `GET`
- **Description** : Get all tasks due next month for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                  |
  | --------- | ---------- | -------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get next month's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Next Month's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving next month's tasks" }`

### Get This Year's Tasks

- **URL** : `/tasks/:userId/this-year`
- **Method** : `GET`
- **Description** : Get all tasks due this year for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                 |
  | --------- | ---------- | ------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get this year's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of This Year's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving this year's tasks" }`

### Get Next Year's Tasks

- **URL** : `/tasks/:userId/next-year`
- **Method** : `GET`
- **Description** : Get all tasks due next year for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                                 |
  | --------- | ---------- | ------------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get next year's tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Next Year's Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving next year's tasks" }`

### Get Becoming Tasks

- **URL** : `/tasks/:userId/becoming`
- **Method** : `GET`
- **Description** : Get all becoming tasks for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                              |
  | --------- | ---------- | ---------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get becoming tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Becoming Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving becoming tasks" }`

### Get Archived Tasks

- **URL** : `/tasks/:userId/archived`
- **Method** : `GET`
- **Description** : Get all archived tasks for a specific user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **URL Parameters** :

  | Parameter | Type       | Description                              |
  | --------- | ---------- | ---------------------------------------- |
  | `userId`  | `ObjectId` | ID of the user to get archived tasks for |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "tasks": "<Array of Archived Task Objects>" }`

- **Error Responses** :

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Error retrieving archived tasks" }`

## Invitation Endpoints

### Send Invitation

- **URL** : `/invitations/send-invitation`
- **Method** : `POST`
- **Description** : Send an invitation to another user.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field        | Type   | Description                            |
  | ------------ | ------ | -------------------------------------- |
  | `senderId`   | string | ID of the user sending the invitation. |
  | `guestEmail` | string | Email of the user to invite.           |
  | `message`    | string | Message to include in the invitation.  |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "invitations": "<Array of Invitation Objects>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "User does not exist" }`

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "You cannot send an invitation to yourself" }`

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation already sent to this user" }`

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation already received from this user" }`

  - **Code** : `401 Unauthorized\*\*
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Retrieve Sent Invitations

- **URL** : `/invitations/sentout-invitations/:id`
- **Method** : `GET`
- **Description** : Retrieve all invitations sent by a user.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `id`      | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "invitations": "<Array of Invitation Objects>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Retrieve Received Invitations

- **URL** : `/invitations/received-invitations/:id`
- **Method** : `GET`
- **Description** : Retrieve all invitations received by a user.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `id`      | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "invitations": "<Array of Invitation Objects>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Accept Invitation

- **URL** : `/invitations/:invitationId/accept`
- **Method** : `PUT\*\*
- **Description** : Accept an invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field    | Type   | Description               |
  | -------- | ------ | ------------------------- |
  | `userId` | string | ID of the user accepting. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "invitations": "<Array of Invitation Objects>", "userContacts": "<Array of User Contact Objects>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is not pending" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to accept this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Decline Invitation

- **URL** : `/invitations/:invitationId/decline`
- **Method** : `PUT\*\*
- **Description** : Decline an invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field    | Type   | Description               |
  | -------- | ------ | ------------------------- |
  | `userId` | string | ID of the user declining. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "invitations": "<Array of Invitation Objects>", "message": "Invitation declined" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is not pending" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to decline this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Cancel Invitation

- **URL** : `/invitations/:invitationId/cancel`
- **Method** : `DELETE\*\*
- **Description** : Cancel an invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "invitations": "<Array of Invitation Objects>", "message": "Invitation cancelled" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is already accepted" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to cancel this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

## Workspace Invitation Endpoints

### Send Workspace Invitation

- **URL** : `/workspaceInvitations/send-invitation`
- **Method** : `POST`
- **Description** : Send an invitation to join a workspace.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field         | Type   | Description                            |
  | ------------- | ------ | -------------------------------------- |
  | `senderId`    | string | ID of the user sending the invitation. |
  | `guestId`     | string | ID of the user to invite.              |
  | `role`        | string | Role to assign to the invited user.    |
  | `workspaceId` | string | ID of the workspace to invite to.      |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>", "workspaces": "<Array of Workspace Objects>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "User does not exist" }`

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "You cannot send an invitation to yourself" }`

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Workspace does not exist" }`

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "You cannot send an invitation to the default workspace" }`

  - **Code** : `401 Unauthorized`
  - **Content** : `{ "message": "User not authenticated" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

### Retrieve Sent Workspace Invitations

- **URL** : `/workspaceInvitations/sentout-invitations/:id`
- **Method** : `GET`
- **Description** : Retrieve all workspace invitations sent by a user.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `id`      | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error" }`

### Retrieve Received Workspace Invitations

- **URL** : `/workspaceInvitations/received-invitations/:id`
- **Method** : `GET`
- **Description** : Retrieve all workspace invitations received by a user.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `id`      | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Accept Workspace Invitation

- **URL** : `/workspaceInvitations/:invitationId/accept`
- **Method** : `PUT\*\*
- **Description** : Accept a workspace invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field    | Type   | Description               |
  | -------- | ------ | ------------------------- |
  | `userId` | string | ID of the user accepting. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>", "message": "Workspace invitation accepted", "workspaces": "<Array of Workspace Objects>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is not pending" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to accept this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Decline Workspace Invitation

- **URL** : `/workspaceInvitations/:invitationId/decline`
- **Method** : `PUT\*\*
- **Description** : Decline a workspace invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field    | Type   | Description               |
  | -------- | ------ | ------------------------- |
  | `userId` | string | ID of the user declining. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>", "message": "Invitation declined" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is not pending" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to decline this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

### Cancel Workspace Invitation

- **URL** : `/workspaceInvitations/:invitationId/cancel`
- **Method** : `DELETE\*\*
- **Description** : Cancel a workspace invitation.
- **URL Parameters** :

  | Parameter      | Type       | Description           |
  | -------------- | ---------- | --------------------- |
  | `invitationId` | `ObjectId` | ID of the invitation. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "workspaceInvitations": "<Array of Workspace Invitation Objects>", "message": "Invitation cancelled and member removed from workspace", "workspaces": "<Array of Workspace Objects>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Invitation does not exist or is already accepted" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "You do not have sufficient rights to cancel this invitation" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error" }`

## Notification Endpoints

### Set Notification

- **URL** : `/notifications/set-notification`
- **Method** : `POST`
- **Description** : Set a new notification.
- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field         | Type   | Description                                                   |
  | ------------- | ------ | ------------------------------------------------------------- |
  | `creatorId`   | string | ID of the user creating the notification.                     |
  | `taskId`      | string | (Optional) ID of the task related to the notification.        |
  | `workspaceId` | string | (Optional) ID of the workspace related to the notification.   |
  | `type`        | string | Type of the notification (e.g., taskUpdate, workspaceUpdate). |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "notificationsIds": "<Array of Notification IDs>" }`

- **Error Responses** :

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Task ID is required for this type of notification" }`

  - **Code** : `400 Bad Request`
  - **Content** : `{ "message": "Workspace ID is required for this type of notification" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Task not found" }`

  - **Code** : `404 Not Found`
  - **Content** : `{ "message": "Workspace not found" }`

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`

### Get All Notifications

- **URL** : `/notifications/:userId/get-all-notifications`
- **Method** : `GET`
- **Description** : Retrieve all notifications for a specific user with pagination.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `userId`  | `ObjectId` | ID of the user. |

- **Query Parameters** :

  | Parameter | Type   | Description                                           |
  | --------- | ------ | ----------------------------------------------------- |
  | `page`    | number | (Optional) Page number for pagination (default is 1). |
  | `limit`   | number | (Optional) Number of items per page (default is 10).  |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "notifications": "<Array of Notification Objects>", "totalNumberOfNotifications": "<Total Number of Notifications>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`

### Get Notifications

- **URL** : `/notifications/get-notifications/:userId`
- **Method** : `GET`
- **Description** : Retrieve notifications for a specific user.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `userId`  | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK`
  - **Content** : `{ "newNotifications": "<Array of New Notification Objects>", "earlierNotifications": "<Array of Earlier Notification Objects>" }`

- **Error Responses** :

  - **Code** : `500 Internal Server Error`
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`

### Mark Notifications as Viewed

- **URL** : `/notifications/mark-viewed/:userId`
- **Method** : `PUT\*\*
- **Description** : Mark multiple notifications as viewed.
- **URL Parameters** :

  | Parameter | Type       | Description     |
  | --------- | ---------- | --------------- |
  | `userId`  | `ObjectId` | ID of the user. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field              | Type  | Description                                  |
  | ------------------ | ----- | -------------------------------------------- |
  | `notificationsIds` | array | Array of notification IDs to mark as viewed. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "message": "Notifications updated" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Notifications IDs are required" }`

  - **Code** : `404 Not Found\*\*
  - **Content** : `{ "message": "User not found" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`

### Mark Notification as Read

- **URL** : `/notifications/mark-read/:notificationId`
- **Method** : `PUT\*\*
- **Description** : Mark a single notification as read.
- **URL Parameters** :

  | Parameter        | Type       | Description             |
  | ---------------- | ---------- | ----------------------- |
  | `notificationId` | `ObjectId` | ID of the notification. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Request Body** :

  | Field    | Type   | Description                                      |
  | -------- | ------ | ------------------------------------------------ |
  | `userId` | string | ID of the user marking the notification as read. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "message": "Notification marked as read" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Notification ID is required" }`

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "User ID is required" }`

  - **Code** : `404 Not Found\*\*
  - **Content** : `{ "message": "Notification not found" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "User is not allowed to access this notification" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`

### Delete Notification

- **URL** : `/notifications/delete-notification/:notificationId`
- **Method** : `DELETE\*\*
- **Description** : Delete a notification.
- **URL Parameters** :

  | Parameter        | Type       | Description             |
  | ---------------- | ---------- | ----------------------- |
  | `notificationId` | `ObjectId` | ID of the notification. |

- **Request Headers** :

  | Header          | Type   | Description                       |
  | --------------- | ------ | --------------------------------- |
  | `Authorization` | string | Bearer token obtained from login. |

- **Success Response** :

  - **Code** : `200 OK\*\*
  - **Content** : `{ "message": "Notification deleted" }`

- **Error Responses** :

  - **Code** : `400 Bad Request\*\*
  - **Content** : `{ "message": "Notification ID is required" }`

  - **Code** : `404 Not Found\*\*
  - **Content** : `{ "message": "Notification not found" }`

  - **Code** : `403 Forbidden\*\*
  - **Content** : `{ "message": "User is not allowed to access this notification" }`

  - **Code** : `500 Internal Server Error\*\*
  - **Content** : `{ "message": "Internal server error", "error": "<Error Details>" }`
