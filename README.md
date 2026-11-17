# Software-Engineering-Mini-Project
# Library Management System

A beginner-friendly, full-stack Library Management System mini project suitable for a college demonstration.

## Features

- Dashboard with total copies, available copies, members, active issues and overdue count
- Add, edit, delete and search books
- Register, search and remove library members
- Issue books to registered members with due dates
- Mark books as returned and update availability automatically
- Overdue labels and circulation history
- Validation for required fields, duplicate ISBNs and duplicate member emails
- Persistent data in `data/library.json`

## Technology Stack

- Frontend: HTML5, CSS3 and vanilla JavaScript
- Backend: Node.js and Express
- Storage: JSON file (no separate database installation required)

## Requirements

Node.js 18 or newer (npm is installed with Node.js).

## Run Locally

Open PowerShell or Terminal in this project folder and execute:

```bash
npm install
npm start
```

On Windows PowerShell, if script execution policy blocks `npm`, use:

```powershell
npm.cmd install
npm.cmd start
```

Open http://localhost:3000. Keep the terminal open while using the app. Press `Ctrl + C` to stop the server.

No login is required. Sample books, members and circulation records are included.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server status |
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/books?q=...` | List or search books |
| POST | `/api/books` | Add a book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Delete a book |
| GET | `/api/members?q=...` | List or search members |
| POST | `/api/members` | Register a member |
| DELETE | `/api/members/:id` | Remove a member |
| GET | `/api/loans` | List issue and return records |
| POST | `/api/loans` | Issue a book |
| PATCH | `/api/loans/:id/return` | Record a return |

## Project Structure

```text
Library-Management-System/
├── data/library.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server/index.js
├── .gitignore
├── package.json
└── README.md
```

## Limitations

This is an educational prototype, not a production system. It has no authentication, role management, fine calculation, barcode support or cloud database. JSON-file storage is intended for a local demonstration, not concurrent multi-user production use. Back up `data/library.json` before experimenting with important data.

## License

No open-source license has been selected yet.
