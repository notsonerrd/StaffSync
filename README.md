# StaffSync – HR Management Solution

StaffSync is a full-stack employee management web application designed to simplify and streamline essential human resource operations. It features a React-based frontend and a Node.js, Express.js, and MongoDB backend.

The application provides role-based access for administrators, HR personnel, and employees. Administrators and HR personnel can manage employee records, while employees can access attendance information, submit leave requests, and view organizational announcements.

## Features

- **JWT-Based Authentication:** Secure login using JSON Web Tokens (JWT), with tokens configured to expire after 24 hours.
- **Dashboard:** Provides an overview of workforce information and key employee management activities.
- **Employee Management:** Supports listing, searching, adding, and deleting employee records, including department, position, and role details.
- **Attendance Management:** Includes a dedicated interface for viewing attendance information.
- **Leave Management:** Provides an interface for submitting leave requests and approving or rejecting applications.
- **Announcements:** Includes a dedicated page for displaying organizational announcements.
- **Role-Based Access:** Provides administrative controls in the user interface for accounts assigned the `admin` or `hr` role.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Lucide React, Create React App |
| Backend | Node.js, Express 5, Mongoose, JSON Web Tokens, bcryptjs, CORS |
| Database | MongoDB Atlas |

## Project Structure

```text
StaffSync/
├── README.md
├── staffsync-backend/
│   ├── server.js
│   ├── reset.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Leave.js
│   │   └── auth.js
│   ├── package.json
│   └── .env
└── staffsync-frontend/
    ├── public/
    └── src/
        ├── App.js
        ├── App.css
        ├── index.css
        ├── index.js
        └── package.json
```

**Key files:**

- `server.js` – Initializes the Express server, configures API routes, and integrates Mongoose.
- `reset.js` – Creates or resets the initial administrator account.
- `middleware/auth.js` – Contains middleware for verifying JWTs.
- `models/User.js` – Defines the user data model.
- `models/Leave.js` – Defines the leave data model.
- `src/App.js` – Contains the frontend application, pages, and routing.
- `src/App.css` and `src/index.css` – Define application-specific and global styles.

The `.env` file contains environment-specific configuration and should not be committed to version control.

## Getting Started

### Prerequisites

Ensure that the following tools and services are available before setting up the project:

- Node.js version 18 or later
- npm (Node Package Manager)
- A MongoDB database, such as a free MongoDB Atlas cluster

### 1. Backend Setup

Navigate to the backend directory and install the required dependencies:

```bash
cd staffsync-backend
npm install
```

Create a `.env` file in the `staffsync-backend` directory and configure the following environment variables:

```env
PORT=5000
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<a long, random secret>
```

Replace the placeholder values with your MongoDB connection string and a strong, randomly generated JWT secret.

Start the backend server:

```bash
node server.js
```

The API will be available at:

`http://localhost:5000`

#### Create the Initial Administrator Account

Before creating the administrator account, update the email address and password in `reset.js` with the intended credentials. Then execute:

```bash
node reset.js
```

This script is intended to initialize or reset the administrator account. Review its implementation before running it to understand its effect on existing data.

### 2. Frontend Setup

Open a separate terminal and navigate to the frontend directory:

```bash
cd staffsync-frontend
npm install
```

Start the React development server:

```bash
npm start
```

The frontend will be available at:

`http://localhost:3000`

#### Configure the Backend API URL

By default, the frontend is configured to communicate with the deployed backend on Render. To connect it to a locally running backend, create a `.env` file in the `staffsync-frontend` directory with the following configuration:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Restart the frontend development server after changing environment variables.

## API Endpoints

| HTTP Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Authenticates a user and returns a JWT with user information. |
| GET | `/api/employees` | Retrieves the employee list. |
| POST | `/api/employees` | Creates a new employee record. |
| DELETE | `/api/employees/:id` | Deletes an employee record by ID. |
| GET / POST | `/api/leaves` | Placeholder endpoints for retrieving and submitting leave requests. |
| GET | `/api/attendance` | Placeholder endpoint for retrieving attendance records. |
| GET | `/api/announcements` | Placeholder endpoint for retrieving announcements. |
| GET | `/api/trainings` | Placeholder endpoint for retrieving training information. |

**Note:** The availability of an endpoint does not necessarily mean its functionality is complete. The placeholder endpoints currently return empty lists and require further implementation.

## Frontend Routes

The application provides the following routes:

| Route | Purpose |
|---|---|
| `/login` | User authentication |
| `/` | Main dashboard |
| `/employees` | Employee management |
| `/attendance` | Attendance information |
| `/leaves` | Leave management |
| `/announcements` | Organizational announcements |

All listed routes except `/login` require the user to be logged in.

## Deployment

### Backend Deployment

The backend is deployed on Render and reads the following environment variables from the hosting environment:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`

On Render's free service tier, inactive instances may enter a sleep state. Consequently, the first request after a period of inactivity may take approximately 30 seconds or longer to complete.

### Frontend Deployment

The frontend can be deployed to a static hosting provider such as Netlify, Vercel, or Render Static Sites.

Generate the production build using:

```bash
npm run build
```

Configure the `REACT_APP_API_URL` environment variable with the URL of the deployed backend API before building and deploying the application.

## Known Issues and Future Improvements

The project requires further improvements in security, code organization, and backend functionality. The following areas should be addressed:

- **Dependency Management:** Remove committed `node_modules` directories and rely on package manifests and lockfiles for dependency installation.
- **Environment Security:** Remove exposed credentials and secrets from version control, rotate any credentials that may have been exposed, and use environment variables for sensitive configuration.
- **Frontend Configuration:** Review the placement of the frontend `package.json` and ensure that dependencies and scripts are configured correctly.
- **Code Organization:** Review unused models and middleware, including duplicate authentication-related files, and remove or consolidate unnecessary code.
- **API Authorization:** Implement and verify server-side authentication and role-based authorization for protected endpoints. Hiding administrative controls in the frontend alone does not secure the API.
- **Backend Functionality:** Implement database-backed attendance tracking, leave processing, announcements, and training management.
- **Validation and Error Handling:** Add appropriate input validation, consistent error responses, and safeguards for employee and administrative operations.
- **Testing:** Introduce automated tests for authentication, employee management, access permissions, and other critical workflows.

These improvements will help make StaffSync more secure, maintainable, and suitable for further development.

## License

This project is licensed under the ISC License. Refer to the project's license file for the applicable terms and conditions.
