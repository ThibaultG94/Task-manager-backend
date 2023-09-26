# API Documentation for My Task Manager App

This is the backend API for the Todo List application. This API enables users to create an account, login, and manage their todo items. Users can perform CRUD (Create, Read, Update, Delete) operations on their tasks.

This documentation provides information on the endpoints available, the expected request formats, and the responses.

This API is built using Node.js and Express, and follows RESTful principles.

## Authentication

Before users can interact with their tasks, they need to register for an account and their Login. User authentication is performed via email and password.

Upon successful login, the user is provided with an authentication token. This token must be included in the `Authorization` header in all requests to the task endpoints, as follows:

`Authorization: Bearer <token>`

## Endpoints

### User Endpoints

#### User Registration

-   **URL** : `/users/register`
-   **Method**: `POST`
-   **Description**: Register a new user. A default workspace is created for each new user.
-   **Request body**:

    | Field      | Type   | Description                                  |
    | ---------- | ------ | -------------------------------------------- |
    | `email`    | string | User's email address.                        |
    | `password` | string | User's password.                             |
    | `username` | string | User's username.                             |
    | `role`     | string | User's role (e.g., user, admin, superadmin). |

-   **Success Response**:

    -   **Code**: `201 Created`
    -   **Content**: `{ "message": "User successfully registered and default workspace created" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Email already in use. Please change email address or login." }`

    or

    -   **Code**: `422 Unprocessable Entity`
    -   **Content**: `{ "message": "Invalid input" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Error registering account" }`

#### User Login

-   **URL** : `/users/login`
-   **Method**: `POST`
-   **Description**: Log in a user.
-   **Request body**:

    | Field      | Type   | Description           |
    | ---------- | ------ | --------------------- |
    | `email`    | string | User's email address. |
    | `password` | string | User's password.      |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Authentication successful", "user": {"id": "<User ID>", "username": "<User username>", "email": "<User email>"} }`
    -   **Cookies**: On successful login, two HttpOnly cookies named 'token' and 'refreshToken' are set, containing the JWT token and the refresh token, respectively.

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Identifiants incorrects" }`

    or

    -   **Code**: `401 Unauthorized`
    -   **Content**: `{ "message": "Invalid password" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "User not found" }`

    or

    -   **Code**: `422 Unprocessable Entity`
    -   **Content**: `{ "message": "Invalid input" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

#### User Update

-   **URL** : `/users/:id/update`
-   **Method**: `PUT`
-   **Description**: Update a user.

-   **URL Parameters**:

    | Parameter | Type       | Description              |
    | --------- | ---------- | ------------------------ |
    | `id`      | `ObjectId` | ID of the user to update |

-   **Request body**: At least one of the following fields should be present:

    | Field      | Type   | Description                      |
    | ---------- | ------ | -------------------------------- |
    | `email`    | string | (Optional) User's email address. |
    | `password` | string | (Optional) User's password.      |
    | `username` | string | (Optional) User's username.      |
    | `role`     | string | (Optional) User's role.          |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "User updated", "user": "<User Object>" }`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "User not found" }`

    or

    -   **Code**: `422 Unprocessable Entity`
    -   **Content**: `{ "message": "No fields for update were provided" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

**Notes**:

    1. The user himself or an `admin` or `superadmin` can update the user's data.
    2. A non-superadmin user cannot update an `admin` or `superadmin` user's data.
    3. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### User Deletion

-   **URL** : `/users/:id/delete`
-   **Method**: `DELETE`
-   **Description**: Delete a user.

-   **URL Parameters**:

    | Parameter | Type       | Description              |
    | --------- | ---------- | ------------------------ |
    | `id`      | `ObjectId` | ID of the user to delete |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "User deleted", "user": "<User Object>" }`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "User not found" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. Only the user himself or an `admin` or `superadmin` can delete the user's account.
    2. A non-superadmin user cannot delete an `admin` or `superadmin` user's account.
    3. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Get User Information

-   **URL** : `/users/:id/account`
-   **Method**: `GET`
-   **Description**: Retrieve information about a user.

-   **URL Parameters**:

    | Parameter | Type       | Description                |
    | --------- | ---------- | -------------------------- |
    | `id`      | `ObjectId` | ID of the user to retrieve |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "user": "<User Object without password>" }`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "User not found" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A user can only request his own data, unless they are `admin` or `superadmin`.
    2. An `admin` can request the data of any user, except for other `admin` and `superadmin` user's.
    3. A `superadmin` can request data from any user.
    4. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### User forgot his password

-   **URL** : `/users/auth/forgot-password`
-   **Method**: `POST`
-   **Description**: Reset password with email adress

-   **Request body**:

    | Field   | Type   | Description           |
    | ------- | ------ | --------------------- |
    | `email` | string | User's email address. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Email sent" }`

-   **Error Responses**:

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "No account with that email address exists" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

#### User refresh his token

-   **URL** : `/users/token`
-   **Method**: `POST`
-   **Description**: Refreshes the access token using the refresh token sent in cookies.

-   **Request cookies**:

    | Field          | Type   | Description           |
    | -------------- | ------ | --------------------- |
    | `refreshToken` | string | User's refresh token. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Token refresh successful" }`
    -   **Cookies**: On successful token refresh, two HttpOnly cookies named 'token' and 'refreshToken' are set, containing the new JWT token and the refresh token, respectively.

-   **Error Responses**:

    -   **Code**: `401 Unauthorized`
    -   **Content**: `{ "message": "Refresh token not provided" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "Refresh token not found" }`

    or

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "User not found" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

#### User Logout

-   **URL** : `/users/logout`
-   **Method**: `POST`
-   **Description**: Logs out a user, clearing the refresh token from cookies and the database.

-   **Request cookies**:

    | Field          | Type   | Description           |
    | -------------- | ------ | --------------------- |
    | `refreshToken` | string | User's refresh token. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "User logged out successfully" }`

-   **Error Responses**:

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

**Notes**:

1. To logout a user, send a `POST` request to `/users/logout` with the `refreshToken` in the cookies. No request body is required.
2. This endpoint will clear the `refreshToken` from cookies and delete the corresponding document in the database.

### Task Endpoints

#### Get Task Information

-   **URL** : `/tasks/:id`
-   **Method**: `GET`
-   **Description**: Retrieve information about a specific task.

-   **URL Parameters**:

    | Parameter | Type       | Description                |
    | --------- | ---------- | -------------------------- |
    | `id`      | `ObjectId` | ID of the task to retrieve |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "<Task Object>" }`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "This task does not exist" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A user can only retrieve tasks that they have created.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Get Workspace's Tasks

-   **URL** : `/tasks/workspace/:id`
-   **Method**: `GET`
-   **Description**: Retrieve all tasks associated with a specific workspace.

-   **URL Parameters**:

    | Parameter | Type       | Description                               |
    | --------- | ---------- | ----------------------------------------- |
    | `id`      | `ObjectId` | ID of the workspace to retrieve tasks for |

-   **Query Parameters**:

    | Parameter | Type     | Description                | Default |
    | --------- | -------- | -------------------------- | ------- |
    | `page`    | `Number` | Page number for pagination | 1       |
    | `limit`   | `Number` | Number of tasks per page   | 10      |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `[ "<Task Object>" ]`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "Workspace not found" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A user can only retrieve tasks from a workspace they are a member of.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. This endpoint uses caching. If the tasks are in cache, they will be retrieved from there. Otherwise, they will be retrieved from the database and then cached for future requests.

#### Set Task

-   **URL** : `/tasks`
-   **Method**: `POST`
-   **Description**: Create a new task.

-   **Request body**:

    | Field         | Type   | Description                       |
    | ------------- | ------ | --------------------------------- |
    | `title`       | string | Title of the task.                |
    | `date`        | number | Due date of the task.             |
    | `description` | string | Description of the task.          |
    | `workspace`   | string | ID of the workspace for the task. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "task": "<Task Object>" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Please add a task" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "The specified user does not exist" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A task can be only created by a logged-in user, who is then associated with the task.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. When a new task is created, all cached task keys for this user are invalidated.
    4. The user ID is retrieved from the JWT token, not the request body.

    #### Edit Task

-   **URL** : `/tasks/:id`
-   **Method**: `PUT`
-   **Description**: Update an existing task.

-   **URL Parameters**:

    -   `id` : ID of the task to update.

-   **Request body**:

    | Field           | Type   | Description                          |
    | --------------- | ------ | ------------------------------------ |
    | `title`         | string | Title of the task.                   |
    | `date`          | number | Due date of the task.                |
    | `description`   | string | Description of the task.             |
    | `status`        | string | Status of the task.                  |
    | `estimatedTime` | number | Estimated time to complete the task. |
    | `comments`      | string | Comments on the task.                |
    | `priority`      | string | Priority of the task.                |
    | `workspaceId`   | string | Id of the workspace                  |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Task updated", "task": "<Task Object>" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "This task does not exist" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have the right to modify this task" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A task can only be updated by the user who created it.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Delete Task

-   **URL** : `/tasks/:id`
-   **Method**: `DELETE`
-   **Description**: Delete a task.

-   **URL Parameters**:

    -   `id` : ID of the task to update.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Task deleted `req.params.id`", }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "This task does not exist" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have the right to modify this task" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error", "result": "<Error Details>" }`

    **Notes**:

    1. A task can only be deleted by the user who created it.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

### Workspace Endpoints

#### Get Workspace

-   **URL** : `/workspaces/:id`
-   **Method**: `GET`
-   **Description**: Get a workspace by ID.

-   **URL Parameters**:

    -   `id` : ID of the workspace to get.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "workspace": "<Workspace Object>" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "This workspace does not exist" }`

    or

    -   **Code**: `401 Unauthorized`
    -   **Content**: `{ "message": "User not authenticated" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. A workspace can be accessed only by the user who created it or its members.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Get User Workspaces

-   **URL** : `/workspaces/user/:id`
-   **Method**: `GET`
-   **Description**: Get all workspaces of a specific user.

-   **URL Parameters**:

    -   `id` : ID of the user whose workspaces to get.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "workspaces": "<Array of Workspace Objects>" }`

-   **Error Responses**:

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to perform this action" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. A user can only retrieve their own workspaces.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Create Workspace

-   **URL** : `/workspaces`
-   **Method**: `POST`
-   **Description**: Create a new workspace.

-   **Request body**:

    | Field         | Type   | Description                                         |
    | ------------- | ------ | --------------------------------------------------- |
    | `title`       | string | Title of the workspace.                             |
    | `userId`      | string | User's ID who created the workspace.                |
    | `description` | string | Description of the workspace.                       |
    | `members`     | Array  | Array of user IDs who are members of the workspace. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "workspace": "<Workspace Object>" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Please add a title" }`

    or

    -   **Code**: `404 Not Found`
    -   **Content**: `{ "message": "The specified user does not exist" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Edit Workspace

-   **URL** : `/workspaces/:id`
-   **Method**: `PUT`
-   **Description**: Edit a workspace.

-   **URL Parameters**:

    -   `id` : ID of the workspace to edit.

-   **Request body**:

    | Field         | Type   | Description                                         |
    | ------------- | ------ | --------------------------------------------------- |
    | `title`       | string | Title of the workspace.                             |
    | `userId`      | string | User's ID who created the workspace.                |
    | `description` | string | Description of the workspace.                       |
    | `members`     | Array  | Array of user IDs who are members of the workspace. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Workspace updated", "workspace": "<Workspace Object>" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "This workspace does not exist" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficients rights to perform this action" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. A workspace can only be edited by the user who created it or a member of it.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.

#### Delete Workspace

-   **URL** : `/workspaces/:id`
-   **Method**: `DELETE`
-   **Description**: Delete a workspace.

-   **URL Parameters**:

    -   `id` : ID of the workspace to delete.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Workspace deleted `req.params.id`", }`

    or

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "User removed from workspace `req.params.id`", }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "This workspace does not exist" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have the right to modify this workspace" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "No default workspace found" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. A workspace can only be deleted by a member of the workspace. If the user is not the creator of the workspace, they will only be removed from the workspace, not deleting it.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. When a workspace is deleted, the tasks created by the user within that workspace will be transferred to their default workspace. If the default workspace is the one being deleted, a new default workspace will be created.

### Workspace Endpoints

#### Send Workspace Invitation

-   **URL** : `/invitations/send-invitation`
-   **Method**: `POST`
-   **Description**: Send a workspace invitation.

-   **Request body**:

    | Field         | Type   | Description                                      |
    | ------------- | ------ | ------------------------------------------------ |
    | `workspaceId` | string | Workspace's ID for which the invitation is sent. |
    | `inviteeId`   | string | User's ID who is being invited to the workspace. |

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "<Workspace Invitation Object>" }`

-   **Error Responses**:

    -   **Code**: `401 Unauthorized`
    -   **Content**: `{ "message": "User not authenticated" }`

    or

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Workspace does not exist" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficient rights to send an invitation for this workspace" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. A workspace invitation can only be sent by a member of the workspace or the user who created it.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. The `inviteeId` should be a valid user ID of the user who is to be invited.
    4. The `workspaceId` should be a valid workspace ID for which the invitation is being sent.
    5. The returned object is the invitation object that includes `inviterId`, `inviteeId`, `workspaceId`, and the `status` of the invitation.

    #### Accept Workspace Invitation

-   **URL** : `/invitations/:id/accept`
-   **Method**: `POST`
-   **Description**: Accept a workspace invitation.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Invitation accepted and user added to workspace" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Invitation does not exist or is not pending" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficients rights to accept this invitation" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. An invitation can only be accepted by the user who was invited.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. The `invitationId` should be a valid invitation ID that the user wants to accept.

#### Reject Workspace Invitation

-   **URL** : `/invitations/:id/reject`
-   **Method**: `POST`
-   **Description**: Reject a workspace invitation.

-   **URL Parameters**:

    -   `id` : ID of the invitation to reject.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `{ "message": "Invitation rejected" }`

-   **Error Responses**:

    -   **Code**: `400 Bad Request`
    -   **Content**: `{ "message": "Invitation does not exist or is not pending" }`

    or

    -   **Code**: `403 Forbidden`
    -   **Content**: `{ "message": "You do not have sufficients rights to accept this invitation" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. An invitation can only be rejected by the user who was invited.
    2. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    3. The `invitationId` should be a valid invitation ID that the user wants to reject.

#### List User Invitations

-   **URL** : `/invitations/list`
-   **Method**: `GET`
-   **Description**: List all pending invitations for a user.

-   **Success Response**:

    -   **Code**: `200 OK`
    -   **Content**: `[<Invitation Object>, ...]`

-   **Error Responses**:

    -   **Code**: `401 Unauthorized`
    -   **Content**: `{ "message": "User not authenticated" }`

    or

    -   **Code**: `500 Internal Server Error`
    -   **Content**: `{ "message": "Internal server error" }`

    **Notes**:

    1. The `Authorization` header should contain a valid JWT token in the format `Bearer <JWT>`.
    2. The API returns an array of pending workspace invitation objects associated with the authenticated user.

## Common Errors

The API uses conventional HTTP response codes to indicate the success or failure of an API request.

-   `200 OK`: The request was successful.
-   `201 Created`: The request was successful, and a resource was created as a result.
-   `400 Bad Request`: The server could not understand the request due to invalid syntax.
-   `401 Unauthorized`: The request requires user authentication.
-   `403 Forbidden`: The client does not have access rights to the content.
-   `404 Not Found`: The server can not find the requested resource.
-   `422 Unprocessable Entity`: The server understands the content type of the request, but was unable to process the contained instructions.
-   `500 Internal Server Error`: The server has encountered a situation it doesn't know how to handle.
